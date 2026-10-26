import pandas as pd
import os

# Nuevos datasets V2
CSV_TRAIN_PATH = "dataset_v2_XGBOOST_encoded_FINAL.csv"
CSV_EQUIPO_PATH = "dataset_v2_EQUIPO_FINAL.csv"
CSV_DASHBOARD_PATH = "FCB_DASHBOARD_INPUT_TEMPLATE_excel_es.csv"

def load_and_consolidate(csv_path: str = CSV_TRAIN_PATH) -> pd.DataFrame:
    """Carga el dataset consolidado listo para entrenamiento o inferencia."""
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} no encontrado.")
        return pd.DataFrame()
            
    print(f"Cargando dataset desde {csv_path}...")
    # Soportar el nuevo formato: separador ; y decimal ,
    df = pd.read_csv(csv_path, sep=";", decimal=",")
    
    # Si estamos cargando el encoded y existe el de equipo, unirlos para tener nombres de sectores, etc.
    if csv_path == CSV_TRAIN_PATH and os.path.exists(CSV_EQUIPO_PATH):
        print(f"Uniendo con {CSV_EQUIPO_PATH} para obtener metadatos (nombres, etc.)...")
        df_equipo = pd.read_csv(CSV_EQUIPO_PATH, sep=";", decimal=",")
        
        # Columnas de interés que suelen faltar en el encoded
        meta_cols = ["snapshot_id", "match_id", "sector_id", "sector_name", "opponent", "visibility_category", "time_bucket"]
        meta_cols = [c for c in meta_cols if c in df_equipo.columns]
        
        # Unir por las llaves primarias
        keys = ["snapshot_id", "match_id", "sector_id"]
        df = pd.merge(df, df_equipo[meta_cols], on=keys, how="left", suffixes=('', '_raw'))

    # --- EXTRACCIÓN DE JERARQUÍA ---
    if 'sector_name' in df.columns and 'item_area' not in df.columns:
        df['item_area'] = df['sector_name'].str.extract(r'(.*?)\s*\d+$')
        df['item_level'] = df['sector_name'].str.extract(r'(\d+)$')
        df['item_area'] = df['item_area'].fillna(df['sector_name'])
        df['item_level'] = df['item_level'].fillna("0")
    
    # Asegurar que los booleanos son interpretados correctamente
    bool_cols = ["is_derby", "star_signing_debut", "is_weekend", "is_holiday_period", "is_public_holiday", 
                 "is_premium_experience", "hospitality_included", "is_low_availability", "is_last_minute", 
                 "is_final_week", "bad_weather_flag", "is_televised"]
    
    for col in bool_cols:
        if col in df.columns:
            df[col] = df[col].astype(bool)
            
    return df

def main() -> None:
    df = load_and_consolidate()
    if not df.empty:
        print("Carga completada: registros finales =", len(df))
        print(df.head())

if __name__ == "__main__":
    main()
