from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.views import exception_handler


class Conflicto(APIException):
    """El estado actual no admite la acción (RF-018, RF-025)."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "El estado actual no admite esta acción."
    default_code = "estado_no_permitido"


# La traducción al español de djangorestframework-simplejwt está incompleta (p. ej. "No active account found…"):
# sus errores se reemplazan por mensajes propios. El código (`code`) no cambia.
MENSAJES_SESION = {
    "no_active_account": "Correo o contraseña incorrectos.",
    "token_not_valid": "La sesión no es válida o ha caducado. Inicia sesión de nuevo.",
    "user_inactive": "La cuenta está suspendida.",
    "user_not_found": "La cuenta no existe.",
}


def manejador_excepciones(exc, context):
    """Añade los códigos de error al JSON para que el frontend distinga los casos sin depender del texto:
    - errores con `detail` (401, 403, 409…): `code`, p. ej. `cuenta_suspendida` o `contenido_oculto`;
    - errores de validación (400): `codes`, con la misma estructura de campos, p. ej. {"email": ["email_en_uso"]}."""
    respuesta = exception_handler(exc, context)
    if respuesta is None or not isinstance(respuesta.data, dict):
        return respuesta
    if isinstance(exc, ValidationError):
        respuesta.data["codes"] = exc.get_codes()
    elif "code" not in respuesta.data and hasattr(respuesta.data.get("detail"), "code"):
        respuesta.data["code"] = respuesta.data["detail"].code
    codigo = respuesta.data.get("code")
    if codigo in MENSAJES_SESION:
        respuesta.data = {"detail": MENSAJES_SESION[codigo], "code": codigo}
    return respuesta
