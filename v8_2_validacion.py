
"""STADIUM IQ V8.2: validacion con numeros aleatorios comunes.

Ejecutar: python v8_2_validacion.py --repeticiones 20
No sobrescribe los resultados de V7.9.
"""

import argparse
import json

import numpy as np
import pandas as pd
from scipy.stats import poisson
from sklearn.model_selection import GroupShuffleSplit

from multisport_v7 import (
    ROOT,
    build_model,
    encode_features,
    load_dataset,
    predict_sales,
)
from v7_8_evaluacion import (
    load_generator,
    replay_latent_parameters,
    update_state,
)


def train_model(df):
    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=0.2,
        random_state=42,
    )
    train_idx, test_idx = next(
        splitter.split(df, groups=df["event_id"])
    )
    train, test = df.iloc[train_idx], df.iloc[test_idx]

    assert set(train.event_id).isdisjoint(
        set(test.event_id)
    )

    x = encode_features(train)
    stock = train.remaining_capacity.to_numpy(dtype=float)
    sales = train.sales_next_period.to_numpy(dtype=float)

    target = np.divide(
        sales,
        stock,
        out=np.zeros_like(sales),
        where=stock > 0,
    )

    model = build_model(x.columns.tolist())
    model.fit(x, target)

    return model, x.columns.tolist(), train, test


def simulate(
    rows,
    latent,
    generator,
    model,
    features,
    policy,
    shocks,
):
    """Simula una politica usando shocks diarios compartidos."""

    rows = rows.sort_values(
        "days_remaining",
        ascending=False,
    )

    capacity = int(rows.iloc[0]["category_capacity"])
    stock, revenue, history = capacity, 0.0, []
    base = float(rows.iloc[0]["base_price"])
    detail = []

    for day_index, (_, snapshot) in enumerate(
        rows.iterrows()
    ):
        if stock == 0:
            break

        state = update_state(
            snapshot,
            stock,
            history,
            revenue,
        )

        low = float(state["min_price"])
        high = float(state["max_price"])

        if policy == "precio_fijo":
            price = float(np.clip(base, low, high))
        else:
            prices = np.linspace(low, high, 51)

            candidates = pd.DataFrame(
                [state.to_dict()] * len(prices)
            )
            candidates["current_price"] = prices

            x = encode_features(candidates, features)

            predicted = predict_sales(
                model,
                x,
                np.full(len(prices), stock),
                "rate",
            )

            best = int(
                np.argmax(prices * predicted)
            )
            price = float(prices[best])

        kwargs = dict(
            latent[str(snapshot["snapshot_id"])]
        )
        kwargs["price"] = price

        mean = float(
            generator.hidden_demand_mean(**kwargs)
        )

        gamma_factor, uniform_quantile = shocks[
            day_index
        ]

        demand = int(
            poisson.ppf(
                uniform_quantile,
                max(0.0, mean * gamma_factor),
            )
        )

        sold = min(stock, demand)
        stock -= sold
        revenue += sold * price
        history.append(sold)

        detail.append({
            "event_id": str(snapshot["event_id"]),
            "ticket_category_id": str(
                snapshot["ticket_category_id"]
            ),
            "policy": policy,
            "days_remaining": int(
                snapshot["days_remaining"]
            ),
            "price": round(price, 2),
            "actual_simulated_sales": sold,
            "remaining": stock,
            "revenue_cumulative": round(revenue, 2),
        })

    return revenue, stock, detail


def main(repetitions):

    if repetitions < 2:
        raise ValueError(
            "Selecciona al menos 2 repeticiones."
        )

    df = load_dataset().reset_index(drop=True)
    generator = load_generator()

    print("Reconstruyendo parametros del generador...")

    latent = replay_latent_parameters(
        generator,
        df,
    )

    print("Entrenando XGBoost una vez...")

    model, features, train, test = train_model(df)

    categories = list(
        test.groupby(
            "ticket_category_id",
            sort=True,
        )
    )

    results = []
    sports_results = []
    detail_first = []

    print(
        f"Entrenamiento: {train.event_id.nunique()} eventos"
    )
    print(
        f"Evaluacion: {test.event_id.nunique()} eventos; "
        f"{len(categories)} categorias"
    )

    for rep in range(repetitions):

        fixed_total = 0.0
        dynamic_total = 0.0
        wins = 0
        sports = {}

        for ci, (category, rows) in enumerate(
            categories
        ):

            rng = np.random.default_rng(
                100000 + rep * 1000 + ci
            )

            # Los dos escenarios reciben exactamente
            # los mismos factores de ruido diarios.

            shocks = list(zip(
                rng.gamma(
                    shape=9.0,
                    scale=1.0 / 9.0,
                    size=len(rows),
                ),
                rng.uniform(
                    low=1e-10,
                    high=1 - 1e-10,
                    size=len(rows),
                ),
            ))

            fixed, _, fixed_detail = simulate(
                rows,
                latent,
                generator,
                model,
                features,
                "precio_fijo",
                shocks,
            )

            dynamic, _, dynamic_detail = simulate(
                rows,
                latent,
                generator,
                model,
                features,
                "ajuste_diario",
                shocks,
            )

            if rep == 0:
                detail_first.extend(fixed_detail)
                detail_first.extend(dynamic_detail)

            sport = str(
                rows.iloc[0]["sport_type"]
            )

            if sport not in sports:
                sports[sport] = {
                    "fixed": 0.0,
                    "dynamic": 0.0,
                    "wins": 0,
                    "n": 0,
                }

            s = sports[sport]

            s["fixed"] += fixed
            s["dynamic"] += dynamic
            s["wins"] += int(dynamic > fixed)
            s["n"] += 1

            fixed_total += fixed
            dynamic_total += dynamic
            wins += int(dynamic > fixed)

        uplift = (
            100 * (dynamic_total / fixed_total - 1)
            if fixed_total
            else np.nan
        )

        results.append({
            "repeticion": rep + 1,
            "ingresos_fijos": round(fixed_total, 2),
            "ingresos_dinamicos": round(
                dynamic_total, 2
            ),
            "diferencia_eur": round(
                dynamic_total - fixed_total, 2
            ),
            "mejora_pct": round(uplift, 4),
            "categorias_con_mejora": wins,
            "categorias_totales": len(categories),
        })

        for name, s in sports.items():

            sport_uplift = (
                100 * (s["dynamic"] / s["fixed"] - 1)
                if s["fixed"]
                else np.nan
            )

            sports_results.append({
                "repeticion": rep + 1,
                "deporte": name,
                "mejora_pct": round(
                    sport_uplift, 4
                ),
                "categorias_con_mejora": s["wins"],
                "categorias_totales": s["n"],
            })

        print(
            f"Repeticion {rep + 1}/{repetitions}: "
            f"{uplift:+.2f}% | "
            f"categorias {wins}/{len(categories)}",
            flush=True,
        )

    frame = pd.DataFrame(results)
    sport_frame = pd.DataFrame(sports_results)

    frame.to_csv(
        ROOT / "v8_2_repeticiones.csv",
        index=False,
        encoding="utf-8-sig",
    )

    sport_frame.to_csv(
        ROOT / "v8_2_deportes.csv",
        index=False,
        encoding="utf-8-sig",
    )

    pd.DataFrame(detail_first).to_csv(
        ROOT / "v8_2_detalle.csv",
        index=False,
        encoding="utf-8-sig",
    )

    values = frame.mejora_pct.to_numpy()

    summary = {
        "version": "8.2",
        "repeticiones": repetitions,
        "eventos_entrenamiento": int(
            train.event_id.nunique()
        ),
        "eventos_evaluacion": int(
            test.event_id.nunique()
        ),
        "categorias": len(categories),
        "mejora_global_pct": {
            "media": round(
                float(np.mean(values)), 3
            ),
            "desviacion": round(
                float(np.std(values, ddof=1)), 3
            ),
            "percentil_5": round(
                float(np.percentile(values, 5)), 3
            ),
            "percentil_95": round(
                float(np.percentile(values, 95)), 3
            ),
        },
        "repeticiones_con_mejora": int(
            (values > 0).sum()
        ),
        "categorias_ganadas": {
            "media": round(
                float(
                    frame.categorias_con_mejora.mean()
                ),
                2,
            )
        },
        "deportes": {
            sport: {
                "mejora_pct": {
                    "media": round(
                        float(
                            group.mejora_pct.mean()
                        ),
                        3,
                    )
                }
            }
            for sport, group in sport_frame.groupby(
                "deporte"
            )
        },
        "advertencias": [
            "Demanda sintetica; no demuestra mejora comercial real.",
            "Se mantiene fijo el modelo y la particion de eventos.",
            "Se comparten shocks diarios y cuantiles Poisson entre politicas.",
            "El ajuste diario no optimiza el horizonte completo.",
            "Percentiles descriptivos, no intervalos de confianza generalizables.",
        ],
    }

    output = ROOT / "v8_2_resumen.json"

    output.write_text(
        json.dumps(
            summary,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print("\nRESULTADOS V8.2")

    print(
        "Mejora media:",
        f"{summary['mejora_global_pct']['media']:+.2f}%",
    )

    print(
        "Repeticiones positivas:",
        f"{summary['repeticiones_con_mejora']}/{repetitions}",
    )

    print("\nArchivos generados:")
    print("- v8_2_resumen.json")
    print("- v8_2_repeticiones.csv")
    print("- v8_2_deportes.csv")
    print("- v8_2_detalle.csv")

    print(
        "\nNo se han sobrescrito los resultados anteriores."
    )


if __name__ == "__main__":

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--repeticiones",
        type=int,
        default=20,
    )

    args = parser.parse_args()

    main(args.repeticiones)
