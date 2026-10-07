from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from cuentas.correos import enviar_recuperacion
from cuentas.models import Usuario
from cuentas.serializers import (
    ConfirmacionRecuperacionSerializer,
    RegistroSerializer,
    SolicitudRecuperacionSerializer,
    TokenSerializer,
    UsuarioActualSerializer,
)


class RegistroView(generics.CreateAPIView):
    """ACCESS-1 · criterio 1."""

    serializer_class = RegistroSerializer
    permission_classes = [AllowAny]


class TokenView(TokenObtainPairView):
    """ACCESS-1 · criterio 2; ADMIN-3 · criterio 1 (cuenta suspendida → 401 `cuenta_suspendida`)."""

    serializer_class = TokenSerializer

    @extend_schema(
        responses=inline_serializer("Tokens", {"access": serializers.CharField(), "refresh": serializers.CharField()})
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class UsuarioActualView(generics.RetrieveAPIView):
    """RF-024: el frontend sabe si mostrar el módulo de administración."""

    serializer_class = UsuarioActualSerializer

    def get_object(self):
        return self.request.user


class SolicitudRecuperacionView(APIView):
    """ACCESS-1 · criterio 3. Responde igual exista o no la cuenta, para no revelar qué correos están registrados."""

    permission_classes = [AllowAny]

    @extend_schema(request=SolicitudRecuperacionSerializer, responses={204: None})
    def post(self, request):
        serializer = SolicitudRecuperacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = Usuario.objects.filter(email__iexact=serializer.validated_data["email"]).first()
        if usuario:
            enviar_recuperacion(usuario)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ConfirmacionRecuperacionView(APIView):
    """ACCESS-1 · criterio 3 (G-17)."""

    permission_classes = [AllowAny]

    @extend_schema(request=ConfirmacionRecuperacionSerializer, responses={204: None})
    def post(self, request):
        serializer = ConfirmacionRecuperacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.validated_data["usuario"]
        usuario.set_password(serializer.validated_data["password"])
        usuario.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)
