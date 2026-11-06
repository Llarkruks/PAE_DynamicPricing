
import { useEffect, useState } from "react";
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
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    loadCurrentUser()
      .then(setUser)
      .catch(() => {
        setAuthError("No se pudo conectar con el backend. Comprueba que esté iniciado.");
        setUser(null);
      });
  }, []);

  if (user === undefined) {
    return (
      <main className="app-loading">
        <span className="material-symbols-outlined">hourglass_top</span>
        <p>Cargando STADIUM IQ...</p>
      </main>
    );
  }
  if (!user) return <Auth onAuthenticated={setUser} initialError={authError} />;

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
