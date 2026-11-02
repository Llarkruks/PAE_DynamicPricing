
"""STADIUM IQ V7.6 - API de optimizacion multideporte."""

from contextlib import asynccontextmanager
from typing import Literal

import joblib
import numpy as np
import pandas as pd

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from multisport_v7 import (
    ARTIFACT,
    encode_features,
    load_dataset,
    predict_sales,
)

DATA = None
BUNDLE = None

EPSILON = 1e-6


@asynccontextmanager
async def lifespan(app: FastAPI):
    global DATA, BUNDLE

    if not ARTIFACT.exists():
        raise RuntimeError(
            "Primero ejecuta: python multisport_v7.py train"
        )

    DATA = load_dataset()
    BUNDLE = joblib.load(ARTIFACT)
    yield


app = FastAPI(
    title="STADIUM IQ - Multisport V7.6",
    version="7.6",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class Prediction(BaseModel):
    event_id: str
    ticket_category_id: str
    days_remaining: int = Field(ge=1, le=365)
    model: Literal["rate", "direct"] = "rate"
    remaining_capacity: int | None = Field(
        default=None, ge=0
    )


def get_snapshot(event_id, ticket_category_id, days):
    if DATA is None:
        raise HTTPException(503, "Dataset no cargado")

    records = DATA.loc[
        (DATA["event_id"] == event_id)
        & (DATA["ticket_category_id"] == ticket_category_id)
        & (DATA["days_remaining"] == days)
    ]

    if records.empty:
        raise HTTPException(
            404, "No existe ese evento, categoria y dia"
        )

    return records.iloc[0].copy()


def context_dict(row, original_stock=None):
    capacity = int(row["category_capacity"])
    stock = int(row["remaining_capacity"])

    return {
        "sport": str(row["sport_type"]),
        "event_id": str(row["event_id"]),
        "category": str(row["ticket_category"]),
        "category_id": str(row["ticket_category_id"]),
        "days_remaining": int(row["days_remaining"]),
        "remaining_capacity": stock,
        "original_remaining_capacity": (
            stock if original_stock is None
            else int(original_stock)
        ),
        "category_capacity": capacity,
        "occupancy_rate": (
            (capacity - stock) / capacity
            if capacity > 0 else 0.0
        ),
        "observed_price": float(row["current_price"]),
        "min_price": float(row["min_price"]),
        "max_price": float(row["max_price"]),
        "is_hypothetical": (
            original_stock is not None
            and stock != original_stock
        ),
    }


def update_inventory(row, stock):
    """Actualiza inventario y derivados conocidos."""
    row = row.copy()
    capacity = int(row["category_capacity"])

    if not 0 <= stock <= capacity:
        raise HTTPException(
            422,
            "El inventario debe estar entre 0 y el aforo"
        )

    row["remaining_capacity"] = stock
    row["cumulative_sales"] = capacity - stock
    row["occupancy_rate"] = (
        (capacity - stock) / capacity
        if capacity > 0 else 0.0
    )

    if "remaining_capacity_pct" in row.index:
        row["remaining_capacity_pct"] = (
            stock / capacity if capacity > 0 else 0.0
        )

    return row


def evaluate_prices(row, model_name, prices):
    scenarios = pd.DataFrame(
        [row.to_dict()] * len(prices)
    )

    scenarios["current_price"] = prices

    x = encode_features(
        scenarios,
        BUNDLE["features"],
    )

    stock = scenarios[
        "remaining_capacity"
    ].to_numpy(float)

    demand = predict_sales(
        BUNDLE["models"][model_name],
        x,
        stock,
        model_name,
    )

    demand = np.nan_to_num(
        np.asarray(demand, dtype=float),
        nan=0.0,
        posinf=0.0,
        neginf=0.0,
    )

    demand = np.clip(demand, 0, stock)
    revenue = prices * demand

    return demand, revenue


@app.get("/api/v7/health")
def health():
    return {
        "ok": DATA is not None and BUNDLE is not None,
        "version": "7.6",
        "events": int(DATA["event_id"].nunique()),
    }


@app.get("/api/v7/config")
def config():
    pairs = DATA[
        [
            "sport_type",
            "event_id",
            "ticket_category_id",
            "ticket_category",
        ]
    ].drop_duplicates()

    return {
        "events": pairs.sort_values(
            ["sport_type", "event_id", "ticket_category_id"]
        ).to_dict(orient="records")
    }


@app.get("/api/v7/context")
def get_context(
    event_id: str = Query(...),
    ticket_category_id: str = Query(...),
    days_remaining: int = Query(..., ge=1, le=365),
):
    row = get_snapshot(
        event_id, ticket_category_id, days_remaining
    )
    return context_dict(row)


@app.post("/api/v7/optimize")
def optimize(req: Prediction):
    row = get_snapshot(
        req.event_id,
        req.ticket_category_id,
        req.days_remaining,
    )

    original_stock = int(row["remaining_capacity"])
    stock = (
        original_stock
        if req.remaining_capacity is None
        else int(req.remaining_capacity)
    )

    row = update_inventory(row, stock)

    context = context_dict(row, original_stock)

    # Sin existencias no existe decision de pricing.
    if stock == 0:
        return {
            "status": "sold_out",
            "message": (
                "Todas las entradas de esta categoria "
                "estan agotadas. No es posible generar "
                "ingresos adicionales cambiando el precio."
            ),
            "context": context,
            "model": req.model,
            "optimal": None,
            "reference": None,
            "uplift_percent": None,
            "local_price_sensitivity": None,
            "sensitivity": [],
            "curve": [],
        }

    low = float(row["min_price"])
    high = float(row["max_price"])
    observed = float(row["current_price"])

    if not (
        np.isfinite(low)
        and np.isfinite(high)
        and np.isfinite(observed)
        and 0 < low <= high
        and observed > 0
    ):
        raise HTTPException(
            422, "Precios del evento no validos"
        )

    # Barrido del rango completo mas precio observado exacto.
    grid = np.linspace(low, high, 51)
    prices = np.unique(
        np.append(grid, observed)
    )

    demand, revenue = evaluate_prices(
        row, req.model, prices
    )

    ref_demand, ref_revenue = evaluate_prices(
        row,
        req.model,
        np.array([observed], dtype=float),
    )

    reference = {
        "price": observed,
        "sales": float(ref_demand[0]),
        "revenue": float(ref_revenue[0]),
    }

    curve = [
        {
            "price": float(p),
            "sales": float(q),
            "revenue": float(r),
        }
        for p, q, r in zip(
            prices, demand, revenue
        )
    ]

    # Con inventario, pero sin ventas previstas.
    if float(np.max(demand)) <= EPSILON:
        return {
            "status": "no_demand",
            "message": (
                "El modelo no preve ventas con ninguno "
                "de los precios probados. No hay una "
                "recomendacion de precio fundamentada."
            ),
            "context": context,
            "model": req.model,
            "optimal": None,
            "reference": reference,
            "uplift_percent": None,
            "local_price_sensitivity": None,
            "sensitivity": [],
            "curve": curve,
        }

    best_revenue = float(np.max(revenue))

    # Si varios precios empatan, preferir el mas proximo
    # al observado. Esto evita elegir arbitrariamente
    # el precio minimo.
    tolerance = max(1e-7, best_revenue * 1e-9)

    tied = np.flatnonzero(
        revenue >= best_revenue - tolerance
    )

    best_idx = tied[
        np.argmin(
            np.abs(prices[tied] - observed)
        )
    ]

    optimal = {
        "price": float(prices[best_idx]),
        "sales": float(demand[best_idx]),
        "revenue": float(revenue[best_idx]),
    }

    uplift = (
        100.0 * (
            optimal["revenue"] / reference["revenue"] - 1
        )
        if reference["revenue"] > EPSILON
        else None
    )

    # Sensibilidad predictiva local, no causal.
    pair = np.array(
        [observed * 0.95, observed * 1.05],
        dtype=float,
    )

    pair = np.clip(pair, low, high)
    local_sensitivity = None

    if pair[1] > pair[0]:
        qs, _ = evaluate_prices(
            row, req.model, pair
        )

        if np.mean(qs) > EPSILON:
            local_sensitivity = float(
                (
                    (qs[1] - qs[0]) / np.mean(qs)
                )
                /
                (
                    (pair[1] - pair[0]) / np.mean(pair)
                )
            )

    # Sensibilidad al inventario (opcional).
    checks = []

    for name, factor in [
        ("Inventario -5%", 0.95),
        ("Escenario base", 1.0),
        ("Inventario +5%", 1.05),
    ]:
        scenario_stock = int(
            np.clip(
                round(stock * factor),
                0,
                int(row["category_capacity"]),
            )
        )

        scenario = update_inventory(
            row, scenario_stock
        )

        sq, sr = evaluate_prices(
            scenario, req.model, prices
        )

        if float(np.max(sq)) <= EPSILON:
            scenario_best = None
        else:
            scenario_max = float(np.max(sr))
            tied_s = np.flatnonzero(
                sr >= scenario_max -
                max(1e-7, scenario_max * 1e-9)
            )
            si = tied_s[
                np.argmin(
                    np.abs(prices[tied_s] - observed)
                )
            ]
            scenario_best = {
                "price": float(prices[si]),
                "sales": float(sq[si]),
                "revenue": float(sr[si]),
            }

        checks.append({
            "scenario": name,
            "remaining_capacity": scenario_stock,
            "optimal": scenario_best,
        })

    return {
        "status": "ok",
        "message": "Simulacion completada.",
        "context": context,
        "model": req.model,
        "optimal": optimal,
        "reference": reference,
        "uplift_percent": uplift,
        "local_price_sensitivity": local_sensitivity,
        "sensitivity": checks,
        "curve": curve,
        "caveat": (
            "Datos sinteticos. Estimaciones para un dia. "
            "Las variaciones manuales del inventario "
            "son escenarios hipoteticos y no garantizan "
            "la coherencia de todas las variables historicas."
        ),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app, host="127.0.0.1", port=8001
    )
