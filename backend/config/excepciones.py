from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler


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
    return respuesta
