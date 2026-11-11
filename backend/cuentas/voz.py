import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class TokenDeepgramView(APIView):
    """Emite un token efímero; la clave maestra nunca se entrega al navegador."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=None,
        responses={
            200: inline_serializer(
                "TokenVoz", {"access_token": serializers.CharField(), "expires_in": serializers.IntegerField()}
            ),
            503: inline_serializer("VozNoDisponible", {"detail": serializers.CharField()}),
        },
    )
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
        expires_in = datos.get("expires_in", 30)
        if not isinstance(expires_in, (int, float)) or isinstance(expires_in, bool) or expires_in <= 0:
            return Response(
                {"detail": "El servicio de voz entregó un tiempo de expiración inválido."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"access_token": token, "expires_in": min(expires_in, 30)})


MAX_TEXTO_VOZ = 400


class TextoVozSerializer(serializers.Serializer):
    texto = serializers.CharField(max_length=MAX_TEXTO_VOZ, trim_whitespace=True)


class VozAsistenteView(APIView):
    """Convierte en audio las preguntas del asistente guiado con Deepgram Aura-2 (voz colombiana).

    El navegador no puede llamar a la API REST de Deepgram (CORS) y la clave no debe salir del servidor, así que
    el backend pide el audio y lo reenvía. Solo se envía el texto de la pregunta; no se guarda nada.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=TextoVozSerializer,
        responses={
            (200, "audio/mpeg"): OpenApiResponse(response=OpenApiTypes.BINARY, description="Audio MP3 de la frase."),
            503: inline_serializer("VozHabladaNoDisponible", {"detail": serializers.CharField()}),
        },
    )
    def post(self, request):
        datos = TextoVozSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        api_key = getattr(settings, "DEEPGRAM_API_KEY", "")
        if not api_key:
            return Response(
                {"detail": "El asistente de voz no está configurado."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        modelo = getattr(settings, "DEEPGRAM_TTS_MODEL", "aura-2-celeste-es")
        solicitud = urllib.request.Request(
            f"https://api.deepgram.com/v1/speak?model={modelo}&encoding=mp3",
            data=json.dumps({"text": datos.validated_data["texto"]}).encode(),
            headers={"Authorization": f"Token {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(solicitud, timeout=10) as respuesta:
                audio = respuesta.read()
        except urllib.error.HTTPError as error:
            logger.warning("Deepgram rechazó la solicitud de voz: HTTP %s", error.code)
            return Response(
                {"detail": "El servicio de voz no pudo generar el audio."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except (urllib.error.URLError, TimeoutError):
            logger.exception("No fue posible generar el audio con Deepgram.")
            return Response(
                {"detail": "No fue posible conectar con el servicio de voz."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not audio:
            return Response(
                {"detail": "El servicio de voz no entregó audio."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return HttpResponse(audio, content_type="audio/mpeg")
