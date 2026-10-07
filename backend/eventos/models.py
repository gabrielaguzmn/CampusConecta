from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MinValueValidator, URLValidator
from django.db import models
from django.db.models import Case, Exists, F, OuterRef, Q, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone

PROXIMA = "proxima"
EN_VIVO = "en_vivo"
FINALIZADA = "finalizada"
CANCELADA = "cancelada"
ESTADOS = [(PROXIMA, "Próxima"), (EN_VIVO, "En vivo"), (FINALIZADA, "Finalizada"), (CANCELADA, "Cancelada")]

TAMANO_MAXIMO_IMAGEN = 5 * 1024 * 1024  # G-07: 5 MB


def validar_tamano_imagen(archivo):
    if archivo.size > TAMANO_MAXIMO_IMAGEN:
        raise ValidationError("La imagen no puede superar 5 MB.")


class Categoria(models.Model):
    # RF-022, RF-023
    nombre = models.CharField(max_length=100, unique=True)
    activa = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.nombre


class Ubicacion(models.Model):
    # RF-009: catálogo fijo, no gestionable desde la plataforma.
    nombre = models.CharField(max_length=200, unique=True)
    # TODO(PENDIENTE G-01: coordenadas y sistema de coordenadas del mapa)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class EventoQuerySet(models.QuerySet):
    def vigentes(self, ahora=None):
        """RF-020, G-32: al menos una fecha no cancelada próxima o en vivo."""
        fechas_vigentes = Fecha.objects.con_estado(ahora).filter(
            evento=OuterRef("pk"), estado_calculado__in=[PROXIMA, EN_VIVO]
        )
        return self.filter(Exists(fechas_vigentes))

    def historial(self, ahora=None):
        """RF-021: eventos sin fechas vigentes."""
        return self.exclude(pk__in=self.vigentes(ahora).values("pk"))


class Evento(models.Model):
    creador = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="eventos")
    # RF-008: obligatorios.
    nombre = models.TextField()
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT)
    descripcion = models.TextField()
    responsable = models.TextField()
    # RF-009, G-30: una única ubicación del catálogo por evento.
    ubicacion = models.ForeignKey(Ubicacion, on_delete=models.PROTECT)
    # RF-010: opcionales.
    detalle_ubicacion = models.TextField(blank=True)
    cupo = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    imagen = models.ImageField(
        upload_to="eventos/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(["jpg", "jpeg", "png"]), validar_tamano_imagen],
    )
    enlace_externo = models.URLField(blank=True, validators=[URLValidator(schemes=["http", "https"])])
    contacto = models.TextField(blank=True)
    # RF-032: ocultamiento por moderación.
    oculto = models.BooleanField(default=False)
    # TODO(PENDIENTE G-21: motivo de ocultamiento — una norma, varias o norma con texto)

    objects = EventoQuerySet.as_manager()

    def __str__(self):
        return self.nombre

    def es_vigente(self, ahora=None):
        return Evento.objects.filter(pk=self.pk).vigentes(ahora).exists()


class FechaQuerySet(models.QuerySet):
    def con_estado(self, ahora=None):
        """Anota `estado_calculado` con la misma regla que Fecha.estado(), para filtrar en la base de datos."""
        ahora = ahora or timezone.now()
        return self.alias(fin_efectivo=Coalesce("finalizada_en", "fin")).annotate(
            estado_calculado=Case(
                When(cancelada=True, then=Value(CANCELADA)),
                When(inicio__gt=ahora, then=Value(PROXIMA)),
                When(fin_efectivo__gt=ahora, then=Value(EN_VIVO)),
                default=Value(FINALIZADA),
                output_field=models.CharField(),
            )
        )


class Fecha(models.Model):
    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, related_name="fechas")
    # RF-008, G-07: horario propio con inicio y fin.
    inicio = models.DateTimeField()
    fin = models.DateTimeField()
    # RF-019: acciones manuales del creador.
    cancelada = models.BooleanField(default=False)
    finalizada_en = models.DateTimeField(null=True, blank=True)
    # RF-032: ocultamiento por moderación.
    oculta = models.BooleanField(default=False)
    # TODO(PENDIENTE G-21: motivo de ocultamiento)

    objects = FechaQuerySet.as_manager()

    class Meta:
        ordering = ["inicio"]
        constraints = [
            # G-31: el fin es posterior al inicio.
            models.CheckConstraint(condition=Q(fin__gt=F("inicio")), name="fecha_fin_posterior_al_inicio"),
        ]

    def estado(self, ahora=None):
        """RF-019, G-32: cancelada es permanente; si no, próxima → en vivo → finalizada."""
        ahora = ahora or timezone.now()
        if self.cancelada:
            return CANCELADA
        if ahora < self.inicio:
            return PROXIMA
        if ahora < (self.finalizada_en or self.fin):
            return EN_VIVO
        return FINALIZADA
