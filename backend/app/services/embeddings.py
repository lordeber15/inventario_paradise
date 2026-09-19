from functools import lru_cache

from PIL import Image
from sentence_transformers import SentenceTransformer

from app.config import get_settings

EMBEDDING_DIM = 512


@lru_cache
def _get_model() -> SentenceTransformer:
    """Loaded once per process and cached: weights are ~350MB and slow to
    load, so every call after the first reuses this instance."""
    return SentenceTransformer(get_settings().clip_model_name)


def get_embedding(image: Image.Image) -> list[float]:
    model = _get_model()
    vector = model.encode(image, convert_to_numpy=True, normalize_embeddings=True)
    return vector.tolist()
