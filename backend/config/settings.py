"""Configuración de CampusConecta. Todo lo que cambia entre entornos sale de variables de entorno (ver .env.example)."""

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

def lista_env(nombre):
    return [v.strip() for v in os.environ.get(nombre, "").split(",") if v.strip()]


SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = os.environ.get("DJANGO_DEBUG") == "1"
ALLOWED_HOSTS = lista_env("DJANGO_ALLOWED_HOSTS")

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "cuentas",
    "eventos",
    "moderacion",
    "voice_assistant",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {},
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["DB_NAME"],
        "USER": os.environ.get("DB_USER", ""),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", ""),
        "PORT": os.environ.get("DB_PORT", ""),
    }
}
# Las bases en la nube
if os.environ.get("DB_SSLMODE"):
    DATABASES["default"]["OPTIONS"] = {"sslmode": os.environ["DB_SSLMODE"]}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# RF-001: el correo identifica la cuenta (T-1).
AUTH_USER_MODEL = "cuentas.Usuario"

# G-35: validadores estándar de Django.
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# G-17: el enlace de recuperación vale 1 hora.
PASSWORD_RESET_TIMEOUT = 60 * 60

# G-15: zona horaria America/Bogota.
LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True

# RF-010, G-42: imágenes en el sistema de archivos (volumen persistente en producción).
MEDIA_ROOT = os.environ.get("MEDIA_ROOT") or str(BASE_DIR / "media")
MEDIA_URL = "media/"

CORS_ALLOWED_ORIGINS = lista_env("CORS_ALLOWED_ORIGINS")

# G-17: página del frontend que recibe ?uid=...&token=... del enlace de recuperación.
FRONTEND_URL_RECUPERACION = os.environ.get("FRONTEND_URL_RECUPERACION", "")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    # RF-001: sin sesión no hay acceso a los eventos.
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "config.excepciones.manejador_excepciones",
}
VOICE_SEMANTIC = {
    "ENABLED": os.environ.get("VOICE_SEMANTIC_ENABLED", "1") == "1",
    "MODEL_PATH": os.environ.get("VOICE_SEMANTIC_MODEL_PATH", str(BASE_DIR / "semantic-model")),
    "ACCEPT_THRESHOLD": float(os.environ.get("VOICE_SEMANTIC_ACCEPT_THRESHOLD", "0.70")),
    "SUGGEST_THRESHOLD": float(os.environ.get("VOICE_SEMANTIC_SUGGEST_THRESHOLD", "0.55")),
    "MIN_MARGIN": float(os.environ.get("VOICE_SEMANTIC_MIN_MARGIN", "0.08")),
    "MAX_TEXT_LENGTH": int(os.environ.get("VOICE_SEMANTIC_MAX_TEXT_LENGTH", "200")),
    "WARMUP": os.environ.get("VOICE_SEMANTIC_WARMUP", "0") == "1",
    "LOG_PHRASES": os.environ.get("VOICE_SEMANTIC_LOG_PHRASES", "0") == "1",
    "THROTTLE_RATE": os.environ.get("VOICE_SEMANTIC_THROTTLE_RATE", "30/min"),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "CampusConecta API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "EstadoFechaEnum": "eventos.models.ESTADOS",
        "EstadoCasoEnum": "moderacion.models.CasoReporte.ESTADOS",
        "NormaEnum": "moderacion.normas.Norma",
    },
}

# T-9: correo por consola en desarrollo; SMTP configurable por entorno para probar entregas reales.
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "")
MAILER_BACKEND = os.environ.get(
    "EMAIL_BACKEND"
) or (
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend"
)
MAILERS = {
    "default": {
        "BACKEND": MAILER_BACKEND,
        "OPTIONS": {
            "host": os.environ.get("EMAIL_HOST", ""),
            "port": int(os.environ.get("EMAIL_PORT") or 0) or None,
            "username": os.environ.get("EMAIL_HOST_USER", ""),
            "password": os.environ.get("EMAIL_HOST_PASSWORD", ""),
            "use_tls": os.environ.get("EMAIL_USE_TLS") == "1",
        },
    }
}
