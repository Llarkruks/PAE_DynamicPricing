from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from joblib import load
import numpy as np

from data_loader import load_and_consolidate
from train_model import select_features
from pricing_optimizer import run_optimization_sweep

MODEL_PATH = "xgb_sales_rate_model.pkl"

app = FastAPI(title="CampNou Pricing API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
reference_features = None
static_data = None
analytics_data = None


class PredictRequest(BaseModel):
    item_area: str = Field("Gol Nord")
    item_level: str = Field("1")
    days_to_match: int
    occupancy_rate: float = Field(0.5, ge=0.0, le=1.0)
    match_importance: int = Field(7, ge=1, le=10)
    competition_type: str = Field("LaLiga")
    competition_phase: str = Field("Regular Season")
    is_derby: bool = Field(False)
    is_holiday_period: bool = Field(False)


class PredictResponse(BaseModel):
    item_area: str
    item_level: str
    base_price: float
    xgboost_raw_prediction: float
    suggested_optimal_price: float
    expected_revenue: float
    revpar: float
    elasticity: float
    ai_confidence: float
    optimal_revenue_increase_percent: float
    message: str
    sweep_data: list[dict]


@app.on_event("startup")
def startup_event():
    global model, reference_features, static_data, analytics_data

    try:
        model = load(MODEL_PATH)
    except Exception as exc:
        raise RuntimeError(f"No se pudo cargar el modelo desde {MODEL_PATH}: {exc}")

    df = load_and_consolidate()

    if df.empty:
        raise RuntimeError("Data consolidada vacía en startup")

    # No reseteamos el index para que siga siendo un DataFrame plano para las búsquedas por area/nivel
    static_data = df
    analytics_data = pd.read_csv("dataset_v2_EQUIPO_FINAL.csv", sep=";", decimal=",")

    # Construir esquema de features esperadas por el modelo
    reference_features = select_features(df).columns.tolist()

@app.get("/api/config")
def get_config():
    if static_data is None:
        raise HTTPException(status_code=500, detail="Datos no inicializados")
    
    # Optimización: extraer combinaciones únicas de Zonas y Niveles (instantáneo)
    areas_levels = {}
    if "item_area" in static_data.columns and "item_level" in static_data.columns:
        areas_df = static_data[["item_area", "item_level"]].drop_duplicates()
        for _, row in areas_df.iterrows():
            area = str(row["item_area"])
            level = str(row["item_level"])
            if area not in areas_levels:
                areas_levels[area] = set()
            areas_levels[area].add(level)
            
    result_areas = {}
    for area, levels in areas_levels.items():
        result_areas[area] = sorted(list(levels))
        
    # Las competiciones y fases estaban hardcodeadas en la app original porque
    # en el CSV XGBOOST están one-hot encoded y no en formato texto plano.
    # Así que construimos la jerarquía lógica aquí.
    result_comps = {
        "LaLiga": ["Regular Season"],
        "Champions League": ["League Phase", "Round of 16", "Quarterfinal", "Semifinal", "Final"],
        "Copa del Rey": ["Round of 16", "Quarterfinal", "Semifinal", "Final"],
        "Supercopa": ["Semifinal", "Final"],
        "Friendly": ["General"]
    }
        
    return {"areas": result_areas, "competitions": result_comps}

@app.post("/predict-price", response_model=PredictResponse)
def predict_price(req: PredictRequest):
    if model is None or reference_features is None or static_data is None:
        raise HTTPException(status_code=500, detail="Modelo o datos no inicializados")

    mask = (static_data["item_area"] == req.item_area) & (static_data["item_level"].astype(str) == str(req.item_level))
    filtered = static_data[mask]
    
    if len(filtered) > 0:
        static_row = filtered.iloc[0].copy()
    else:
        static_row = static_data.iloc[0].copy() # Fallback

    # Inyectar valores de la petición en la fila estática para construir el contexto
    static_row['days_to_match'] = req.days_to_match
    static_row['occupancy_rate'] = req.occupancy_rate
    static_row['match_importance'] = req.match_importance
    static_row['competition_type'] = req.competition_type
    static_row['competition_phase'] = req.competition_phase
    static_row['is_derby'] = req.is_derby
    static_row['is_holiday_period'] = req.is_holiday_period

    # Rango de barrido para optimización (ej: desde 50% hasta 250% del precio base)
    base_p = float(static_row["base_price"])
    p_range = np.linspace(base_p * 0.5, base_p * 2.5, 50)

    # Llamada al motor centralizado de optimización
    sweep_df, optimal, raw_ai_rate = run_optimization_sweep(
        model, reference_features, static_row, p_range
    )

    revpar = optimal["Ingresos"] / 1000 
    elasticity = optimal.get("Elasticidad", 1.2)
    ai_confidence = min(98.5, max(50.0, 95.0 - abs(optimal["vsBase"]) * 0.2)) 
    
    base_rev = base_p * raw_ai_rate * 15 
    rev_uplift = ((optimal['Ingresos'] / base_rev) - 1) * 100 if base_rev > 0 else 0
    
    sweep_data_list = sweep_df[["Precio", "Ingresos"]].to_dict(orient="records")

    return PredictResponse(
        item_area=req.item_area,
        item_level=req.item_level,
        base_price=round(base_p, 2),
        xgboost_raw_prediction=round(raw_ai_rate, 2),
        suggested_optimal_price=round(optimal["Precio"], 2),
        expected_revenue=round(optimal["Ingresos"], 2),
        revpar=round(revpar, 2),
        elasticity=round(elasticity, 2),
        ai_confidence=round(ai_confidence, 1),
        optimal_revenue_increase_percent=round(rev_uplift, 1),
        message="Optimización de precio completada con éxito",
        sweep_data=sweep_data_list
    )

from fastapi import Query

@app.get("/api/analytics")
def get_analytics(
    competition: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    day_type: Optional[str] = Query(None)
):
    if analytics_data is None:
        raise HTTPException(status_code=500, detail="Datos no inicializados")
        
    df = analytics_data.copy()
    
    if competition and competition != "All Leagues":
        df = df[df["competition_type"] == competition]
        
    if sector and sector != "All Sectors":
        df = df[df["sector_family"] == sector]
        
    if day_type == "Weekend Only":
        df = df[df["is_weekend"] == True]
    elif day_type == "Weekdays":
        df = df[df["is_weekend"] == False]
        
    # Obtener el estado final de las ventas ordenando por days_to_match y eliminando duplicados
    df_final = df.sort_values("days_to_match", ascending=True).drop_duplicates(subset=["match_id", "sector_id"])
    
    total_revenue = float(df_final["revenue_so_far"].sum())
    avg_occupancy = float(df_final["occupancy_rate"].mean()) * 100 if not df_final.empty else 0.0
    avg_ticket_price = float(df_final["current_price"].mean()) if not df_final.empty else 0.0
    
    comp_perf = df_final.groupby("competition_type")["revenue_so_far"].sum().to_dict()
    competitions_data = [{"name": str(k), "revenue": float(v)} for k, v in comp_perf.items()]
    competitions_data = sorted(competitions_data, key=lambda x: x["revenue"], reverse=True)
    
    matches_df = df_final.groupby("match_id").agg({
        "revenue_so_far": "sum",
        "tickets_sold": "sum",
        "opponent": "first",
        "competition_type": "first",
        "occupancy_rate": "mean"
    }).reset_index()
    
    matches_data = []
    for _, row in matches_df.iterrows():
        occ = row["occupancy_rate"]
        status = "OPTIMAL" if occ >= 0.9 else "GOOD" if occ >= 0.6 else "UNDER"
        
        matches_data.append({
            "match_id": int(row["match_id"]),
            "opponent": str(row["opponent"]),
            "competition": str(row["competition_type"]),
            "attendance": int(row["tickets_sold"]),
            "revenue": float(row["revenue_so_far"]),
            "status": status
        })
        
    matches_data = sorted(matches_data, key=lambda x: x["match_id"], reverse=True)[:10] # Mostrar los últimos 10
    
    return {
        "total_revenue": total_revenue,
        "avg_occupancy": avg_occupancy,
        "avg_ticket_price": avg_ticket_price,
        "performance_by_competition": competitions_data,
        "recent_matches": matches_data
    }
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
