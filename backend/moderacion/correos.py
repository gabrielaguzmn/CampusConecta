from django.core.mail import send_mail
from django.utils import timezone

from moderacion.normas import Norma

# G-16 (decisión 2026-10-07): textos genéricos. RNF-007: ocultamiento y suspensión se notifican por correo.


def _motivo(norma, explicacion):
    texto = f"Norma incumplida: {norma}. {Norma(norma).label}."
    if explicacion:
        texto += f"\nExplicación del equipo de administración: {explicacion}"
    return texto


def enviar_ocultamiento(evento, fecha, norma, explicacion):
    """ADMIN-1 · criterio 4, RF-032: se informa al creador la norma incumplida."""
    if fecha is None:
        asunto = "Tu evento fue ocultado en CampusConecta"
        contenido = f'tu evento "{evento.nombre}"'
    else:
        inicio = timezone.localtime(fecha.inicio).strftime("%d/%m/%Y %H:%M")
        asunto = "Una fecha de tu evento fue ocultada en CampusConecta"
        contenido = f'la fecha del {inicio} de tu evento "{evento.nombre}"'
    mensaje = (
        f"Hola, {evento.creador.nombre}:\n\n"
        f"El equipo de administración de CampusConecta ocultó {contenido} porque incumple las normas de uso "
        "de la plataforma. Mientras esté oculto no se mostrará en el mapa ni en el feed.\n\n"
        f"{_motivo(norma, explicacion)}\n\n"
        'Puedes consultar la marca y el motivo en "Mis eventos".'
    )
    send_mail(asunto, mensaje, None, [evento.creador.email])


def enviar_suspension(usuario, norma, explicacion):
    """ADMIN-3 · criterio 4, RF-033: se informa al afectado la norma incumplida."""
    mensaje = (
        f"Hola, {usuario.nombre}:\n\n"
        "El equipo de administración de CampusConecta suspendió tu cuenta porque incumple las normas de uso "
        "de la plataforma. Mientras dure la suspensión no podrás iniciar sesión ni publicar eventos, "
        "y tus eventos no se mostrarán.\n\n"
        f"{_motivo(norma, explicacion)}"
    )
    send_mail("Tu cuenta de CampusConecta fue suspendida", mensaje, None, [usuario.email])
