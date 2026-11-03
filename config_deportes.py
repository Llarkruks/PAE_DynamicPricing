
"""Configuracion central de deportes para STADIUM IQ."""

DEPORTES = {
    "football": {
        "nombre": "Futbol",
        "variables": (
            "derby_rivalry_index",
            "league_position_home",
            "league_position_away",
        ),
    },
    "basketball": {
        "nombre": "Baloncesto",
        "variables": (
            "team_win_percentage",
        ),
    },
    "tennis": {
        "nombre": "Tenis",
        "variables": (
            "player_ranking",
            "tournament_round",
        ),
    },
    "running": {
        "nombre": "Running",
        "variables": (
            "race_distance_km",
            "elevation_gain_m",
        ),
    },
}


def variables_deporte(deporte):
    """Devuelve las variables especificas de cada deporte."""
    try:
        return DEPORTES[deporte]["variables"]
    except KeyError as exc:
        raise ValueError(
            f"Deporte no configurado: {deporte}"
        ) from exc
