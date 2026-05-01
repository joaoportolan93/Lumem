"""
Lumem Feed Algorithm v2
-----------------------
Pipeline de recomendação personalizada para o feed "Para Você".

Fluxo:
  1. Buscar contexto do usuário (com cache Redis, TTL 10min)
  2. Buscar pool de candidatos (~300 posts recentes, janela dinâmica)
  3. Calcular score de cada candidato:
     - Engagement (likes, saves, comments, views)
     - Afinidade (seguindo, comunidade, hashtag, tipo de sonho)
     - Similaridade ML (embedding semântico)
     - Recência (decay exponencial)
  4. Ordenar por score DESC
  5. Retornar IDs ordenados (o ViewSet re-busca com anotações do serializer)
  6. Registrar posts entregues como vistos (PostVisto)

Design decisions:
  - Retorna IDs (não instâncias) para permitir re-busca via get_queryset() anotado
  - Cache Redis separado (DB 1) para não interferir com Channels/Celery
  - Janela dinâmica: se poucos candidatos, expande de 7 → 14 → 30 dias
  - Cold-start: usuários sem histórico recebem fallback por popularidade (janela 30 dias)
"""

import math
import logging
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from django.core.cache import cache

from .models import (
    Publicacao, Seguidor, MembroComunidade, Bloqueio, Silenciamento,
    ReacaoPublicacao, PublicacaoSalva, PublicacaoHashtag, PostVisto,
    PostEmbedding,
)

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# PESOS DO ALGORITMO
# ══════════════════════════════════════════════════════════════════════════════

# Engajamento
PESO_SAVE = 5.0
PESO_COMMENT = 3.0
PESO_LIKE = 2.0
PESO_VIEW = 0.1

# Afinidade
BONUS_SEGUINDO = 3.0
BONUS_COMUNIDADE = 2.0
BONUS_HASHTAG = 1.5
BONUS_TIPO_SONHO = 2.0
BONUS_EMBEDDING = 3.0  # Similaridade semântica via ML

# Recência
RECENCIA_JANELA_HORAS = 72
RECENCIA_MULTIPLICADOR_MIN = 0.3

# Pool
POOL_SIZE = 300
POOL_MIN_SIZE = 10  # mínimo aceitável antes de expandir janela

# Cache
CACHE_TTL_CONTEXT = 600   # 10 minutos
CACHE_TTL_FEED = 300       # 5 minutos

# Combinação final (score_qualidade × PESO_QUALIDADE + score_relevancia × PESO_RELEVANCIA)
PESO_QUALIDADE = 0.45    # engajamento normalizado (log)
PESO_RELEVANCIA = 0.55   # afinidade pessoal (preferências, seguidores, comunidades)


# ══════════════════════════════════════════════════════════════════════════════
# RECÊNCIA
# ══════════════════════════════════════════════════════════════════════════════

def _recencia_score(data_publicacao):
    """
    Retorna multiplicador de recência entre RECENCIA_MULTIPLICADOR_MIN e 1.0.
    Posts dentro de RECENCIA_JANELA_HORAS recebem ~1.0.
    Posts mais antigos decaem exponencialmente até RECENCIA_MULTIPLICADOR_MIN.
    """
    agora = timezone.now()
    horas = (agora - data_publicacao).total_seconds() / 3600.0

    if horas <= 0:
        return 1.0

    # Decay exponencial suave
    decay = math.exp(-0.03 * horas)
    return max(RECENCIA_MULTIPLICADOR_MIN, decay)


# ══════════════════════════════════════════════════════════════════════════════
# CONTEXTO DO USUÁRIO (com cache Redis)
# ══════════════════════════════════════════════════════════════════════════════

def _get_user_context(user):
    """
    Coleta todos os dados de afinidade do usuário necessários para scoring.
    Resultado é cacheado no Redis por CACHE_TTL_CONTEXT (10 minutos).
    """
    cache_key = f'feed_ctx:{user.id_usuario}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    trinta_dias = timezone.now() - timedelta(days=30)
    sete_dias = timezone.now() - timedelta(days=7)

    # IDs de quem o usuário segue
    following_ids = set(
        Seguidor.objects.filter(
            usuario_seguidor=user, status=1
        ).values_list('usuario_seguido_id', flat=True)
    )

    # IDs de comunidades que o usuário participa
    community_ids = set(
        MembroComunidade.objects.filter(
            usuario=user
        ).values_list('comunidade_id', flat=True)
    )

    # IDs de usuários bloqueados
    blocked_ids = set(
        Bloqueio.objects.filter(
            usuario=user
        ).values_list('usuario_bloqueado_id', flat=True)
    )

    # IDs de usuários silenciados
    muted_ids = set(
        Silenciamento.objects.filter(
            usuario=user
        ).values_list('usuario_silenciado_id', flat=True)
    )

    # Fix #6: Hashtags dos posts que o usuário engajou (com ordem antes do slice)
    liked_post_ids = list(
        ReacaoPublicacao.objects.filter(
            usuario=user, data_reacao__gte=trinta_dias
        ).order_by('-data_reacao')
        .values_list('publicacao_id', flat=True)[:200]
    )

    saved_post_ids = list(
        PublicacaoSalva.objects.filter(
            usuario=user, data_salvo__gte=trinta_dias
        ).order_by('-data_salvo')
        .values_list('publicacao_id', flat=True)[:100]
    )

    engaged_ids = set(liked_post_ids) | set(saved_post_ids)

    # Hashtags dos posts engajados
    hashtag_ids = set(
        PublicacaoHashtag.objects.filter(
            publicacao_id__in=engaged_ids
        ).values_list('hashtag_id', flat=True)
    ) if engaged_ids else set()

    # Tipos de sonho preferidos (dos posts engajados)
    tipos_preferidos = set(
        Publicacao.objects.filter(
            id_publicacao__in=engaged_ids, tipo_sonho__isnull=False
        ).exclude(tipo_sonho='')
        .values_list('tipo_sonho', flat=True)
    ) if engaged_ids else set()

    # Adicionar interesses do onboarding (ConfiguracaoUsuario.interesses)
    try:
        config = user.configuracaousuario
        if config.interesses:
            tipos_preferidos |= set(config.interesses)
    except Exception as exc:
        logger.warning('Erro ao carregar interesses do onboarding para user %s: %s', user.id_usuario, exc)

    # Fix #4: Posts já vistos (apenas últimos 7 dias — janela de candidatos)
    seen_post_ids = set(
        PostVisto.objects.filter(
            usuario=user, data_visto__gte=sete_dias
        ).values_list('publicacao_id', flat=True)
    )

    context = {
        'following_ids': following_ids,
        'community_ids': community_ids,
        'blocked_ids': blocked_ids,
        'muted_ids': muted_ids,
        'hashtag_ids': hashtag_ids,
        'tipos_preferidos': tipos_preferidos,
        'seen_post_ids': seen_post_ids,
        'engaged_ids': engaged_ids,
        'is_cold_start': len(engaged_ids) < 5,  # Fix #7: cold-start detection
    }

    # Cache no Redis (sets são serializáveis como listas pelo pickle padrão do django-redis)
    cache.set(cache_key, context, CACHE_TTL_CONTEXT)
    return context


# ══════════════════════════════════════════════════════════════════════════════
# POOL DE CANDIDATOS
# ══════════════════════════════════════════════════════════════════════════════

def _get_candidates(user, context, pool_size=POOL_SIZE):
    """
    Busca o pool de posts candidatos para o algoritmo.
    Fix #2: ORDER BY -data_publicacao antes do LIMIT.
    Fix #8: Janela dinâmica — se poucos candidatos, expande (7→14→30→90→365→sem filtro).
    """
    exclude_ids = context['blocked_ids'] | context['muted_ids']

    base_filters = dict(usuario__status=1, visibilidade=1)
    base_excludes = [
        dict(usuario=user),
        dict(usuario__in=exclude_ids),
        dict(id_publicacao__in=context['seen_post_ids']),
        dict(is_efemero=True),
    ]

    def _query(extra_filter=None):
        qs = Publicacao.objects.filter(**base_filters)
        if extra_filter:
            qs = qs.filter(**extra_filter)
        for exc in base_excludes:
            qs = qs.exclude(**exc)
        return (
            qs.annotate(
                total_likes=Count('reacaopublicacao', distinct=True),
                total_comments=Count('comentario', filter=Q(comentario__status=1), distinct=True),
                total_saves=Count('publicacaosalva', distinct=True),
            )
            .select_related('usuario', 'comunidade')
            .order_by('-data_publicacao')
            [:pool_size]
        )

    # Janela dinâmica: 7 → 14 → 30 → 90 → 365 dias
    for dias in [7, 14, 30, 90, 365]:
        janela = timezone.now() - timedelta(days=dias)
        candidatos = _query(extra_filter=dict(data_publicacao__gte=janela))
        if len(candidatos) >= POOL_MIN_SIZE:
            return candidatos

    # Fallback absoluto: sem filtro de data (plataforma nova com poucos posts)
    if len(candidatos) < POOL_MIN_SIZE:
        candidatos = _query()
    return candidatos


# ══════════════════════════════════════════════════════════════════════════════
# SCORE DE CADA POST
# ══════════════════════════════════════════════════════════════════════════════

def _score_post(post, context, user_embedding=None, post_hashtags_map=None):
    """
    Calcula score final de um post para o feed do usuário.
    Fórmula:
      score = (score_qualidade × PESO_QUALIDADE + score_relevancia × PESO_RELEVANCIA) × recência

    score_qualidade usa log1p() para normalizar engajamento e evitar que posts
    virais dominem o feed de todos os usuários (popularity bias).

    Args:
        post_hashtags_map: dict {post_id: set(hashtag_ids)} pré-computado
                           para evitar N+1 queries.
    """
    # ── 1. Score de qualidade (engajamento com teto logarítmico) ──
    # log1p impede que posts virais dominem o feed de todos os usuários.
    # Ex: 100 likes (raw=200) → log1p(200) ≈ 5.3, não 200.
    engajamento_bruto = (
        (getattr(post, 'total_likes', 0) * PESO_LIKE)
        + (getattr(post, 'total_comments', 0) * PESO_COMMENT)
        + (getattr(post, 'total_saves', 0) * PESO_SAVE)
        + (getattr(post, 'views_count', 0) * PESO_VIEW)
    )
    score_qualidade = math.log1p(engajamento_bruto)

    # ── 2. Score de relevância pessoal ──
    score_relevancia = 0.0

    # Segue o autor?
    if post.usuario_id in context['following_ids']:
        score_relevancia += BONUS_SEGUINDO

    # Post é de uma comunidade que o usuário participa?
    if post.comunidade_id and post.comunidade_id in context['community_ids']:
        score_relevancia += BONUS_COMUNIDADE

    # Tipo de sonho que o usuário costuma engajar?
    if post.tipo_sonho and post.tipo_sonho in context['tipos_preferidos']:
        score_relevancia += BONUS_TIPO_SONHO

    # Hashtags em comum com posts engajados? (usa mapa pré-computado)
    if context['hashtag_ids'] and post_hashtags_map:
        post_hashtags = post_hashtags_map.get(post.id_publicacao, set())
        if post_hashtags & context['hashtag_ids']:
            score_relevancia += BONUS_HASHTAG

    # ── 3. Similaridade ML (embedding) — contribui para relevância pessoal ──
    if user_embedding is not None:
        try:
            post_emb = PostEmbedding.objects.filter(
                publicacao=post
            ).values_list('vetor', flat=True).first()

            if post_emb:
                from .feed_embeddings import load_embedding, cosine_similarity
                post_vec = load_embedding(post_emb)
                sim = cosine_similarity(user_embedding, post_vec)
                # Similaridade vai de -1 a 1, convertemos para 0-1
                score_relevancia += max(0.0, sim) * BONUS_EMBEDDING
        except Exception as exc:  # noqa: BLE001
            # Feed não deve quebrar por erros de embedding, mas registramos para debug
            logger.warning('Erro ao calcular ML score para post %s: %s', post.id_publicacao, exc)

    # ── 4. Recência ──
    recencia = _recencia_score(post.data_publicacao)

    # ── Score final: qualidade normalizada + relevância pessoal ──
    score = (
        score_qualidade * PESO_QUALIDADE
        + score_relevancia * PESO_RELEVANCIA
    ) * recencia

    return score


# ══════════════════════════════════════════════════════════════════════════════
# FUNÇÃO PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════

def get_foryou_feed(user, page=1, page_size=15):
    """
    Gera o feed personalizado "Para Você".

    Retorna:
        (post_ids, has_more): tupla com lista de UUIDs ordenados por score
                              e boolean indicando se há mais páginas.

    O ViewSet deve re-buscar esses IDs pelo get_queryset() anotado
    para preservar annotated_is_liked, annotated_is_saved, etc.
    """
    # Checar cache do feed completo
    cache_key = f'feed_foryou:{user.id_usuario}:p{page}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    context = _get_user_context(user)
    candidatos = _get_candidates(user, context)

    if not candidatos:
        # Fix #7: fallback cold-start — posts mais populares das últimas 48h
        if context['is_cold_start']:
            fallback = (
                Publicacao.objects
                .filter(
                    usuario__status=1,
                    visibilidade=1,
                    data_publicacao__gte=timezone.now() - timedelta(days=30),
                )
                .exclude(usuario=user)
                .exclude(is_efemero=True)
                .annotate(
                    pop=Count('reacaopublicacao', distinct=True)
                        + Count('comentario', filter=Q(comentario__status=1), distinct=True)
                )
                .order_by('-pop', '-data_publicacao')
                [:page_size]
            )
            ids = [p.id_publicacao for p in fallback]
            result = (ids, False)
            cache.set(cache_key, result, CACHE_TTL_FEED)
            return result

        return ([], False)

    # Carregar vetor de interesse do usuário (pré-computado pelo Celery)
    user_embedding = None
    raw_vec = cache.get(f'user_interest_vec:{user.id_usuario}')
    if raw_vec:
        from .feed_embeddings import load_embedding
        user_embedding = load_embedding(raw_vec)

    # Pré-carregar hashtags de todos os candidatos (evita N+1 queries)
    candidate_ids = [p.id_publicacao for p in candidatos]
    post_hashtags_map = {}
    if context['hashtag_ids']:
        from collections import defaultdict
        post_hashtags_map = defaultdict(set)
        qs_tags = PublicacaoHashtag.objects.filter(
            publicacao_id__in=candidate_ids
        ).values_list('publicacao_id', 'hashtag_id')
        for pid, hid in qs_tags:
            post_hashtags_map[pid].add(hid)

    # Calcular score de cada candidato
    scored = []
    for post in candidatos:
        score = _score_post(post, context, user_embedding, post_hashtags_map)
        scored.append((post.id_publicacao, score))

    # Ordenar por score decrescente
    scored.sort(key=lambda x: x[1], reverse=True)

    # Paginação manual
    start = (page - 1) * page_size
    end = start + page_size
    page_ids = [pid for pid, _ in scored[start:end]]
    has_more = end < len(scored)

    # Registrar posts desta página como vistos
    if page_ids:
        from django.utils import timezone as tz
        vistos = [
            PostVisto(usuario=user, publicacao_id=pid, data_visto=tz.now())
            for pid in page_ids
        ]
        PostVisto.objects.bulk_create(vistos, ignore_conflicts=True)

    result = (page_ids, has_more)
    cache.set(cache_key, result, CACHE_TTL_FEED)
    return result
