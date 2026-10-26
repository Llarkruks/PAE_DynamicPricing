import pandas as pd
import numpy as np
from sklearn.model_selection import GroupKFold
from sklearn.metrics import mean_squared_error, r2_score
from xgboost import XGBRegressor
import joblib
import json

from data_loader import load_and_consolidate

MODEL_PATH = "xgb_sales_rate_model.pkl"

def select_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Columnas a excluir (IDs, targets, y metadatos)
    # snapshot_id, match_id, sector_id no deben ser features principales
    exclude = [
        "snapshot_id", "match_id", "sector_id", "sector_name", 
        "y_sales_rate_per_day", "y_tickets_sold_delta", 
        "tickets_sold", "tickets_remaining", "revenue_potential",
        "initial_sales_horizon", "revenue_so_far", "remaining_revenue_potential",
        "total_sector_revenue_potential", "revenue_per_capacity",
        "item_area", "item_level", "opponent", "visibility_category", "time_bucket"
    ]
    
    # Identificar columnas base de features
    features = [c for c in df.columns if c not in exclude]
    df_sub = df[features].copy()

    # Reemplazar nulos numéricos con la mediana
    numeric_df = df_sub.select_dtypes(include=[np.number])
    df_sub[numeric_df.columns] = numeric_df.fillna(numeric_df.median())
    
    # Asegurar que no hay objetos/strings restantes (el encoded no debería tenerlos)
    df_sub = df_sub.select_dtypes(exclude=['object'])

    return df_sub

def train():
    df = load_and_consolidate()
    if df.empty:
        print("Dataset vacío. Abortando.")
        return

    # Target: y_sales_rate_per_day
    target = "y_sales_rate_per_day"
    if target not in df.columns:
        raise ValueError(f"No se encontró {target} en el set de datos.")

    X = select_features(df)
    y = df[target].astype(float)
    groups = df["match_id"] # Para GroupKFold

    print(f"Features seleccionadas ({X.shape[1]}): {X.columns.tolist()[:10]}...")
    print(f"Registros para entrenamiento: {X.shape[0]}")
    print(f"Número de partidos (grupos): {groups.nunique()}")

    # Validación por Grupos (match_id) como recomienda LEEME_dataset.txt
    gkf = GroupKFold(n_splits=5)

    fold_results = []
    importances = []

    print("\nIniciando validación cruzada por grupos (match_id)...")
    for fold, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups=groups), start=1):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

        model = XGBRegressor(
            n_estimators=1000,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            early_stopping_rounds=50,
            objective="reg:squarederror",
            random_state=42,
            n_jobs=-1,
        )

        model.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )

        y_pred = model.predict(X_val)
        mse = mean_squared_error(y_val, y_pred)
        r2 = r2_score(y_val, y_pred)
        fold_results.append({"fold": fold, "mse": mse, "r2": r2, "best_iteration": model.best_iteration})
        importances.append(model.feature_importances_)

        print(f"Fold {fold}: MSE={mse:.4f}, R2={r2:.4f} (Mejor iteración: {model.best_iteration})")

    mean_importance = np.mean(importances, axis=0)
    importance_df = pd.DataFrame({"feature": X.columns, "importance": mean_importance}).sort_values("importance", ascending=False)
    
    print("\nTop 15 Feature Importances:\n", importance_df.head(15))

    # Registro de importancia de variables
    with open("feature_importance_engraving.txt", "w", encoding="utf-8") as f:
        f.write(f"Modelo: {MODEL_PATH}\n")
        f.write(f"Target: {target}\n")
        f.write(f"R2 promedio: {np.mean([f['r2'] for f in fold_results]):.4f}\n")
        f.write("Importancia de features tras entrenamiento (Top 25):\n")
        for _, row in importance_df.head(25).iterrows():
            f.write(f"{row['feature']}: {row['importance']:.6f}\n")

    # Entrenar modelo final en todo el set
    best_n = int(np.mean([f['best_iteration'] for f in fold_results]))
    print(f"\nEntrenando modelo final en dataset completo (n_estimators={best_n})...")
    final_model = XGBRegressor(
        n_estimators=best_n,
        learning_rate=0.05,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=-1,
    )
    final_model.fit(X, y)
    joblib.dump(final_model, MODEL_PATH)
    
    # Guardar las columnas del modelo
    with open("model_features.json", "w") as f:
        json.dump(X.columns.tolist(), f)

    print(f"[DONE] Modelo final guardado en {MODEL_PATH}")
    print(f"[DONE] Columnas guardadas en model_features.json")

if __name__ == "__main__":
    train()
