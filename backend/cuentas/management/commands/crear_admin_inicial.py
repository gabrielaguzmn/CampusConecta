import os

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from cuentas.models import Usuario


class Command(BaseCommand):
    help = "Crea la cuenta administradora inicial con ADMIN_INICIAL_NOMBRE, ADMIN_INICIAL_EMAIL y ADMIN_INICIAL_PASSWORD (RF-029)."

    def handle(self, *args, **options):
        nombre = os.environ.get("ADMIN_INICIAL_NOMBRE", "").strip()
        email = os.environ.get("ADMIN_INICIAL_EMAIL", "").strip()
        password = os.environ.get("ADMIN_INICIAL_PASSWORD", "")
        if not nombre or not email or not password:
            raise CommandError(
                "Faltan las variables de entorno ADMIN_INICIAL_NOMBRE, ADMIN_INICIAL_EMAIL o ADMIN_INICIAL_PASSWORD."
            )

        if Usuario.objects.filter(email__iexact=email).exists():
            self.stdout.write(f"La cuenta {email} ya existe; no se modifica.")
            return

        try:
            password_validation.validate_password(password, Usuario(email=email))
        except ValidationError as error:
            raise CommandError("La contraseña no cumple la política: " + " ".join(error.messages))

        Usuario.objects.create_user(email, password, nombre=nombre, es_administrador=True)
        self.stdout.write(self.style.SUCCESS(f"Cuenta administradora inicial creada: {email}"))
