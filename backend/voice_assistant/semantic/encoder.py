import os


class SentenceTransformerEncoder:
    """Adaptador perezoso; no importa PyTorch hasta que se use el endpoint."""

    def __init__(self, model_path):
        self.model_path = str(model_path)
        self._model = None

    def encode(self, texts):
        if self._model is None:
            os.environ.setdefault("HF_HUB_OFFLINE", "1")
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_path, local_files_only=True)
        return self._model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
