"""Auditoria no destructiva de un CSV multideporte.

Ejemplo:
    python comprobar_nuevo_dataset.py ruta/al/nuevo_dataset.csv

No cambia archivos del proyecto ni reentrena XGBoost.
"""

import argparse
import json
from pathlib import Path

import pandas as pd

from config_deportes import DEPORTES

# Minimo necesario para evaluar la estructura de los eventos.
COLUMNAS_BASE = {
    "sport_type", "event_id", "ticket_category", "ticket_category_id",
    "days_remaining", "category_capacity", "remaining_capacity",
    "current_price", "base_price", "sales_next_period",
}


def auditar(ruta):
    df = pd.read_csv(ruta, low_memory=False)
    problemas = []
    avisos = []
    columnas = set(df.columns)
    faltan = sorted(COLUMNAS_BASE - columnas)
    if faltan:
        problemas.append("Faltan columnas estructurales: " + ", ".join(faltan))

    deportes = sorted(df["sport_type"].dropna().astype(str).unique().tolist()) if "sport_type" in df else []
    nuevos_deportes = sorted(set(deportes) - set(DEPORTES))
    if nuevos_deportes:
        avisos.append("Deportes nuevos (requieren adaptar modelo y formulario): " + ", ".join(nuevos_deportes))

    for sport in sorted(set(deportes) & set(DEPORTES)):
        fields = DEPORTES[sport]["variables"]
        missing = [field for field in fields if field not in columnas]
        if missing:
            avisos.append(f"{sport}: faltan variables especificas: {', '.join(missing)}")

    if {"event_id", "ticket_category_id", "days_remaining"} <= columnas:
        n = int(df.duplicated(["event_id", "ticket_category_id", "days_remaining"]).sum())
        if n:
            avisos.append(f"Filas repetidas por evento/categoria/dia: {n}")

    for field in ("category_capacity", "remaining_capacity", "current_price", "sales_next_period"):
        if field not in columnas:
            continue
        numeric = pd.to_numeric(df[field], errors="coerce")
        invalid = int(numeric.isna().sum())
        if invalid:
            avisos.append(f"{field}: {invalid} valores vacios o no numericos")
        if field == "current_price" and (numeric <= 0).any():
            problemas.append("Hay precios actuales menores o iguales a cero")
        if field in ("category_capacity", "remaining_capacity", "sales_next_period") and (numeric < 0).any():
            problemas.append(f"{field}: contiene valores negativos")

    if {"remaining_capacity", "category_capacity"} <= columnas:
        stock = pd.to_numeric(df["remaining_capacity"], errors="coerce")
        capacity = pd.to_numeric(df["category_capacity"], errors="coerce")
        if (stock > capacity).any():
            problemas.append("Hay inventarios disponibles mayores que el aforo")

    # Comparamos columnas con el dataset actual, si existe un CSV real.
    actual = Path("dataset_multideporte_EQUIPO.csv")
    nuevas_columnas = []
    columnas_eliminadas = []
    if actual.exists() and actual.stat().st_size > 1000:
        try:
            anterior = set(pd.read_csv(actual, nrows=0).columns)
            nuevas_columnas = sorted(columnas - anterior)
            columnas_eliminadas = sorted(anterior - columnas)
        except (OSError, ValueError) as exc:
            avisos.append(f"No se pudo comparar con el CSV actual: {exc}")

    return {
        "archivo": str(ruta),
        "filas": int(len(df)),
        "columnas": len(df.columns),
        "eventos": int(df["event_id"].nunique()) if "event_id" in df else None,
        "deportes": deportes,
        "deportes_nuevos": nuevos_deportes,
        "variables_nuevas": nuevas_columnas,
        "variables_desaparecidas": columnas_eliminadas,
        "errores": problemas,
        "avisos": avisos,
    }


def main():
    parser = argparse.ArgumentParser(description="Comprobar compatibilidad de dataset nuevo")
    parser.add_argument("csv", type=Path)
    args = parser.parse_args()
    if not args.csv.is_file():
        parser.error(f"No existe: {args.csv}")
    try:
        result = auditar(args.csv)
    except Exception as exc:
        parser.exit(2, f"No se pudo analizar el CSV: {exc}\n")
    print(json.dumps(result, indent=2, ensure_ascii=True))
    if result["errores"]:
        parser.exit(1, "Hay problemas de estructura que deben revisarse.\n")


if __name__ == "__main__":
    main()
