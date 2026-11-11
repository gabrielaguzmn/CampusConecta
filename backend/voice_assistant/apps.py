import os
import sys

from django.apps import AppConfig
from django.conf import settings


class VoiceAssistantConfig(AppConfig):
    name = "voice_assistant"

    def ready(self):
        # Evita cargar durante migraciones, tests y el proceso padre del autoreloader.
        server_process = any(command in sys.argv for command in ("runserver", "gunicorn", "uwsgi"))
        if settings.VOICE_SEMANTIC["WARMUP"] and server_process and os.environ.get("RUN_MAIN", "true") != "false":
            from .semantic.engine import get_engine
            try:
                get_engine()
            except Exception:
                # El endpoint informará 503; un modelo opcional no debe tumbar el servidor.
                pass
