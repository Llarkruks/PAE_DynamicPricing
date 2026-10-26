import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  return (
    <aside className="w-[260px] bg-surface-container-lowest border-r border-white/5 flex flex-col fixed inset-y-0 z-50">
      <div className="p-6">
        <h1 className="font-display-lg text-headline-md tracking-tighter text-primary-container flex items-center gap-2">
          <span className="material-symbols-outlined">stadium</span>
          SMART STADIUM
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-2 mt-4">
        <NavLink 
          to="/simulator" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group ${isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container'}`
          }
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>tune</span>
          <span className="font-label-md text-label-md">Matchday Simulator</span>
        </NavLink>
        <NavLink 
          to="/analytics" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group ${isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container'}`
          }
        >
          <span className="material-symbols-outlined">query_stats</span>
          <span className="font-label-md text-label-md">Season Analytics</span>
        </NavLink>

      </nav>
      {/* Omitido el login real, solo se deja el dummy visual */}
    </aside>
  );
};

export default Sidebar;
