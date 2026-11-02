
import React from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes
} from "react-router-dom";

import Sidebar from "./Sidebar";
import Dashboard from "./pages/Dashboard";
import Simulator from "./pages/Simulator";
import Multisport from "./pages/Multisport";
import Validation from "./pages/Validation";

import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="stadium-app">
        <Sidebar />

        <Routes>
          <Route path="/" element={<Dashboard />} />

          <Route
            path="/multisport"
            element={<Multisport />}
          />

          <Route
            path="/simulator"
            element={<Simulator />}
          />

          <Route
            path="/validation"
            element={<Validation />}
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
