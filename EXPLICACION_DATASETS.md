# Explicacion Completa de los Datasets

## Objetivo del dataset

Este dataset se ha construido para alimentar una herramienta de pricing dinamico para entradas del FC Barcelona. La herramienta usa variables de contexto deportivo, demanda, precio, disponibilidad, meteorologia, producto y neuromarketing para estimar demanda y recomendar precios por sector.

La idea principal es que cada fila representa un snapshot comercial:

- un partido concreto
- un sector concreto
- un momento concreto antes del partido

Por ejemplo, una fila puede representar el sector `Gol Nord 1` para un partido determinado cuando faltan `30` dias para jugarse.

## Archivos finales

Los archivos recomendados para continuar el proyecto son:

- `dataset_v2_EQUIPO_FINAL.csv`
- `dataset_v2_XGBOOST_encoded_FINAL.csv`

### `dataset_v2_EQUIPO_FINAL.csv`

Es el dataset legible para personas. Contiene variables categoricas en texto, como `competition_type`, `sector_family`, `scarcity_level` o `price_scenario`.

Uso recomendado:

- explicar el proyecto
- validar datos con negocio
- construir el dashboard del manager de operaciones
- analizar casos concretos de partido y sector

### `dataset_v2_XGBOOST_encoded_FINAL.csv`

Es el dataset preparado para Machine Learning. Las variables categoricas estan codificadas en columnas one-hot.

Uso recomendado:

- entrenamiento del modelo XGBoost
- pruebas de features
- comparacion de modelos

## Diferencia entre raw y encoded

En el raw, una variable categorica aparece asi:

```text
competition_type = LaLiga
```

En el encoded, esa misma informacion aparece como varias columnas binarias:

```text
competition_type_LaLiga = 1
competition_type_Champions_League = 0
competition_type_Copa_del_Rey = 0
competition_type_Friendly = 0
competition_type_Supercopa = 0
```

Esto permite que el modelo entienda categorias sin interpretar texto directamente.

## Variables de identificacion

### `snapshot_id`

Identificador unico de cada fila.

Uso:

- trazabilidad
- unir raw y encoded
- evitar duplicados

### `match_id`

Identificador del partido.

Uso:

- agrupar todos los sectores y snapshots de un mismo partido
- hacer validaciones por partido
- evitar mezclar partidos en entrenamiento

### `sector_id`

Identificador del sector del estadio.

Uso:

- agrupar la evolucion temporal de un sector
- comparar comportamiento entre sectores

## Variables objetivo

Estas variables son las que el modelo intenta aprender o predecir.

### `y_sales_rate_per_day`

Ritmo esperado de ventas futuras por dia.

Si es alto:

- se espera que el sector venda rapido en los proximos dias
- puede justificar mantener o subir precio

Si es bajo:

- se espera poca venta futura
- puede indicar riesgo de sobreprecio o baja demanda

### `y_tickets_sold_delta`

Numero de entradas que se espera vender en el horizonte futuro.

Si es alto:

- hay potencial de venta cercano

Si es bajo:

- la demanda esperada es limitada

### `horizon_days`

Numero de dias futuros que cubre el target.

Ejemplo:

- si faltan 30 dias, puede mirar una ventana futura de varios dias
- si falta 1 dia, el horizonte se reduce porque no puede mirar mas alla del partido

## Variables temporales

### `days_to_match`

Dias restantes hasta el partido.

Si es alto:

- estamos lejos del partido
- suele haber menos presion de compra

Si es bajo:

- estamos cerca del partido
- aumenta la urgencia comercial

### `time_bucket`

Agrupacion comercial de `days_to_match`.

Ejemplos:

- `D91-150`
- `D31-60`
- `D8-14`
- `D1-3`

Uso:

- facilita segmentar la venta por fases comerciales
- ayuda al dashboard a mostrar el ciclo de venta

### `initial_sales_horizon`

Primer punto temporal disponible para esa serie de partido y sector.

Uso:

- saber desde cuando se observa la venta de ese sector

## Variables de precio

### `base_price`

Precio base de referencia del sector.

Interpretacion:

- sirve como punto de comparacion
- no necesariamente es el precio final de venta

### `current_price`

Precio actual del sector en ese snapshot.

Si es alto:

- el sistema esta capturando mayor valor del sector o del contexto

Si es bajo:

- puede indicar precio conservador, baja demanda o estrategia de activacion

### `price_vs_base`

Relacion entre precio actual y precio base.

Formula:

```text
current_price / base_price
```

Si es mayor que 1:

- el precio actual esta por encima del precio base

Si es igual a 1:

- el precio actual coincide con el precio base

Si es menor que 1:

- el precio actual esta por debajo del precio base

### `anchor_price_gap`

Prima o descuento porcentual frente al precio base.

Formula conceptual:

```text
(current_price / base_price - 1) * 100
```

Si es alto:

- hay una prima importante sobre el precio base

Si es negativo:

- hay descuento frente al precio base

Uso:

- dashboard
- analisis de percepcion de precio
- variable de neuromarketing ligada al efecto ancla

## Variables de venta e inventario

### `tickets_sold`

Entradas vendidas acumuladas hasta el snapshot.

Si es alto:

- el sector esta teniendo buena traccion

Si es bajo:

- puede haber baja demanda o todavia estar lejos del partido

### `tickets_remaining`

Entradas pendientes por vender.

Si es alto:

- queda mucho inventario
- menor presion de escasez

Si es bajo:

- queda poco inventario
- aumenta la urgencia y el poder de precio

### `occupancy_rate`

Porcentaje del sector ya vendido.

Formula:

```text
tickets_sold / sector_capacity
```

Si es alto:

- el sector esta muy ocupado
- hay prueba social y menor disponibilidad

Si es bajo:

- la venta esta poco avanzada

### `remaining_capacity_pct`

Porcentaje de aforo restante.

Formula:

```text
tickets_remaining / sector_capacity
```

Si es alto:

- queda mucha disponibilidad

Si es bajo:

- hay escasez

### `sales_velocity`

Velocidad media de ventas observada hasta ese momento.

Si es alta:

- el sector esta vendiendo rapido

Si es baja:

- el sector vende lento

Uso:

- estimar traccion comercial
- alimentar indices como `social_proof_index`

## Variables de escasez

### `scarcity_level`

Nivel de escasez comercial.

Reglas:

- `low`: queda mas del 35% de capacidad
- `medium`: queda entre 15% y 35%
- `high`: queda entre 5% y 15%
- `critical`: queda 5% o menos

Si es `critical`:

- el sector esta casi agotado
- puede justificar precios mas altos

Si es `low`:

- hay inventario suficiente
- hay menos presion para comprar

### `is_low_availability`

Variable binaria que indica baja disponibilidad.

Valor:

- `1`: queda 15% o menos de capacidad
- `0`: queda mas del 15%

### `is_last_minute`

Indica si estamos en ventana de ultima hora.

Si vale `1`:

- queda muy poco tiempo para el partido

### `is_final_week`

Indica si estamos en la ultima semana antes del partido.

Si vale `1`:

- el manager debe vigilar conversion, escasez y precio con mas frecuencia

## Variables economicas

### `revenue_so_far`

Ingresos acumulados reales hasta el snapshot.

Importante:

- se calcula por ventas incrementales y precio vigente en cada tramo
- no revaloriza entradas ya vendidas con el precio actual

Si es alto:

- el sector ya ha generado buenos ingresos

### `remaining_revenue_potential`

Ingresos potenciales si las entradas restantes se vendieran al precio actual.

Si es alto:

- queda oportunidad economica por capturar

### `total_sector_revenue_potential`

Suma de:

```text
revenue_so_far + remaining_revenue_potential
```

Uso:

- estimar el potencial total del sector

### `revenue_per_capacity`

Ingresos acumulados por asiento de capacidad.

Formula:

```text
revenue_so_far / sector_capacity
```

Si es alto:

- el sector monetiza bien por asiento

## Variables del sector y producto

### `sector_name`

Nombre del sector.

Ejemplo:

- `Gol Nord 1`
- `Lateral 2`
- `VIP Tribuna`

### `sector_capacity`

Capacidad total del sector.

Si es alta:

- sector grande
- normalmente mas volumen y menor exclusividad

Si es baja:

- sector mas limitado
- puede aumentar exclusividad

### `visibility_category`

Calidad de visibilidad.

Valores:

- `Limited`
- `Standard`
- `Good`
- `Premium`
- `VIP`

Si es alta:

- mayor valor percibido
- menor sensibilidad al precio

### `sector_family`

Familia comercial del sector.

Valores:

- `Gol`
- `Corner`
- `Lateral`
- `Tribuna`
- `VIP`

Interpretacion:

- `Gol`: producto mas masivo y sensible al precio
- `Corner`: intermedio
- `Lateral`: mejor visibilidad
- `Tribuna`: producto de mayor valor
- `VIP`: producto premium

### `vip_type`

Tipo de producto VIP.

Valores:

- `No VIP`
- `VIP Normal`
- `VIP Premium`

Si es VIP Premium:

- mayor exclusividad
- mayor valor percibido
- menor sensibilidad al precio

### `vip_product`

Producto VIP concreto.

Ejemplos:

- `Palco Presidencial`
- `Players Zone`
- `VIP Tribuna`
- `VIP Lateral`
- `none`

Si es `none`:

- no aplica producto VIP

### `is_premium_experience`

Indica si la experiencia se considera premium.

### `hospitality_included`

Indica si el producto incluye hospitality.

Si vale `1`:

- el precio puede justificarse mejor
- aumenta valor percibido

## Variables de elasticidad y sensibilidad

### `zone_elasticity_class`

Clase estructural de elasticidad del sector.

Valores:

- `elastic`
- `medium_high`
- `medium`
- `medium_low`
- `inelastic`
- `very_inelastic`

Interpretacion:

- `elastic`: el comprador reacciona mucho al precio
- `inelastic`: el comprador reacciona menos al precio
- `very_inelastic`: producto premium con mayor tolerancia a precio alto

### `price_sensitivity_score`

Sensibilidad numerica al precio.

Si es alto:

- el sector es sensible al precio
- subir precio puede reducir demanda

Si es bajo:

- el sector tolera mejor precios altos

## Variables de escenario comercial

### `price_scenario`

Clasifica el estado comercial del precio.

Valores:

- `bajo_estimado`
- `normal_observado`
- `interpolado`
- `extrema_observado`
- `standard`

Interpretacion:

- `bajo_estimado`: precio conservador en contexto de baja demanda
- `normal_observado`: precio normal cercano a base
- `interpolado`: precio estable en contexto medio o premium
- `extrema_observado`: demanda muy alta, poca capacidad y prima clara
- `standard`: pricing dinamico normal con uplift o comportamiento no extremo

Uso:

- segmentar la estrategia de precio
- explicar decisiones al manager
- aportar contexto al modelo

## Variables deportivas

### `opponent`

Rival del partido.

### `opponent_ranking`

Ranking o nivel del rival.

Si indica rival fuerte:

- suele aumentar demanda
- aumenta tiron emocional

### `match_importance`

Importancia del partido.

Si es alta:

- mayor demanda
- mayor disposicion a pagar
- mayor urgencia

### `is_derby`

Indica si el partido es derbi.

Si vale `1`:

- mayor emocion
- mayor presion de demanda

### `team_form`

Forma reciente del equipo.

Si es alta:

- aumenta atractivo del partido

### `league_position`

Posicion competitiva del equipo.

Si es buena:

- puede aumentar interes por el partido

### `team_availability_index`

Disponibilidad de jugadores del equipo local.

Si es alta:

- mayor probabilidad de ver un equipo competitivo

### `opponent_availability_index`

Disponibilidad de jugadores del rival.

Si es alta:

- mayor atractivo del partido si el rival llega fuerte

### `historical_goals_avg`

Promedio historico de goles.

Si es alto:

- puede indicar partido atractivo o con potencial espectaculo

### `star_signing_debut`

Indica si hay debut o efecto fichaje estrella.

Si vale `1`:

- aumenta tiron emocional
- puede aumentar disposicion a pagar

## Variables de competicion

### `competition_type`

Tipo de competicion.

Valores:

- `LaLiga`
- `Champions League`
- `Copa del Rey`
- `Supercopa`
- `Friendly`

Interpretacion:

- Champions y Supercopa suelen tener mayor tiron
- Friendly suele tener menor urgencia competitiva

### `competition_phase`

Fase de la competicion.

Ejemplos:

- `Regular Season`
- `League Phase`
- `Round of 16`
- `Quarterfinal`
- `Semifinal`
- `Final`

Si la fase es mas avanzada:

- mayor importancia
- mayor emocion
- mayor capacidad de precio

## Variables de calendario

### `kickoff_hour`

Hora de inicio.

Puede afectar asistencia:

- horarios comodos suelen favorecer demanda
- horarios dificiles pueden penalizarla

### `match_month`

Mes del partido.

Puede capturar:

- temporada turistica
- clima
- calendario deportivo

### `match_dow`

Dia de la semana.

### `is_weekend`

Indica si el partido cae en fin de semana.

Si vale `1`:

- suele mejorar disponibilidad del publico

### `is_holiday_period`

Indica periodo vacacional o festivo.

Si vale `1`:

- puede aumentar turismo y demanda

### `is_public_holiday`

Indica festivo oficial.

## Variables meteorologicas y externas

### `weather_temperature`

Temperatura prevista.

Si es extrema:

- puede afectar asistencia y confort

### `rain_probability`

Probabilidad de lluvia entre 0 y 1.

Si es alta:

- puede reducir intencion de compra

### `bad_weather_flag`

Marca de clima adverso.

Si vale `1`:

- el modelo recibe una senal directa de riesgo meteorologico

### `is_televised`

Indica si el partido es televisado.

Si vale `1`:

- puede aumentar visibilidad del evento
- tambien puede generar alternativa de consumo desde casa

### `broadcast_type`

Tipo de emision.

Ejemplos:

- `pay`
- `none`

### `competing_event_city`

Indica si hay evento competidor en la ciudad.

Si vale `1`:

- puede competir por ocio, transporte o atencion

### `tourism_season_index`

Nivel de turismo esperado.

Valores:

- `low`
- `medium`
- `high`

Si es alto:

- puede mejorar demanda de entradas
- especialmente en productos premium o experiencias

## Variables sinteticas de pricing

### `urgency_score`

Mide urgencia comercial.

Sube con:

- cercania del partido
- ocupacion
- escasez
- importancia del partido
- competicion fuerte
- fase avanzada

Si es alto:

- hay presion comercial para decidir
- puede justificar precios mas altos

Si es bajo:

- todavia hay margen temporal o baja tension comercial

### `willingness_to_pay_index`

Mide disposicion estimada a pagar.

Sube con:

- mejor asiento
- producto VIP
- competicion importante
- fase relevante
- escasez
- turismo
- derbi

Si es alto:

- el mercado deberia aceptar mejor un precio alto

Si es bajo:

- conviene ser prudente con subidas

### `perceived_value_score`

Mide valor percibido del producto.

Sube con:

- calidad del sector
- visibilidad
- VIP
- partido atractivo

Si es alto:

- el producto se percibe valioso

Si es bajo:

- el producto necesita precio mas competitivo o mejor comunicacion

## Variables de neuromarketing

Estas variables no son datos historicos puros. Son senales construidas para que el modelo y el dashboard entiendan mejor la psicologia de compra.

### `fomo_index`

Mide miedo a quedarse sin entrada.

Sube con:

- poca disponibilidad
- alta ocupacion
- cercania del partido
- partido importante
- alta velocidad de venta

Si es alto:

- el comprador puede sentir urgencia por comprar
- puede haber margen de precio

Si es bajo:

- no hay presion psicologica fuerte

### `social_proof_index`

Mide prueba social: la sensacion de que mucha gente ya esta comprando.

Sube con:

- ocupacion alta
- ventas rapidas
- sector con buen llenado
- escasez creciente

Si es alto:

- el sector transmite traccion
- puede reforzar la decision de compra

Si es bajo:

- el sector parece frio o con baja demanda

### `perceived_exclusivity_index`

Mide exclusividad percibida.

Sube con:

- VIP
- buena visibilidad
- poca disponibilidad
- competicion relevante
- producto premium

Si es alto:

- el producto se percibe mas exclusivo
- menor sensibilidad al precio

Si es bajo:

- producto mas masivo
- mayor necesidad de competitividad en precio

### `emotional_pull_index`

Mide atraccion emocional del partido.

Sube con:

- rival fuerte
- derbi
- fase importante
- equipo en buena forma
- debut estrella
- partido con potencial espectaculo

Si es alto:

- el partido tiene mayor poder emocional
- puede aumentar demanda

Si es bajo:

- el partido tiene menor tiron emocional

### `price_fairness_score`

Mide si el precio parece justo o justificable.

Sube cuando:

- el contexto justifica el precio
- el producto es bueno
- el partido es atractivo
- la prima sobre base es razonable

Baja cuando:

- el precio sube mucho sin contexto suficiente
- hay baja ocupacion y poca justificacion de demanda

Si es alto:

- el precio parece aceptable

Si es bajo:

- puede haber friccion de precio
- el manager deberia revisar si el sector esta caro

### `decision_pressure_index`

Mide presion para decidir pronto.

Sube con:

- pocos dias restantes
- baja disponibilidad
- alta ocupacion
- ventas rapidas

Si es alto:

- el usuario tiene poco margen para esperar
- puede reforzar conversion

Si es bajo:

- el comprador puede posponer decision

### `premium_anchor_strength`

Mide efecto ancla premium.

Idea:

- cuando existen productos VIP caros, sectores no VIP pueden parecer relativamente mas razonables

Si es alto:

- el precio del sector se beneficia de compararse contra referencias premium

Si es bajo:

- hay poco efecto ancla

## Como debe usarlo el dashboard

El dashboard debe usar:

```text
dataset_v2_EQUIPO_FINAL.csv
```

Vistas recomendadas:

- resumen por partido
- tabla por sector
- evolucion temporal de un sector
- mapa de riesgo y oportunidad
- alertas operativas

KPIs clave:

- `occupancy_rate`
- `current_price`
- `price_vs_base`
- `revenue_so_far`
- `remaining_revenue_potential`
- `scarcity_level`
- `price_scenario`
- `urgency_score`
- `fomo_index`
- `social_proof_index`
- `price_fairness_score`
- `decision_pressure_index`

## Como debe usarlo el modelo

El modelo debe usar:

```text
dataset_v2_XGBOOST_encoded_FINAL.csv
```

Las variables nuevas de neuromarketing ya son numericas, por lo que no necesitan one-hot.

Recomendacion:

- entrenar un modelo base sin neuromarketing
- entrenar un modelo enriquecido con neuromarketing
- comparar metricas y comportamiento de recomendaciones

