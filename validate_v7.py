
"""V7.2 - Validacion cruzada por eventos y auditoria de curvas de precio.

Ejecutar desde la raiz:
    python validate_v7.py

No sobrescribe los modelos del simulador ni los datos.
"""

import json

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

from multisport_v7 import (
    ROOT,
    build_model,
    encode_features,
    load_dataset,
    metrics,
    predict_sales,
)

RESULTS = ROOT / "v7_2_validacion.csv"
CURVES = ROOT / "v7_2_curvas_precios.csv"
SUMMARY = ROOT / "v7_2_resumen.json"

MODES = ("direct", "rate")


def train_target(df, mode):
    sales = df["sales_next_period"].to_numpy(float)

    if mode == "direct":
        return sales

    remaining = df["remaining_capacity"].to_numpy(float)

    return np.divide(
        sales,
        remaining,
        out=np.zeros_like(sales),
        where=remaining > 0,
    )


def assess_curve(model, feature_columns, sample, mode, fold):
    low = float(sample["min_price"])
    high = float(sample["max_price"])

    if (
        not np.isfinite(low)
        or not np.isfinite(high)
        or low <= 0
        or high <= low
    ):
        return []

    prices = np.linspace(low, high, 41)

    scenarios = pd.DataFrame(
        [sample.to_dict()] * len(prices)
    )

    scenarios["current_price"] = prices

    x = encode_features(scenarios, feature_columns)

    stock = scenarios[
        "remaining_capacity"
    ].to_numpy(float)

    forecast = predict_sales(model, x, stock, mode)

    income = prices * forecast

    return [
        {
            "fold": fold,
            "modelo": mode,
            "deporte": str(sample["sport_type"]),
            "evento": str(sample["event_id"]),
            "categoria": str(sample["ticket_category_id"]),
            "precio_eur": round(float(p), 4),
            "entradas_estimadas": round(float(q), 5),
            "ingresos_estimados_eur": round(float(rev), 5),
        }
        for p, q, rev in zip(prices, forecast, income)
    ]


def main():
    df = load_dataset().reset_index(drop=True)

    groups = df["event_id"]
    n_events = groups.nunique()

    if n_events < 5:
        raise ValueError(
            "Se necesitan al menos cinco eventos para GroupKFold."
        )

    fold_rows = []
    curve_rows = []

    gkf = GroupKFold(n_splits=5)

    for fold, (train_idx, test_idx) in enumerate(
        gkf.split(df, groups=groups), 1
    ):
        training = df.iloc[train_idx]
        testing = df.iloc[test_idx]

        assert set(training["event_id"]).isdisjoint(
            set(testing["event_id"])
        )

        x_train = encode_features(training)
        columns = x_train.columns.tolist()

        x_test = encode_features(testing, columns)

        actual = testing[
            "sales_next_period"
        ].to_numpy(float)

        stock = testing[
            "remaining_capacity"
        ].to_numpy(float)

        # Baseline: ventas medias por deporte, calculadas
        # exclusivamente con los datos de entrenamiento.

        sport_means = training.groupby(
            "sport_type"
        )["sales_next_period"].mean()

        baseline = testing["sport_type"].map(
            sport_means
        ).fillna(
            training["sales_next_period"].mean()
        ).to_numpy(float)

        baseline = np.clip(baseline, 0, stock)

        for mode in ("baseline",) + MODES:
            if mode == "baseline":
                pred = baseline
                model = None

            else:
                model = build_model(columns)

                model.fit(
                    x_train,
                    train_target(training, mode)
                )

                pred = predict_sales(
                    model,
                    x_test,
                    stock,
                    mode
                )

            # Evaluar rendimiento global y por deporte.

            for sport in (
                ["GLOBAL"] +
                sorted(testing["sport_type"].unique())
            ):
                if sport == "GLOBAL":
                    mask = np.ones(
                        len(testing), dtype=bool
                    )
                else:
                    mask = (
                        testing["sport_type"].to_numpy()
                        == sport
                    )

                if not mask.any():
                    continue

                row = {
                    "fold": fold,
                    "modelo": mode,
                    "deporte": sport,
                    "filas_prueba": int(mask.sum()),
                    "eventos_prueba": int(
                        testing.loc[
                            mask, "event_id"
                        ].nunique()
                    ),
                }

                row.update(
                    metrics(
                        actual[mask],
                        pred[mask]
                    )
                )

                fold_rows.append(row)

            # Auditar una curva de cada deporte usando
            # eventos que no participaron en entrenamiento.

            if model is not None:
                for sport, part in testing.groupby(
                    "sport_type"
                ):
                    sample = part.sort_values(
                        "days_remaining",
                        ascending=False
                    ).iloc[0]

                    curve_rows.extend(
                        assess_curve(
                            model,
                            columns,
                            sample,
                            mode,
                            fold
                        )
                    )

        print(
            f"Fold {fold}/5 evaluado: "
            f"{testing.event_id.nunique()} "
            "eventos de prueba"
        )

    # Guardar resultados detallados.

    scores = pd.DataFrame(fold_rows)
    curves = pd.DataFrame(curve_rows)

    scores.to_csv(
        RESULTS,
        index=False,
        encoding="utf-8-sig"
    )

    curves.to_csv(
        CURVES,
        index=False,
        encoding="utf-8-sig"
    )

    global_scores = scores[
        scores["deporte"] == "GLOBAL"
    ]

    overview = {}

    for mode, section in global_scores.groupby(
        "modelo"
    ):
        overview[mode] = {
            "mae_promedio_folds": round(
                float(section["mae_entradas"].mean()), 3
            ),
            "mae_desviacion_folds": round(
                float(
                    section["mae_entradas"].std(ddof=1)
                ), 3
            ),
            "rmse_promedio_folds": round(
                float(section["rmse_entradas"].mean()), 3
            ),
            "r2_promedio_folds": round(
                float(section["r2"].mean()), 4
            ),
        }

    # Comprobar que subir el precio no incrementa
    # las ventas estimadas con el mismo contexto.

    non_monotone = 0

    for _, part in curves.groupby(
        ["fold", "modelo", "evento", "categoria"]
    ):
        ordered = part.sort_values("precio_eur")

        differences = np.diff(
            ordered["entradas_estimadas"].to_numpy()
        )

        if np.any(differences > 1e-3):
            non_monotone += 1

    overview["auditoria"] = {
        "eventos": int(n_events),
        "observaciones": len(df),
        "curvas_evaluadas": int(
            curves.groupby(
                ["fold", "modelo", "evento", "categoria"]
            ).ngroups
        ),
        "curvas_no_monotonas": int(non_monotone),
        "nota": (
            "Las curvas son simulaciones del modelo, "
            "no efectos causales validados."
        ),
    }

    SUMMARY.write_text(
        json.dumps(
            overview,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

    print(
        "\nRESUMEN DE VALIDACION "
        "(medias de los 5 folds)"
    )

    print(
        json.dumps(
            overview,
            ensure_ascii=False,
            indent=2
        )
    )

    print(
        f"\nArchivos creados: "
        f"{RESULTS.name}, "
        f"{CURVES.name}, "
        f"{SUMMARY.name}"
    )

    print(
        "IMPORTANTE: este ensayo NO modifica "
        "los modelos de V7 ni React."
    )


if __name__ == "__main__":
    main()
