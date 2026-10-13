from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


def enviar_recuperacion(usuario):
    """ACCESS-1 · criterio 3, RNF-007: envía por correo el enlace de recuperación (G-17)."""
    uid = urlsafe_base64_encode(force_bytes(usuario.pk))
    token = default_token_generator.make_token(usuario)
    enlace = f"{settings.FRONTEND_URL_RECUPERACION}?uid={uid}&token={token}"
    # G-16 (recuperación): texto genérico aprobado el 2026-10-07.
    mensaje = (
        "Hola:\n\n"
        "Recibimos una solicitud para restablecer la contraseña de tu cuenta de CampusConecta.\n"
        "Accede a este enlace para crear una nueva contraseña:\n\n"
        f"{enlace}\n\n"
        "El enlace vale 1 hora y solo puede usarse una vez. Si no solicitaste el cambio, ignora este correo."
    )
    send_mail(
        subject="Recupera tu contraseña de CampusConecta",
        message=mensaje,
        from_email=None,
        recipient_list=[usuario.email],
    )
