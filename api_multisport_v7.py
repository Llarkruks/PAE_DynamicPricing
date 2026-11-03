
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


class CustomPrediction(BaseModel):
    sport_type: Literal["football", "basketball", "tennis", "running"]
    ticket_category: str = Field(min_length=1)
    days_remaining: int = Field(ge=1, le=30)
    model: Literal["rate", "direct"] = "rate"
    category_capacity: int = Field(ge=1, le=100000)
    remaining_capacity: int = Field(ge=0, le=100000)
    current_price: float = Field(gt=0, le=10000)
    popularity_index: float = Field(ge=0, le=1)
    event_importance: float = Field(ge=0, le=1)
    event_name: str = Field(default="Mi evento", max_length=100)
    derby_rivalry_index: float | None = Field(default=None, ge=0, le=1)
    league_position_home: int | None = Field(default=None, ge=1, le=30)
    league_position_away: int | None = Field(default=None, ge=1, le=30)
    team_win_percentage: float | None = Field(default=None, ge=0, le=1)
    player_ranking: int | None = Field(default=None, ge=1, le=500)
    tournament_round: Literal["R32", "R16", "QF", "SF", "F"] | None = None
    race_distance_km: float | None = Field(default=None, gt=0, le=100)
    elevation_gain_m: float | None = Field(default=None, ge=0, le=5000)


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

    return optimize_row(row, req.model, original_stock)


def optimize_row(row, model_name, original_stock=None, extra_context=None):
    stock = int(row["remaining_capacity"])
    context = context_dict(row, original_stock)
    if extra_context:
        context.update(extra_context)

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
            "model": model_name,
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
        row, model_name, prices
    )

    ref_demand, ref_revenue = evaluate_prices(
        row,
        model_name,
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
            "model": model_name,
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
            row, model_name, pair
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

    # Diagnostico: control de forma de la curva y precios en los extremos.
    # Son comprobaciones de coherencia, no prueba de elasticidad causal.
    diffs = np.diff(demand)
    rises = int(np.count_nonzero(diffs > np.maximum(0.05, 0.005 * np.maximum(demand[:-1], 1))))
    boundary_tolerance = max((high - low) / 50, 0.01)
    at_upper = bool(high - optimal["price"] <= boundary_tolerance)
    at_lower = bool(optimal["price"] - low <= boundary_tolerance)
    weak_response = bool(
        local_sensitivity is not None and abs(local_sensitivity) < 0.15
    )
    diagnostics = {
        "demand_increase_steps": rises,
        "price_points": int(len(prices)),
        "optimal_at_upper_bound": at_upper,
        "optimal_at_lower_bound": at_lower,
        "weak_local_response": weak_response,
        "warnings": [],
    }
    if rises:
        diagnostics["warnings"].append(
            "La demanda predicha aumenta en algunos tramos al subir el precio; "
            "revisar la curva antes de interpretar la recomendacion."
        )
    if at_upper:
        diagnostics["warnings"].append(
            "El precio optimo coincide con el maximo evaluado; "
            "puede depender del limite de busqueda."
        )
    if at_lower:
        diagnostics["warnings"].append(
            "El precio optimo coincide con el minimo evaluado; "
            "puede depender del limite de busqueda."
        )
    if weak_response:
        diagnostics["warnings"].append(
            "La demanda estimada responde poco al precio cerca del precio inicial. "
            "El resultado puede estar dominado por el aumento del precio."
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
            scenario, model_name, prices
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
        "model": model_name,
        "optimal": optimal,
        "reference": reference,
        "uplift_percent": uplift,
        "local_price_sensitivity": local_sensitivity,
        "diagnostics": diagnostics,
        "sensitivity": checks,
        "curve": curve,
        "caveat": (
            "Datos sinteticos. Estimaciones para un dia. "
            "Las variaciones manuales del inventario "
            "son escenarios hipoteticos y no garantizan "
            "la coherencia de todas las variables historicas."
        ),
    }



def custom_template(sport_type, ticket_category, days_remaining):
    """Perfil sintetico representativo, NO evento aportado por el usuario."""
    candidates = DATA.loc[
        (DATA["sport_type"] == sport_type)
        & (DATA["ticket_category"] == ticket_category)
        & (DATA["days_remaining"] == days_remaining)
    ]
    if candidates.empty:
        raise HTTPException(422, "Categoria o dias no disponibles para ese deporte")
    # Un registro completo de referencia, evitando combinar columnas
    # inconsistentes de distintos eventos ficticios.
    med = candidates[["popularity_index", "event_importance", "base_price"]].median()
    dist = (
        ((candidates["popularity_index"] - med["popularity_index"]) ** 2)
        + ((candidates["event_importance"] - med["event_importance"]) ** 2)
        + ((candidates["base_price"] / max(med["base_price"], 1) - 1) ** 2)
    )
    return candidates.loc[dist.idxmin()].copy()


@app.get("/api/v7/custom/config")
def custom_config():
    if DATA is None:
        raise HTTPException(503, "Dataset no cargado")
    categories = DATA[["sport_type", "ticket_category"]].drop_duplicates()
    return {
        "categories": categories.sort_values(["sport_type", "ticket_category"]).to_dict("records"),
        "limits": {"min_days": 1, "max_days": 30, "price_min_factor": 0.8, "price_max_factor": 1.2},
        "note": "Los valores que no introduzcas se toman de un evento sintetico representativo.",
    }


def safe_optional_number(row, field):
    value = row.get(field)
    return None if pd.isna(value) else float(value)


@app.get("/api/v7/custom/defaults")
def custom_defaults(
    sport_type: Literal["football", "basketball", "tennis", "running"],
    ticket_category: str,
    days_remaining: int = Query(30, ge=1, le=30),
):
    row = custom_template(sport_type, ticket_category, days_remaining)
    return {
        "category_capacity": int(row["category_capacity"]),
        "remaining_capacity": int(row["remaining_capacity"]),
        "current_price": round(float(row["base_price"]), 2),
        "popularity_index": round(float(row["popularity_index"]), 3),
        "event_importance": round(float(row["event_importance"]), 3),
        "derby_rivalry_index": safe_optional_number(row, "derby_rivalry_index"),
        "league_position_home": safe_optional_number(row, "league_position_home"),
        "league_position_away": safe_optional_number(row, "league_position_away"),
        "team_win_percentage": safe_optional_number(row, "team_win_percentage"),
        "player_ranking": safe_optional_number(row, "player_ranking"),
        "tournament_round": str(row.get("tournament_round")) if pd.notna(row.get("tournament_round")) else "QF",
        "race_distance_km": safe_optional_number(row, "race_distance_km"),
        "elevation_gain_m": safe_optional_number(row, "elevation_gain_m"),
    }


@app.post("/api/v7/custom/optimize")
def optimize_custom(req: CustomPrediction):
    if DATA is None or BUNDLE is None:
        raise HTTPException(503, "Modelo o dataset no cargado")
    if req.remaining_capacity > req.category_capacity:
        raise HTTPException(422, "Las disponibles no pueden superar el aforo")
    row = custom_template(req.sport_type, req.ticket_category, req.days_remaining)
    # Solo se alteran atributos pertenecientes al deporte seleccionado.
    sport_features = {
        "football": ("derby_rivalry_index", "league_position_home", "league_position_away"),
        "basketball": ("team_win_percentage",),
        "tennis": ("player_ranking", "tournament_round"),
        "running": ("race_distance_km", "elevation_gain_m"),
    }
    for field in sport_features[req.sport_type]:
        value = getattr(req, field)
        if value is not None:
            row[field] = value
    row["event_id"] = "CUSTOM_SCENARIO"
    row["ticket_category_id"] = "CUSTOM_CATEGORY"
    row["category_capacity"] = req.category_capacity
    row["total_capacity"] = req.category_capacity  # aprox.: una sola categoria
    row["base_price"] = req.current_price
    row["current_price"] = req.current_price
    row["min_price"] = round(req.current_price * 0.8, 4)
    row["max_price"] = round(req.current_price * 1.2, 4)
    row["popularity_index"] = req.popularity_index
    row["event_importance"] = req.event_importance
    # Evitar importar ventas de otro evento: son supuestos neutros.
    row["sales_last_period"] = 0
    row = update_inventory(row, req.remaining_capacity)
    if "sales_velocity" in row.index:
        row["sales_velocity"] = 0
    if "price_vs_base" in row.index:
        row["price_vs_base"] = 1.0
    output = optimize_row(row, req.model, extra_context={
        "is_custom": True,
        "event_name": req.event_name.strip() or "Mi evento",
        "is_hypothetical": True,
        "assumptions": [
            "Evento nuevo: las variables no introducidas usan un perfil sintetico representativo de ese deporte y categoria.",
            "Se supone que el aforo total coincide con el de esta categoria.",
            "Se supone que las ventas del periodo anterior son cero, al no disponer de historial.",
            "El precio actual actua como precio base; se explora del 80% al 120% de ese precio.",
            "La recomendacion corresponde solo al siguiente dia, no al total del evento.",
        ],
    })
    candidates = DATA.loc[
        (DATA["sport_type"] == req.sport_type)
        & (DATA["ticket_category"] == req.ticket_category)
    ]
    pmin = float(candidates["current_price"].min())
    pmax = float(candidates["current_price"].max())
    output["context"]["observed_price_reference_range"] = [round(pmin, 2), round(pmax, 2)]
    if req.current_price < pmin or req.current_price > pmax:
        output.setdefault("diagnostics", {"warnings": []})["warnings"].append(
            f"El precio introducido ({req.current_price:.2f}) queda fuera de "
            f"los precios sinteticos observados para este deporte y entrada "
            f"({pmin:.2f}-{pmax:.2f}). La extrapolacion puede ser poco fiable."
        )
    output["caveat"] = (
        "ESCENARIO HIPOTETICO con datos de referencia sinteticos. "
        "No validado para eventos reales ni para decisiones comerciales."
    )
    return output


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app, host="127.0.0.1", port=8001
    )
