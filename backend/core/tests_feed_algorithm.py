"""
Testes do Algoritmo de Recomendação — Feed "Para Você"
=======================================================
Valida que:
  1. Interesses salvos no onboarding influenciam o score dos posts
  2. Posts do tipo preferido recebem bonus BONUS_TIPO_SONHO
  3. Posts de autores seguidos recebem bonus BONUS_SEGUINDO
  4. Cold-start retorna fallback por popularidade (30 dias)
  5. Posts já vistos NÃO entram no pool de candidatos
  6. Posts de usuários bloqueados/silenciados NÃO entram no pool
  7. Usuário sem histórico mas COM interesses de onboarding usa esses tipos no scoring
  8. Endpoint GET /api/dreams/?tab=foryou retorna 200 e lista não-vazia quando há posts
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from unittest.mock import patch

from .factories import UsuarioFactory, PublicacaoFactory
from .models import (
    Publicacao, Seguidor, ConfiguracaoUsuario,
    ReacaoPublicacao, PostVisto, Bloqueio, Silenciamento,
)
from .feed_algorithm import (
    _get_user_context,
    _get_candidates,
    _score_post,
    _recencia_score,
    get_foryou_feed,
    BONUS_TIPO_SONHO,
    BONUS_SEGUINDO,
    RECENCIA_MULTIPLICADOR_MIN,
)


# ─────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────

def _make_post(usuario, tipo_sonho='Normal', dias_atras=0, visibilidade=1):
    """Cria um post com data retroativa, evitando duplicação de código."""
    post = PublicacaoFactory(
        usuario=usuario,
        visibilidade=visibilidade,
        tipo_sonho=tipo_sonho,
    )
    if dias_atras:
        post.data_publicacao = timezone.now() - timedelta(days=dias_atras)
        post.save(update_fields=['data_publicacao'])
    return post


def _set_interesses(user, interesses):
    """Garante que ConfiguracaoUsuario existe e salva os interesses."""
    config, _ = ConfiguracaoUsuario.objects.get_or_create(usuario=user)
    config.interesses = interesses
    config.save(update_fields=['interesses'])
    return config


def _clear_feed_cache(user_id):
    """Apaga cache do contexto e do feed para garantir recálculo nos testes."""
    from django.core.cache import cache
    cache.delete(f'feed_ctx:{user_id}')
    for p in range(1, 5):
        cache.delete(f'feed_foryou:{user_id}:p{p}')


# ─────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────

@pytest.fixture
def viewer():
    """Usuário que vai receber o feed (sem histórico de engajamento)."""
    u = UsuarioFactory()
    _clear_feed_cache(u.id_usuario)
    return u


@pytest.fixture
def author():
    """Autor dos posts candidatos."""
    return UsuarioFactory()


@pytest.fixture
def auth_client(viewer):
    client = APIClient()
    client.force_authenticate(user=viewer)
    return client


# ─────────────────────────────────────────────────────────────────
# 1. RECÊNCIA
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRecencia:
    def test_post_recente_score_maximo(self):
        """Post criado agora deve ter score de recência próximo de 1.0."""
        data = timezone.now()
        score = _recencia_score(data)
        assert score >= 0.95

    def test_post_antigo_score_minimo(self):
        """Post de 200 horas atrás deve atingir o piso RECENCIA_MULTIPLICADOR_MIN."""
        data = timezone.now() - timedelta(hours=200)
        score = _recencia_score(data)
        assert score == pytest.approx(RECENCIA_MULTIPLICADOR_MIN, abs=0.01)

    def test_post_data_futura_retorna_1(self):
        """Data futura (edge case) não deve causar erro e deve retornar 1.0."""
        data = timezone.now() + timedelta(hours=1)
        score = _recencia_score(data)
        assert score == 1.0


# ─────────────────────────────────────────────────────────────────
# 2. CONTEXTO DO USUÁRIO
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestContextoUsuario:
    def test_interesses_onboarding_aparecem_em_tipos_preferidos(self, viewer):
        """
        CRÍTICO: Interesses salvos pelo onboarding devem aparecer em
        ctx['tipos_preferidos'] mesmo sem histórico de engajamento.
        """
        _set_interesses(viewer, ['Lúcido', 'Pesadelo'])
        _clear_feed_cache(viewer.id_usuario)

        ctx = _get_user_context(viewer)

        assert 'Lúcido' in ctx['tipos_preferidos'], (
            "Interesse 'Lúcido' do onboarding deve estar em tipos_preferidos"
        )
        assert 'Pesadelo' in ctx['tipos_preferidos'], (
            "Interesse 'Pesadelo' do onboarding deve estar em tipos_preferidos"
        )

    def test_usuario_sem_interesses_tipos_preferidos_vazio(self, viewer):
        """Sem histórico e sem onboarding, tipos_preferidos deve ser conjunto vazio."""
        _set_interesses(viewer, [])
        _clear_feed_cache(viewer.id_usuario)

        ctx = _get_user_context(viewer)
        assert len(ctx['tipos_preferidos']) == 0

    def test_cold_start_detectado_sem_engajamento(self, viewer):
        """Usuário sem engajamento deve ser detectado como cold-start."""
        _clear_feed_cache(viewer.id_usuario)
        ctx = _get_user_context(viewer)
        assert ctx['is_cold_start'] is True

    def test_cold_start_false_com_engajamento(self, viewer, author):
        """Usuário com 5+ engajamentos não deve ser cold-start."""
        for _ in range(6):
            post = _make_post(author)
            ReacaoPublicacao.objects.create(usuario=viewer, publicacao=post)

        _clear_feed_cache(viewer.id_usuario)
        ctx = _get_user_context(viewer)
        assert ctx['is_cold_start'] is False

    def test_seguindo_aparece_no_contexto(self, viewer, author):
        """Autor seguido pelo viewer deve aparecer em following_ids."""
        Seguidor.objects.create(
            usuario_seguidor=viewer, usuario_seguido=author, status=1
        )
        _clear_feed_cache(viewer.id_usuario)
        ctx = _get_user_context(viewer)
        assert author.id_usuario in ctx['following_ids']

    def test_bloqueado_aparece_no_contexto(self, viewer, author):
        """Usuário bloqueado deve aparecer em blocked_ids."""
        Bloqueio.objects.create(usuario=viewer, usuario_bloqueado=author)
        _clear_feed_cache(viewer.id_usuario)
        ctx = _get_user_context(viewer)
        assert author.id_usuario in ctx['blocked_ids']

    def test_silenciado_aparece_no_contexto(self, viewer, author):
        """Usuário silenciado deve aparecer em muted_ids."""
        Silenciamento.objects.create(usuario=viewer, usuario_silenciado=author)
        _clear_feed_cache(viewer.id_usuario)
        ctx = _get_user_context(viewer)
        assert author.id_usuario in ctx['muted_ids']


# ─────────────────────────────────────────────────────────────────
# 3. SCORE DE POST
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestScorePost:
    def _ctx_base(self, viewer):
        """Contexto mínimo para testar scoring sem acessar banco."""
        return {
            'following_ids': set(),
            'community_ids': set(),
            'blocked_ids': set(),
            'muted_ids': set(),
            'hashtag_ids': set(),
            'tipos_preferidos': set(),
            'seen_post_ids': set(),
            'engaged_ids': set(),
            'is_cold_start': True,
        }

    def test_bonus_tipo_sonho_aplicado(self, viewer, author):
        """
        CRÍTICO: Post cujo tipo_sonho está em tipos_preferidos deve receber
        BONUS_TIPO_SONHO no score de afinidade.
        """
        post_preferido = _make_post(author, tipo_sonho='Lúcido')
        post_neutro = _make_post(author, tipo_sonho='Normal')

        ctx = self._ctx_base(viewer)
        ctx['tipos_preferidos'] = {'Lúcido'}

        score_preferido = _score_post(post_preferido, ctx)
        score_neutro = _score_post(post_neutro, ctx)

        diferenca = score_preferido - score_neutro
        # A diferença deve ser pelo menos BONUS_TIPO_SONHO × recência_minima
        assert diferenca >= BONUS_TIPO_SONHO * RECENCIA_MULTIPLICADOR_MIN, (
            f"Post do tipo preferido deveria ter score {BONUS_TIPO_SONHO} maior, "
            f"mas a diferença foi {diferenca:.3f}"
        )

    def test_bonus_seguindo_aplicado(self, viewer, author):
        """Post de autor seguido deve receber BONUS_SEGUINDO."""
        post = _make_post(author, tipo_sonho='Normal')

        ctx_sem_follow = self._ctx_base(viewer)
        ctx_com_follow = {**ctx_sem_follow, 'following_ids': {author.id_usuario}}

        score_sem = _score_post(post, ctx_sem_follow)
        score_com = _score_post(post, ctx_com_follow)

        diferenca = score_com - score_sem
        assert diferenca >= BONUS_SEGUINDO * RECENCIA_MULTIPLICADOR_MIN, (
            f"Post de seguido deveria ter score {BONUS_SEGUINDO} maior, "
            f"mas a diferença foi {diferenca:.3f}"
        )

    def test_interesses_onboarding_elevam_score_vs_sem_interesse(self, viewer, author):
        """
        Integração: com interesses de onboarding, post do tipo preferido
        deve ter score MAIOR do que o mesmo post sem preferências configuradas.
        """
        _set_interesses(viewer, ['Lúcido'])
        _clear_feed_cache(viewer.id_usuario)

        ctx_com_interesse = _get_user_context(viewer)

        _set_interesses(viewer, [])
        _clear_feed_cache(viewer.id_usuario)
        ctx_sem_interesse = _get_user_context(viewer)

        post_lucido = _make_post(author, tipo_sonho='Lúcido')

        score_com = _score_post(post_lucido, ctx_com_interesse)
        score_sem = _score_post(post_lucido, ctx_sem_interesse)

        assert score_com > score_sem, (
            "Com interesses de onboarding o score deve ser maior do que sem interesses"
        )

    def test_post_sem_tipo_sonho_nao_recebe_bonus(self, viewer, author):
        """Post com tipo_sonho vazio/None não deve receber bonus de tipo."""
        post = _make_post(author, tipo_sonho='')
        post.tipo_sonho = ''
        post.save(update_fields=['tipo_sonho'])

        ctx = self._ctx_base(viewer)
        ctx['tipos_preferidos'] = {'Lúcido', 'Pesadelo'}

        score = _score_post(post, ctx)
        # Score puro de engajamento × recência (sem bonus de tipo)
        # Verificamos apenas que não quebra e retorna valor positivo
        assert score >= 0.0


# ─────────────────────────────────────────────────────────────────
# 4. POOL DE CANDIDATOS
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPoolCandidatos:
    def test_posts_proprios_excluidos(self, viewer):
        """O próprio usuário não deve aparecer como candidato no feed."""
        _make_post(viewer, tipo_sonho='Lúcido')
        _clear_feed_cache(viewer.id_usuario)
        ctx = _get_user_context(viewer)
        candidatos = _get_candidates(viewer, ctx)
        ids_autores = [c.usuario_id for c in candidatos]
        assert viewer.id_usuario not in ids_autores

    def test_posts_bloqueados_excluidos(self, viewer, author):
        """Posts de autores bloqueados não devem entrar no pool."""
        Bloqueio.objects.create(usuario=viewer, usuario_bloqueado=author)
        _make_post(author, tipo_sonho='Lúcido')
        _clear_feed_cache(viewer.id_usuario)
        ctx = _get_user_context(viewer)
        candidatos = _get_candidates(viewer, ctx)
        ids_autores = [c.usuario_id for c in candidatos]
        assert author.id_usuario not in ids_autores

    def test_posts_silenciados_excluidos(self, viewer, author):
        """Posts de autores silenciados não devem entrar no pool."""
        Silenciamento.objects.create(usuario=viewer, usuario_silenciado=author)
        _make_post(author, tipo_sonho='Normal')
        _clear_feed_cache(viewer.id_usuario)
        ctx = _get_user_context(viewer)
        candidatos = _get_candidates(viewer, ctx)
        ids_autores = [c.usuario_id for c in candidatos]
        assert author.id_usuario not in ids_autores

    def test_posts_privados_excluidos(self, viewer, author):
        """Posts com visibilidade != 1 (privados/amigos) não devem entrar no pool."""
        post_privado = _make_post(author, visibilidade=2)
        _clear_feed_cache(viewer.id_usuario)
        ctx = _get_user_context(viewer)
        candidatos = _get_candidates(viewer, ctx)
        ids = [c.id_publicacao for c in candidatos]
        assert post_privado.id_publicacao not in ids

    def test_posts_ja_vistos_excluidos(self, viewer, author):
        """Posts já registrados em PostVisto não devem reaparecer no pool."""
        post = _make_post(author, tipo_sonho='Lúcido')
        PostVisto.objects.create(
            usuario=viewer,
            publicacao=post,
            data_visto=timezone.now() - timedelta(hours=1)
        )
        _clear_feed_cache(viewer.id_usuario)
        ctx = _get_user_context(viewer)
        candidatos = _get_candidates(viewer, ctx)
        ids = [c.id_publicacao for c in candidatos]
        assert post.id_publicacao not in ids

    def test_janela_dinamica_expande_com_poucos_posts(self, viewer, author):
        """
        Com posts muito antigos (>7 dias), a janela dinâmica deve expandir
        para 14 ou 30 dias e ainda encontrar candidatos.
        """
        # Post com 20 dias — fora da janela de 7 dias, dentro de 30
        _make_post(author, tipo_sonho='Normal', dias_atras=20)
        _clear_feed_cache(viewer.id_usuario)
        ctx = _get_user_context(viewer)
        candidatos = _get_candidates(viewer, ctx)
        assert len(candidatos) >= 1, (
            "A janela dinâmica deveria expandir para 30 dias e encontrar o post antigo"
        )


# ─────────────────────────────────────────────────────────────────
# 5. FUNÇÃO PRINCIPAL get_foryou_feed
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetForyouFeed:
    def test_retorna_ids_ordenados_por_score(self, viewer, author):
        """
        O feed deve retornar posts do tipo preferido antes dos neutros
        quando o viewer tem esse interesse no onboarding.
        """
        _set_interesses(viewer, ['Lúcido'])
        _clear_feed_cache(viewer.id_usuario)

        # Posts neutros (Normal)
        for _ in range(3):
            _make_post(author, tipo_sonho='Normal')

        # Post preferido (Lúcido)
        post_lucido = _make_post(author, tipo_sonho='Lúcido')

        ids, _ = get_foryou_feed(viewer, page=1, page_size=10)

        assert len(ids) >= 1, "O feed não deve estar vazio"
        assert post_lucido.id_publicacao in ids, (
            "Post do tipo Lúcido deve aparecer no feed"
        )

        # O post Lúcido deve estar nas primeiras posições
        posicao_lucido = ids.index(post_lucido.id_publicacao)
        assert posicao_lucido <= 1, (
            f"Post preferido (Lúcido) deveria estar na posição 0 ou 1, "
            f"mas estava na posição {posicao_lucido}"
        )

    def test_cold_start_retorna_posts_populares(self, viewer, author):
        """
        Usuário sem histórico (cold-start) deve receber o fallback
        com posts mais populares — não deve retornar lista vazia.
        """
        _set_interesses(viewer, [])
        _clear_feed_cache(viewer.id_usuario)

        # Criar posts públicos dentro de 30 dias
        for _ in range(5):
            _make_post(author, tipo_sonho='Normal', dias_atras=5)

        ids, _ = get_foryou_feed(viewer, page=1, page_size=15)
        assert len(ids) >= 1, (
            "Cold-start deve retornar fallback por popularidade, não lista vazia"
        )

    def test_paginacao_has_more(self, viewer, author):
        """has_more deve ser True quando há mais posts além da página atual."""
        _set_interesses(viewer, ['Normal'])
        _clear_feed_cache(viewer.id_usuario)

        for _ in range(20):
            _make_post(author, tipo_sonho='Normal')

        _, has_more = get_foryou_feed(viewer, page=1, page_size=10)
        assert has_more is True

    def test_paginacao_ultima_pagina_has_more_false(self, viewer, author):
        """Na última página, has_more deve ser False."""
        _set_interesses(viewer, ['Normal'])
        _clear_feed_cache(viewer.id_usuario)

        for _ in range(3):
            _make_post(author, tipo_sonho='Normal')

        # Página 1 com page_size=10 e apenas 3 posts → sem próxima página
        _, has_more = get_foryou_feed(viewer, page=1, page_size=10)
        assert has_more is False

    def test_posts_vistos_registrados(self, viewer, author):
        """Após get_foryou_feed, os posts entregues devem estar em PostVisto."""
        _set_interesses(viewer, ['Lúcido'])
        _clear_feed_cache(viewer.id_usuario)

        post = _make_post(author, tipo_sonho='Lúcido')

        ids, _ = get_foryou_feed(viewer, page=1, page_size=15)

        if post.id_publicacao in ids:
            assert PostVisto.objects.filter(
                usuario=viewer, publicacao=post
            ).exists(), "Post entregue deve ser registrado como visto"

    def test_cache_redis_retorna_resultado_identico(self, viewer, author):
        """Segunda chamada deve usar cache e retornar exatamente o mesmo resultado."""
        _set_interesses(viewer, ['Lúcido'])
        _clear_feed_cache(viewer.id_usuario)
        _make_post(author, tipo_sonho='Lúcido')

        ids_1, has_more_1 = get_foryou_feed(viewer, page=1, page_size=15)
        ids_2, has_more_2 = get_foryou_feed(viewer, page=1, page_size=15)

        assert ids_1 == ids_2
        assert has_more_1 == has_more_2


# ─────────────────────────────────────────────────────────────────
# 6. ENDPOINT HTTP (integração com a View)
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestEndpointForyou:
    def test_foryou_retorna_200_com_posts(self, auth_client, viewer, author):
        """GET /api/dreams/?tab=foryou deve retornar 200."""
        _set_interesses(viewer, ['Lúcido'])
        _clear_feed_cache(viewer.id_usuario)
        _make_post(author, tipo_sonho='Lúcido')

        url = reverse('dreams-list') + '?tab=foryou'
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_foryou_sem_posts_retorna_200_lista_vazia(self, auth_client, viewer):
        """Feed vazio não deve retornar erro — deve retornar 200 com lista vazia."""
        _set_interesses(viewer, [])
        _clear_feed_cache(viewer.id_usuario)

        url = reverse('dreams-list') + '?tab=foryou'
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_foryou_anonimo_sem_erro(self):
        """Usuário anônimo acessando ?tab=foryou não deve gerar 500."""
        client = APIClient()
        url = reverse('dreams-list') + '?tab=foryou'
        response = client.get(url)
        # Pode ser 200 (feed público) ou 401, mas nunca 500
        assert response.status_code != status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_foryou_post_tipo_preferido_aparece_antes(self, auth_client, viewer, author):
        """
        INTEGRAÇÃO COMPLETA: Post do tipo preferido pelo onboarding deve aparecer
        no início do feed retornado pela API.
        """
        _set_interesses(viewer, ['Lúcido'])
        _clear_feed_cache(viewer.id_usuario)

        # Posts neutros
        for _ in range(4):
            _make_post(author, tipo_sonho='Normal')

        # Post preferido
        post_lucido = _make_post(author, tipo_sonho='Lúcido')

        url = reverse('dreams-list') + '?tab=foryou'
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK

        data = response.data
        # Suporte a resposta paginada e não paginada
        results = data.get('results', data) if isinstance(data, dict) else data

        assert len(results) >= 1, "Feed não deve estar vazio"

        ids_retornados = [str(p['id_publicacao']) for p in results]
        str_id_lucido = str(post_lucido.id_publicacao)

        assert str_id_lucido in ids_retornados, (
            "Post do tipo Lúcido (preferido no onboarding) deve aparecer no feed"
        )

        posicao = ids_retornados.index(str_id_lucido)
        assert posicao <= 1, (
            f"Post Lúcido deveria estar entre os 2 primeiros, mas está na posição {posicao}"
        )
