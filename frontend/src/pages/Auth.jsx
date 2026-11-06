import { useState } from "react";
import { authenticate } from "../auth";
import "./Auth.css";

export default function Auth({ onAuthenticated, initialError = "" }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await authenticate(mode === "login" ? "login" : "register", {
        email,
        password
      });
      onAuthenticated(user);
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      setError(
        Array.isArray(detail)
          ? "La contraseña debe tener al menos 6 caracteres."
          : detail ||
            (!requestError.response
              ? "No se pudo conectar con el backend. Comprueba que esté iniciado."
              : "No se pudo completar la operación.")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="material-symbols-outlined">stadium</span>
          <strong>STADIUM<span>IQ</span></strong>
        </div>
        <div className="ms-eyebrow">ACCESO A LA PLATAFORMA</div>
        <h1>{mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}</h1>
        <p>Guarda tus eventos y consulta tus recomendaciones cuando quieras.</p>
        <form onSubmit={submit}>
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" required value={email}
            onChange={event => setEmail(event.target.value)} placeholder="tu@email.com" />
          <label htmlFor="auth-password">Contraseña</label>
          <div className="auth-password-field">
            <input id="auth-password" type={showPassword ? "text" : "password"}
              minLength={mode === "register" ? 6 : undefined}
              required value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Introduce tu contraseña"} />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              <span className="material-symbols-outlined">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>
        <button type="button" className="auth-switch" onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
        }}>
          {mode === "login" ? "¿No tienes cuenta? Crear una" : "Ya tengo una cuenta"}
        </button>
      </section>
    </main>
  );
}
