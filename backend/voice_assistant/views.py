import logging

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import APIView

from .semantic.engine import get_engine
from .serializers import SemanticMatchSerializer
from .throttles import SemanticUserThrottle

logger = logging.getLogger(__name__)


class SemanticUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "El servicio semántico local no está disponible."
    default_code = "semantic_unavailable"


class SemanticMatchView(APIView):
    throttle_classes = [SemanticUserThrottle]

    @extend_schema(request=SemanticMatchSerializer)
    def post(self, request):
        if not settings.VOICE_SEMANTIC["ENABLED"]:
            raise SemanticUnavailable("El servicio semántico está deshabilitado.")
        serializer = SemanticMatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = get_engine().match(serializer.validated_data["text"], serializer.validated_data.get("candidate_intents"))
        except Exception:
            logger.exception("No fue posible cargar o ejecutar el modelo semántico")
            raise SemanticUnavailable()
        if settings.VOICE_SEMANTIC["LOG_PHRASES"]:
            logger.info("Consulta semántica: %s", serializer.validated_data["text"])
        return Response(result)


class SemanticHealthView(APIView):
    def get(self, request):
        from .semantic import engine
        return Response({"ready": engine._engine is not None, "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2", "enabled": settings.VOICE_SEMANTIC["ENABLED"]})
