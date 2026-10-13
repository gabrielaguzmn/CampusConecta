from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from config.excepciones import Conflicto
from cuentas.correos import enviar_recuperacion
from cuentas.models import Usuario
from cuentas.permissions import EsAdministrador
from cuentas.serializers import (
    ConfirmacionRecuperacionSerializer,
    RegistroSerializer,
    SolicitudRecuperacionSerializer,
    TokenSerializer,
    UsuarioActualSerializer,
    UsuarioAdminSerializer,
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


class AdminUsuariosView(generics.ListAPIView):
    """ADMIN-3, ADMIN-4: listado de cuentas para el administrador."""

    serializer_class = UsuarioAdminSerializer
    permission_classes = [EsAdministrador]
    pagination_class = None
    queryset = Usuario.objects.order_by("pk")


class CambioRolView(APIView):
    """ADMIN-4 · criterio 2, RF-028: asignar o revocar el rol administrador a otros usuarios."""

    permission_classes = [EsAdministrador]
    es_administrador = None

    @extend_schema(request=None, responses=UsuarioAdminSerializer)
    @transaction.atomic
    def post(self, request, pk):
        usuario = get_object_or_404(Usuario.objects.select_for_update(), pk=pk)
        # RF-028: "a otros usuarios".
        if usuario.pk == request.user.pk:
            raise Conflicto("No puedes cambiar tu propio rol.", code="rol_propio")
        if usuario.es_administrador == self.es_administrador:
            raise Conflicto("La cuenta ya tiene ese rol.")
        # TODO(PENDIENTE G-28: revocar al administrador inicial o dejar la plataforma sin administradores)
        # TODO(PENDIENTE G-34: si el cambio de rol se guarda en el registro de moderación)
        usuario.es_administrador = self.es_administrador
        usuario.save(update_fields=["es_administrador"])
        return Response(UsuarioAdminSerializer(usuario).data)
