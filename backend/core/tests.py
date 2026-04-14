import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from .factories import UsuarioFactory, PublicacaoFactory, ComentarioFactory
from .models import Usuario, Publicacao, Seguidor, Notificacao, PublicacaoMencao, ComentarioMencao

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user():
    return UsuarioFactory()

@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client

@pytest.mark.django_db
class TestAuth:
    def test_user_registration_success(self, api_client):
        url = reverse('register')
        data = {
            'nome_usuario': 'newuser',
            'email': 'new@example.com',
            'nome_completo': 'New User',
            'password': 'password123'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_201_CREATED
        assert Usuario.objects.filter(email='new@example.com').exists()

    def test_user_registration_duplicate_email(self, api_client, user):
        url = reverse('register')
        data = {
            'nome_usuario': 'otheruser',
            'email': user.email,
            'nome_completo': 'Other User',
            'password': 'password123'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_login_success(self, api_client, user):
        url = reverse('token_obtain_pair')
        data = {
            'email': user.email,
            'password': 'password123'
        }
        response = api_client.post(url, data)
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data

@pytest.mark.django_db
class TestProfile:
    def test_get_own_profile(self, auth_client, user):
        url = reverse('profile')
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == user.email

    def test_update_own_profile(self, auth_client, user):
        url = reverse('user_detail', args=[user.id_usuario])
        data = {'nome_completo': 'Updated Name'}
        response = auth_client.put(url, data)
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.nome_completo == 'Updated Name'

@pytest.mark.django_db
class TestDreams:
    def test_create_dream_success(self, auth_client):
        url = reverse('dreams-list')
        data = {
            'titulo': 'My Dream',
            'conteudo_texto': 'I was flying #flying',
            'visibilidade': 1
        }
        response = auth_client.post(url, data)
        assert response.status_code == status.HTTP_201_CREATED
        assert Publicacao.objects.count() == 1
        # Check hashtag extraction
        assert 'flying' in response.data['conteudo_texto']

    def test_list_dreams_foryou(self, auth_client):
        # Create public dreams
        PublicacaoFactory.create_batch(3, visibilidade=1)
        # Create private dream
        PublicacaoFactory(visibilidade=3)
        
        url = reverse('dreams-list') + '?tab=foryou'
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_like_dream_toggle(self, auth_client, user):
        dream = PublicacaoFactory()
        url = reverse('dreams-like', args=[dream.id_publicacao])
        
        # Like
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_liked'] is True
        
        # Unlike
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_liked'] is False

@pytest.mark.django_db
class TestComments:
    def test_create_comment(self, auth_client):
        dream = PublicacaoFactory()
        url = reverse('dream-comments-list', args=[dream.id_publicacao])
        data = {'conteudo_texto': 'Nice dream!'}
        
        response = auth_client.post(url, data)
        assert response.status_code == status.HTTP_201_CREATED
        assert dream.comentario_set.count() == 1
    
    def test_delete_comment_without_replies(self, auth_client, user):
        """Test that comments without replies can be deleted"""
        dream = PublicacaoFactory(usuario=user)
        comment = ComentarioFactory(publicacao=dream, usuario=user)
        url = reverse('dream-comments-detail', args=[dream.id_publicacao, comment.id_comentario])
        
        response = auth_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not dream.comentario_set.filter(id_comentario=comment.id_comentario).exists()
    
    def test_cannot_delete_comment_with_replies(self, auth_client, user):
        """Test that comments with replies cannot be deleted to preserve thread structure"""
        dream = PublicacaoFactory(usuario=user)
        parent_comment = ComentarioFactory(publicacao=dream, usuario=user)
        # Create a reply to the parent comment
        reply = ComentarioFactory(publicacao=dream, usuario=user, comentario_pai=parent_comment)
        
        url = reverse('dream-comments-detail', args=[dream.id_publicacao, parent_comment.id_comentario])
        response = auth_client.delete(url)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'respostas' in response.data['error'].lower()
        # Verify comment still exists
        assert dream.comentario_set.filter(id_comentario=parent_comment.id_comentario).exists()
    
    def test_can_delete_reply_then_parent(self, auth_client, user):
        """Test that replies can be deleted first, then the parent comment"""
        dream = PublicacaoFactory(usuario=user)
        parent_comment = ComentarioFactory(publicacao=dream, usuario=user)
        reply = ComentarioFactory(publicacao=dream, usuario=user, comentario_pai=parent_comment)
        
        # First, delete the reply
        reply_url = reverse('dream-comments-detail', args=[dream.id_publicacao, reply.id_comentario])
        response = auth_client.delete(reply_url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Now, delete the parent (should succeed since reply is gone)
        parent_url = reverse('dream-comments-detail', args=[dream.id_publicacao, parent_comment.id_comentario])
        response = auth_client.delete(parent_url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verify both are deleted
        assert dream.comentario_set.filter(status=1).count() == 0
        assert not dream.comentario_set.filter(id_comentario=parent_comment.id_comentario).exists()
        assert not dream.comentario_set.filter(id_comentario=reply.id_comentario).exists()

    def test_create_comment_with_mentions_creates_notification(self, auth_client, user):
        dream = PublicacaoFactory(usuario=UsuarioFactory())
        mentioned_user = UsuarioFactory(nome_usuario='comment_target')
        url = reverse('dream-comments-list', args=[dream.id_publicacao])

        response = auth_client.post(url, {'conteudo_texto': 'Ei @comment_target olha isso'}, format='json')
        assert response.status_code == status.HTTP_201_CREATED

        comment_id = response.data['id_comentario']
        assert ComentarioMencao.objects.filter(comentario_id=comment_id, usuario_mencionado=mentioned_user).exists()

        reference = f"{dream.id_publicacao}::{comment_id}"
        assert Notificacao.objects.filter(
            usuario_destino=mentioned_user,
            usuario_origem=user,
            tipo_notificacao=7,
            id_referencia=reference,
        ).exists()

    def test_update_comment_mentions_syncs_records_and_notifications(self, auth_client, user):
        dream = PublicacaoFactory(usuario=UsuarioFactory())
        first_user = UsuarioFactory(nome_usuario='comment_first')
        second_user = UsuarioFactory(nome_usuario='comment_second')

        create_response = auth_client.post(
            reverse('dream-comments-list', args=[dream.id_publicacao]),
            {'conteudo_texto': 'versao 1 @comment_first'},
            format='json'
        )
        assert create_response.status_code == status.HTTP_201_CREATED

        comment_id = create_response.data['id_comentario']
        comment_url = reverse('dream-comments-detail', args=[dream.id_publicacao, comment_id])

        update_response = auth_client.put(comment_url, {'conteudo_texto': 'versao 2 @comment_second'})
        assert update_response.status_code == status.HTTP_200_OK

        assert not ComentarioMencao.objects.filter(comentario_id=comment_id, usuario_mencionado=first_user).exists()
        assert ComentarioMencao.objects.filter(comentario_id=comment_id, usuario_mencionado=second_user).exists()

        first_reference = f"{dream.id_publicacao}::{comment_id}"
        assert not Notificacao.objects.filter(
            usuario_destino=first_user,
            usuario_origem=user,
            tipo_notificacao=7,
            id_referencia=first_reference,
        ).exists()
        assert Notificacao.objects.filter(
            usuario_destino=second_user,
            usuario_origem=user,
            tipo_notificacao=7,
            id_referencia=first_reference,
        ).exists()

@pytest.mark.django_db
class TestFollow:
    def test_follow_user(self, auth_client, user):
        other_user = UsuarioFactory()
        url = reverse('follow', args=[other_user.id_usuario])
        
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert Seguidor.objects.filter(usuario_seguidor=user, usuario_seguido=other_user).exists()
        
        # Check notification
        assert Notificacao.objects.filter(usuario_destino=other_user, tipo_notificacao=4).exists()

    def test_cannot_follow_self(self, auth_client, user):
        url = reverse('follow', args=[user.id_usuario])
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

@pytest.mark.django_db
class TestSearch:
    def test_search_posts(self, auth_client):
        PublicacaoFactory(titulo="Flying Dream", conteudo_texto="Sky")
        PublicacaoFactory(titulo="Running Dream", conteudo_texto="Ground")
        
        url = reverse('search') + '?q=Flying'
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']['posts']) == 1
        assert response.data['results']['posts'][0]['titulo'] == "Flying Dream"


@pytest.mark.django_db
class TestSettings:
    def test_get_settings_creates_if_missing(self, auth_client, user):
        """Settings should be auto-created if missing"""
        url = reverse('user-settings')
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert 'notificacoes_novas_publicacoes' in response.data
        assert 'tema_interface' in response.data
        
    def test_update_settings(self, auth_client, user):
        """Settings should be updateable via PATCH"""
        url = reverse('user-settings')
        data = {'tema_interface': 2, 'notificacoes_comentarios': False}
        response = auth_client.patch(url, data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['tema_interface'] == 2
        assert response.data['notificacoes_comentarios'] is False


@pytest.mark.django_db
class TestCloseFriends:
    def test_list_followers_for_management(self, auth_client, user):
        """Should list followers with close friend status"""
        # Create a follower
        follower = UsuarioFactory()
        Seguidor.objects.create(usuario_seguidor=follower, usuario_seguido=user)
        
        url = reverse('close-friends-manage')
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['nome_usuario'] == follower.nome_usuario
        assert response.data[0]['is_close_friend'] is False
        
    def test_toggle_close_friend(self, auth_client, user):
        """Should toggle close friend status"""
        # Create a follower
        follower = UsuarioFactory()
        Seguidor.objects.create(usuario_seguidor=follower, usuario_seguido=user)
        
        url = reverse('close-friends-toggle', args=[follower.id_usuario])
        
        # Toggle ON
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_close_friend'] is True
        
        # Toggle OFF
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_close_friend'] is False


@pytest.mark.django_db
class TestFollowersList:
    def test_public_user_followers_list(self, auth_client, user):
        """Public profile: anyone can list followers"""
        public_user = UsuarioFactory(privacidade_padrao=1)
        follower = UsuarioFactory()
        Seguidor.objects.create(usuario_seguidor=follower, usuario_seguido=public_user, status=1)

        url = reverse('user-followers', args=[public_user.id_usuario])
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['nome_usuario'] == follower.nome_usuario

    def test_private_user_followers_denied(self, auth_client, user):
        """Private profile: non-follower gets 403"""
        private_user = UsuarioFactory(privacidade_padrao=2)
        url = reverse('user-followers', args=[private_user.id_usuario])
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_private_user_followers_allowed_for_follower(self, auth_client, user):
        """Private profile: approved follower can see list"""
        private_user = UsuarioFactory(privacidade_padrao=2)
        Seguidor.objects.create(usuario_seguidor=user, usuario_seguido=private_user, status=1)

        url = reverse('user-followers', args=[private_user.id_usuario])
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_own_followers_always_visible(self, auth_client, user):
        """Owner always sees their own followers list"""
        user.privacidade_padrao = 2
        user.save()
        follower = UsuarioFactory()
        Seguidor.objects.create(usuario_seguidor=follower, usuario_seguido=user, status=1)

        url = reverse('user-followers', args=[user.id_usuario])
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_following_list_privacy(self, auth_client, user):
        """Following list also respects privacy"""
        private_user = UsuarioFactory(privacidade_padrao=2)
        target = UsuarioFactory()
        Seguidor.objects.create(usuario_seguidor=private_user, usuario_seguido=target, status=1)

        # Denied
        url = reverse('user-following', args=[private_user.id_usuario])
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Now follow and retry
        Seguidor.objects.create(usuario_seguidor=user, usuario_seguido=private_user, status=1)
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1


@pytest.mark.django_db
class TestPostMentions:
    def test_create_post_with_mentions_creates_notification(self, auth_client, user):
        mentioned_user = UsuarioFactory(nome_usuario='alice_mention')
        url = reverse('dreams-list')

        response = auth_client.post(url, {
            'titulo': 'Post com mencao',
            'conteudo_texto': 'Oi @alice_mention, veja este sonho!'
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        post_id = response.data['id_publicacao']

        assert PublicacaoMencao.objects.filter(
            publicacao_id=post_id,
            usuario_mencionado=mentioned_user,
            usuario_mencionador=user,
        ).exists()

        notification = Notificacao.objects.filter(
            usuario_destino=mentioned_user,
            usuario_origem=user,
            tipo_notificacao=7,
            id_referencia=str(post_id),
        ).first()
        assert notification is not None

    def test_create_post_with_duplicate_or_self_mentions(self, auth_client, user):
        mentioned_user = UsuarioFactory(nome_usuario='dupe_user')
        url = reverse('dreams-list')

        response = auth_client.post(url, {
            'conteudo_texto': 'Teste @dupe_user @DUPE_USER e @%s' % user.nome_usuario
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        post_id = response.data['id_publicacao']

        assert PublicacaoMencao.objects.filter(publicacao_id=post_id).count() == 1
        assert PublicacaoMencao.objects.filter(publicacao_id=post_id, usuario_mencionado=mentioned_user).exists()
        assert not PublicacaoMencao.objects.filter(publicacao_id=post_id, usuario_mencionado=user).exists()

        assert Notificacao.objects.filter(
            usuario_destino=mentioned_user,
            tipo_notificacao=7,
            id_referencia=str(post_id),
        ).count() == 1

    def test_update_post_mentions_syncs_records_and_notifications(self, auth_client, user):
        first_user = UsuarioFactory(nome_usuario='first_mention')
        second_user = UsuarioFactory(nome_usuario='second_mention')

        create_response = auth_client.post(reverse('dreams-list'), {
            'conteudo_texto': 'Primeira versao com @first_mention'
        }, format='json')
        assert create_response.status_code == status.HTTP_201_CREATED

        post_id = create_response.data['id_publicacao']

        patch_response = auth_client.patch(
            reverse('dreams-detail', args=[post_id]),
            {'conteudo_texto': 'Versao nova com @second_mention'},
            format='json'
        )
        assert patch_response.status_code == status.HTTP_200_OK

        assert not PublicacaoMencao.objects.filter(publicacao_id=post_id, usuario_mencionado=first_user).exists()
        assert PublicacaoMencao.objects.filter(publicacao_id=post_id, usuario_mencionado=second_user).exists()

        assert not Notificacao.objects.filter(
            usuario_destino=first_user,
            usuario_origem=user,
            tipo_notificacao=7,
            id_referencia=str(post_id),
        ).exists()
        assert Notificacao.objects.filter(
            usuario_destino=second_user,
            usuario_origem=user,
            tipo_notificacao=7,
            id_referencia=str(post_id),
        ).exists()


@pytest.mark.django_db
class TestDirectMessagesV2:
    """Testes para a API V2 de Mensagens Diretas (conversas explícitas)"""

    def test_create_conversation(self, auth_client, user):
        """POST /api/v2/conversations/ deve criar conversa 1:1"""
        partner = UsuarioFactory()
        url = reverse('v2-conversations-list')
        response = auth_client.post(url, {'user_id': str(partner.id_usuario)})
        assert response.status_code == status.HTTP_201_CREATED
        assert 'id_conversa' in response.data
        assert response.data['parceiro']['id_usuario'] == str(partner.id_usuario)

    def test_conversation_deterministic(self, user):
        """Criar conversa A→B e B→A resulta na mesma conversa"""
        partner = UsuarioFactory()
        client_a = APIClient()
        client_a.force_authenticate(user=user)
        client_b = APIClient()
        client_b.force_authenticate(user=partner)

        url = reverse('v2-conversations-list')
        r1 = client_a.post(url, {'user_id': str(partner.id_usuario)})
        r2 = client_b.post(url, {'user_id': str(user.id_usuario)})

        assert r1.data['id_conversa'] == r2.data['id_conversa']
        assert r2.status_code == status.HTTP_200_OK  # Já existia

    def test_list_inbox(self, auth_client, user):
        """GET /api/v2/conversations/ deve listar conversas com última mensagem"""
        partner = UsuarioFactory()
        url = reverse('v2-conversations-list')
        auth_client.post(url, {'user_id': str(partner.id_usuario)})

        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.data.get('results', response.data)
        assert len(data) >= 1

    def test_send_text_message(self, auth_client, user):
        """POST /api/v2/conversations/<id>/send/ com texto deve criar mensagem"""
        partner = UsuarioFactory()
        url = reverse('v2-conversations-list')
        conv_resp = auth_client.post(url, {'user_id': str(partner.id_usuario)})
        conv_id = conv_resp.data['id_conversa']

        send_url = reverse('v2-conversations-send', args=[conv_id])
        response = auth_client.post(send_url, {'conteudo': 'Olá, teste!'})
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['conteudo'] == 'Olá, teste!'
        assert response.data['tipo_mensagem'] == 'text'
        assert response.data['is_mine'] is True

    def test_mark_read(self, user):
        """POST /api/v2/conversations/<id>/read/ marca mensagens como lidas"""
        partner = UsuarioFactory()
        from .models import Conversa, MensagemDireta
        conversa, _ = Conversa.get_or_create_for_users(user, partner)
        MensagemDireta.objects.create(
            usuario_remetente=partner, usuario_destinatario=user,
            conversa=conversa, conteudo='Msg não lida'
        )

        client = APIClient()
        client.force_authenticate(user=user)
        read_url = reverse('v2-conversations-mark-read', args=[conversa.id_conversa])
        response = client.post(read_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['marked_read'] == 1

    def test_unread_count(self, user):
        """GET /api/v2/conversations/unread-count/ retorna contagem correta"""
        partner = UsuarioFactory()
        from .models import Conversa, MensagemDireta
        conversa, _ = Conversa.get_or_create_for_users(user, partner)
        MensagemDireta.objects.create(
            usuario_remetente=partner, usuario_destinatario=user,
            conversa=conversa, conteudo='Msg 1'
        )
        MensagemDireta.objects.create(
            usuario_remetente=partner, usuario_destinatario=user,
            conversa=conversa, conteudo='Msg 2'
        )

        client = APIClient()
        client.force_authenticate(user=user)
        url = reverse('v2-conversations-unread-count')
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['unread_count'] == 2

    def test_block_prevents_send(self, auth_client, user):
        """Bloqueio deve impedir envio de mensagem (403)"""
        from .models import Bloqueio, Conversa
        partner = UsuarioFactory()
        conversa, _ = Conversa.get_or_create_for_users(user, partner)
        Bloqueio.objects.create(usuario=partner, usuario_bloqueado=user)

        send_url = reverse('v2-conversations-send', args=[conversa.id_conversa])
        response = auth_client.post(send_url, {'conteudo': 'Teste bloqueio'})
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_message_history(self, auth_client, user):
        """GET /api/v2/conversations/<id>/messages/ retorna histórico"""
        partner = UsuarioFactory()
        from .models import Conversa, MensagemDireta
        conversa, _ = Conversa.get_or_create_for_users(user, partner)
        MensagemDireta.objects.create(
            usuario_remetente=user, usuario_destinatario=partner,
            conversa=conversa, conteudo='Mensagem 1'
        )

        url = reverse('v2-conversations-messages', args=[conversa.id_conversa])
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.data.get('results', response.data)
        assert len(data) >= 1

    def test_cannot_create_self_conversation(self, auth_client, user):
        """Não deve ser possível criar conversa consigo mesmo"""
        url = reverse('v2-conversations-list')
        response = auth_client.post(url, {'user_id': str(user.id_usuario)})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_v1_compatibility(self, auth_client, user):
        """Rotas V1 /api/chat/conversations/ devem continuar funcionando"""
        url = reverse('chat-conversations')
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
