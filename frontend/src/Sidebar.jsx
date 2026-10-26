import React from 'react';
import { NavLink } from 'react-router-dom';

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
        WORKSPACE
      </div>

      <nav aria-label="Navegación principal">
        <NavLink
          to="/simulator"
          className={({ isActive }) =>
            `nav-entry ${isActive ? 'active' : ''}`
          }
        >
          <span className="material-symbols-outlined">
            tune
          </span>

          Simulador de precios
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <div className="status-dot">
          <span />
          Motor de simulación
        </div>

        <p>
          Prototipo universitario.
          Resultados no validados comercialmente.
        </p>

        <small>
          PAE · Smart Stadium Pricing
        </small>
      </div>

    </aside>
  );
}