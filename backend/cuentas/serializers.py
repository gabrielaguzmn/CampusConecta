from django.contrib.auth import password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from cuentas.models import Usuario


def validar_password(password, usuario):
    # G-35: validadores estándar de Django, devueltos como error del campo `password`.
    try:
        password_validation.validate_password(password, usuario)
    except DjangoValidationError as error:
        raise serializers.ValidationError({"password": list(error.messages)})


class RegistroSerializer(serializers.ModelSerializer):
    # RF-001: correo de cualquier dominio y contraseña; sin confirmación por enlace.
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Usuario
        fields = ["id", "nombre", "email", "password"]

    def validate_email(self, email):
        email = Usuario.objects.normalize_email(email)
        if Usuario.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.", code="email_en_uso")
        return email

    def validate(self, datos):
        validar_password(datos["password"], Usuario(email=datos["email"]))
        return datos

    def create(self, datos):
        return Usuario.objects.create_user(datos["email"], datos["password"], nombre=datos["nombre"])


class TokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except AuthenticationFailed:
            # RF-033: una cuenta suspendida no inicia sesión. Solo se informa si la contraseña es correcta.
            usuario = Usuario.objects.filter(email__iexact=attrs.get("email", "")).first()
            if usuario and not usuario.is_active and usuario.check_password(attrs.get("password", "")):
                raise AuthenticationFailed("La cuenta está suspendida.", code="cuenta_suspendida")
            raise


class UsuarioActualSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ["id", "nombre", "email", "es_administrador"]


class SolicitudRecuperacionSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ConfirmacionRecuperacionSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, datos):
        try:
            usuario = Usuario.objects.get(pk=force_str(urlsafe_base64_decode(datos["uid"])))
        except (ValueError, Usuario.DoesNotExist):
            usuario = None
        # G-17: el token vale PASSWORD_RESET_TIMEOUT (1 hora) y deja de valer al cambiar la contraseña.
        if usuario is None or not default_token_generator.check_token(usuario, datos["token"]):
            raise serializers.ValidationError("El enlace no es válido o ha caducado.", code="enlace_invalido")
        validar_password(datos["password"], usuario)
        datos["usuario"] = usuario
        return datos
