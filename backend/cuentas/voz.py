import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class TokenDeepgramView(APIView):
    """Emite un token efímero; la clave maestra nunca se entrega al navegador."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        api_key = getattr(settings, "DEEPGRAM_API_KEY", "")
        if not api_key:
            return Response(
                {"detail": "El asistente de voz no está configurado."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        solicitud = urllib.request.Request(
            "https://api.deepgram.com/v1/auth/grant",
            data=json.dumps({"ttl_seconds": 30}).encode(),
            headers={"Authorization": f"Token {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(solicitud, timeout=5) as respuesta:
                datos = json.loads(respuesta.read())
        except urllib.error.HTTPError as error:
            logger.warning("Deepgram rechazó la solicitud de token: HTTP %s", error.code)
            return Response(
                {"detail": "Deepgram rechazó la clave del servicio de voz."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except (urllib.error.URLError, TimeoutError, ValueError):
            logger.exception("No fue posible obtener un token temporal de Deepgram.")
            return Response(
                {"detail": "No fue posible conectar con el servicio de voz."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        token = datos.get("access_token")
        if not token:
            return Response(
                {"detail": "El servicio de voz no entregó credenciales temporales."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"access_token": token, "expires_in": datos.get("expires_in", 60)})
