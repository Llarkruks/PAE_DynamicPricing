
import React from "react";
import { Link } from "react-router-dom";
import "./Dashboard.css";

const sections = [
  {
    icon: "tune",
    tag: "PREDICCIÓN Y OPTIMIZACIÓN",
    title: "Simulador de precios",
    description:
      "Configura un evento deportivo, consulta la demanda estimada mediante XGBoost y descubre el precio que maximiza los ingresos previstos del siguiente día comercial.",
    path: "/multisport",
    action: "Abrir simulador",
    main: true
  },
  {
    icon: "monitoring",
    tag: "EVALUACIÓN EXPERIMENTAL",
    title: "Resultados y validación",
    description:
      "Analiza los resultados de las simulaciones, compara las estrategias de precio fijo y dinámico y consulta su comportamiento por deporte.",
    path: "/validation",
    action: "Ver resultados"
  },
  {
    icon: "sports_soccer",
    tag: "PRIMER PROTOTIPO",
    title: "Simulador original",
    description:
      "Accede al prototipo inicial orientado al fútbol. Se conserva para mostrar la evolución del desarrollo y comparar los enfoques.",
    path: "/simulator",
    action: "Abrir prototipo"
  }
];

export default function Dashboard() {
  return (
    <main className="dashboard-page">

      <header className="dashboard-hero">
        <div className="dashboard-eyebrow">
          SMART STADIUM PRICING
        </div>

        <h1>
          Decisiones de precio
          <span> basadas en datos.</span>
        </h1>

        <p>
          STADIUM IQ es una plataforma experimental
          que combina inteligencia artificial y
          optimización para analizar la demanda
          de entradas deportivas y recomendar precios.
        </p>

        <div className="dashboard-hero-actions">
          <Link
            to="/multisport"
            className="dashboard-primary-button"
          >
            Abrir simulador
            <span className="material-symbols-outlined">
              arrow_forward
            </span>
          </Link>

          <Link
            to="/validation"
            className="dashboard-secondary-button"
          >
            Explorar resultados
          </Link>
        </div>
      </header>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <span>PLATAFORMA</span>
            <h2>Explora STADIUM IQ</h2>
          </div>
        </div>

        <div className="dashboard-cards">
          {sections.map((section) => (
            <Link
              to={section.path}
              key={section.path}
              className={`dashboard-card ${
                section.main ? "featured" : ""
              }`}
            >
              <div className="dashboard-card-icon">
                <span className="material-symbols-outlined">
                  {section.icon}
                </span>
              </div>

              <div className="dashboard-card-tag">
                {section.tag}
              </div>

              <h3>{section.title}</h3>

              <p>{section.description}</p>

              <div className="dashboard-card-link">
                {section.action}
                <span className="material-symbols-outlined">
                  arrow_forward
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <span>METODOLOGÍA</span>
            <h2>¿Cómo funciona?</h2>
          </div>
        </div>

        <div className="dashboard-process">
          <div className="dashboard-process-step">
            <div className="dashboard-step-number">01</div>

            <h3>Datos</h3>
            <p>
              Características del evento, precios,
              inventario y ventas sintéticas.
            </p>
          </div>

          <div className="dashboard-process-step">
            <div className="dashboard-step-number">02</div>

            <h3>Predicción</h3>
            <p>
              XGBoost estima la demanda esperada
              bajo diferentes precios.
            </p>
          </div>

          <div className="dashboard-process-step">
            <div className="dashboard-step-number">03</div>

            <h3>Optimización</h3>
            <p>
              El sistema compara los ingresos previstos
              y recomienda un precio.
            </p>
          </div>

          <div className="dashboard-process-step">
            <div className="dashboard-step-number">04</div>

            <h3>Validación</h3>
            <p>
              Las políticas de precios se comparan
              mediante un simulador sintético de demanda.
            </p>
          </div>
        </div>
      </section>

      <footer className="dashboard-disclaimer">
        <span className="material-symbols-outlined">
          info
        </span>

        <p>
          Proyecto académico basado en datos sintéticos.
          Las recomendaciones y mejoras calculadas
          no constituyen resultados comerciales reales.
        </p>
      </footer>

    </main>
  );
}
