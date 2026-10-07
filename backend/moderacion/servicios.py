"""Acciones de moderación (ADMIN-1, ADMIN-2, ADMIN-3). Cada una cambia el estado, escribe el registro (RF-034) y,
cuando corresponde, envía el correo (RNF-007) una vez confirmada la transacción."""

from django.db import transaction

from moderacion import correos
from moderacion.models import RegistroModeracion as Registro

VISIBLE, OCULTO = "visible", "oculto"
ACTIVA, SUSPENDIDA = "activa", "suspendida"


def _registrar(administrador, accion, anterior, posterior, reportes=(), **campos):
    registro = Registro.objects.create(
        administrador=administrador, tipo_accion=accion, estado_anterior=anterior, estado_posterior=posterior, **campos
    )
    registro.reportes.set(reportes)
    return registro


@transaction.atomic
def ocultar(administrador, evento, norma, explicacion="", fecha=None, reportes=()):
    """RF-032: ocultar un evento completo o una de sus fechas."""
    objeto = fecha or evento
    if fecha is None:
        evento.oculto = True
    else:
        fecha.oculta = True
    objeto.norma_ocultamiento = norma
    objeto.explicacion_ocultamiento = explicacion
    objeto.save()
    _registrar(administrador, Registro.OCULTAR, VISIBLE, OCULTO, reportes, evento=evento, fecha=fecha,
               cuenta_afectada=evento.creador, norma=norma, explicacion=explicacion)
    transaction.on_commit(lambda: correos.enviar_ocultamiento(evento, fecha, norma, explicacion))


@transaction.atomic
def restaurar(administrador, evento, fecha=None):
    """RF-032: el administrador restaura lo ocultado."""
    # TODO(PENDIENTE G-04: condiciones de restauración; hoy basta con que el contenido esté oculto y no finalizado)
    # TODO(PENDIENTE G-22: si se notifica por correo al restaurar)
    objeto = fecha or evento
    if fecha is None:
        evento.oculto = False
    else:
        fecha.oculta = False
    objeto.norma_ocultamiento = None
    objeto.explicacion_ocultamiento = ""
    objeto.save()
    _registrar(administrador, Registro.RESTAURAR, OCULTO, VISIBLE, evento=evento, fecha=fecha,
               cuenta_afectada=evento.creador)


@transaction.atomic
def suspender(administrador, usuario, norma, explicacion=""):
    """RF-033: la cuenta no inicia sesión ni publica, y sus fechas vigentes dejan de mostrarse (T-3, T-4)."""
    # TODO(PENDIENTE G-27: duración de la suspensión; hoy dura hasta que un administrador la reactiva)
    usuario.is_active = False
    usuario.save(update_fields=["is_active"])
    _registrar(administrador, Registro.SUSPENDER, ACTIVA, SUSPENDIDA, cuenta_afectada=usuario,
               norma=norma, explicacion=explicacion)
    transaction.on_commit(lambda: correos.enviar_suspension(usuario, norma, explicacion))


@transaction.atomic
def reactivar(administrador, usuario):
    """RF-033: al reactivar, la cuenta vuelve a iniciar sesión y sus fechas se restablecen (G-06: lo ocultado
    individualmente sigue oculto)."""
    # TODO(PENDIENTE G-22: si se notifica por correo al reactivar)
    usuario.is_active = True
    usuario.save(update_fields=["is_active"])
    _registrar(administrador, Registro.REACTIVAR, SUSPENDIDA, ACTIVA, cuenta_afectada=usuario)
