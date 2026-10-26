import streamlit as st
import pandas as pd
import numpy as np
import joblib
import json
import os
import plotly.graph_objects as go
from data_loader import load_and_consolidate, CSV_TRAIN_PATH
from train_model import select_features, MODEL_PATH
from pricing_optimizer import run_optimization_sweep, set_sim_categorical

FEATURES_PATH = "model_features.json"

st.set_page_config(
    page_title="FCB Pricing Dinámico",
    page_icon="🔵🔴",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ... (CSS styles omitted for brevity, keeping them as they are)
# I'll just replace the logic part to keep it clean.
# WAIT, the instructions say to replace a single contiguous block.
# Let's target the selection logic.

# ─── ESTILOS CSS OPTIMIZADOS (TEMA FCB + GLASSMORPHISM) ─────────────────────────
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Outfit', sans-serif;
    }
    
    .stApp {
        background: linear-gradient(135deg, #004d98 0%, #a50044 100%);
        color: white;
    }
    
    /* Estilo para las métricas de Streamlit */
    [data-testid="stMetricValue"] {
        font-size: 2rem !important;
        font-weight: 700 !important;
        color: #ffed00 !important;
    }
    
    [data-testid="stMetricDelta"] {
        color: #00ff00 !important;
    }

    .glass-card {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(12px);
        border-radius: 15px;
        padding: 25px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        margin-bottom: 20px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }
    
    h1, h2, h3 {
        color: white !important;
        font-weight: 600 !important;
    }
    
    .stButton>button {
        background-color: #ffed00 !important;
        color: #004d98 !important;
        font-weight: 600 !important;
        border-radius: 12px !important;
        border: none !important;
        padding: 10px 24px !important;
        transition: all 0.3s ease;
    }
    
    .stButton>button:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(255, 237, 0, 0.4);
    }

    .sidebar .sidebar-content {
        background-color: rgba(0, 77, 152, 0.9) !important;
    }
    </style>
    """, unsafe_allow_html=True)

# ─── FUNCIONES AUXILIARES ────────────────────────────────────────────────────────

@st.cache_resource
def load_assets():
    if not os.path.exists(MODEL_PATH) or not os.path.exists(FEATURES_PATH):
        return None, None
    model = joblib.load(MODEL_PATH)
    with open(FEATURES_PATH, "r") as f:
        features = json.load(f)
    return model, features

# run_optimization eliminada - ahora se usa pricing_optimizer.run_optimization_sweep

# ─── BARRA LATERAL (PANEL DE CONTROL) ──────────────────────────────────────────

with st.sidebar:
    st.image("https://www.fcbarcelona.com/fcbarcelona/photo/2018/10/01/21626601-26dd-4d7a-ba92-70b12bc85496/FCB_Logo.png", width=120)
    st.title("Consola de Gestión")
    st.markdown("---")
    
    st.subheader("Estado del Sistema")
    st.success("✅ Modelo v2: Realista Activo")
    st.info("Utilizando el dataset de precios ajustados y optimizados por sección.")

# ─── CONTENIDO PRINCIPAL ────────────────────────────────────────────────────────

st.title("📊 Camp Nou: Inteligencia de Pricing Dinámico")
st.markdown("Motor de optimización de ingresos de élite para el FC Barcelona.")

model, model_features = load_assets()

if not model or not model_features:
    st.error("Activos del modelo no encontrados. Por favor, ejecuta el entrenamiento primero.")
    st.stop()

# Carga de Datos (Dataset Maestro Completo 'Realistas')
df = load_and_consolidate(CSV_TRAIN_PATH) 

if df is not None:
    # ─── SELECTOR DE UBICACIÓN (NUEVA ESTRUCTURA LIMPIA) ───
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)
    c_sel1, c_sel2 = st.columns(2)
    
    with c_sel1:
        available_areas = sorted(df["item_area"].unique())
        selected_area = st.selectbox("1. Zona", available_areas, index=2) # Default Gol Nord
    
    with c_sel2:
        levels_in_area = sorted(df[df["item_area"] == selected_area]["item_level"].unique(), key=lambda x: int(x))
        selected_level = st.selectbox("2. Nivel", levels_in_area, index=0)
    
    # Extraer fila de referencia
    row = df[(df["item_area"] == selected_area) & (df["item_level"] == selected_level)].iloc[0].copy()
    
    # Mostrar solo la información esencial de ubicación en una línea
    st.markdown(f"📍 **Ubicación:** {row['sector_name']}  |  💰 **Precio Base Sector:** €{row['base_price']:.2f}")
    st.markdown('</div>', unsafe_allow_html=True)

    st.subheader("🔥 Simulador de Escenarios")
    
    # 1. Selección de Torneo (Al principio)
    st.markdown("##### 🏆 Contexto de Competición")
    c_ctx1, c_ctx2 = st.columns(2)
    with c_ctx1:
        sim_comp = st.selectbox("Competición", ["LaLiga", "Champions_League", "Copa_del_Rey", "Supercopa", "Friendly"], index=0)
    with c_ctx2:
        # Fases disponibles en el dataset
        phases = ["Regular_Season", "League_Phase", "Round_of_32", "Round_of_16", "Quarterfinal", "Semifinal", "Final", "Playoff", "Mid_season", "Pre_season", "Summer_Tour"]
        if sim_comp == "LaLiga":
            sim_phase = st.selectbox("Fase Actual", ["Regular_Season", "Mid_season"], index=0)
        elif sim_comp == "Champions_League":
            sim_phase = st.selectbox("Fase Actual", ["League_Phase", "Round_of_16", "Quarterfinal", "Semifinal", "Final"], index=0)
        else:
            sim_phase = st.selectbox("Fase Actual", phases, index=0)

    # 2. Otros Parámetros
    st.markdown("##### ⚙️ Parámetros de Simulación")
    s_c1, s_c2, s_c3 = st.columns(3)
    
    with s_c1:
        sim_days = st.slider("Días para el partido", 1, 150, 30)
        sim_occ = st.slider("Ocupación Proyectada (%)", 0.0, 0.99, 0.45)

    with s_c2:
        sim_imp = st.slider("Importancia Match", 1, 10, 7)
        sim_hour = st.slider("Hora Inicio", 12, 23, 21)

    with s_c3:
        sim_derby = st.checkbox("¿Es un Derbi?", value=False)
        sim_fest = st.checkbox("Festivo / Vacacional", value=False)

    st.markdown("---")

    # ─── INYECCIÓN DE VALORES Y OPTIMIZACIÓN ───
    row['days_to_match'] = sim_days
    row['occupancy_rate'] = sim_occ
    row['match_importance'] = sim_imp
    row['kickoff_hour'] = sim_hour
    row['is_derby'] = sim_derby
    row['is_holiday_period'] = sim_fest
    
    # Aplicar codificación categórica para la simulación
    row = set_sim_categorical(row, "competition_type", sim_comp)
    row = set_sim_categorical(row, "competition_phase", sim_phase)

    # Ejecutar Optimización centralizada
    base_p_sector = float(row['base_price'])
    p_range = np.linspace(base_p_sector * 0.4, base_p_sector * 2.8, 70)
    sweep_df, optimal, raw_ai_rate = run_optimization_sweep(model, model_features, row, p_range)

    # ─── RESULTADOS DE OPTIMIZACIÓN ───
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)
    c_res1, c_res2, c_res3 = st.columns([2, 1, 1])
    
    with c_res1:
        st.subheader("💡 Precio Óptimo Recomendado")
        st.markdown(f"<h1 style='color: #ffed00; font-size: 4.5rem; margin: 0;'>€{optimal['Precio']:.2f}</h1>", unsafe_allow_html=True)
        st.markdown(f"**Variación:** {optimal['vsBase']:+.1f}% sobre el precio base")
    
    with c_res2:
        st.metric("Elasticidad (E)", f"{optimal['Elasticidad']:.2f}", 
                  delta=f"{(2.5 - optimal['Elasticidad']):.2f}", delta_color="normal",
                  help="Menor elasticidad significa mercado más rígido (puedes subir el precio sin perder tanta demanda).")
        st.metric("Demanda Est.", f"{optimal['Demanda']:.1f} tix", 
                  help="Entradas proyectadas a vender en el horizonte de tiempo.")

    with c_res3:
        # Calcular ingresos vs base para el delta
        base_rev = base_p_sector * raw_ai_rate * 15 # aproximado
        rev_uplift = ((optimal['Ingresos'] / base_rev) - 1) * 100 if base_rev > 0 else 0
        st.metric("Potencial Ingresos", f"€{optimal['Ingresos']:,.0f}", f"{rev_uplift:+.1f}%")

    st.markdown('</div>', unsafe_allow_html=True)

    # ─── GRÁFICO DE MAXIMIZACIÓN ───
    st.markdown("### Curva de Maximización de Ingresos")
    fig_rev = go.Figure()
    
    # Curva de Ingresos
    fig_rev.add_trace(go.Scatter(x=sweep_df["Precio"], y=sweep_df["Ingresos"], 
                                mode='lines', name='Ingresos Est.',
                                line=dict(color='#ffed00', width=4),
                                fill='tozeroy', fillcolor='rgba(255, 237, 0, 0.1)'))
    
    # Línea de Precio Óptimo
    fig_rev.add_vline(x=optimal["Precio"], line_dash="dash", line_color="#00ff00", 
                      annotation_text=f"ÓPTIMO: €{optimal['Precio']:.2f}", 
                      annotation_position="top right")
    
    # Línea de Precio Base
    fig_rev.add_vline(x=base_p_sector, line_dash="dot", line_color="rgba(255,255,255,0.5)", 
                      annotation_text="BASE", annotation_position="bottom left")

    fig_rev.update_layout(xaxis_title="Precio (€)", yaxis_title="Ingresos Estimados (€)",
                          paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
                          font=dict(color="white", family="Outfit"),
                          hovermode="x unified",
                          margin=dict(l=0, r=0, t=30, b=0),
                          height=450)
    st.plotly_chart(fig_rev, use_container_width=True)

    with st.expander("🔎 Ver detalle técnico de optimización"):
        st.dataframe(sweep_df.style.background_gradient(subset=['Ingresos'], cmap='YlGn'), use_container_width=True)

else:
    st.error("Error crítico: No se pudo cargar el dataset realista.")
