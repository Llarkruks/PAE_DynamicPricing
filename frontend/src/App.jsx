import React from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes
} from 'react-router-dom';

import Sidebar from './Sidebar';
import Simulator from './pages/Simulator';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="stadium-app">
        <Sidebar />

        <Routes>
          <Route
            path="/"
            element={<Navigate to="/simulator" replace />}
          />

          <Route
            path="/simulator"
            element={<Simulator />}
          />

          <Route
            path="*"
            element={<Navigate to="/simulator" replace />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}