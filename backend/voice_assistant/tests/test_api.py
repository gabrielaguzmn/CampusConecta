from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APITestCase

from cuentas.models import Usuario


class FakeEngine:
    def match(self, text, candidate_intents=None):
        return {"decision": "accept", "intent": "OPEN_FEED", "score": .91, "margin": .2,
                "candidates": [{"intent": "OPEN_FEED", "score": .91}],
                "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                "examples_version": "test", "latency_ms": .1}


class SemanticApiTests(APITestCase):
    def setUp(self):
        self.user = Usuario.objects.create_user("voz@example.com", "clave-segura-123")
        self.payload = {"text": "qué hay en la universidad", "page": "FEED"}

    def test_requires_authentication(self):
        self.assertEqual(self.client.post("/api/voice/semantic-match/", self.payload, format="json").status_code, 401)

    @patch("voice_assistant.views.get_engine", return_value=FakeEngine())
    def test_returns_contract(self, _):
        self.client.force_authenticate(self.user)
        response = self.client.post("/api/voice/semantic-match/", self.payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), {"decision", "intent", "score", "margin", "candidates", "model", "examples_version", "latency_ms"})

    def test_rejects_invalid_input(self):
        self.client.force_authenticate(self.user)
        response = self.client.post("/api/voice/semantic-match/", {"text": 4, "page": "NO"}, format="json")
        self.assertEqual(response.status_code, 400)

    @override_settings(VOICE_SEMANTIC={"ENABLED": False, "THROTTLE_RATE": "30/min"})
    def test_disabled_returns_503(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post("/api/voice/semantic-match/", self.payload, format="json").status_code, 503)
