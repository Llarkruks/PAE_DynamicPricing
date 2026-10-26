# Hoja de Ruta Dataset Final

## 1. Auditoria final

Estado auditado sobre:

- `dataset_v2_EQUIPO_corregido.csv`
- `dataset_v2_XGBOOST_encoded_corregido.csv`

Resultado:

- Filas raw: `336414`
- Columnas raw: `64`
- Columnas encoded: `118`
- Sin duplicados detectados en la estructura principal.
- Sin valores nulos.
- Sin bajadas de `current_price` dentro de una misma serie temporal.
- Sin bajadas de `revenue_so_far` al acercarse el partido.
- `scarcity_level` coherente con `remaining_capacity_pct`.
- One-hot de `price_scenario` y `scarcity_level` correcto.
- Raw y encoded sincronizados en las columnas clave.

Correccion aplicada durante esta auditoria:

- `occupancy_rate` se recalculo con precision desde `tickets_sold / sector_capacity`.
- `price_sensitivity_score` se sincronizo correctamente en el encoded.

## 2. Diagnostico de codificacion actual

### Variables bien codificadas para modelo

- Numericas continuas:
  - `current_price`
  - `base_price`
  - `price_vs_base`
  - `tickets_sold`
  - `tickets_remaining`
  - `occupancy_rate`
  - `sales_velocity`
  - `remaining_capacity_pct`
  - `urgency_score`
  - `willingness_to_pay_index`
  - `perceived_value_score`
  - `price_sensitivity_score`
  - `weather_temperature`
  - `rain_probability`

- Binarias:
  - `is_derby`
  - `star_signing_debut`
  - `is_weekend`
  - `is_holiday_period`
  - `is_public_holiday`
  - `is_premium_experience`
  - `hospitality_included`
  - `is_low_availability`
  - `is_last_minute`
  - `is_final_week`
  - `bad_weather_flag`
  - `is_televised`
  - `competing_event_city`

- Categoricas bien pasadas a one-hot en encoded:
  - `visibility_category`
  - `time_bucket`
  - `competition_type`
  - `competition_phase`
  - `sector_family`
  - `vip_type`
  - `vip_product`
  - `price_scenario`
  - `zone_elasticity_class`
  - `scarcity_level`
  - `broadcast_type`
  - `tourism_season_index`

### Variables que estan bien, pero deben tratarse con cuidado

- `urgency_score`
- `willingness_to_pay_index`
- `perceived_value_score`
- `price_sensitivity_score`
- `price_scenario`

Estas variables son sinteticas. Son utiles, pero el equipo debe entender que no son mediciones historicas puras, sino senales de negocio construidas para ayudar al modelo y al dashboard.

### Variables de meteo

Actualmente estan en formato correcto:

- `weather_temperature`: numerica continua.
- `rain_probability`: numerica continua de 0 a 1.
- `bad_weather_flag`: binaria.

Para una version futura se podria enriquecer con:

- `weather_comfort_score`
- `temperature_deviation_from_ideal`
- `is_hot_weather`
- `is_cold_weather`
- `weather_attendance_risk`


## 3. Variables de neuromarketing recomendadas

introducir variables numericas de 0 a 100. Asi son faciles de explicar, visualizar y usar en XGBoost sin one-hot adicional.

### `fomo_index`

Mide miedo a quedarse sin entrada.

Inputs:

- `remaining_capacity_pct`
- `occupancy_rate`
- `days_to_match`
- `match_importance`
- `competition_type`
- `competition_phase`
- `is_derby`

Uso:

- Modelo: si
- Dashboard: si

Interpretacion:

- Alto: poca disponibilidad, partido cercano, alta demanda o partido importante.
- Bajo: mucha disponibilidad o partido lejano.

### `social_proof_index`

Mide senal de traccion social, es decir, si el mercado parece estar comprando.

Inputs:

- `occupancy_rate`
- `sales_velocity`
- `scarcity_level`
- `tickets_sold`
- `sector_capacity`

Uso:

- Modelo: si
- Dashboard: si

Interpretacion:

- Alto: mucha ocupacion y buen ritmo de venta.
- Bajo: baja ocupacion o ritmo lento.

### `perceived_exclusivity_index`

Mide exclusividad percibida del producto.

Inputs:

- `sector_family`
- `visibility_category`
- `vip_type`
- `vip_product`
- `scarcity_level`
- `competition_type`
- `competition_phase`

Uso:

- Modelo: si
- Dashboard: si

Interpretacion:

- Alto: VIP, buena visibilidad, poca disponibilidad o partido premium.
- Bajo: producto mas masivo o menos exclusivo.

### `emotional_pull_index`

Mide atraccion emocional del partido.

Inputs:

- `opponent_ranking`
- `match_importance`
- `is_derby`
- `competition_type`
- `competition_phase`
- `team_form`
- `league_position`
- `star_signing_debut`
- `historical_goals_avg`

Uso:

- Modelo: si
- Dashboard: si

Interpretacion:

- Alto: partido importante, rival fuerte, fase relevante, derbi o narrativa emocional.
- Bajo: partido de menor tiron.

### `price_fairness_score`

Mide percepcion de justicia del precio.

Inputs:

- `price_vs_base`
- `match_importance`
- `competition_type`
- `competition_phase`
- `visibility_category`
- `sector_family`
- `vip_type`
- `occupancy_rate`

Uso:

- Modelo: si
- Dashboard: si

Interpretacion:

- Alto: el precio parece justificable por producto y contexto.
- Bajo: el precio parece agresivo sin suficiente justificacion.

Nota:

- Es una variable inversa a la friccion de precio.
- Si se usa en dashboard, conviene mostrarla como "fairness" o "aceptacion percibida", no como verdad absoluta.

### `decision_pressure_index`

Mide presion psicologica para decidir pronto.

Inputs:

- `days_to_match`
- `is_last_minute`
- `is_final_week`
- `scarcity_level`
- `occupancy_rate`
- `sales_velocity`

Uso:

- Modelo: si
- Dashboard: si

Interpretacion:

- Alto: el usuario tiene menos tiempo y menos inventario disponible.
- Bajo: aun hay margen temporal y disponibilidad.

### `anchor_price_gap`

Mide distancia psicologica contra el precio base.

Inputs:

- `current_price`
- `base_price`

Formula base:

- `anchor_price_gap = (current_price / base_price - 1) * 100`

Uso:

- Modelo: con cuidado, porque se parece a `price_vs_base`.
- Dashboard: si.

Interpretacion:

- Positivo: prima sobre base.
- Negativo: descuento sobre base.

### `premium_anchor_strength`

Mide efecto ancla de productos premium sobre el resto del estadio.

Inputs:

- precio maximo del partido
- precio actual del sector
- `vip_type`
- `sector_family`
- `visibility_category`

Uso:

- Modelo: si
- Dashboard: opcional.

Interpretacion:

- Alto: existe un producto premium caro que hace que otros sectores parezcan relativamente mas razonables.
- Bajo: poco efecto ancla premium.

## 4. Como introducirlas en el dataset

### En el raw

Anadir columnas numericas nuevas al final del CSV:

- `fomo_index`
- `social_proof_index`
- `perceived_exclusivity_index`
- `emotional_pull_index`
- `price_fairness_score`
- `decision_pressure_index`
- `anchor_price_gap`
- `premium_anchor_strength`

Todas deben ir en escala 0 a 100 excepto `anchor_price_gap`, que puede expresarse como porcentaje positivo o negativo.

### En el encoded

Como son numericas, se copian directamente con el mismo nombre. No necesitan one-hot.

### En entrenamiento

Se pueden introducir como features, pero se recomienda entrenar dos variantes:

- Modelo base sin neuromarketing.
- Modelo enriquecido con neuromarketing.

La comparacion debe mirar no solo metricas, sino tambien si las recomendaciones de precio son mas creibles.

## 5. Instrucciones para el programador del dashboard

### Objetivo del dashboard

El dashboard debe ayudar al manager de operaciones a entender:

- donde hay oportunidad de subir precio
- donde hay riesgo de sobreprecio
- que sectores tienen escasez real
- que partidos tienen mayor tiron emocional
- que sectores necesitan empuje comercial
- como evoluciona cada sector en el tiempo

### Vistas recomendadas

1. Vista resumen partido

KPIs:

- ocupacion total
- ingresos acumulados
- potencial restante
- precio medio actual
- urgencia media
- FOMO medio
- fairness medio

2. Vista por sector

Tabla o matriz por sector:

- `sector_name`
- `sector_family`
- `current_price`
- `price_vs_base`
- `tickets_sold`
- `tickets_remaining`
- `occupancy_rate`
- `scarcity_level`
- `revenue_so_far`
- `remaining_revenue_potential`
- `urgency_score`
- `fomo_index`
- `price_fairness_score`

3. Vista curva temporal

Para un sector seleccionado:

- evolucion de `current_price`
- evolucion de `occupancy_rate`
- evolucion de `revenue_so_far`
- evolucion de `sales_velocity`
- evolucion de `urgency_score`
- evolucion de `fomo_index`

4. Vista riesgo y oportunidad

Segmentar sectores en cuadrantes:

- alta demanda + bajo precio relativo: oportunidad de subida.
- baja demanda + precio alto: riesgo de sobreprecio.
- alta escasez + alta urgencia: mantener o subir.
- baja ocupacion + bajo social proof: necesita activacion comercial.

### Filtros necesarios

- partido
- competicion
- fase
- rival
- familia de sector
- tipo VIP
- escenario de precio
- nivel de escasez
- tramo temporal

### Reglas de diseno

- Usar `dataset_v2_EQUIPO_corregido.csv` para dashboard.
- No usar el encoded para dashboard visual.
- Mantener raw y encoded separados en la app.
- Mostrar los indices sinteticos como apoyo a decision, no como verdad absoluta.
- Evitar mostrar demasiados scores a la vez; priorizar 3 o 4 por vista.

### Alertas recomendadas

- Escasez critica: `scarcity_level = critical`
- Posible sobreprecio: `price_fairness_score < 45` y `occupancy_rate < 0.5`
- Oportunidad de subida: `fomo_index > 75` y `price_fairness_score > 55`
- Baja traccion: `social_proof_index < 35` y `days_to_match < 30`
- Sector premium tensionado: `perceived_exclusivity_index > 80` y `remaining_capacity_pct < 0.15`

## 6. Cierre ejecutado

Se han anadido las 8 variables de neuromarketing y se han generado los datasets finales:

- `dataset_v2_EQUIPO_FINAL.csv`
- `dataset_v2_XGBOOST_encoded_FINAL.csv`

Resultado final:

- Filas raw: `336414`
- Columnas raw final: `72`
- Columnas encoded final: `126`
- Sin nulos.
- Sin desalineaciones entre raw y encoded.
- Sin bajadas de precio por serie.
- Sin bajadas de ingresos acumulados por serie.
- One-hot de `price_scenario` correcto.
- One-hot de `scarcity_level` correcto.

Rangos finales de neuromarketing:

- `fomo_index`: `4.48` a `95.19`
- `social_proof_index`: `0.0` a `99.749`
- `perceived_exclusivity_index`: `24.272` a `87.993`
- `emotional_pull_index`: `21.416` a `84.082`
- `price_fairness_score`: `32.406` a `78.895`
- `decision_pressure_index`: `1.12` a `98.773`
- `anchor_price_gap`: `-42.211` a `75.109`
- `premium_anchor_strength`: `23.575` a `86.025`

Lectura de negocio:

- `fomo_index` y `decision_pressure_index` capturan tension temporal y de inventario.
- `social_proof_index` captura traccion real de venta.
- `perceived_exclusivity_index` diferencia bien VIP frente a seating general.
- `emotional_pull_index` captura atractivo del partido.
- `price_fairness_score` ya penaliza primas poco justificadas.
- `premium_anchor_strength` refleja mejor el efecto de referencia premium sobre sectores no VIP.
- `anchor_price_gap` expresa claramente la prima o descuento frente al precio base.

