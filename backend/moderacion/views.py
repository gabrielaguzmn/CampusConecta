from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from config.excepciones import Conflicto
from cuentas.models import Usuario
from cuentas.permissions import EsAdministrador
from eventos.models import EN_VIVO, PROXIMA, Evento, Fecha
from eventos.serializers import EventoSerializer
from eventos.views import eventos_visibles
from moderacion import servicios
from moderacion.models import CasoReporte, RegistroModeracion, Reporte
from moderacion.normas import Norma
from moderacion.serializers import (
    CasoActualizacionSerializer,
    CasoSerializer,
    MotivoSerializer,
    NormaSerializer,
    RegistroModeracionSerializer,
    ReporteEntradaSerializer,
)

CONFIRMACION_REPORTE = "El reporte fue enviado y será revisado."


class NormasView(APIView):
    @extend_schema(responses=NormaSerializer(many=True))
    def get(self, request):
        """Las 10 normas de uso: causas de reporte (G-20) y motivos de moderación (G-21)."""
        return Response([{"id": valor, "nombre": nombre} for valor, nombre in Norma.choices])


class ReportarView(APIView):
    @extend_schema(
        request=ReporteEntradaSerializer,
        responses={201: inline_serializer("ConfirmacionReporte", {"detail": serializers.CharField()})},
    )
    @transaction.atomic
    def post(self, request, pk):
        """DISPLAY-3, RF-007, RF-030: reportar un evento desde su detalle; solo se confirma el envío."""
        evento = get_object_or_404(eventos_visibles(), pk=pk)
        serializer = ReporteEntradaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # RF-026: todos los reportes de un mismo evento van al mismo caso.
        caso, _ = CasoReporte.objects.get_or_create(evento=evento)
        serializer.save(caso=caso, evento=evento, usuario=request.user)
        return Response({"detail": CONFIRMACION_REPORTE}, status=status.HTTP_201_CREATED)


# --- Reportes (ADMIN-2) ---


def casos():
    return CasoReporte.objects.select_related("evento__creador").prefetch_related("reportes__usuario")


class AdminCasosView(generics.ListAPIView):
    serializer_class = CasoSerializer
    permission_classes = [EsAdministrador]
    pagination_class = None

    @extend_schema(parameters=[OpenApiParameter("estado", enum=[e for e, _ in CasoReporte.ESTADOS])])
    def get(self, request, *args, **kwargs):
        """ADMIN-2 · criterio 1: reportes agrupados por evento."""
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        estado = self.request.query_params.get("estado")
        return casos().filter(estado=estado) if estado else casos()


class AdminCasoView(APIView):
    permission_classes = [EsAdministrador]

    @extend_schema(responses=CasoSerializer)
    def get(self, request, pk):
        return Response(CasoSerializer(get_object_or_404(casos(), pk=pk)).data)

    @extend_schema(request=CasoActualizacionSerializer, responses=CasoSerializer)
    @transaction.atomic
    def patch(self, request, pk):
        """ADMIN-2 · criterios 2 y 3: cambiar el estado del caso y, al revisarlo, decidir si el evento se oculta."""
        caso = get_object_or_404(casos().select_for_update(of=("self",)), pk=pk)
        serializer = CasoActualizacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        if datos["decision_ocultar"]:
            evento = caso.evento
            comprobar_evento_moderable(evento, oculto=False)
            servicios.ocultar(request.user, evento, datos["norma"], datos["explicacion"], reportes=caso.reportes.all())
        caso.estado = datos["estado"]
        caso.decision_ocultar = datos["decision_ocultar"]
        caso.save()
        return Response(CasoSerializer(casos().get(pk=caso.pk)).data)


# --- Moderación de eventos y fechas (ADMIN-1) ---


def comprobar_evento_moderable(evento, oculto):
    # RF-025, ADMIN-1 · criterio 3: no se modera contenido caducado (sin fechas próximas o en vivo).
    if not evento.fechas.con_estado().filter(estado_calculado__in=[PROXIMA, EN_VIVO]).exists():
        raise Conflicto("El evento ya no tiene fechas próximas o en vivo.", code="contenido_caducado")
    if evento.oculto != oculto:
        raise Conflicto("El evento ya está oculto." if evento.oculto else "El evento no está oculto.")


def comprobar_fecha_moderable(fecha, oculta):
    estado = fecha.estado()
    if estado == "finalizada":
        raise Conflicto("La fecha ya finalizó.", code="contenido_caducado")  # RF-025
    if estado == "cancelada":
        # TODO(PENDIENTE G-23: si se puede moderar una fecha cancelada)
        raise Conflicto("La fecha está cancelada.", code="pendiente_g23")
    if fecha.oculta != oculta:
        raise Conflicto("La fecha ya está oculta." if fecha.oculta else "La fecha no está oculta.")


class AdminEventosView(generics.ListAPIView):
    """ADMIN-1: "revisar" (RF-025). Lista todos los eventos, incluidos los ocultos."""

    serializer_class = EventoSerializer
    permission_classes = [EsAdministrador]
    pagination_class = None

    @extend_schema(parameters=[OpenApiParameter("oculto", bool)])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        eventos = Evento.objects.select_related("categoria", "ubicacion").prefetch_related("fechas").order_by("-pk")
        oculto = self.request.query_params.get("oculto")
        if oculto not in (None, "true", "false"):
            raise ValidationError({"oculto": "Debe ser 'true' o 'false'."})
        return eventos if oculto is None else eventos.filter(oculto=oculto == "true")


def evento_bloqueado(pk):
    return get_object_or_404(Evento.objects.select_for_update().select_related("creador"), pk=pk)


def fecha_bloqueada(pk):
    fecha = get_object_or_404(Fecha.objects.select_for_update(of=("self",)).select_related("evento__creador"), pk=pk)
    return fecha


def respuesta_admin(request, evento):
    evento = Evento.objects.select_related("categoria", "ubicacion").prefetch_related("fechas").get(pk=evento.pk)
    return Response(EventoSerializer(evento, context={"request": request}).data)


class AdminOcultarEventoView(APIView):
    permission_classes = [EsAdministrador]

    @extend_schema(request=MotivoSerializer, responses=EventoSerializer)
    @transaction.atomic
    def post(self, request, pk):
        """ADMIN-1 · criterios 1 y 4: ocultar el evento completo; se avisa al creador por correo."""
        evento = evento_bloqueado(pk)
        comprobar_evento_moderable(evento, oculto=False)
        motivo = MotivoSerializer(data=request.data)
        motivo.is_valid(raise_exception=True)
        servicios.ocultar(request.user, evento, **motivo.validated_data)
        return respuesta_admin(request, evento)


class AdminRestaurarEventoView(APIView):
    permission_classes = [EsAdministrador]

    @extend_schema(request=None, responses=EventoSerializer)
    @transaction.atomic
    def post(self, request, pk):
        """ADMIN-1 · criterio 2: restaurar el evento."""
        evento = evento_bloqueado(pk)
        comprobar_evento_moderable(evento, oculto=True)
        servicios.restaurar(request.user, evento)
        return respuesta_admin(request, evento)


class AdminOcultarFechaView(APIView):
    permission_classes = [EsAdministrador]

    @extend_schema(request=MotivoSerializer, responses=EventoSerializer)
    @transaction.atomic
    def post(self, request, pk):
        """ADMIN-1 · criterios 1 y 4: ocultar una fecha; se avisa al creador por correo."""
        fecha = fecha_bloqueada(pk)
        comprobar_fecha_moderable(fecha, oculta=False)
        motivo = MotivoSerializer(data=request.data)
        motivo.is_valid(raise_exception=True)
        servicios.ocultar(request.user, fecha.evento, fecha=fecha, **motivo.validated_data)
        return respuesta_admin(request, fecha.evento)


class AdminRestaurarFechaView(APIView):
    permission_classes = [EsAdministrador]

    @extend_schema(request=None, responses=EventoSerializer)
    @transaction.atomic
    def post(self, request, pk):
        """ADMIN-1 · criterio 2: restaurar una fecha."""
        fecha = fecha_bloqueada(pk)
        comprobar_fecha_moderable(fecha, oculta=True)
        servicios.restaurar(request.user, fecha.evento, fecha=fecha)
        return respuesta_admin(request, fecha.evento)


# TODO(PENDIENTE G-24: eliminación de eventos y fechas por moderación — PUBLICATION-8 · criterio 4, RF-017, RF-025)


# --- Suspensión de cuentas (ADMIN-3) ---


def usuario_afectado(request, pk):
    usuario = get_object_or_404(Usuario.objects.select_for_update(), pk=pk)
    if usuario.pk == request.user.pk or usuario.es_administrador:
        # TODO(PENDIENTE G-28: suspender a un administrador o a uno mismo)
        raise Conflicto("No se puede suspender ni reactivar a un administrador.", code="pendiente_g28")
    return usuario


class EstadoCuentaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    suspendida = serializers.BooleanField()


def respuesta_cuenta(usuario):
    return Response({"id": usuario.pk, "email": usuario.email, "suspendida": not usuario.is_active})


class AdminSuspenderView(APIView):
    permission_classes = [EsAdministrador]

    @extend_schema(request=MotivoSerializer, responses=EstadoCuentaSerializer)
    @transaction.atomic
    def post(self, request, pk):
        """ADMIN-3 · criterios 1, 2 y 4."""
        usuario = usuario_afectado(request, pk)
        if not usuario.is_active:
            raise Conflicto("La cuenta ya está suspendida.")
        motivo = MotivoSerializer(data=request.data)
        motivo.is_valid(raise_exception=True)
        servicios.suspender(request.user, usuario, **motivo.validated_data)
        return respuesta_cuenta(usuario)


class AdminReactivarView(APIView):
    permission_classes = [EsAdministrador]

    @extend_schema(request=None, responses=EstadoCuentaSerializer)
    @transaction.atomic
    def post(self, request, pk):
        """ADMIN-3 · criterio 3."""
        usuario = usuario_afectado(request, pk)
        if usuario.is_active:
            raise Conflicto("La cuenta no está suspendida.")
        servicios.reactivar(request.user, usuario)
        return respuesta_cuenta(usuario)


# --- Registro de moderación (ADMIN-4) ---


class AdminRegistroView(generics.ListAPIView):
    """ADMIN-4 · criterios 3 y 4: consulta de solo lectura."""

    serializer_class = RegistroModeracionSerializer
    permission_classes = [EsAdministrador]
    pagination_class = None
    queryset = RegistroModeracion.objects.select_related("administrador", "cuenta_afectada").prefetch_related("reportes")


class AdminRegistroDetalleView(generics.RetrieveAPIView):
    serializer_class = RegistroModeracionSerializer
    permission_classes = [EsAdministrador]
    queryset = AdminRegistroView.queryset
