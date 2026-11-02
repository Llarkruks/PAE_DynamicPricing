
import React from "react";
import { NavLink } from "react-router-dom";

const navigation = [
  {
    path: "/",
    icon: "dashboard",
    label: "Inicio",
    end: true
  },
  {
    path: "/multisport",
    icon: "tune",
    label: "Simulador de precios"
  },
  {
    path: "/simulator",
    icon: "sports_soccer",
    label: "Simulador original"
  },
  {
    path: "/validation",
    icon: "monitoring",
    label: "Resultados y validación"
  }
];

export default function Sidebar() {
  return (
    <aside className="stadium-sidebar">

      <div className="brand">
        <span className="brand-mark material-symbols-outlined">
          stadium
        </span>

        <div>
          <strong>
            STADIUM<span>IQ</span>
          </strong>

          <small>PRICING INTELLIGENCE</small>
        </div>
      </div>

      <div className="nav-caption">
        PLATAFORMA
      </div>

      <nav aria-label="Navegación principal">
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `nav-entry ${isActive ? "active" : ""}`
            }
          >
            <span className="material-symbols-outlined">
              {item.icon}
            </span>

            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="status-dot">
          <span />
          Plataforma de simulación
        </div>

        <p>
          Sistema experimental de predicción
          de demanda y optimización de precios.
        </p>

        <small>
          Smart Stadium Pricing · Proyecto PAE
        </small>
      </div>
    </aside>
  );
}
