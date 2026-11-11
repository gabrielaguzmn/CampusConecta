import json
import threading
import time
from pathlib import Path
from typing import Protocol

from django.conf import settings

from .encoder import SentenceTransformerEncoder

INTENTS = ("OPEN_MAP", "OPEN_FEED", "OPEN_MY_EVENTS", "CREATE_EVENT")


class Encoder(Protocol):
    def encode(self, texts): ...


def normalize(text):
    return " ".join(text.lower().split())


class SemanticEngine:
    def __init__(self, encoder: Encoder, examples=None, config=None):
        # numpy es una dependencia de ejecución del motor, no del arranque de Django.
        import numpy as np
        self.np = np
        self.encoder = encoder
        self.config = config or settings.VOICE_SEMANTIC
        if examples is None:
            path = Path(__file__).parent.parent / "data" / "semantic_examples.json"
            examples = json.loads(path.read_text(encoding="utf-8"))
        self.examples = examples
        self.version = examples["version"]
        self._labels, phrases = [], []
        for intent, values in examples["intents"].items():
            self._labels.extend([intent] * len(values)); phrases.extend(values)
        anchors = examples["out_of_domain"]
        self._labels.extend(["OUT_OF_DOMAIN"] * len(anchors)); phrases.extend(anchors)
        self._embeddings = np.asarray(self.encoder.encode([normalize(p) for p in phrases]))

    def match(self, text, candidate_intents=None):
        started = time.perf_counter()
        allowed = set(candidate_intents or INTENTS)
        allowed.add("OUT_OF_DOMAIN")
        vector = self.np.asarray(self.encoder.encode([normalize(text)]))[0]
        scores = {}
        for label, score in zip(self._labels, self._embeddings @ vector):
            if label in allowed:
                scores[label] = max(scores.get(label, -1.0), float(score))
        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        intent, score = ranked[0]
        second = ranked[1][1] if len(ranked) > 1 else -1.0
        margin = score - second
        accept = self.config["ACCEPT_THRESHOLD"]
        suggest = self.config["SUGGEST_THRESHOLD"]
        if intent != "OUT_OF_DOMAIN" and score >= accept and margin >= self.config["MIN_MARGIN"]:
            decision = "accept"
        elif intent != "OUT_OF_DOMAIN" and score >= suggest:
            decision = "suggest"
        else:
            decision = "none"
        return {"decision": decision, "intent": intent if decision != "none" else None,
                "score": round(score, 4), "margin": round(margin, 4),
                "candidates": [{"intent": key, "score": round(value, 4)} for key, value in ranked if key != "OUT_OF_DOMAIN"],
                "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                "examples_version": self.version, "latency_ms": round((time.perf_counter() - started) * 1000, 2)}


_engine = None
_lock = threading.Lock()


def get_engine():
    global _engine
    if _engine is None:
        with _lock:
            if _engine is None:
                _engine = SemanticEngine(SentenceTransformerEncoder(settings.VOICE_SEMANTIC["MODEL_PATH"]))
    return _engine


def reset_engine_for_tests():
    global _engine
    _engine = None
