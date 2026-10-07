from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models


class UsuarioManager(BaseUserManager):
    def create_user(self, email, password, **campos):
        usuario = self.model(email=self.normalize_email(email), **campos)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario


class Usuario(AbstractBaseUser):
    # RF-001: registro e inicio de sesión con correo de cualquier dominio.
    email = models.EmailField(unique=True)
    # G-08 (decisión 2026-10-07): nombre obligatorio en el registro (Figma 4:28815).
    nombre = models.TextField()
    # RF-024, RF-028: rol administrador de la plataforma (T-2).
    es_administrador = models.BooleanField(default=False)
    # RF-033: is_active=False significa cuenta suspendida (T-3).
    is_active = models.BooleanField(default=True)
    # TODO(PENDIENTE G-08: casilla "Acepto las normas de uso" de Figma 4:28815)

    objects = UsuarioManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["nombre"]

    def __str__(self):
        return self.email
