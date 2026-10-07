from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from cuentas.permissions import EsAdministrador
from eventos.models import EN_VIVO, PROXIMA, Categoria, Evento, Fecha, Ubicacion
from eventos.serializers import (
    CategoriaSerializer,
    EventoCreacionSerializer,
    EventoEdicionSerializer,
    EventoSerializer,
    ExtensionSerializer,
    FechaEdicionSerializer,
    FechaEntradaSerializer,
    FechaSerializer,
    ImagenSerializer,
    UbicacionSerializer,
    intervalos,
    se_solapan,
)


class Conflicto(APIException):
    """El estado de la fecha o del evento no admite la acción (RF-018)."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "El estado actual no admite esta acción."
    default_code = "estado_no_permitido"


def evento_propio(request, pk):
    """RF-018, RNF-004: las acciones de gestión son exclusivas del creador. Bloquea la fila hasta fin de la transacción."""
    evento = get_object_or_404(Evento.objects.select_for_update(), pk=pk)
    if evento.creador_id != request.user.pk:
        raise PermissionDenied("Solo el creador del evento puede realizar esta acción.")
    return evento


def fecha_propia(request, pk):
    fecha = get_object_or_404(Fecha.objects.select_related("evento"), pk=pk)
    evento_propio(request, fecha.evento_id)
    return fecha


def rechazar_si_oculto(evento, fecha=None):
    # TODO(PENDIENTE G-23: qué puede hacer el creador sobre contenido oculto por moderación)
    if evento.oculto or (fecha is not None and fecha.oculta):
        raise Conflicto("El contenido está oculto por moderación.", code="contenido_oculto")


def exigir_estado(fecha, *estados):
    if fecha.estado() not in estados:
        raise Conflicto()


def exigir_vigente(evento):
    # G-30: el evento se edita (y admite fechas nuevas) mientras no pase al historial.
    if not evento.es_vigente():
        raise Conflicto("El evento está en el historial y solo admite consulta.", code="evento_en_historial")


def respuesta_evento(evento, codigo=status.HTTP_200_OK):
    evento = Evento.objects.select_related("categoria", "ubicacion").prefetch_related("fechas").get(pk=evento.pk)
    return Response(EventoSerializer(evento).data, status=codigo)


# --- Categorías y ubicaciones ---


class CategoriasView(generics.ListAPIView):
    """CATEGORY-1 · criterio 1: categorías disponibles para publicar."""

    serializer_class = CategoriaSerializer
    pagination_class = None
    # TODO(PENDIENTE G-29: si los usuarios ven también las categorías inactivas)
    queryset = Categoria.objects.filter(activa=True)


class AdminCategoriasView(generics.ListCreateAPIView):
    """CATEGORY-1 · criterio 2, RF-023."""

    serializer_class = CategoriaSerializer
    permission_classes = [EsAdministrador]
    pagination_class = None
    queryset = Categoria.objects.all()


class AdminCategoriaView(generics.UpdateAPIView):
    """CATEGORY-1 · criterios 2 y 3: renombrar, activar o desactivar."""

    serializer_class = CategoriaSerializer
    permission_classes = [EsAdministrador]
    queryset = Categoria.objects.all()
    http_method_names = ["patch"]


class UbicacionesView(generics.ListAPIView):
    """RF-009: catálogo fijo de ubicaciones."""

    serializer_class = UbicacionSerializer
    pagination_class = None
    queryset = Ubicacion.objects.all()


# --- Eventos ---


class EventosView(APIView):
    @extend_schema(request=EventoCreacionSerializer, responses={201: EventoSerializer})
    def post(self, request):
        """PUBLICATION-1: crear y publicar un evento con una o varias fechas."""
        serializer = EventoCreacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evento = serializer.save(creador=request.user)
        return respuesta_evento(evento, status.HTTP_201_CREATED)


class EventoView(APIView):
    @extend_schema(request=EventoEdicionSerializer, responses=EventoSerializer)
    @transaction.atomic
    def patch(self, request, pk):
        """G-30: editar los datos del evento."""
        evento = evento_propio(request, pk)
        rechazar_si_oculto(evento)
        exigir_vigente(evento)
        serializer = EventoEdicionSerializer(evento, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return respuesta_evento(evento)

    @extend_schema(responses={204: None})
    @transaction.atomic
    def delete(self, request, pk):
        """PUBLICATION-8 · criterio 2: eliminar el evento completo."""
        evento = evento_propio(request, pk)
        rechazar_si_oculto(evento)
        if any(fecha.estado() != PROXIMA for fecha in evento.fechas.all()):
            # TODO(PENDIENTE G-24: eliminar un evento con fechas en vivo, finalizadas o canceladas)
            raise Conflicto("Solo se puede eliminar un evento cuyas fechas son todas próximas.", code="pendiente_g24")
        evento.imagen.delete(save=False)
        evento.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventoImagenView(APIView):
    parser_classes = [MultiPartParser]

    @extend_schema(request=ImagenSerializer, responses=EventoSerializer)
    @transaction.atomic
    def put(self, request, pk):
        """RF-010: imagen opcional del evento (JPG o PNG, 5 MB como máximo)."""
        evento = evento_propio(request, pk)
        rechazar_si_oculto(evento)
        exigir_vigente(evento)
        serializer = ImagenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evento.imagen.delete(save=False)
        evento.imagen = serializer.validated_data["imagen"]
        evento.save(update_fields=["imagen"])
        return respuesta_evento(evento)

    @extend_schema(responses=EventoSerializer)
    @transaction.atomic
    def delete(self, request, pk):
        evento = evento_propio(request, pk)
        rechazar_si_oculto(evento)
        exigir_vigente(evento)
        evento.imagen.delete(save=False)
        evento.imagen = None
        evento.save(update_fields=["imagen"])
        return respuesta_evento(evento)


class EventoFechasView(APIView):
    @extend_schema(request=FechaEntradaSerializer, responses={201: EventoSerializer})
    @transaction.atomic
    def post(self, request, pk):
        """G-30: añadir una fecha a un evento ya publicado."""
        evento = evento_propio(request, pk)
        rechazar_si_oculto(evento)
        exigir_vigente(evento)
        serializer = FechaEntradaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        if se_solapan(datos["inicio"], datos["fin"], intervalos(evento.fechas.all())):
            raise ValidationError("Dos fechas del mismo evento no pueden solaparse.")
        Fecha.objects.create(evento=evento, **datos)
        return respuesta_evento(evento, status.HTTP_201_CREATED)


class CancelarTodasView(APIView):
    @extend_schema(request=None, responses=EventoSerializer)
    @transaction.atomic
    def post(self, request, pk):
        """PUBLICATION-5: cancelar de una vez todas las fechas próximas o en vivo."""
        evento = evento_propio(request, pk)
        rechazar_si_oculto(evento)
        vigentes = [f.pk for f in evento.fechas.all() if f.estado() in (PROXIMA, EN_VIVO)]
        if not vigentes:
            raise Conflicto("El evento no tiene fechas próximas o en vivo.")
        Fecha.objects.filter(pk__in=vigentes).update(cancelada=True)
        return respuesta_evento(evento)


class MisEventosView(generics.ListAPIView):
    """PUBLICATION-2: eventos propios, separados en vigentes e historial."""

    serializer_class = EventoSerializer
    pagination_class = None

    @extend_schema(parameters=[OpenApiParameter("vista", enum=["vigentes", "historial"], default="vigentes")])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        vista = self.request.query_params.get("vista", "vigentes")
        if vista not in ("vigentes", "historial"):
            raise ValidationError({"vista": "Debe ser 'vigentes' o 'historial'."})
        # TODO(PENDIENTE G-23: si un evento oculto con fechas futuras aparece como vigente o como historial)
        eventos = Evento.objects.filter(creador=self.request.user)
        eventos = eventos.vigentes() if vista == "vigentes" else eventos.historial()
        return eventos.select_related("categoria", "ubicacion").prefetch_related("fechas").order_by("pk")


# --- Fechas ---


class FechaView(APIView):
    @extend_schema(request=FechaEdicionSerializer, responses=EventoSerializer)
    @transaction.atomic
    def patch(self, request, pk):
        """PUBLICATION-3: editar el horario de una fecha próxima."""
        fecha = fecha_propia(request, pk)
        rechazar_si_oculto(fecha.evento, fecha)
        exigir_estado(fecha, PROXIMA)
        serializer = FechaEdicionSerializer(fecha, data=request.data)
        serializer.is_valid(raise_exception=True)
        Fecha.objects.filter(pk=fecha.pk).update(**serializer.validated_data)
        return respuesta_evento(fecha.evento)

    @extend_schema(responses={204: None})
    @transaction.atomic
    def delete(self, request, pk):
        """PUBLICATION-8 · criterio 1: eliminar una fecha próxima."""
        fecha = fecha_propia(request, pk)
        rechazar_si_oculto(fecha.evento, fecha)
        exigir_estado(fecha, PROXIMA)
        if not fecha.evento.fechas.exclude(pk=fecha.pk).exists():
            # TODO(PENDIENTE G-24: eliminar la única fecha de un evento)
            raise Conflicto("Es la única fecha del evento; elimina el evento completo.", code="pendiente_g24")
        fecha.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CancelarFechaView(APIView):
    @extend_schema(request=None, responses=EventoSerializer)
    @transaction.atomic
    def post(self, request, pk):
        """PUBLICATION-4: cancelar una fecha próxima o en vivo (G-32: queda cancelada de forma permanente)."""
        fecha = fecha_propia(request, pk)
        rechazar_si_oculto(fecha.evento, fecha)
        exigir_estado(fecha, PROXIMA, EN_VIVO)
        Fecha.objects.filter(pk=fecha.pk).update(cancelada=True)
        return respuesta_evento(fecha.evento)


class FinalizarFechaView(APIView):
    @extend_schema(request=None, responses=EventoSerializer)
    @transaction.atomic
    def post(self, request, pk):
        """PUBLICATION-6: finalizar antes de tiempo una fecha en vivo."""
        fecha = fecha_propia(request, pk)
        rechazar_si_oculto(fecha.evento, fecha)
        exigir_estado(fecha, EN_VIVO)
        Fecha.objects.filter(pk=fecha.pk).update(finalizada_en=timezone.now())
        return respuesta_evento(fecha.evento)


class ExtenderFechaView(APIView):
    @extend_schema(request=ExtensionSerializer, responses=EventoSerializer)
    @transaction.atomic
    def post(self, request, pk):
        """PUBLICATION-7: extender una fecha en vivo con un nuevo fin."""
        fecha = fecha_propia(request, pk)
        rechazar_si_oculto(fecha.evento, fecha)
        exigir_estado(fecha, EN_VIVO)
        serializer = ExtensionSerializer(fecha, data=request.data)
        serializer.is_valid(raise_exception=True)
        Fecha.objects.filter(pk=fecha.pk).update(fin=serializer.validated_data["fin"])
        return respuesta_evento(fecha.evento)
