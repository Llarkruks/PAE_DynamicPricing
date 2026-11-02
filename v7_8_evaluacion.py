
"""STADIUM IQ V7.8 - Evaluacion independiente de politicas.

Requiere en la raiz:
    multisport_v7.py
    dataset_multideporte_EQUIPO.csv
    generar_dataset.py (original de Aurora)

Ejecutar:
    python v7_8_evaluacion.py

No sobrescribe los modelos entrenados ni modifica React.
"""

import importlib.util

import numpy as np
import pandas as pd

from sklearn.model_selection import GroupShuffleSplit

from multisport_v7 import (
    ROOT,
    build_model,
    encode_features,
    load_dataset,
    predict_sales,
)


SEED = 42
RESULTS = ROOT / "v7_8_resultados.csv"
DETAIL = ROOT / "v7_8_detalle.csv"


def load_generator():
    """Carga la funcion original del generador de Aurora."""

    candidates = [
        ROOT / "generar_dataset.py",
        ROOT / "src" / "generar_dataset.py",
    ]

    script = next(
        (p for p in candidates if p.is_file()),
        None,
    )

    if script is None:
        raise FileNotFoundError(
            "Copia generar_dataset.py del ZIP de Aurora "
            "a la raiz del proyecto."
        )

    spec = importlib.util.spec_from_file_location(
        "aurora_generator",
        script,
    )

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    return module


def replay_latent_parameters(generator, original):
    """
    Regenera los datos con la semilla original.

    Captura los parametros ocultos del simulador,
    pero no se los entrega a XGBoost.
    """

    calls = []

    real_function = generator.hidden_demand_mean

    def collect(**kwargs):
        calls.append(kwargs.copy())
        return real_function(**kwargs)

    generator.hidden_demand_mean = collect

    try:
        regenerated = generator.generate(
            n_events=120,
            days=30,
            seed=42,
        )
    finally:
        generator.hidden_demand_mean = real_function

    columns = [
        "snapshot_id",
        "event_id",
        "ticket_category_id",
        "days_remaining",
        "current_price",
        "sales_next_period",
    ]

    a = regenerated[columns].reset_index(drop=True)
    b = original[columns].reset_index(drop=True)

    try:
        pd.testing.assert_frame_equal(
            a,
            b,
            check_dtype=False,
            atol=1e-6,
        )
    except AssertionError as exc:
        raise ValueError(
            "El CSV no coincide con el generador "
            "original de semilla 42. Comprueba que "
            "ambos archivos son de la misma version."
        ) from exc

    if len(calls) != len(original):
        raise ValueError(
            "Numero de registros latentes inesperado."
        )

    return {
        sid: params
        for sid, params in zip(
            regenerated["snapshot_id"],
            calls,
        )
    }


def update_state(row, stock, history, earned):
    """Actualiza el estado comercial del dia."""

    row = row.copy()

    capacity = float(row["category_capacity"])

    ratio = (
        stock / capacity
        if capacity > 0 else 0
    )

    row["remaining_capacity"] = stock
    row["cumulative_sales"] = capacity - stock
    row["occupancy_rate"] = 1 - ratio

    row["sales_last_period"] = (
        history[-1] if history else 0
    )

    row["sales_velocity"] = (
        float(np.mean(history[-7:]))
        if history else 0
    )

    row["remaining_capacity_pct"] = ratio

    row["is_low_availability"] = int(
        ratio <= 0.1
    )

    row["scarcity_level"] = (
        "critical" if ratio <= 0.1
        else "high" if ratio <= 0.3
        else "medium" if ratio <= 0.6
        else "low"
    )

    row["revenue_so_far"] = earned

    row["revenue_per_capacity"] = (
        earned / capacity
        if capacity > 0 else 0
    )

    return row


def evaluate_scenario(
    generator,
    params,
    price,
    rng,
    stock,
):
    """Simula las ventas utilizando la formula de Aurora."""

    kwargs = dict(params)
    kwargs["price"] = float(price)

    mean = generator.hidden_demand_mean(**kwargs)

    random_multiplier = float(
        rng.gamma(
            shape=9.0,
            scale=1.0 / 9.0,
        )
    )

    potential = int(
        rng.poisson(mean * random_multiplier)
    )

    return min(potential, int(stock))


def simulate_category(
    rows,
    latent,
    generator,
    model,
    columns,
    policy,
    seed,
):
    """Simula toda la venta de una categoria."""

    rows = rows.sort_values(
        "days_remaining",
        ascending=False,
    )

    first = rows.iloc[0]

    capacity = int(first["category_capacity"])
    stock = capacity

    fixed_price = float(first["base_price"])

    rng = np.random.default_rng(seed)

    history = []
    earned = 0.0
    detail = []

    for _, snapshot in rows.iterrows():

        if stock <= 0:
            break

        state = update_state(
            snapshot,
            stock,
            history,
            earned,
        )

        low = float(state["min_price"])
        high = float(state["max_price"])

        if policy == "precio_fijo":

            price = float(
                np.clip(
                    fixed_price,
                    low,
                    high,
                )
            )

        else:

            prices = np.linspace(
                low,
                high,
                51,
            )

            candidates = pd.DataFrame(
                [state.to_dict()] * len(prices)
            )

            candidates["current_price"] = prices

            for i, p in enumerate(prices):

                candidates.at[
                    i, "price_vs_base"
                ] = (
                    p / float(state["base_price"]) - 1
                )

                candidates.at[
                    i, "discount_active"
                ] = int(
                    p < float(state["base_price"])
                )

                candidates.at[
                    i, "remaining_revenue_potential"
                ] = stock * p

            x = encode_features(
                candidates,
                columns,
            )

            forecast = predict_sales(
                model,
                x,
                np.full(len(prices), stock),
                "rate",
            )

            best = int(
                np.argmax(prices * forecast)
            )

            price = float(prices[best])

        sold = evaluate_scenario(
            generator,
            latent[str(snapshot["snapshot_id"])],
            price,
            rng,
            stock,
        )

        earned += price * sold
        stock -= sold
        history.append(sold)

        detail.append({
            "event_id": str(first["event_id"]),
            "ticket_category_id": str(
                first["ticket_category_id"]
            ),
            "policy": policy,
            "days_remaining": int(
                snapshot["days_remaining"]
            ),
            "price": round(price, 2),
            "actual_simulated_sales": sold,
            "remaining": stock,
            "revenue_cumulative": round(
                earned, 2
            ),
        })

    return (
        earned,
        sum(history),
        stock,
        detail,
    )


def main():

    df = load_dataset().reset_index(drop=True)

    generator = load_generator()

    latent = replay_latent_parameters(
        generator,
        df,
    )

    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=0.2,
        random_state=SEED,
    )

    tr_idx, te_idx = next(
        splitter.split(
            df,
            groups=df["event_id"],
        )
    )

    train = df.iloc[tr_idx]
    test = df.iloc[te_idx]

    assert set(train["event_id"]).isdisjoint(
        set(test["event_id"])
    )

    x = encode_features(train)

    columns = x.columns.tolist()

    remaining = train[
        "remaining_capacity"
    ].to_numpy(float)

    sales = train[
        "sales_next_period"
    ].to_numpy(float)

    y = np.divide(
        sales,
        remaining,
        out=np.zeros_like(sales),
        where=remaining > 0,
    )

    model = build_model(columns)
    model.fit(x, y)

    print(
        "Entrenamiento:",
        train["event_id"].nunique(),
        "eventos",
    )

    print(
        "Evaluacion:",
        test["event_id"].nunique(),
        "eventos no vistos",
    )

    summary = []
    details = []

    for category_id, group in test.groupby(
        "ticket_category_id",
        sort=True,
    ):

        result = {
            "event_id": str(
                group.iloc[0]["event_id"]
            ),
            "sport": str(
                group.iloc[0]["sport_type"]
            ),
            "category": str(category_id),
        }

        number = int(
            "".join(
                c for c in category_id
                if c.isdigit()
            )[-5:]
        )

        for policy, key in [
            ("precio_fijo", "fixed"),
            ("ajuste_diario", "dynamic"),
        ]:

            earned, sold, remaining_end, records = (
                simulate_category(
                    group,
                    latent,
                    generator,
                    model,
                    columns,
                    policy,
                    seed=10000 + number,
                )
            )

            result[f"{key}_revenue"] = round(
                earned, 2
            )

            result[f"{key}_sold"] = sold

            result[f"{key}_remaining"] = (
                remaining_end
            )

            details.extend(records)

        result["difference"] = round(
            result["dynamic_revenue"]
            - result["fixed_revenue"],
            2,
        )

        summary.append(result)

    output = pd.DataFrame(summary)

    output.to_csv(
        RESULTS,
        index=False,
        encoding="utf-8-sig",
    )

    pd.DataFrame(details).to_csv(
        DETAIL,
        index=False,
        encoding="utf-8-sig",
    )

    fixed = output["fixed_revenue"].sum()
    dynamic = output["dynamic_revenue"].sum()

    improvement = (
        (dynamic / fixed - 1) * 100
        if fixed > 0 else 0
    )

    print()
    print("STADIUM IQ V7.8")
    print("EVALUACION CON DEMANDA DE AURORA")
    print("-----------------------------------")

    print(
        "Categorias evaluadas:",
        len(output),
    )

    print(
        f"Precio fijo: {fixed:,.2f} EUR"
    )

    print(
        f"Ajuste diario: {dynamic:,.2f} EUR"
    )

    print(
        f"Diferencia: {dynamic - fixed:,.2f} EUR"
    )

    print(
        f"Variacion: {improvement:+.2f} %"
    )

    print(
        "Categorias con mejora:",
        int((output["difference"] > 0).sum()),
        "de",
        len(output),
    )

    print()
    print(
        "Resultados guardados en:",
        RESULTS.name,
        "y",
        DETAIL.name,
    )

    print()
    print(
        "AVISO: evaluacion de demanda sintetica "
        "con una realizacion aleatoria."
    )

    print(
        "El ajuste diario no garantiza la "
        "optimizacion de todo el horizonte."
    )


if __name__ == "__main__":
    main()
