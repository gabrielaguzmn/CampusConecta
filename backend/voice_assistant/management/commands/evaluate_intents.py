import json
import statistics
import time
from pathlib import Path

from django.core.management.base import BaseCommand
from django.conf import settings

from voice_assistant.semantic.engine import SemanticEngine
from voice_assistant.semantic.encoder import SentenceTransformerEncoder


class Command(BaseCommand):
    help = "Evalúa el clasificador local y escribe voice_assistant/eval/report.md."

    def handle(self, *args, **options):
        start = time.perf_counter()
        root = Path(__file__).resolve().parents[2]
        data = json.loads((root / "eval" / "intent_dataset.json").read_text(encoding="utf-8"))
        engine = SemanticEngine(SentenceTransformerEncoder(settings.VOICE_SEMANTIC["MODEL_PATH"]))
        load_ms = (time.perf_counter() - start) * 1000
        rows, latencies = [], []
        for item in data:
            result = engine.match(item["text"])
            rows.append((item["expected_intent"], result["intent"] or "NONE")); latencies.append(result["latency_ms"])
        domain = [(expected, actual) for expected, actual in rows if expected != "OUT_OF_DOMAIN"]
        accuracy = sum(a == e for e, a in domain) / len(domain) * 100
        ood = [(e, a) for e, a in rows if e == "OUT_OF_DOMAIN"]
        fp = sum(a != "NONE" for _, a in ood) / len(ood) * 100
        report = f"# Evaluación semántica\\n\\n- Casos: {len(rows)}\\n- Carga: {load_ms:.1f} ms\\n- Exactitud en dominio: {accuracy:.2f}%\\n- Falsos positivos fuera de dominio: {fp:.2f}%\\n- Latencia p50/p95: {statistics.median(latencies):.2f}/{sorted(latencies)[int(len(latencies)*.95)-1]:.2f} ms\\n\\nEjecutar este comando realiza además la carga real del modelo; ajuste los umbrales con `VOICE_SEMANTIC_*` y repita la evaluación.\\n"
        (root / "eval" / "report.md").write_text(report, encoding="utf-8")
        self.stdout.write(report)
