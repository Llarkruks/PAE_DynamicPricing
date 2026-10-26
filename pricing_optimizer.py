import pandas as pd
import numpy as np
import joblib
import os
import json
from data_loader import load_and_consolidate, CSV_DASHBOARD_PATH, CSV_TRAIN_PATH
from train_model import select_features, MODEL_PATH

FEATURES_PATH = "model_features.json"

def set_sim_categorical(row: pd.Series, prefix: str, value: str) -> pd.Series:
    """
    Simula una variable categórica en un row ya encoded.
    Pone a 1 la columna prefix_value y a 0 el resto de prefix_*.
    """
    # Encontrar todas las columnas que empiezan por prefix_
    # Nota: esto asume que el row es una Serie que puede tener columnas no presentes en el modelo original
    # o que simplemente iteramos sobre las llaves del row
    
    col_to_set = f"{prefix}_{value}"
    
    for col in row.index:
        if col.startswith(f"{prefix}_"):
            if col == col_to_set:
                row[col] = 1
            else:
                row[col] = 0
    return row

def run_optimization_sweep(model, features, context_row, price_range):
    """
    Función centralizada para realizar un barrido de precios y encontrar el óptimo.
    Retorna un DataFrame con los resultados del barrido y la fila del óptimo.
    """
    base_p = float(context_row["base_price"])
    horizon = float(context_row.get("horizon_days", 15))
    
    # 1. Inyectar variables de "Alta Importancia" para que la IA reaccione
    # Muchos de estos campos tienen alta importancia en el modelo (ver feature_importance_engraving.txt)
    occ = float(context_row.get('occupancy_rate', 0.5))
    match_imp = float(context_row.get('match_importance', 5))
    days = float(context_row.get('days_to_match', 30))
    is_derby = bool(context_row.get('is_derby', False))
    
    # Mapeo de sliders a variables con alta importancia en el XGBoost
    context_row['willingness_to_pay_index'] = 30 + (match_imp * 5) + (occ * 20)
    context_row['urgency_score'] = match_imp
    context_row['sales_velocity'] = 0.5 + (occ * 2) # Variable muy importante (0.08)
    
    # Variables Neuromarketing Dinámicas para el Simulador
    context_row['fomo_index'] = min(100, max(0, 30 + (occ * 50) + (match_imp * 3) - (days * 0.2)))
    context_row['decision_pressure_index'] = min(100, max(0, 20 + (occ * 40) + (match_imp * 2) - (days * 0.3)))
    context_row['social_proof_index'] = min(100, max(0, 10 + (occ * 70)))
    context_row['emotional_pull_index'] = min(100, max(0, 40 + (match_imp * 5) + (10 if is_derby else 0)))
    
    # Ajustar niveles de escasez (One-hot encoding manual)
    context_row = set_sim_categorical(context_row, "scarcity_level", "low")
    if occ > 0.8:
        context_row = set_sim_categorical(context_row, "scarcity_level", "critical")
    elif occ > 0.6:
        context_row = set_sim_categorical(context_row, "scarcity_level", "high")
    elif occ > 0.4:
        context_row = set_sim_categorical(context_row, "scarcity_level", "medium")

    # 2. Elasticidad dinámica (E) - Ajustada para ser más sensible
    # E base: Curva de demanda elástica. 
    # Queremos que baje (mercado rígido) cuando el partido es importante.
    E = 3.0 - (occ * 1.8) - (match_imp / 10 * 1.0)
    if is_derby:
        E -= 0.5
    if days < 7:
        E -= 0.4
        
    E = max(0.15, E) # Límite físico: nunca menos de 0.15 (muy rígido)
    
    sweep_results = []
    
    # Predicción base del modelo AI (XGBoost) para el precio base
    ref_row = context_row.copy()
    ref_row["current_price"] = base_p
    ref_row["price_vs_base"] = 1.0
    ref_row["anchor_price_gap"] = 0.0
    base_fairness = context_row.get("price_fairness_score", 50)
    ref_row["price_fairness_score"] = min(100, max(0, base_fairness + (match_imp * 2)))
    
    X_ref = select_features(pd.DataFrame([ref_row]))
    X_ref = X_ref.reindex(columns=features, fill_value=0)
    raw_ai_rate = max(0, model.predict(X_ref)[0])

    for price in price_range:
        temp_row = context_row.copy()
        temp_row["current_price"] = price
        temp_row["price_vs_base"] = price / base_p
        temp_row["anchor_price_gap"] = ((price / base_p) - 1) * 100
        temp_row["price_fairness_score"] = min(100, max(0, base_fairness - ((price / base_p) - 1) * 40 + (match_imp * 2)))
        
        input_df = pd.DataFrame([temp_row])
        X = select_features(input_df)
        X = X.reindex(columns=features, fill_value=0)
        
        # 1. Predicción base del modelo AI
        base_rate = max(0, model.predict(X)[0])
        
        # 2. Factor de elasticidad dinámico (Multiplicador de mercado)
        # Aplicamos un ajuste extra basado en E para que los sliders tengan impacto visual inmediato
        price_ratio = price / base_p
        elasticity_factor = 1.0 - (price_ratio - 1.0) * E 
        
        # 3. Tasa final proyectada
        rate = max(0, base_rate * elasticity_factor)
        
        q = rate * horizon
        rev = price * q
        
        sweep_results.append({
            "Precio": price,
            "TasaVenta": rate,
            "Ingresos": rev,
            "Demanda": q,
            "vsBase": (price/base_p - 1) * 100,
            "RawAIRate": base_rate,
            "Elasticidad": E
        })
    
    sweep_df = pd.DataFrame(sweep_results)
    optimal_idx = sweep_df["Ingresos"].idxmax()
    return sweep_df, sweep_df.loc[optimal_idx], raw_ai_rate

def optimize_pricing(csv_path: str = CSV_TRAIN_PATH):
    """Ejecuta una optimización masiva para todos los sectores definidos."""
    if not os.path.exists(MODEL_PATH) or not os.path.exists(FEATURES_PATH):
        print(f"Error: No se encontró el modelo o las columnas. Ejecuta train_model.py primero.")
        return

    # 1. Cargar el modelo y la lista de features
    print(f"Cargando modelo de IA desde {MODEL_PATH}...")
    model = joblib.load(MODEL_PATH)
    with open(FEATURES_PATH, "r") as f:
        model_features = json.load(f)

    # 2. Cargar el dataset
    print(f"Cargando base de datos ({csv_path})...")
    df = load_and_consolidate(csv_path)
    if df.empty:
        return
    
    # Quedamos solo con un registro por sector para la optimización base
    template_df = df.drop_duplicates(subset=["sector_id"])
    
    results = []

    print(f"Iniciando optimización para {len(template_df)} sectores...")

    # 3. Procesar cada sección de forma independiente
    for idx, row in template_df.iterrows():
        sector_name = row.get("sector_name", f"Sector {row['sector_id']}")
        base_p = float(row["base_price"])
        
        # Barrer precios: desde -40% hasta +120% del base de esta sección
        p_range = np.linspace(base_p * 0.6, base_p * 2.2, 50)
        
        _, optimal, raw_ai_rate = run_optimization_sweep(model, model_features, row, p_range)
        
        print(f"  > {sector_name}:IA €{raw_ai_rate:.2f}/dia -> Sugerido €{optimal['Precio']:.2f}")
        
        results.append({
            "sector": sector_name,
            "base_price": base_p,
            "optimal_price": optimal["Precio"],
            "optimal_revenue": optimal["Ingresos"],
            "predicted_rate": optimal["TasaVenta"],
            "raw_ai_rate": raw_ai_rate
        })

    # Guardar resultados finales
    if results:
        summary_df = pd.DataFrame(results)
        summary_df.to_csv("pricing_optimization_results.csv", index=False)
        print("\n[OK] Resultados maestros guardados en pricing_optimization_results.csv")
    else:
        print("\n[ERROR] No se generaron resultados.")

if __name__ == "__main__":
    optimize_pricing()
