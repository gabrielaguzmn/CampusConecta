from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Descarga una vez el modelo semántico en la ruta local configurada."

    def handle(self, *args, **options):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise CommandError("Instala sentence-transformers antes de descargar el modelo.") from exc
        path = Path(settings.VOICE_SEMANTIC["MODEL_PATH"])
        if (path / "config_sentence_transformers.json").exists():
            self.stdout.write(self.style.SUCCESS(f"El modelo ya existe en {path}"))
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2").save(str(path))
        self.stdout.write(self.style.SUCCESS(f"Modelo guardado en {path}"))
