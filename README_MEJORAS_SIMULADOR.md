# STADIUM IQ — simulador personalizado: revisión de fiabilidad y UX

Se conservan el simulador original y el dataset de entrenamiento. La actualización afecta a:

- `api_multisport_v7.py`: campos específicos por deporte, nombre del evento, comprobaciones de curva, aviso de precio fuera del rango de precios sintéticos vistos para deporte/categoría y advertencias de recomendación en extremos.
- `frontend/src/pages/Multisport.jsx`: nombre de evento, selectores baja/media/alta, parámetros específicos de fútbol, baloncesto, tenis y running, diagnóstico visible.
- `frontend/src/pages/Multisport.css`: estilos.
- `test_escenarios_personalizados.py`: prueba rápida sin arrancar navegador.

## Ejecutar

Desde la raíz del proyecto:

```powershell
python test_escenarios_personalizados.py
python -m uvicorn api_multisport_v7:app --reload --port 8001
```

En otra terminal:

```powershell
cd frontend
npm ci
npm run dev
```

## Interpretación

- Las opciones de popularidad e importancia (baja=0,25, media=0,55, alta=0,85) son **valores numéricos de demostración**, no una calibración validada del mercado.
- El resto de características ocultas procede de un evento sintético de referencia. No es una simulación de un evento real totalmente especificado.
- La demanda estimada puede parecer poco sensible al precio, y una recomendación en el límite de búsqueda debe interpretarse con cautela.
- Las advertencias son indicadores de calidad de la simulación, no una certificación de elasticidad causal.
- La comparación del +13,96 % histórico no se ha recalculado con esta actualización. No cambia el entrenamiento ni las políticas utilizadas en esa evaluación.
