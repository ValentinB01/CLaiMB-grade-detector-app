import math

# Punctaj de bază per culoare (grad de dificultate)
GRADE_BASE_POINTS = {
    "galben": 50,
    "verde": 100,
    "albastru": 250,
    "negru": 500,
}

# Multiplicator progresie
PROGRESSION_MULTIPLIER = {
    "zone": 0.5,
    "top": 1.0,
    "flash": 1.2,
}

# Multiplicator validare
VERIFICATION_MULTIPLIER = {
    "unverified": 0.5,
    "peer_verified": 1.0,
    "ai_verified": 1.0,
}


def calculate_route_points(
    grade: str,
    progression: str,
    verified_status: str,
) -> int:
    """
    Calculează punctajul final pentru o urcarea adăugată manual.

    Args:
        grade: Culoarea / gradul traseului (Galben, Verde, Albastru, Negru).
        progression: Nivelul de completare ('zone', 'top', 'flash').
        verified_status: Statusul validării ('unverified', 'peer_verified', 'ai_verified').

    Returns:
        Punctajul final, rotunjit la cel mai apropiat întreg.
    """
    base = GRADE_BASE_POINTS.get(grade.lower(), 0)
    prog_mult = PROGRESSION_MULTIPLIER.get(progression.lower(), 1.0)
    verif_mult = VERIFICATION_MULTIPLIER.get(verified_status.lower(), 0.5)

    return round(base * prog_mult * verif_mult)
