"""
Lumem Feed Embeddings
---------------------
Computa vetores semânticos dos posts para matching de conteúdo.
O modelo é carregado LAZY (na primeira chamada) para não atrasar o boot do Django.

Modelo: paraphrase-multilingual-MiniLM-L12-v2
  - Suporta português nativamente
  - Vetores de 384 dimensões
  - ~120MB (leve comparado a modelos maiores)
"""

import io
import logging

import numpy as np

logger = logging.getLogger(__name__)

_model = None  # Lazy loading — carregado apenas quando necessário


def _get_model():
    """Carrega o modelo na primeira chamada e reutiliza nas próximas."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        logger.info("Modelo de embeddings carregado com sucesso.")
    return _model


def compute_embedding(text: str) -> bytes:
    """
    Computa embedding de um texto e retorna como bytes serializados.
    O vetor é normalizado (unit length) para que cosine_similarity = dot product.
    """
    model = _get_model()
    vector = model.encode(text, normalize_embeddings=True)
    buf = io.BytesIO()
    np.save(buf, vector.astype(np.float32))
    return buf.getvalue()


def load_embedding(raw_bytes: bytes) -> np.ndarray:
    """Deserializa bytes (do BinaryField) de volta para numpy array."""
    buf = io.BytesIO(raw_bytes)
    return np.load(buf)


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Similaridade de cosseno entre dois vetores.
    Se ambos estão normalizados, é equivalente ao dot product.
    """
    return float(np.dot(vec_a, vec_b))


def compute_user_interest_vector(user) -> bytes | None:
    """
    Calcula o vetor de interesse do usuário como a média ponderada
    dos embeddings dos posts que ele curtiu/salvou nos últimos 30 dias.

    Retorna None se o usuário não tem engajamento recente ou
    se nenhum dos posts engajados tem embedding computado.
    """
    from datetime import timedelta
    from django.utils import timezone
    from .models import ReacaoPublicacao, PublicacaoSalva, PostEmbedding

    trinta_dias = timezone.now() - timedelta(days=30)

    # Fix #6: IDs ordenados por data antes do slice
    liked_ids = list(
        ReacaoPublicacao.objects.filter(
            usuario=user, data_reacao__gte=trinta_dias
        ).order_by('-data_reacao')
        .values_list('publicacao_id', flat=True)[:200]
    )

    saved_ids = list(
        PublicacaoSalva.objects.filter(
            usuario=user, data_salvo__gte=trinta_dias
        ).order_by('-data_salvo')
        .values_list('publicacao_id', flat=True)[:100]
    )

    engaged_ids = set(liked_ids) | set(saved_ids)

    if not engaged_ids:
        return None

    embeddings_qs = PostEmbedding.objects.filter(
        publicacao_id__in=engaged_ids
    ).values_list('vetor', flat=True)

    vectors = [load_embedding(raw) for raw in embeddings_qs if raw]

    if not vectors:
        return None

    # Média + normalização para unit length
    mean_vector = np.mean(vectors, axis=0)
    norm = np.linalg.norm(mean_vector)
    if norm > 1e-8:
        mean_vector = mean_vector / norm

    buf = io.BytesIO()
    np.save(buf, mean_vector.astype(np.float32))
    return buf.getvalue()
