
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

import {
  AreaChart,
  Area,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const INITIAL = {
  importance: 7,
  days: 40,
  occupancy: 62,
  isDerby: false,
  isHoliday: false
};

const eur = (value, digits = 2) =>
  value !== null &&
  value !== undefined &&
  Number.isFinite(Number(value))
    ? new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      }).format(Number(value))
    : '—';

const num = (value, digits = 1) =>
  value !== null &&
  value !== undefined &&
  Number.isFinite(Number(value))
    ? new Intl.NumberFormat('es-ES', {
        maximumFractionDigits: digits
      }).format(Number(value))
    : '—';

// ========================================
// COMPONENTE SLIDER
// ========================================

function Slider({ label, value, onChange, min, max, suffix = '' }) {
  return (
    <label className="field slider-field">
      <span className="field-header">
        <span>{label}</span>
        <strong>{value}{suffix}</strong>
      </span>

      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />

      <span className="range-ends">
        <span>{min}{suffix}</span>
        <span>{max}{suffix}</span>
      </span>
    </label>
  );
}

// ========================================
// COMPONENTE METRICA
// ========================================

function Metric({ label, value, help, explanation, accent = false }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`metric ${accent ? 'metric-accent' : ''}`}>
      <div className="metric-header">
        <span>{label}</span>

        <button
          type="button"
          className="metric-info-button"
          aria-label={`Información sobre ${label}`}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <span className="material-symbols-outlined">info</span>
        </button>
      </div>

      <strong>{value}</strong>
      <small>{help}</small>

      {open && (
        <div className="metric-explanation">
          {explanation}
        </div>
      )}
    </div>
  );
}

// ========================================
// SIMULADOR
// ========================================

export default function Simulator() {

  // Configuracion recibida de FastAPI
  const [config, setConfig] = useState({
    areas: {},
    competitions: {}
  });

  const [selectedArea, setSelectedArea] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedComp, setSelectedComp] = useState('');
  const [selectedPhase, setSelectedPhase] = useState('');

  // Parametros
  const [importance, setImportance] = useState(INITIAL.importance);
  const [days, setDays] = useState(INITIAL.days);
  const [occupancy, setOccupancy] = useState(INITIAL.occupancy);
  const [isDerby, setIsDerby] = useState(INITIAL.isDerby);
  const [isHoliday, setIsHoliday] = useState(INITIAL.isHoliday);

  // Estado de la aplicacion
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState('');
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Resultados
  const [results, setResults] = useState(null);
  const [resultSignature, setResultSignature] = useState(null);
  const [chartMode, setChartMode] = useState('Ingresos');

  // Revision humana, solamente local
  const [review, setReview] = useState('Sin revisar');

  // Evita utilizar respuestas de peticiones antiguas
  const requestId = useRef(0);

  // ========================================
  // CARGAR CONFIGURACION
  // ========================================

  useEffect(() => {
    let active = true;

    async function fetchConfig() {
      setLoadingConfig(true);
      setConfigError('');

      try {
        const { data } = await axios.get(
          `${API}/api/config`,
          { timeout: 20000 }
        );

        if (!active) return;

        const areas = data?.areas || {};
        const competitions = data?.competitions || {};

        const firstArea = Object.keys(areas)[0] || '';
        const firstComp = Object.keys(competitions)[0] || '';

        setConfig({ areas, competitions });
        setSelectedArea(firstArea);
        setSelectedLevel(String(areas[firstArea]?.[0] ?? ''));
        setSelectedComp(firstComp);
        setSelectedPhase(String(competitions[firstComp]?.[0] ?? ''));

      } catch (err) {
        if (!active) return;

        console.error('Error de configuración:', err);
        setConfigError(
          'No se pudo conectar con FastAPI. Comprueba que python main.py esté ejecutándose.'
        );
      } finally {
        if (active) setLoadingConfig(false);
      }
    }

    fetchConfig();

    return () => {
      active = false;
    };
  }, [retryCount]);

  // ========================================
  // CAMBIO DE ZONA Y COMPETICION
  // ========================================

  const changeArea = value => {
    setSelectedArea(value);
    setSelectedLevel(String(config.areas[value]?.[0] ?? ''));
  };

  const changeCompetition = value => {
    setSelectedComp(value);
    setSelectedPhase(String(config.competitions[value]?.[0] ?? ''));
  };

  // ========================================
  // DETECTAR CAMBIOS EN EL ESCENARIO
  // ========================================

  const scenarioSignature = JSON.stringify({
    selectedArea,
    selectedLevel,
    selectedComp,
    selectedPhase,
    importance,
    days,
    occupancy,
    isDerby,
    isHoliday
  });

  const latestSignature = useRef(scenarioSignature);
  latestSignature.current = scenarioSignature;

  const isOutdated =
    results !== null &&
    resultSignature !== scenarioSignature;

  const currentResults = isOutdated ? null : results;

  // Asociamos la revision a una simulacion concreta
  const [reviewSignature, setReviewSignature] = useState(null);

  const currentReview =
    currentResults && reviewSignature === scenarioSignature
      ? review
      : 'Sin revisar';

  // ========================================
  // RESTABLECER
  // ========================================

  const resetParameters = () => {
    requestId.current += 1;

    const firstArea = Object.keys(config.areas)[0] || '';
    const firstComp = Object.keys(config.competitions)[0] || '';

    setSelectedArea(firstArea);
    setSelectedLevel(String(config.areas[firstArea]?.[0] ?? ''));
    setSelectedComp(firstComp);
    setSelectedPhase(String(config.competitions[firstComp]?.[0] ?? ''));

    setImportance(INITIAL.importance);
    setDays(INITIAL.days);
    setOccupancy(INITIAL.occupancy);
    setIsDerby(false);
    setIsHoliday(false);

    setResults(null);
    setResultSignature(null);
    setReview('Sin revisar');
    setReviewSignature(null);
    setChartMode('Ingresos');
    setError('');
    setLoading(false);
  };

  // ========================================
  // EJECUTAR SIMULACION
  // ========================================

  const runSimulation = async () => {
    if (
      !selectedArea ||
      !selectedLevel ||
      !selectedComp ||
      !selectedPhase
    ) {
      setError('Selecciona una zona, nivel, competición y fase.');
      return;
    }

    const thisRequest = ++requestId.current;
    const submittedSignature = scenarioSignature;

    setLoading(true);
    setError('');
    setResults(null);
    setResultSignature(null);
    setReview('Sin revisar');
    setReviewSignature(null);

    try {
      const { data } = await axios.post(
        `${API}/predict-price`,
        {
          item_area: selectedArea,
          item_level: String(selectedLevel),
          days_to_match: days,
          occupancy_rate: occupancy / 100,
          match_importance: importance,
          competition_type: selectedComp,
          competition_phase: selectedPhase,
          is_derby: isDerby,
          is_holiday_period: isHoliday
        },
        { timeout: 90000 }
      );

      if (thisRequest !== requestId.current) return;

      setResults(data);
      setResultSignature(submittedSignature);

      if (submittedSignature !== latestSignature.current) {
        setError(
          'Los parámetros cambiaron durante el cálculo. Ejecuta una nueva simulación.'
        );
      }

    } catch (err) {
      if (thisRequest !== requestId.current) return;

      console.error('Error ejecutando simulación:', err);

      setError(
        err?.response
          ? `La API devolvió el error ${err.response.status}. Revisa el backend.`
          : 'No se pudo conectar con FastAPI.'
      );

    } finally {
      if (thisRequest === requestId.current) {
        setLoading(false);
      }
    }
  };

  // ========================================
  // DATOS DEL GRAFICO
  // ========================================

  const chartData = useMemo(() => {
    if (!Array.isArray(currentResults?.sweep_data)) return [];

    return currentResults.sweep_data
      .map(point => {
        const precio = Number(point.Precio);
        const ingresos = Number(point.Ingresos);

        const demanda =
          point.Demanda !== null &&
          point.Demanda !== undefined &&
          Number.isFinite(Number(point.Demanda))
            ? Number(point.Demanda)
            : precio > 0
              ? ingresos / precio
              : 0;

        return {
          ...point,
          Precio: precio,
          Ingresos: ingresos,
          Demanda: demanda
        };
      })
      .filter(point =>
        Number.isFinite(point.Precio) &&
        Number.isFinite(point.Ingresos) &&
        Number.isFinite(point.Demanda)
      );
  }, [currentResults]);

  const changePercent =
    currentResults && Number(currentResults.base_price) > 0
      ? (
          Number(currentResults.suggested_optimal_price) /
          Number(currentResults.base_price) - 1
        ) * 100
      : null;

  const canSimulate = Boolean(
    !loadingConfig &&
    !loading &&
    selectedArea &&
    selectedLevel &&
    selectedComp &&
    selectedPhase
  );

  const chartColor =
    chartMode === 'Ingresos' ? '#a39cfb' : '#5ee1b3';

  // ========================================
  // REVISION HUMANA V4
  // ========================================

  const registerReview = status => {
    if (!currentResults) return;

    setReview(status);
    setReviewSignature(scenarioSignature);
  };

  const reviewCompleted =
    currentReview === 'Revisión registrada localmente';

  const reviewPending =
    currentReview === 'Pendiente de revisión';

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <main className="sim-main">

      {/* CABECERA */}

      <header className="sim-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            SIMULATION WORKSPACE / 01
          </div>

          <h1>
            Smart Stadium <em>Pricing</em>
          </h1>

          <p>
            Explora escenarios, estima ingresos y revisa recomendaciones
            antes de cualquier decisión comercial.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={!canSimulate}
          onClick={runSimulation}
        >
          <span className="material-symbols-outlined">
            {loading ? 'hourglass_top' : 'auto_graph'}
          </span>
          {loading ? 'Calculando...' : 'Ejecutar simulación'}
        </button>
      </header>

      {/* AVISOS */}

      {configError && (
        <div className="alert" role="alert">
          {configError}
          <button
            type="button"
            onClick={() => setRetryCount(n => n + 1)}
          >
            Reintentar
          </button>
        </div>
      )}

      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      {isOutdated && (
        <div className="stale-warning" role="status">
          <span className="material-symbols-outlined">
            warning
          </span>

          <div>
            <strong>Parámetros modificados</strong>
            <p>
              Los resultados anteriores ya no corresponden al escenario
              actual. Ejecuta una nueva simulación.
            </p>
          </div>

          <button
            type="button"
            disabled={!canSimulate}
            onClick={runSimulation}
          >
            Recalcular
          </button>
        </div>
      )}

      <div className="sim-layout">

        {/* COLUMNA IZQUIERDA */}

        <section className="panel input-panel">

          <div className="panel-heading">
            <div>
              <span className="section-kicker">
                01 / CONFIGURACIÓN
              </span>
              <h2>Contexto del evento</h2>
              <p>Define un escenario hipotético para el modelo.</p>
            </div>

            <button
              type="button"
              className="reset-button"
              onClick={resetParameters}
              disabled={loadingConfig}
              title="Restablecer parámetros"
            >
              <span className="material-symbols-outlined">
                restart_alt
              </span>
            </button>
          </div>

          <div className="form-grid">

            <label className="field">
              <span>Zona del estadio</span>
              <select
                value={selectedArea}
                disabled={loadingConfig}
                onChange={e => changeArea(e.target.value)}
              >
                {!selectedArea && (
                  <option value="">Selecciona una zona</option>
                )}

                {Object.keys(config.areas).map(area => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Nivel</span>
              <select
                value={selectedLevel}
                disabled={loadingConfig}
                onChange={e => setSelectedLevel(e.target.value)}
              >
                {(config.areas[selectedArea] || []).map(level => (
                  <option
                    key={String(level)}
                    value={String(level)}
                  >
                    {level}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Competición</span>
              <select
                value={selectedComp}
                disabled={loadingConfig}
                onChange={e => changeCompetition(e.target.value)}
              >
                {!selectedComp && (
                  <option value="">Selecciona competición</option>
                )}

                {Object.keys(config.competitions).map(comp => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Fase</span>
              <select
                value={selectedPhase}
                disabled={loadingConfig}
                onChange={e => setSelectedPhase(e.target.value)}
              >
                {(config.competitions[selectedComp] || []).map(phase => (
                  <option
                    key={String(phase)}
                    value={String(phase)}
                  >
                    {String(phase).replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>

          </div>

          <div className="panel-rule" />

          <div className="slider-stack">

            <Slider
              label="Importancia del partido"
              min={1}
              max={10}
              value={importance}
              onChange={setImportance}
              suffix="/10"
            />

            <Slider
              label="Días hasta el evento"
              min={0}
              max={150}
              value={days}
              onChange={setDays}
              suffix=" días"
            />

            <Slider
              label="Ocupación actual estimada"
              min={0}
              max={100}
              value={occupancy}
              onChange={setOccupancy}
              suffix="%"
            />

          </div>

          <div className="panel-rule" />

          <div className="toggle-grid">
            <label className="toggle">
              <input
                type="checkbox"
                checked={isDerby}
                onChange={e => setIsDerby(e.target.checked)}
              />
              <span className="toggle-track" />
              <span>Derbi local</span>
            </label>

            <label className="toggle">
              <input
                type="checkbox"
                checked={isHoliday}
                onChange={e => setIsHoliday(e.target.checked)}
              />
              <span className="toggle-track" />
              <span>Periodo festivo</span>
            </label>
          </div>

          <div className="input-note">
            <span className="material-symbols-outlined">
              info
            </span>
            El backend actual no recibe la hora de inicio como
            parámetro de simulación.
          </div>

          {/* RESUMEN DEL ESCENARIO */}

          <div className="scenario-summary">

            <div className="scenario-title">
              <span className="material-symbols-outlined">
                event_available
              </span>

              <div>
                <strong>Resumen del escenario</strong>
                <small>Configuración actual del evento</small>
              </div>
            </div>

            <div className="scenario-grid">
              <div>
                <span>Ubicación</span>
                <strong>
                  {selectedArea || '—'} {selectedLevel}
                </strong>
              </div>

              <div>
                <span>Competición</span>
                <strong>{selectedComp || '—'}</strong>
              </div>

              <div>
                <span>Fase</span>
                <strong>
                  {selectedPhase
                    ? selectedPhase.replaceAll('_', ' ')
                    : '—'}
                </strong>
              </div>

              <div>
                <span>Días restantes</span>
                <strong>{days} días</strong>
              </div>

              <div>
                <span>Ocupación</span>
                <strong>{occupancy}%</strong>
              </div>

              <div>
                <span>Importancia</span>
                <strong>{importance}/10</strong>
              </div>

              <div>
                <span>Tipo de partido</span>
                <strong>
                  {isDerby ? 'Derbi local' : 'Partido regular'}
                </strong>
              </div>

              <div>
                <span>Calendario</span>
                <strong>
                  {isHoliday ? 'Periodo festivo' : 'No festivo'}
                </strong>
              </div>
            </div>

          </div>
        </section>

        {/* COLUMNA DERECHA */}

        <section className="output-stack" aria-live="polite">

          {/* PRECIO RECOMENDADO */}

          <div className="panel recommendation-panel">
            <span className="section-kicker">
              02 / RECOMENDACIÓN DEL MODELO HÍBRIDO
            </span>

            <div className="recommendation-top">
              <div>
                <span className="muted-label">
                  Precio recomendado por el modelo
                </span>

                <div className="big-price">
                  {currentResults
                    ? eur(currentResults.suggested_optimal_price)
                    : '—'}
                </div>
              </div>

              <span className="signal-icon material-symbols-outlined">
                trending_up
              </span>
            </div>

            <div className="comparison-line">
              <span>
                Precio base:{' '}
                <strong>
                  {currentResults
                    ? eur(currentResults.base_price)
                    : '—'}
                </strong>
              </span>

              <span
                className={
                  changePercent === null
                    ? 'change-chip'
                    : changePercent >= 0
                      ? 'change-chip positive'
                      : 'change-chip negative'
                }
              >
                {changePercent === null
                  ? 'Sin simulación actualizada'
                  : `${changePercent >= 0 ? '+' : ''}${num(changePercent)} % vs. base`}
              </span>
            </div>

            <p className="recommendation-note">
              Simulación exploratoria basada en XGBoost y una regla
              manual de elasticidad. No representa un precio óptimo
              validado comercialmente.
            </p>
          </div>

          {/* METRICAS */}

          <div className="metric-grid">

            <Metric
              label="Ingresos estimados"
              value={
                currentResults
                  ? eur(currentResults.expected_revenue, 0)
                  : '—'
              }
              help="Para el escenario recomendado"
              accent
              explanation="Ingresos calculados por el optimizador para el precio recomendado. No son ingresos garantizados."
            />

            <Metric
              label="RevPAR informado por API"
              value={
                currentResults
                  ? eur(currentResults.revpar)
                  : '—'
              }
              help="Ingresos por asiento disponible"
              explanation="Revenue per Available Seat. La cifra se recibe directamente del backend."
            />

            <Metric
              label="Tasa XGBoost inicial"
              value={
                currentResults
                  ? num(currentResults.xgboost_raw_prediction, 2)
                  : '—'
              }
              help="Ventas previstas por día"
              explanation="Predicción inicial de XGBoost antes de aplicar el ajuste manual de elasticidad."
            />

            <Metric
              label="Parámetro de elasticidad"
              value={
                currentResults
                  ? num(currentResults.elasticity, 2)
                  : '—'
              }
              help="Regla manual de sensibilidad"
              explanation="Parámetro usado por el optimizador. No es una elasticidad estimada directamente a partir de ventas reales."
            />

          </div>

          {/* GRAFICA */}

          <div className="panel chart-panel">

            <div className="chart-heading">
              <div>
                <span className="section-kicker">
                  03 / ANÁLISIS DE ESCENARIOS
                </span>

                <h2>
                  {chartMode === 'Ingresos'
                    ? 'Curva de ingresos'
                    : 'Curva de demanda'}
                </h2>

                <p>
                  {chartMode === 'Ingresos'
                    ? 'Ingresos estimados para cada precio simulado.'
                    : 'Entradas proyectadas para cada precio simulado.'}
                </p>
              </div>

              <div className="chart-switch" role="group">
                <button
                  type="button"
                  className={chartMode === 'Ingresos' ? 'selected' : ''}
                  aria-pressed={chartMode === 'Ingresos'}
                  onClick={() => setChartMode('Ingresos')}
                >
                  Ingresos
                </button>

                <button
                  type="button"
                  className={chartMode === 'Demanda' ? 'selected' : ''}
                  aria-pressed={chartMode === 'Demanda'}
                  onClick={() => setChartMode('Demanda')}
                >
                  Demanda
                </button>
              </div>
            </div>

            <div className="chart-description">
              <span className="material-symbols-outlined">info</span>
              <p>
                {chartMode === 'Ingresos'
                  ? 'Ingresos estimados por el optimizador híbrido. Se calculan multiplicando precio por demanda proyectada.'
                  : 'Demanda proyectada por XGBoost más el ajuste manual de elasticidad. No es la predicción pura de XGBoost.'}
              </p>
            </div>

            <div className="chart-wrap">

              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">

                  <AreaChart
                    data={chartData}
                    margin={{ top: 15, right: 12, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient
                        id="revenueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={chartColor}
                          stopOpacity={0.38}
                        />
                        <stop
                          offset="100%"
                          stopColor={chartColor}
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      vertical={false}
                      stroke="#293449"
                      strokeDasharray="3 6"
                    />

                    <XAxis
                      dataKey="Precio"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={v => `${Math.round(v)} €`}
                      tick={{ fill: '#8796ae', fontSize: 11 }}
                      stroke="#293449"
                      tickLine={false}
                    />

                    <YAxis
                      tickFormatter={v =>
                        chartMode === 'Ingresos'
                          ? `${Math.round(v / 1000)}k`
                          : String(Math.round(v))
                      }
                      tick={{ fill: '#8796ae', fontSize: 11 }}
                      stroke="transparent"
                      tickLine={false}
                      width={45}
                    />

                    <Tooltip
                      contentStyle={{
                        background: '#161f31',
                        border: '1px solid #38445c',
                        borderRadius: 12,
                        color: '#f3f5fb'
                      }}
                      labelFormatter={v => `Precio: ${eur(v)}`}
                      formatter={v => [
                        chartMode === 'Ingresos'
                          ? eur(v, 0)
                          : `${num(v, 1)} entradas`,
                        chartMode
                      ]}
                    />

                    <Area
                      type="monotone"
                      dataKey={chartMode}
                      stroke={chartColor}
                      strokeWidth={3}
                      fill="url(#revenueGradient)"
                      dot={false}
                      activeDot={{ r: 5 }}
                    />

                    {currentResults && (
                      <ReferenceLine
                        x={Number(currentResults.suggested_optimal_price)}
                        stroke="#5ee1b3"
                        strokeDasharray="5 5"
                      />
                    )}

                    {currentResults && (
                      <ReferenceLine
                        x={Number(currentResults.base_price)}
                        stroke="#8d9ab1"
                        strokeDasharray="3 5"
                      />
                    )}

                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-empty">
                  <span className="material-symbols-outlined">
                    monitoring
                  </span>

                  <strong>
                    {isOutdated
                      ? 'Resultados pendientes de actualizar'
                      : 'La curva aparecerá aquí'}
                  </strong>

                  <p>
                    {isOutdated
                      ? 'Ejecuta una nueva simulación.'
                      : 'Configura el evento y ejecuta una simulación.'}
                  </p>
                </div>
              )}

            </div>

            {currentResults && (
              <div className="chart-footnote">
                <span>
                  <i className="base-line" />
                  Precio base: {eur(currentResults.base_price)}
                </span>
                <span>
                  <i className="optimal-line" />
                  Precio recomendado: {eur(currentResults.suggested_optimal_price)}
                </span>
              </div>
            )}
          </div>

          {/* ========================================
              NUEVO PANEL DE REVISION HUMANA V4
          ======================================== */}

          <div className="panel review-panel-v4">

            <div className="review-header-v4">

              <div className="review-heading-v4">

                <div className="review-icon-v4">
                  <span className="material-symbols-outlined">
                    verified_user
                  </span>
                </div>

                <div>
                  <span className="section-kicker">
                    04 / CONTROL Y VALIDACIÓN
                  </span>

                  <h2>Revisión de la recomendación</h2>
                </div>

              </div>

              <span
                className={`review-badge-v4 ${
                  !currentResults
                    ? 'neutral'
                    : reviewCompleted
                      ? 'completed'
                      : 'pending'
                }`}
              >
                <span className="review-badge-dot" />

                {!currentResults
                  ? 'Sin simulación'
                  : reviewCompleted
                    ? 'Revisada'
                    : reviewPending
                      ? 'Por revisar'
                      : 'Pendiente'}
              </span>
            </div>

            <p className="review-subtitle-v4">
              Revisa la propuesta antes de tomar una decisión comercial.
              Esta función es demostrativa y no publica ni guarda precios.
            </p>

            <div className="review-content-v4">

              <span className="material-symbols-outlined">
                {!currentResults
                  ? 'info'
                  : reviewCompleted
                    ? 'task_alt'
                    : 'pending_actions'}
              </span>

              <div>
                <strong>
                  {!currentResults
                    ? 'No hay una recomendación vigente'
                    : reviewCompleted
                      ? 'Revisión registrada en esta sesión'
                      : reviewPending
                        ? 'Recomendación marcada para revisar'
                        : 'Recomendación lista para revisión'}
                </strong>

                <p>
                  {!currentResults
                    ? 'Ejecuta una simulación para habilitar la revisión.'
                    : reviewCompleted
                      ? 'El estado se ha actualizado únicamente en esta interfaz.'
                      : `Precio sugerido: ${eur(currentResults.suggested_optimal_price)}`}
                </p>
              </div>

            </div>

            <div className="review-footer-v4">

              <span className="review-disclaimer-v4">
                <span className="material-symbols-outlined">
                  lock
                </span>
                Sin publicación automática
              </span>

              <div className="review-actions-v4">

                <button
                  type="button"
                  className="review-secondary-v4"
                  disabled={!currentResults}
                  onClick={() =>
                    registerReview('Pendiente de revisión')
                  }
                >
                  Marcar para revisar
                </button>

                <button
                  type="button"
                  className="review-primary-v4"
                  disabled={!currentResults}
                  onClick={() =>
                    registerReview('Revisión registrada localmente')
                  }
                >
                  <span className="material-symbols-outlined">
                    check_circle
                  </span>
                  Registrar revisión
                </button>

              </div>
            </div>

          </div>

        </section>
      </div>

      <footer className="app-footer">
        PAE · Smart Stadium Pricing · Prototipo académico
        con datos sintéticos · Sin publicación automática de precios
      </footer>

    </main>
  );
}
