import axios from "axios";

export const API =
  import.meta.env.VITE_MULTISPORT_API_URL || "http://localhost:8001";
const TOKEN_KEY = "stadium-iq-auth-token";

export function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function authenticate(path, credentials) {
  const response = await axios.post(`${API}/api/v7/auth/${path}`, credentials);
  localStorage.setItem(TOKEN_KEY, response.data.token);
  return response.data.user;
}

export async function loadCurrentUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const response = await axios.get(`${API}/api/v7/auth/me`, {
      headers: authHeaders()
    });
    return response.data;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

export async function logout() {
  try {
    await axios.post(`${API}/api/v7/auth/logout`, {}, { headers: authHeaders() });
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}
