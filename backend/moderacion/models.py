from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db import models

from moderacion.normas import Norma


class CasoReporte(models.Model):
    """RF-026, RF-031: todos los reportes de un mismo evento forman un único caso."""

    PENDIENTE = "pendiente"
    EN_REVISION = "en_revision"
    REVISADO = "revisado"
    ESTADOS = [(PENDIENTE, "Pendiente por revisión"), (EN_REVISION, "En revisión"), (REVISADO, "Revisado")]

    # TODO(PENDIENTE G-25: si un reporte posterior a "revisado" reabre el caso o abre uno nuevo; hoy se suma al mismo)
    evento = models.OneToOneField("eventos.Evento", on_delete=models.CASCADE, related_name="caso_reporte")
    estado = models.CharField(max_length=20, choices=ESTADOS, default=PENDIENTE)
    # RF-031: en "revisado" el administrador decide si el evento se oculta o no.
    decision_ocultar = models.BooleanField(null=True, blank=True)

    class Meta:
        ordering = ["pk"]


class Reporte(models.Model):
    """RF-007: usuario, evento, causa (G-20: una norma de uso) y detalles opcionales."""

    # TODO(PENDIENTE G-26: reportar un evento propio o el mismo evento varias veces; hoy se permite)
    caso = models.ForeignKey(CasoReporte, on_delete=models.CASCADE, related_name="reportes")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reportes")
    evento = models.ForeignKey("eventos.Evento", on_delete=models.CASCADE, related_name="reportes")
    causa = models.PositiveSmallIntegerField(choices=Norma.choices)
    detalles = models.TextField(blank=True)

    class Meta:
        ordering = ["pk"]


class RegistroQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise PermissionDenied("El registro de moderación no se puede editar.")

    def delete(self):
        raise PermissionDenied("El registro de moderación no se puede eliminar.")


class RegistroModeracion(models.Model):
    """RF-034, RNF-006: registro completo de solo lectura de las acciones de moderación."""

    OCULTAR = "ocultar"
    RESTAURAR = "restaurar"
    SUSPENDER = "suspender"
    REACTIVAR = "reactivar"
    # TODO(PENDIENTE G-24: "eliminar" se añadirá cuando se defina el borrado por moderación)
    # TODO(PENDIENTE G-34: si también se registran cambios de categorías y de rol administrador)
    ACCIONES = [(OCULTAR, "Ocultar"), (RESTAURAR, "Restaurar"), (SUSPENDER, "Suspender"), (REACTIVAR, "Reactivar")]

    fecha_hora = models.DateTimeField(auto_now_add=True)
    administrador = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    tipo_accion = models.CharField(max_length=20, choices=ACCIONES)
    evento = models.ForeignKey("eventos.Evento", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    fecha = models.ForeignKey("eventos.Fecha", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    cuenta_afectada = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    # RF-034: motivo (norma incumplida); G-21: más un texto opcional. Restaurar y reactivar no llevan norma.
    norma = models.PositiveSmallIntegerField(choices=Norma.choices, null=True, blank=True)
    explicacion = models.TextField(blank=True)
    reportes = models.ManyToManyField("moderacion.Reporte", blank=True, related_name="+")
    estado_anterior = models.CharField(max_length=50)
    estado_posterior = models.CharField(max_length=50)

    objects = RegistroQuerySet.as_manager()

    class Meta:
        ordering = ["-fecha_hora", "-pk"]

    def save(self, *args, **kwargs):
        # ADMIN-4 · criterio 4: los registros no se editan.
        if self.pk is not None:
            raise PermissionDenied("El registro de moderación no se puede editar.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionDenied("El registro de moderación no se puede eliminar.")
