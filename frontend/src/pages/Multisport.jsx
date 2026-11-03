
import React, {
  useEffect,
  useState
} from "react";

import axios from "axios";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import "./Multisport.css";

const API =
  import.meta.env.VITE_MULTISPORT_API_URL ||
  "http://localhost:8001";

const SPORTS = [
  ["football", "Fútbol", "sports_soccer"],
  ["basketball", "Baloncesto", "sports_basketball"],
  ["tennis", "Tenis", "sports_tennis"],
  ["running", "Running", "directions_run"]
];

const euro = value =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(value ?? 0);

const fmt = (value, decimals = 1) =>
  new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: decimals
  }).format(value ?? 0);

const categoryName = value => ({
  general: "Entrada general",
  premium: "Entrada premium",
  vip: "Entrada VIP",
  standard: "Entrada estándar",
  premium_registration: "Inscripción premium",
  day_session: "Sesión de día",
  evening_session: "Sesión de tarde"
}[String(value).toLowerCase()] || String(value));

function Icon({ name, size = 20 }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

function Card({ title, value, detail }) {
  return (
    <div className="ms-card">
      <p>{title}</p>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export default function Multisport() {
  const [sport, setSport] = useState("football");
  const [days, setDays] = useState(30);
  const [model, setModel] = useState("rate");
  const [chart, setChart] = useState("revenue");

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [advanced, setAdvanced] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);
  const [customCategory, setCustomCategory] = useState("");
  const [eventName, setEventName] = useState("Mi evento deportivo");
  const [custom, setCustom] = useState({
    category_capacity: 1000, remaining_capacity: 800,
    current_price: 40, popularity_index: 0.5, event_importance: 0.5
  });
  const updateCustom = (key, value) => {
    setCustom(previous => ({ ...previous, [key]: value }));
    setResult(null);
  };


  useEffect(() => {
    axios.get(`${API}/api/v7/custom/config`)
      .then(response => setCustomCategories(response.data.categories || []))
      .catch(() => {});
  }, []);

  const availableCustomCategories = customCategories
    .filter(x => x.sport_type === sport)
    .map(x => x.ticket_category);
  const activeCustomCategory = availableCustomCategories.includes(customCategory)
    ? customCategory : availableCustomCategories[0] || "";

  useEffect(() => {
    if (!activeCustomCategory) return;
    let canceled = false;
    axios.get(`${API}/api/v7/custom/defaults`, { params: {
      sport_type: sport, ticket_category: activeCustomCategory,
      days_remaining: 30
    }}).then(response => {
      if (!canceled) setCustom(response.data);
    }).catch(() => {
      if (!canceled) setError("No se pudieron cargar los valores de referencia.");
    });
    return () => { canceled = true; };
  }, [sport, activeCustomCategory]);

  useEffect(() => {
    setResult(null);
  }, [sport, days, activeCustomCategory, model]);

  async function calculate(e) {
    e.preventDefault();

    const capacity = Number(custom.category_capacity);
    const remaining = Number(custom.remaining_capacity);
    const currentPrice = Number(custom.current_price);

    if (!activeCustomCategory ||
        !Number.isFinite(capacity) ||
        capacity <= 0 ||
        !Number.isInteger(capacity) ||
        !Number.isFinite(remaining) ||
        !Number.isInteger(remaining) ||
        remaining < 0 ||
        remaining > capacity ||
        !Number.isFinite(currentPrice) ||
        currentPrice <= 0 ||
        !eventName.trim()) {
      setError("Revisa el nombre, precio, aforo y entradas disponibles.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await axios.post(
        `${API}/api/v7/custom/optimize`,
        {
          sport_type: sport,
          ticket_category: activeCustomCategory,
          days_remaining: Number(days),
          event_name: eventName.trim(),
          model,
          ...Object.fromEntries(
            Object.entries(custom).map(([key, value]) => [
              key,
              key === "tournament_round"
                ? value
                : (value == null ? null : Number(value))
            ])
          )
        }
      );

      setResult(response.data);

    } catch (err) {
      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "No se pudo calcular el escenario."
      );
    } finally {
      setLoading(false);
    }
  }

  const ok = result?.status === "ok";
  const soldOut = result?.status === "sold_out";
  const noDemand = result?.status === "no_demand";

  const optimal = result?.optimal;
  const reference = result?.reference;

  const uplift = result?.uplift_percent;
  const diff = ok
    ? optimal.revenue - reference.revenue
    : 0;

  const priceChange = ok
    ? (optimal.price / reference.price - 1) * 100
    : 0;

  const direction = ok
    ? priceChange < -0.01
      ? "reducir"
      : priceChange > 0.01
        ? "aumentar"
        : "mantener"
    : "";

  return (
    <main className="ms-main">
      <header className="ms-header">
        <div>
          <div className="ms-eyebrow">
            STADIUM IQ / SIMULADOR MULTIDEPORTE
          </div>
          <h1>
            Encuentra el <span>precio adecuado</span>
          </h1>
          <p>
            Configura el evento, modifica las entradas
            disponibles y explora las recomendaciones.
          </p>
        </div>
      </header>

      <div className="ms-layout">
        <aside className="ms-panel ms-form">
          <h2>Configura tu evento</h2>
          <form onSubmit={calculate}>
            <label className="ms-label">
              01 / Deporte
            </label>

            <div className="ms-sports">
              {SPORTS.map(([id, name, icon]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    sport === id
                      ? "ms-sport selected"
                      : "ms-sport"
                  }
                  onClick={() => {
                    setSport(id);
                  }}
                >
                  <Icon name={icon} size={26} />
                  {name}
                </button>
              ))}
            </div>

            <div className="ms-divider" />

            <label className="ms-label">Nombre del evento</label>

            <input
              className="ms-text-field"
              type="text"
              maxLength={100}
              required
              value={eventName}
              onChange={e => {
                setEventName(e.target.value);
                setResult(null);
              }}
              placeholder="Ej. Final del torneo de mi ciudad"
            />

            <label className="ms-label">
              02 / Tipo de entrada
            </label>

            <select
              value={activeCustomCategory}
              onChange={e => {
                setCustomCategory(e.target.value);
                setResult(null);
              }}
            >
              {availableCustomCategories.map(c => (
                <option key={c} value={c}>
                  {categoryName(c)}
                </option>
              ))}
            </select>

            <p className="ms-muted">
              Escenario nuevo. Las variables no indicadas
              utilizan un perfil sintético de referencia
              del deporte seleccionado.
            </p>

            <div className="ms-divider" />

            <label className="ms-label">
              03 / Días hasta el evento
            </label>

            <div className="ms-slider-title">
              <span>Días restantes</span>
              <strong>{days} días</strong>
            </div>

            <input
              type="range"
              min={1}
              max={30}
              value={days}
              onChange={e => setDays(Number(e.target.value))}
            />

            <div className="ms-range-labels">
              <span>1 día</span>
              <span>30 días</span>
            </div>

            <div className="ms-divider" />

            <label className="ms-label">
              04 / Entradas disponibles
            </label>

            <div className="ms-custom-fields">
                <label className="ms-label">Aforo de esta categoría</label>
                <input type="number" min="1" max="100000" required
                  value={custom.category_capacity}
                  onChange={e => updateCustom("category_capacity", e.target.value)} />
                <label className="ms-label">Entradas disponibles actualmente</label>
                <input type="number" min="0" max={custom.category_capacity} required
                  value={custom.remaining_capacity}
                  onChange={e => updateCustom("remaining_capacity", e.target.value)} />
                <label className="ms-label">Precio actual (€)</label>
                <input type="number" min="0.01" step="0.01" max="10000" required
                  value={custom.current_price}
                  onChange={e => updateCustom("current_price", e.target.value)} />
                <label className="ms-label">Popularidad esperada</label>
                <select value={String(custom.popularity_index)}
                  onChange={e => updateCustom("popularity_index", Number(e.target.value))}>
                  <option value="0.25">Baja</option><option value="0.55">Media</option>
                  <option value="0.85">Alta</option>
                  {! [0.25,0.55,0.85].includes(Number(custom.popularity_index)) &&
                    <option value={String(custom.popularity_index)}>Referencia ({fmt(custom.popularity_index,2)})</option>}
                </select>
                <label className="ms-label">Importancia del evento</label>
                <select value={String(custom.event_importance)}
                  onChange={e => updateCustom("event_importance", Number(e.target.value))}>
                  <option value="0.25">Baja</option><option value="0.55">Media</option>
                  <option value="0.85">Alta</option>
                  {! [0.25,0.55,0.85].includes(Number(custom.event_importance)) &&
                    <option value={String(custom.event_importance)}>Referencia ({fmt(custom.event_importance,2)})</option>}
                </select>
                <p className="ms-muted">Baja = 0,25 · Media = 0,55 · Alta = 0,85. Son índices del modelo, no categorías comerciales validadas.</p>
                <div className="ms-sport-details">
                  <h3>Características de {SPORTS.find(x => x[0] === sport)?.[1]}</h3>
                  {sport === "football" && <>
                    <label className="ms-label">Rivalidad del partido</label>
                    <select value={String(custom.derby_rivalry_index ?? 0.5)} onChange={e => updateCustom("derby_rivalry_index", Number(e.target.value))}>
                      <option value="0.2">Baja</option><option value="0.5">Media</option><option value="0.85">Derbi / alta</option>
                      {! [0.2,0.5,0.85].includes(Number(custom.derby_rivalry_index ?? 0.5)) && <option value={String(custom.derby_rivalry_index)}>Referencia ({fmt(custom.derby_rivalry_index,2)})</option>}
                    </select>
                    <label className="ms-label">Posición del equipo local (1–30)</label>
                    <input type="number" min="1" max="30" value={custom.league_position_home ?? 10} onChange={e => updateCustom("league_position_home", Number(e.target.value))} />
                    <label className="ms-label">Posición del visitante (1–30)</label>
                    <input type="number" min="1" max="30" value={custom.league_position_away ?? 10} onChange={e => updateCustom("league_position_away", Number(e.target.value))} />
                  </>}
                  {sport === "basketball" && <>
                    <label className="ms-label">Porcentaje de victorias del equipo</label>
                    <select value={String(custom.team_win_percentage ?? 0.5)} onChange={e => updateCustom("team_win_percentage", Number(e.target.value))}>
                      <option value="0.25">25 %</option><option value="0.5">50 %</option><option value="0.75">75 %</option>
                      {! [0.25,0.5,0.75].includes(Number(custom.team_win_percentage ?? 0.5)) && <option value={String(custom.team_win_percentage)}>Referencia ({fmt(100*custom.team_win_percentage,1)} %)</option>}
                    </select>
                  </>}
                  {sport === "tennis" && <>
                    <label className="ms-label">Ranking del jugador principal</label>
                    <input type="number" min="1" max="500" value={custom.player_ranking ?? 50} onChange={e => updateCustom("player_ranking", Number(e.target.value))} />
                    <label className="ms-label">Ronda del torneo</label>
                    <select value={custom.tournament_round ?? "QF"} onChange={e => updateCustom("tournament_round", e.target.value)}>
                      <option value="R32">Ronda de 32</option><option value="R16">Octavos</option>
                      <option value="QF">Cuartos</option><option value="SF">Semifinal</option><option value="F">Final</option>
                    </select>
                  </>}
                  {sport === "running" && <>
                    <label className="ms-label">Distancia de carrera</label>
                    <select value={String(custom.race_distance_km ?? 10)} onChange={e => updateCustom("race_distance_km", Number(e.target.value))}>
                      <option value="5">5 km</option><option value="10">10 km</option>
                      <option value="21.0975">Media maratón</option><option value="42.195">Maratón</option>
                      {! [5,10,21.0975,42.195].includes(Number(custom.race_distance_km ?? 10)) && <option value={String(custom.race_distance_km)}>Referencia ({fmt(custom.race_distance_km)} km)</option>}
                    </select>
                    <label className="ms-label">Desnivel positivo (metros)</label>
                    <input type="number" min="0" max="5000" value={custom.elevation_gain_m ?? 0} onChange={e => updateCustom("elevation_gain_m", Number(e.target.value))} />
                  </>}
                </div>
                <div className="ms-inventory">
                  Ocupación estimada: <b>{Number(custom.category_capacity)>0
                    ? fmt(Math.max(0,Math.min(100,100*(1-Number(custom.remaining_capacity)/Number(custom.category_capacity)))))
                    : "0"} %</b>
                  <p>El precio se evaluará entre el 80 % y el 120 % del valor indicado.</p>
                </div>
              </div>

            <div className="ms-divider" />

            <button
              className="ms-advanced"
              type="button"
              onClick={() => setAdvanced(!advanced)}
            >
              <Icon name="settings" size={18} />
              Opciones avanzadas
              <Icon
                name={
                  advanced
                    ? "expand_less"
                    : "expand_more"
                }
              />
            </button>

            {advanced && (
              <div className="ms-advanced-body">
                <label className="ms-label">
                  Modelo XGBoost
                </label>

                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                >
                  <option value="rate">
                    Tasa de venta
                  </option>
                  <option value="direct">
                    Ventas directas
                  </option>
                </select>

                <p>
                  Ambos modelos se entrenaron con
                  datos sintéticos. Puedes comparar
                  sus recomendaciones.
                </p>
              </div>
            )}

            <button
              className="ms-submit"
              type="submit"
              disabled={
                loading ||
                !activeCustomCategory ||
                Number(custom.remaining_capacity) >
                  Number(custom.category_capacity) ||
                Number(custom.category_capacity) <= 0
              }
            >
              <Icon name="auto_awesome" size={19} />
              {loading
                ? "Calculando..."
                : "Calcular precio recomendado"}
            </button>
          </form>

          <p className="ms-muted">
            Se utilizan datos sintéticos como referencia.
            El evento no se guarda.
          </p>
        </aside>

        <section className="ms-results">
          {error && (
            <div className="ms-panel ms-error">
              <Icon name="error_outline" />
              {error}
            </div>
          )}

          {!result && !error && (
            <div className="ms-panel ms-empty">
              <Icon name="monitoring" size={54} />
              <h2>Tu análisis aparecerá aquí</h2>
              <p>
                Configura el evento y pulsa
                «Calcular precio recomendado».
              </p>
            </div>
          )}

          {soldOut && (
            <div className="ms-panel ms-status">
              <Icon name="confirmation_number" size={50} />
              <h2>Entradas agotadas</h2>
              <p>{result.message}</p>
              <div className="ms-status-grid">
                <Card
                  title="Entradas disponibles"
                  value="0"
                />
                <Card
                  title="Ocupación"
                  value="100 %"
                />
              </div>
              <p className="ms-muted">
                Puedes aumentar el inventario
                del escenario para estudiar una
                situación hipotética con entradas.
              </p>
            </div>
          )}

          {noDemand && (
            <div className="ms-panel ms-status">
              <Icon name="query_stats" size={50} />
              <h2>Sin demanda prevista</h2>
              <p>{result.message}</p>
              <div className="ms-status-grid">
                <Card
                  title="Entradas disponibles"
                  value={fmt(
                    result.context.remaining_capacity, 0
                  )}
                />
                <Card
                  title="Ventas previstas"
                  value="0"
                />
              </div>
              <p className="ms-muted">
                No hemos seleccionado el precio mínimo
                arbitrariamente: no existe una mejora
                económica identificada por el modelo.
              </p>
            </div>
          )}

          {ok && (
            <>
              <div className="ms-panel ms-hero">
                <div className="ms-eyebrow">
                  RECOMENDACIÓN DEL MODELO
                </div>
                <p>Precio recomendado para mañana {result.context.is_custom ? "(escenario personalizado)" : ""}</p>

                <div className="ms-big-price">
                  {euro(optimal.price)}
                </div>

                <p>
                  Precio observado:{" "}
                  <strong>
                    {euro(reference.price)}
                  </strong>
                </p>

                <div className="ms-explanation">
                  <Icon name="lightbulb" size={23} />

                  {direction === "mantener"
                    ? "El modelo recomienda mantener aproximadamente el precio observado."
                    : `El modelo recomienda ${direction} el precio de ${euro(reference.price)} a ${euro(optimal.price)}. Esto produciría ${fmt(optimal.sales)} ventas estimadas durante el siguiente día comercial.`}
                </div>

                <div className="ms-gain">
                  {result.uplift_percent == null
                    ? "Mejora porcentual no calculable"
                    : `${result.uplift_percent >= 0 ? "+" : ""}${fmt(result.uplift_percent)} % de ingresos previstos`}
                </div>

                {result.context.is_custom && <p className="ms-muted">Evento: <strong>{result.context.event_name}</strong></p>}
                {result.diagnostics?.warnings?.length > 0 && (
                  <div className="ms-diagnostic-alert" role="status">
                    <strong>Precauciones sobre la recomendación</strong>
                    <ul>{result.diagnostics.warnings.map((msg,i) => <li key={i}>{msg}</li>)}</ul>
                  </div>
                )}
              </div>

              <div className="ms-compare">
                <Card
                  title="Mantener el precio"
                  value={euro(reference.revenue)}
                  detail={`${fmt(reference.sales)} entradas previstas a ${euro(reference.price)}`}
                />

                <Card
                  title="Aplicar la recomendación"
                  value={euro(optimal.revenue)}
                  detail={`${fmt(optimal.sales)} entradas previstas a ${euro(optimal.price)}`}
                />
              </div>

              <div className="ms-panel ms-difference">
                <Icon name="insights" size={24} />
                <div>
                  <strong>
                    {diff >= 0 ? "+" : "-"}
                    {euro(Math.abs(diff))}
                  </strong>
                  <p>
                    Diferencia de ingresos prevista
                    durante el próximo día.
                  </p>
                </div>
              </div>

              <div className="ms-panel ms-chart">
                <div className="ms-chart-heading">
                  <div>
                    <div className="ms-eyebrow">
                      ANÁLISIS DE PRECIOS
                    </div>
                    <h2>
                      ¿Cómo cambia el resultado
                      según el precio?
                    </h2>
                  </div>

                  <div className="ms-tabs">
                    <button
                      type="button"
                      className={
                        chart === "revenue" ? "active" : ""
                      }
                      onClick={() => setChart("revenue")}
                    >
                      Ingresos
                    </button>
                    <button
                      type="button"
                      className={
                        chart === "sales" ? "active" : ""
                      }
                      onClick={() => setChart("sales")}
                    >
                      Entradas
                    </button>
                  </div>
                </div>

                <div className="ms-plot">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <LineChart
                      data={result.curve}
                      margin={{
                        top: 25,
                        right: 25,
                        bottom: 12,
                        left: 8
                      }}
                    >
                      <CartesianGrid
                        stroke="#394461"
                        strokeDasharray="4 4"
                      />
                      <XAxis
                        dataKey="price"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tick={{ fill: "#aabce3" }}
                        tickFormatter={v => `${fmt(v)}€`}
                      />
                      <YAxis
                        tick={{ fill: "#aabce3" }}
                        width={58}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#202a43",
                          border: "1px solid #65739a",
                          color: "#ffffff"
                        }}
                        labelFormatter={v =>
                          `Precio: ${euro(v)}`
                        }
                        formatter={v =>
                          chart === "revenue"
                            ? euro(v)
                            : `${fmt(v)} entradas`
                        }
                      />
                      <ReferenceLine
                        x={reference.price}
                        stroke="#78b4e8"
                        strokeDasharray="5 5"
                        label={{
                          value: "Observado",
                          fill: "#78b4e8",
                          position: "insideTopLeft"
                        }}
                      />
                      <ReferenceLine
                        x={optimal.price}
                        stroke="#b1a0ff"
                        strokeDasharray="4 4"
                        label={{
                          value: "Recomendado",
                          fill: "#b1a0ff",
                          position: "insideTopRight"
                        }}
                      />
                      <Line
                        type="linear"
                        dataKey={chart}
                        stroke="#b5a4ff"
                        strokeWidth={2.6}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <details className="ms-panel ms-details">
                <summary>
                  <Icon name="psychology" size={20} />
                  ¿Cómo se ha calculado?
                </summary>

                <p>
                  XGBoost predice las ventas del
                  siguiente día para diferentes precios.
                  El optimizador selecciona el precio
                  con mayores ingresos estimados.
                </p>

                <p>
                  Modelo utilizado:{" "}
                  <strong>
                    {result.model === "rate"
                      ? "Tasa de ventas"
                      : "Demanda directa"}
                  </strong>
                </p>

                {result.context.assumptions && (
                  <div className="ms-assumptions">
                    <h3>Supuestos del evento personalizado</h3>
                    <ul>{result.context.assumptions.map(item => <li key={item}>{item}</li>)}</ul>
                  </div>
                )}
                {result.diagnostics && <p>
                  Tramos donde sube la demanda al subir el precio: <strong>{result.diagnostics.demand_increase_steps}</strong> de {result.diagnostics.price_points - 1}.
                  {" "}Esta comprobación no demuestra una relación causal entre precio y ventas.
                </p>}
                <p>
                  Sensibilidad local:{" "}
                  <strong>
                    {result.local_price_sensitivity == null
                      ? "No calculable"
                      : fmt(
                          result.local_price_sensitivity, 2
                        )}
                  </strong>
                </p>

                <h3>
                  Estabilidad del precio recomendado
                </h3>

                <div className="ms-checks">
                  {result.sensitivity.map(s => (
                    <div key={s.scenario}>
                      <span>{s.scenario}</span>
                      <strong>
                        {s.optimal
                          ? euro(s.optimal.price)
                          : "Sin recomendación"}
                      </strong>
                      <small>
                        {fmt(s.remaining_capacity, 0)}
                        {" "}entradas disponibles
                      </small>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}

          {result && (
            <p className="ms-disclaimer">
              Datos completamente sintéticos.
              Las recomendaciones son predicciones
              para un día comercial, no precios
              comercialmente validados.
              {"El nuevo evento combina entradas del usuario con hipótesis sintéticas."}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
