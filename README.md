# PAE Herramienta XGBoost

Este repositorio contiene una herramienta de simulación de pricing dinámico para entradas deportivas basada en un modelo de Machine Learning (XGBoost). El proyecto se divide en dos partes principales: un backend en Python (FastAPI) y un frontend interactivo en React.

El sistema incorpora variables avanzadas de neuromarketing (presión temporal, FOMO, exclusividad, etc.) para estimar las ventas y determinar el precio óptimo para cada sector.

## Requisitos

- Python 3.9 o superior
- Node.js (y npm)

---

## 1. Arrancar el Backend (Python / FastAPI)

El backend expone la API y carga el modelo de XGBoost entrenado.

1. Abre una terminal y navega a la carpeta principal del proyecto.
2. (Opcional pero recomendado) Crea y activa un entorno virtual de Python.
3. Instala las dependencias necesarias:
   ```bash
   pip install pandas numpy scikit-learn xgboost fastapi uvicorn joblib
   ```
4. Ejecuta el servidor de FastAPI:
   ```bash
   python main.py
   ```
   *El servidor se iniciará y la API estará disponible en `http://localhost:8000`.*

---

## 2. Arrancar el Frontend (React / Vite)

El frontend contiene el Simulador interactivo que consulta la API del backend en tiempo real.

1. Abre **otra terminal** y navega a la carpeta del frontend:
   ```bash
   cd frontend
   ```
2. Instala las dependencias del frontend:
   ```bash
   npm install
   ```
3. Arranca el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   *El frontend estará disponible normalmente en `http://localhost:5173`. Abre esa URL en tu navegador web para utilizar el simulador interactivo.*

---

## Entrenamiento del Modelo (Opcional)

Si necesitas reentrenar el modelo XGBoost con nuevos datos (asegúrate de tener los archivos `dataset_v2_XGBOOST_encoded_FINAL.csv` y `dataset_v2_EQUIPO_FINAL.csv` en la raíz del proyecto):

1. Ejecuta el script de entrenamiento:
   ```bash
   python train_model.py
   ```
   *Esto generará un nuevo archivo `xgb_sales_rate_model.pkl` y actualizará el documento de importancia de variables (`feature_importance_engraving.txt`).*
2. **Reinicia el servidor backend (`main.py`)** para que cargue el nuevo modelo en memoria.
