
# STADIUM IQ

### Smart Stadium Pricing | Predicción de demanda y optimización dinámica de precios

STADIUM IQ es una aplicación web desarrollada como proyecto académico (PAE) que combina técnicas de Machine Learning y optimización para recomendar precios de entradas de eventos deportivos.

El objetivo es estudiar cómo las predicciones de demanda pueden utilizarse para tomar decisiones de pricing y evaluar si una estrategia de precios dinámicos puede mejorar los ingresos frente a una política de precio fijo.

> **Importante:** el proyecto utiliza datos sintéticos. Los resultados no representan ventas reales ni garantizan mejoras comerciales.

---

## 1. Funcionalidades

La plataforma contiene cuatro secciones:

### Inicio

Presentación del proyecto, su metodología y acceso a las funcionalidades.

### Simulador de precios

Herramienta multideporte basada en XGBoost.

Permite:

- Seleccionar un deporte y un evento.
- Seleccionar la categoría de entrada.
- Elegir los días restantes hasta el evento.
- Modificar el inventario disponible para estudiar escenarios hipotéticos.
- Predecir las ventas del siguiente período comercial.
- Calcular el precio recomendado según los ingresos estimados.
- Comparar el precio observado con el recomendado.
- Visualizar la relación entre precio, demanda e ingresos.

El simulador admite fútbol, baloncesto, tenis y running.

### Simulador original

Primer prototipo de optimización de precios, orientado al fútbol.

Se conserva para mostrar la evolución del desarrollo y permitir la comparación con el enfoque multideporte posterior.

### Resultados y validación

Panel de evaluación experimental que permite:

- Consultar la mejora media de ingresos simulados.
- Analizar la estabilidad de los resultados entre repeticiones.
- Comparar los resultados por deporte.
- Visualizar los ingresos acumulados por evento y categoría.
- Comparar la evolución del inventario bajo distintas políticas.

---

## 2. Tecnologías

| Componente | Tecnología |
|---|---|
| Lenguaje de programación | Python |
| Machine Learning | XGBoost |
| Tratamiento de datos | pandas y NumPy |
| API backend | FastAPI |
| Frontend | React |
| Herramienta de desarrollo frontend | Vite |
| Gráficos | Recharts |
| Comunicación frontend-backend | API REST |
| Control de versiones | Git y GitHub |

---

## 3. Dataset

El sistema multideporte utiliza un dataset sintético generado para el proyecto.

Características principales:

- 120 eventos deportivos.
- 4 deportes.
- 30 eventos por deporte.
- 2 categorías de entrada por evento.
- 30 observaciones temporales por categoría.
- 7.200 registros en total.

El dataset incorpora variables relacionadas con el evento, la categoría de entrada, los precios, la disponibilidad, las ventas y otros factores que pueden influir en la demanda.

Archivo principal:

`dataset_multideporte_EQUIPO.csv`

El generador original se conserva en:

`generar_dataset.py`

Los datos sintéticos permiten desarrollar y evaluar el sistema en un entorno experimental controlado, pero no representan el comportamiento observado de compradores reales.

---

## 4. Modelo predictivo

STADIUM IQ utiliza XGBoost para estimar la demanda de entradas.

Se han desarrollado dos enfoques predictivos:

**Modelo directo**

Predice el número de entradas que se venderían durante el siguiente período comercial.

**Modelo de tasa de ventas**

Predice la proporción del inventario disponible que se vendería durante ese período.

El simulador multideporte utiliza el modelo de tasa como opción predeterminada.

El entrenamiento y la generación de los modelos se gestionan mediante:

`multisport_v7.py`

La evaluación predictiva se realiza con:

`validate_v7.py`

Para reducir la fuga de información entre entrenamiento y evaluación, la separación de datos se realiza por evento, evitando que observaciones temporales de un mismo evento aparezcan simultáneamente en ambos conjuntos.

---

## 5. Optimización de precios

El proceso de recomendación sigue estos pasos:

1. El usuario configura el evento y las entradas disponibles.
2. Se generan distintos precios candidatos dentro del rango permitido.
3. XGBoost estima la demanda del siguiente período para cada precio.
4. Se calculan los ingresos previstos:

   `Ingresos previstos = Precio × Ventas previstas`

5. Se selecciona el precio con mayores ingresos estimados.

El algoritmo considera el inventario disponible y evita proyectar ventas superiores a las entradas restantes.

**Limitación:** esta recomendación maximiza los ingresos estimados para el siguiente período comercial, no necesariamente los ingresos totales hasta la celebración del evento.

Además, las predicciones de demanda para precios alternativos no constituyen por sí solas estimaciones causales del efecto del precio.

---

## 6. Evaluación de estrategias de precios

Se comparan dos políticas comerciales:

**Precio fijo**

Mantiene un precio de referencia durante el período de comercialización.

**Precio dinámico**

Recalcula diariamente el precio recomendado mediante XGBoost, teniendo en cuenta el estado actualizado del inventario.

En esta evaluación, XGBoost selecciona los precios y la función de demanda sintética del generador produce las ventas simuladas.

Así, los ingresos no se calculan directamente utilizando las propias predicciones de XGBoost.

### Diseño experimental

- 96 eventos utilizados para entrenamiento.
- 24 eventos reservados para evaluación.
- 48 categorías de entradas evaluadas.
- 20 repeticiones con variaciones aleatorias de demanda.
- Utilización de factores aleatorios compartidos entre las dos estrategias para mejorar la comparabilidad.

En las repeticiones se mantiene fijo el modelo y la partición de eventos.

### Resultados principales

| Indicador | Resultado |
|---|---:|
| Mejora media de ingresos simulados | +13,96 % |
| Repeticiones con mejora global | 20 de 20 |
| Eventos de evaluación | 24 |
| Categorías de evaluación | 48 |

En estas condiciones experimentales, la política dinámica obtuvo mayores ingresos simulados que la política fija en las 20 repeticiones realizadas.

Estos resultados sugieren que las predicciones de demanda pueden aportar valor a la toma de decisiones de precios dentro del entorno sintético utilizado.

### Limitaciones de la evaluación

- Los datos y las ventas son sintéticos.
- No se han realizado pruebas con consumidores reales.
- Los resultados dependen del generador de demanda y de sus supuestos.
- Las 20 repeticiones utilizan el mismo conjunto de eventos y el mismo modelo.
- Las mejoras no deben interpretarse como un intervalo de confianza generalizable a eventos reales.
- La estrategia dinámica optimiza cada día individualmente; no resuelve una optimización global de todo el horizonte comercial.

El análisis demuestra el comportamiento del sistema dentro del simulador empleado, no una mejora garantizada en situaciones comerciales reales.

---

## 7. Estructura del proyecto

```text
PAE_DynamicPricing/
|
|-- frontend/
|   |-- public/
|   |   `-- validation/
|   |       |-- v8_2_resumen.json
|   |       |-- v8_2_repeticiones.csv
|   |       `-- v8_2_detalle.csv
|   |
|   `-- src/
|       |-- App.jsx
|       |-- Sidebar.jsx
|       `-- pages/
|           |-- Dashboard.jsx
|           |-- Simulator.jsx
|           |-- Multisport.jsx
|           `-- Validation.jsx
|
|-- main.py
|-- data_loader.py
|-- pricing_optimizer.py
|-- train_model.py
|
|-- api_multisport_v7.py
|-- multisport_v7.py
|-- multisport_v7_model.joblib
|-- multisport_v7_metrics.json
|
|-- dataset_multideporte_EQUIPO.csv
|-- generar_dataset.py
|
|-- validate_v7.py
|-- v7_8_evaluacion.py
|-- v8_2_validacion.py
|
|-- requirements.txt
`-- README.md
```

La raíz también incluye los datasets, características y modelos necesarios para ejecutar el simulador original.

---

## 8. Instalación

### Requisitos

- Python 3.10 o superior, con las dependencias compatibles.
- Node.js y npm.
- Git, si se desea clonar el repositorio.

### Clonar el proyecto

```bash
git clone https://github.com/Llarkruks/PAE_DynamicPricing.git
cd PAE_DynamicPricing
```

### Crear un entorno virtual de Python

En Windows con PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Si PowerShell bloquea la activación, se puede habilitar temporalmente para la sesión:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

### Instalar dependencias Python

```powershell
pip install -r requirements.txt
```

### Instalar dependencias del frontend

```powershell
cd frontend
npm ci
cd ..
```

---

## 9. Ejecutar STADIUM IQ

Para utilizar todas las funcionalidades, hay que ejecutar tres servicios en terminales independientes.

### Terminal 1: backend original

Desde la raíz del proyecto, con el entorno virtual activado:

```powershell
python -m uvicorn main:app --reload --port 8000
```

### Terminal 2: backend multideporte

Desde la raíz del proyecto, con el entorno virtual activado:

```powershell
python -m uvicorn api_multisport_v7:app --reload --port 8001
```

### Terminal 3: frontend

```powershell
cd frontend
npm run dev
```

La aplicación estará disponible en:

**http://localhost:5173/**

Rutas principales:

| Ruta | Funcionalidad |
|---|---|
| `/` | Inicio |
| `/multisport` | Simulador de precios |
| `/simulator` | Simulador original |
| `/validation` | Resultados y validación |

---

## 10. Reproducir los experimentos

### Entrenar el modelo multideporte

Desde la raíz del proyecto:

```powershell
python multisport_v7.py train
```

Esto genera los archivos del modelo y sus métricas.

### Evaluación predictiva

```powershell
python validate_v7.py
```

Este script permite estudiar el rendimiento del modelo predictivo.

### Evaluación de estrategias comerciales

```powershell
python v8_2_validacion.py --repeticiones 20
```

La evaluación genera:

- `v8_2_resumen.json`
- `v8_2_repeticiones.csv`
- `v8_2_deportes.csv`
- `v8_2_detalle.csv`

La evaluación depende de las funciones de:

`v7_8_evaluacion.py`

Y del generador original:

`generar_dataset.py`

Los resultados publicados en la web se encuentran en:

`frontend/public/validation/`

Si se vuelve a ejecutar la evaluación y se desea actualizar la web, se deben copiar los nuevos archivos de resumen, repeticiones y detalle a esa carpeta.

---

## 11. Alcance del proyecto

STADIUM IQ es un prototipo académico de apoyo a la toma de decisiones comerciales.

Su aportación principal consiste en integrar:

- Predicción de demanda mediante Machine Learning.
- Evaluación de precios alternativos.
- Recomendaciones de precios basadas en ingresos previstos.
- Simulación del inventario a lo largo del tiempo.
- Comparación experimental de políticas de precio fijo y dinámico.
- Visualización de resultados mediante una aplicación web.

El sistema no debe utilizarse directamente para establecer precios reales sin disponer de datos comerciales representativos, validación adicional y controles de negocio adecuados.

---

## 12. Trabajo futuro

Entre las posibles ampliaciones se encuentran:

- Validación con datos reales de ticketing.
- Evaluación con múltiples particiones de entrenamiento y prueba.
- Optimización conjunta de todo el horizonte temporal.
- Incorporación de restricciones comerciales.
- Modelos de elasticidad y respuesta causal al precio.
- Comparación con políticas adicionales de pricing.
- Despliegue de la plataforma en un entorno de producción.

---

## Proyecto académico

**STADIUM IQ — Smart Stadium Pricing**

Proyecto PAE centrado en el uso de inteligencia artificial para la predicción de demanda y la optimización experimental de precios de entradas deportivas.
