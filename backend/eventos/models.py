from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MinValueValidator, RegexValidator, URLValidator
from django.db import models
from django.db.models import Case, Exists, F, OuterRef, Q, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone

from moderacion.normas import Norma

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
    # G-54 / CONTRATO-01 (decisión 2026-10-07): color hexadecimal elegido por el administrador; editable.
    # Las seis iniciales reciben su color en la migración 0004 (G-02).
    color = models.CharField(
        max_length=7,
        null=True,
        blank=True,
        validators=[RegexValidator(r"^#[0-9A-Fa-f]{6}$", "El color debe ser hexadecimal, p. ej. #950000.")],
    )

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.nombre


class Ubicacion(models.Model):
    # RF-009: catálogo fijo, no gestionable desde la plataforma.
    EDIFICIO, CANCHA, PLAZOLETA, OTRO = "edificio", "cancha", "plazoleta", "otro"
    TIPOS = [(EDIFICIO, "Edificio"), (CANCHA, "Cancha"), (PLAZOLETA, "Plazoleta"), (OTRO, "Otro")]

    nombre = models.CharField(max_length=200, unique=True)
    tipo = models.CharField(max_length=10, choices=TIPOS, default=EDIFICIO)
    zona = models.CharField(max_length=1, blank=True)  # A-E, la del plano del mapa
    # Enlaza con el plano del front: "<zona>:<archivo>", p. ej. "E:E1". La posición del pin sale del propio plano.
    codigo = models.CharField(max_length=60, unique=True, null=True, blank=True)

    class Meta:
        ordering = ["zona", "nombre"]

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

    def visibles(self, ahora=None, estado=None):
        """Lo que se muestra en el feed, el mapa y el detalle (RF-005, RF-020, RF-032, RF-033, G-38):
        evento no oculto, creador no suspendido y al menos una fecha no oculta próxima o en vivo.
        Con `estado` (G-33), la fecha debe estar en ese estado."""
        fechas = Fecha.objects.con_estado(ahora).filter(
            evento=OuterRef("pk"), oculta=False, estado_calculado__in=[estado] if estado else [PROXIMA, EN_VIVO]
        )
        return self.filter(oculto=False, creador__is_active=True).filter(Exists(fechas))


class EventoManager(models.Manager.from_queryset(EventoQuerySet)):
    def get_queryset(self):
        return super().get_queryset().filter(eliminado=False)


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
    # RF-032: ocultamiento por moderación, con su motivo (G-21: una norma más un texto opcional).
    oculto = models.BooleanField(default=False)
    norma_ocultamiento = models.PositiveSmallIntegerField(choices=Norma.choices, null=True, blank=True)
    explicacion_ocultamiento = models.TextField(blank=True)
    # RF-017, G-24: borrado lógico. El registro de moderación (RF-034) sigue apuntando al contenido eliminado.
    eliminado = models.BooleanField(default=False)

    # `objects` no devuelve lo eliminado, así que el feed, el mapa, "Mis eventos" y el panel de administración
    # lo ignoran sin cambios. `con_eliminados` los incluye.
    objects = EventoManager()
    con_eliminados = EventoQuerySet.as_manager()

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


class FechaManager(models.Manager.from_queryset(FechaQuerySet)):
    def get_queryset(self):
        return super().get_queryset().filter(eliminado=False)


class Fecha(models.Model):
    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, related_name="fechas")
    # RF-008, G-07: horario propio con inicio y fin.
    inicio = models.DateTimeField()
    fin = models.DateTimeField()
    # RF-019: acciones manuales del creador.
    cancelada = models.BooleanField(default=False)
    finalizada_en = models.DateTimeField(null=True, blank=True)
    # RF-032: ocultamiento por moderación, con su motivo (G-21).
    oculta = models.BooleanField(default=False)
    norma_ocultamiento = models.PositiveSmallIntegerField(choices=Norma.choices, null=True, blank=True)
    explicacion_ocultamiento = models.TextField(blank=True)
    # RF-017, G-24: borrado lógico (ver Evento.eliminado).
    eliminado = models.BooleanField(default=False)
    objects = FechaManager()
    con_eliminadas = FechaQuerySet.as_manager()

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
