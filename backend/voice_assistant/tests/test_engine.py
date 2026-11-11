import unittest


@unittest.skipUnless(__import__("importlib").util.find_spec("numpy"), "numpy no instalado")
class SemanticEngineTests(unittest.TestCase):
    def test_normalizes_text(self):
        from voice_assistant.semantic.engine import normalize
        self.assertEqual(normalize("  Hola   MUNDO "), "hola mundo")
