
import React, { useEffect, useState } from "react";
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
import History from "./pages/History";
import Auth from "./pages/Auth";
import { loadCurrentUser, logout } from "./auth";

import "./App.css";

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    loadCurrentUser().then(setUser);
  }, []);

  if (user === undefined) return null;
  if (!user) return <Auth onAuthenticated={setUser} />;

  return (
    <BrowserRouter>
      <div className="stadium-app">
        <Sidebar user={user} onLogout={() => logout().then(() => setUser(null))} />

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
            path="/history"
            element={<History />}
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
