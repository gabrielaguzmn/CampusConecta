from django.core.validators import URLValidator
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from eventos.models import ESTADOS, Categoria, Evento, Fecha, Ubicacion


class CategoriaSerializer(serializers.ModelSerializer):
    # Al escribir debe ser un hexadecimal; no se puede quitar.
    color = serializers.RegexField(r"^#[0-9A-Fa-f]{6}$", max_length=7, required=False, allow_null=True)

    class Meta:
        model = Categoria
        fields = ["id", "nombre", "activa", "color"]

    def validate_color(self, color):
        if color is None:
            raise serializers.ValidationError("El color no se puede quitar.")
        return color

    def validate(self, datos):
        # G-54: el administrador elige el color al crear la categoría.
        if self.instance is None and not datos.get("color"):
            raise serializers.ValidationError({"color": "El color es obligatorio al crear una categoría."})
        return datos


class UbicacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ubicacion
        fields = ["id", "nombre", "tipo", "zona", "codigo"]

class FechaSerializer(serializers.ModelSerializer):
    estado = serializers.SerializerMethodField()

    class Meta:
        model = Fecha
        fields = ["id", "inicio", "fin", "finalizada_en", "estado", "oculta", "norma_ocultamiento", "explicacion_ocultamiento"]

    @extend_schema_field(serializers.ChoiceField(choices=ESTADOS))
    def get_estado(self, fecha):
        return fecha.estado()


class EventoSerializer(serializers.ModelSerializer):
    """Representación para el creador ("Mis eventos" y respuestas de sus acciones)."""

    categoria = CategoriaSerializer()
    ubicacion = UbicacionSerializer()
    fechas = FechaSerializer(many=True)

    class Meta:
        model = Evento
        fields = [
            "id", "nombre", "categoria", "descripcion", "responsable", "ubicacion", "detalle_ubicacion",
            "cupo", "imagen", "enlace_externo", "contacto", "oculto", "norma_ocultamiento", "explicacion_ocultamiento",
            "fechas",
        ]


class FechaPublicaSerializer(FechaSerializer):
    """Fecha tal como la ve cualquier usuario: sin marcas de moderación."""

    class Meta(FechaSerializer.Meta):
        fields = ["id", "inicio", "fin", "finalizada_en", "estado"]


class EventoPublicoSerializer(serializers.ModelSerializer):
    """Feed y detalle (DISPLAY-1, INTERACTIVITY-2, INTERACTIVITY-3). Las fechas ocultas no se incluyen."""

    categoria = CategoriaSerializer()
    ubicacion = UbicacionSerializer()
    fechas = FechaPublicaSerializer(many=True)

    class Meta:
        model = Evento
        fields = [
            "id", "nombre", "categoria", "descripcion", "responsable", "ubicacion", "detalle_ubicacion",
            "cupo", "imagen", "enlace_externo", "contacto", "fechas",
        ]


class EventoMapaSerializer(serializers.ModelSerializer):
    """Información básica del pin (INTERACTIVITY-2 · criterio 1); el detalle completo está en GET eventos/{id}/."""

    categoria = CategoriaSerializer()
    # MapaView deja en `fechas_mapa` las fechas vigentes del evento.
    fechas = FechaPublicaSerializer(many=True, source="fechas_mapa")

    class Meta:
        model = Evento
        fields = ["id", "nombre", "categoria", "detalle_ubicacion", "fechas"]


class UbicacionMapaSerializer(serializers.Serializer):
    """INTERACTIVITY-1 · criterio 2: los eventos vigentes agrupados por ubicación del catálogo."""

    # TODO(PENDIENTE G-01: coordenadas de la ubicación sobre el mapa del campus)
    ubicacion = UbicacionSerializer()
    eventos = EventoMapaSerializer(many=True)


def validar_horario(inicio, fin):
    """G-31: el fin es posterior al inicio y no se programa en el pasado."""
    if fin <= inicio:
        raise serializers.ValidationError({"fin": "El fin debe ser posterior al inicio."})
    if inicio < timezone.now():
        raise serializers.ValidationError({"inicio": "No se puede programar una fecha que ya pasó."})


def se_solapan(inicio, fin, otras):
    """G-31: dos fechas del mismo evento no se solapan. `otras` son pares (inicio, fin efectivo)."""
    return any(inicio < otro_fin and otro_inicio < fin for otro_inicio, otro_fin in otras)


def intervalos(fechas):
    # Decisión 2026-10-07: las fechas canceladas no ocupan horario; se puede reprogramar en su lugar.
    return [(f.inicio, f.finalizada_en or f.fin) for f in fechas if not f.cancelada]


class FechaEntradaSerializer(serializers.Serializer):
    inicio = serializers.DateTimeField()
    fin = serializers.DateTimeField()

    def validate(self, datos):
        validar_horario(datos["inicio"], datos["fin"])
        return datos


def campo_enlace_externo():
    # G-07: URL http/https. Se declara aquí porque DRF reemplaza el validador del modelo por uno que admite ftp.
    return serializers.URLField(required=False, allow_blank=True, validators=[URLValidator(schemes=["http", "https"])])


def validar_categoria_activa(categoria):
    # CATEGORY-1 · criterio 3: solo categorías activas para nuevas publicaciones.
    if not categoria.activa:
        raise serializers.ValidationError("La categoría no está activa.")
    return categoria


class EventoCreacionSerializer(serializers.ModelSerializer):
    """PUBLICATION-1: RF-008 (obligatorios) y RF-010 (opcionales). La imagen se sube aparte."""

    fechas = FechaEntradaSerializer(many=True, allow_empty=False)
    enlace_externo = campo_enlace_externo()

    class Meta:
        model = Evento
        fields = [
            "nombre", "categoria", "descripcion", "responsable", "ubicacion", "detalle_ubicacion",
            "cupo", "enlace_externo", "contacto", "fechas",
        ]

    def validate_categoria(self, categoria):
        return validar_categoria_activa(categoria)

    def validate_fechas(self, fechas):
        vistas = []
        for fecha in fechas:
            if se_solapan(fecha["inicio"], fecha["fin"], vistas):
                raise serializers.ValidationError("Dos fechas del mismo evento no pueden solaparse.")
            vistas.append((fecha["inicio"], fecha["fin"]))
        return fechas

    @transaction.atomic
    def create(self, datos):
        fechas = datos.pop("fechas")
        evento = Evento.objects.create(**datos)
        Fecha.objects.bulk_create(Fecha(evento=evento, **fecha) for fecha in fechas)
        return evento


class EventoEdicionSerializer(serializers.ModelSerializer):
    """G-30: los datos del evento se editan mientras no pase al historial."""

    enlace_externo = campo_enlace_externo()

    class Meta:
        model = Evento
        fields = [
            "nombre", "categoria", "descripcion", "responsable", "ubicacion", "detalle_ubicacion",
            "cupo", "enlace_externo", "contacto",
        ]

    def validate_categoria(self, categoria):
        if categoria != self.instance.categoria:
            validar_categoria_activa(categoria)
        return categoria


class FechaEdicionSerializer(serializers.Serializer):
    """PUBLICATION-3, G-30: de una fecha próxima se editan el día, el inicio y el fin."""

    inicio = serializers.DateTimeField(required=False)
    fin = serializers.DateTimeField(required=False)
    def validate(self, datos):
        fecha = self.instance
        inicio = datos.get("inicio", fecha.inicio)
        fin = datos.get("fin", fecha.fin)
        validar_horario(inicio, fin)
        otras = fecha.evento.fechas.exclude(pk=fecha.pk)
        if se_solapan(inicio, fin, intervalos(otras)):
            raise serializers.ValidationError("Dos fechas del mismo evento no pueden solaparse.")
        return {"inicio": inicio, "fin": fin}


class ExtensionSerializer(serializers.Serializer):
    """PUBLICATION-7, G-05: nuevo fin posterior al actual y sin solapar otra fecha."""

    fin = serializers.DateTimeField()

    def validate_fin(self, fin):
        fecha = self.instance
        if fin <= fecha.fin:
            raise serializers.ValidationError("El nuevo fin debe ser posterior al fin actual.")
        otras = fecha.evento.fechas.exclude(pk=fecha.pk)
        if se_solapan(fecha.inicio, fin, intervalos(otras)):
            raise serializers.ValidationError("La extensión se solapa con otra fecha del evento.")
        return fin


class ImagenSerializer(serializers.Serializer):
    imagen = serializers.ImageField()

    def validate_imagen(self, imagen):
        # G-07: JPG o PNG reales, de 5 MB como máximo.
        for validador in Evento._meta.get_field("imagen").validators:
            validador(imagen)
        if getattr(imagen, "image", None) is None or imagen.image.format not in ("JPEG", "PNG"):
            raise serializers.ValidationError("La imagen debe ser JPG o PNG.")
        return imagen