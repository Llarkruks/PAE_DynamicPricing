
import React, {
  useEffect,
  useMemo,
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
  standard: "Entrada estándar"
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
  const [items, setItems] = useState([]);
  const [sport, setSport] = useState("football");
  const [event, setEvent] = useState("");
  const [category, setCategory] = useState("");
  const [days, setDays] = useState(30);
  const [model, setModel] = useState("rate");
  const [chart, setChart] = useState("revenue");

  const [context, setContext] = useState(null);
  const [stock, setStock] = useState(null);
  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [error, setError] = useState("");

  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/v7/config`)
      .then(response => {
        setItems(response.data.events || []);
      })
      .catch(() => {
        setError(
          "No responde la API del puerto 8001."
        );
      });
  }, []);

  const events = useMemo(
    () => [...new Set(
      items
        .filter(x => x.sport_type === sport)
        .map(x => x.event_id)
    )].sort(),
    [items, sport]
  );

  const selectedEvent = events.includes(event)
    ? event
    : events[0] || "";

  const categories = useMemo(
    () => items.filter(
      x =>
        x.sport_type === sport &&
        x.event_id === selectedEvent
    ),
    [items, sport, selectedEvent]
  );

  const selectedCategory = categories.some(
    x => x.ticket_category_id === category
  )
    ? category
    : categories[0]?.ticket_category_id || "";

  // Recuperar el estado inicial del snapshot.
  useEffect(() => {
    if (!selectedEvent || !selectedCategory) return;

    let cancelled = false;

    setContext(null);
    setStock(null);
    setResult(null);
    setError("");
    setLoadingContext(true);

    axios.get(`${API}/api/v7/context`, {
      params: {
        event_id: selectedEvent,
        ticket_category_id: selectedCategory,
        days_remaining: Number(days)
      }
    }).then(response => {
      if (!cancelled) {
        setContext(response.data);
        setStock(response.data.remaining_capacity);
      }
    }).catch(() => {
      if (!cancelled) {
        setError(
          "No se ha podido cargar el estado del evento."
        );
      }
    }).finally(() => {
      if (!cancelled) {
        setLoadingContext(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedEvent, selectedCategory, days]);

  // Una prediccion anterior deja de ser valida
  // si cambiamos el modelo o el inventario.
  useEffect(() => {
    setResult(null);
  }, [stock, model]);

  const capacity = context?.category_capacity ?? 0;
  const originalStock =
    context?.remaining_capacity ?? 0;

  const currentStock = stock ?? 0;

  const occupancy = capacity > 0
    ? (1 - currentStock / capacity) * 100
    : 0;

  const hypothetical =
    context !== null && currentStock !== originalStock;

  async function calculate(e) {
    e.preventDefault();

    if (!context || stock === null) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await axios.post(
        `${API}/api/v7/optimize`,
        {
          event_id: selectedEvent,
          ticket_category_id: selectedCategory,
          days_remaining: Number(days),
          model,
          remaining_capacity: Number(stock)
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
                    setEvent("");
                    setCategory("");
                  }}
                >
                  <Icon name={icon} size={26} />
                  {name}
                </button>
              ))}
            </div>

            <div className="ms-divider" />

            <label className="ms-label">
              02 / Evento deportivo
            </label>

            <select
              value={selectedEvent}
              onChange={e => {
                setEvent(e.target.value);
                setCategory("");
              }}
            >
              {events.map(id => (
                <option key={id} value={id}>
                  {`Evento ${Number(
                    id.replace("EV", "")
                  )} (simulado)`}
                </option>
              ))}
            </select>

            <label className="ms-label">
              Tipo de entrada
            </label>

            <select
              value={selectedCategory}
              onChange={e => setCategory(e.target.value)}
            >
              {categories.map(item => (
                <option
                  key={item.ticket_category_id}
                  value={item.ticket_category_id}
                >
                  {categoryName(item.ticket_category)}
                </option>
              ))}
            </select>

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

            {loadingContext || !context ? (
              <p className="ms-muted">
                Cargando inventario...
              </p>
            ) : (
              <>
                <div className="ms-slider-title">
                  <span>Disponibles actualmente</span>
                  <strong>
                    {fmt(currentStock, 0)}
                  </strong>
                </div>

                <input
                  type="range"
                  min={0}
                  max={capacity}
                  step={1}
                  value={currentStock}
                  onChange={e =>
                    setStock(Number(e.target.value))
                  }
                />

                <div className="ms-range-labels">
                  <span>0 entradas</span>
                  <span>
                    Aforo: {fmt(capacity, 0)}
                  </span>
                </div>

                <div className="ms-inventory">
                  <div>
                    Ocupación simulada
                    <strong>{fmt(occupancy)} %</strong>
                  </div>

                  <div className="ms-progress">
                    <div
                      style={{
                        width: `${occupancy}%`
                      }}
                    />
                  </div>

                  <p>
                    Inventario original del dataset:{" "}
                    <b>{fmt(originalStock, 0)}</b>
                  </p>

                  {hypothetical && (
                    <p className="ms-hypothetical">
                      <Icon name="science" size={16} />
                      Escenario hipotético: has modificado
                      el inventario original.
                    </p>
                  )}

                  <button
                    className="ms-reset"
                    type="button"
                    disabled={!hypothetical}
                    onClick={() =>
                      setStock(originalStock)
                    }
                  >
                    <Icon name="restart_alt" size={17} />
                    Restaurar inventario original
                  </button>
                </div>
              </>
            )}

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
                loadingContext ||
                !context ||
                stock === null
              }
            >
              <Icon name="auto_awesome" size={19} />
              {loading
                ? "Calculando..."
                : "Calcular precio recomendado"}
            </button>
          </form>

          <p className="ms-muted">
            El inventario modificado se utiliza
            únicamente para esta simulación.
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
                <p>Precio recomendado para mañana</p>

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

                {result.context.is_hypothetical && (
                  <p className="ms-hypothetical">
                    Estás consultando un escenario
                    con inventario modificado.
                  </p>
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
              Modificar el inventario puede producir
              escenarios que no coinciden con las
              condiciones históricas del dataset.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
