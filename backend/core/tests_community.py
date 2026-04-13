import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from .factories import UsuarioFactory
from .models import Comunidade, MembroComunidade, Usuario, Publicacao

@pytest.fixture
def auth_client():
    user = UsuarioFactory()
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user

@pytest.mark.django_db
class TestCommunityFeatures:
    
    def test_community_creation_with_rules(self, auth_client):
        client, user = auth_client
        url = reverse('communities-list')
        
        rules = [
            {"title": "Be Nice", "description": "No hate speech", "created_at": "2024-01-01"},
            {"title": "No Spam", "description": "Don't post spam", "created_at": "2024-01-01"}
        ]
        
        data = {
            'nome': 'Rules Community',
            'descricao': 'A community with rules',
            'regras': rules,
            'imagem': None
        }
        
        response = client.post(url, data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['regras'] == rules
        assert Comunidade.objects.get(nome='Rules Community').regras == rules

    def test_join_leave_community(self, auth_client):
        client, user = auth_client
        community = Comunidade.objects.create(nome='Test Community', descricao='Testing join')
        
        # Join
        url_join = reverse('communities-join', args=[community.id_comunidade])
        response = client.post(url_join)
        assert response.status_code == status.HTTP_200_OK
        assert MembroComunidade.objects.filter(comunidade=community, usuario=user).exists()
        
        # Verify serialized data shows is_member=True
        url_detail = reverse('communities-detail', args=[community.id_comunidade])
        response = client.get(url_detail)
        assert response.data['is_member'] is True
        assert response.data['membros_count'] == 1

        # Leave
        url_leave = reverse('communities-leave', args=[community.id_comunidade])
        response = client.post(url_leave)
        assert response.status_code == status.HTTP_200_OK
        assert not MembroComunidade.objects.filter(comunidade=community, usuario=user).exists()

    def test_moderator_stats_access_control(self, auth_client):
        client, user = auth_client
        community = Comunidade.objects.create(nome='Mod Stats Community', descricao='Stats test')
        
        # User is NOT a member yet
        url_stats = reverse('communities-moderator-stats', args=[community.id_comunidade])
        response = client.get(url_stats)
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # User joins as Member
        MembroComunidade.objects.create(comunidade=community, usuario=user, role='member')
        response = client.get(url_stats)
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # User promoted to Moderator
        membro = MembroComunidade.objects.get(comunidade=community, usuario=user)
        membro.role = 'moderator'
        membro.save()
        
        response = client.get(url_stats)
        assert response.status_code == status.HTTP_200_OK
        assert 'total_members' in response.data
        assert 'new_members_last_7_days' in response.data

    def test_moderator_stats_calculations(self, auth_client):
        client, mod_user = auth_client
        community = Comunidade.objects.create(nome='Stats Calc Community', descricao='Math test')
        
        # Setup Mod
        MembroComunidade.objects.create(comunidade=community, usuario=mod_user, role='moderator')
        
        # Add another member
        user2 = UsuarioFactory(nome_usuario='user2', email='u2@test.com')
        MembroComunidade.objects.create(comunidade=community, usuario=user2, role='member')
        
        # Get stats
        url_stats = reverse('communities-moderator-stats', args=[community.id_comunidade])
        response = client.get(url_stats)
        
        assert response.data['total_members'] == 2
        assert response.data['new_members_last_7_days'] == 2

    def test_delete_account_precheck_lists_pending_communities(self, auth_client):
        client, user = auth_client

        community_transfer = Comunidade.objects.create(nome='Transfer Community', descricao='Needs transfer')
        MembroComunidade.objects.create(comunidade=community_transfer, usuario=user, role='admin')
        moderator = UsuarioFactory()
        MembroComunidade.objects.create(comunidade=community_transfer, usuario=moderator, role='moderator')

        community_delete = Comunidade.objects.create(nome='Delete Community', descricao='Will be deleted')
        MembroComunidade.objects.create(comunidade=community_delete, usuario=user, role='admin')
        member = UsuarioFactory()
        MembroComunidade.objects.create(comunidade=community_delete, usuario=member, role='member')

        community_safe = Comunidade.objects.create(nome='Shared Admin Community', descricao='Another admin exists')
        MembroComunidade.objects.create(comunidade=community_safe, usuario=user, role='admin')
        other_admin = UsuarioFactory()
        MembroComunidade.objects.create(comunidade=community_safe, usuario=other_admin, role='admin')

        url = reverse('delete_account_precheck')
        response = client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['can_proceed'] is False

        transfer_ids = {item['id_comunidade'] for item in response.data['comunidades_para_transferir']}
        delete_ids = {item['id_comunidade'] for item in response.data['comunidades_para_deletar']}

        assert str(community_transfer.id_comunidade) in transfer_ids
        assert str(community_delete.id_comunidade) in delete_ids
        assert str(community_safe.id_comunidade) not in transfer_ids
        assert str(community_safe.id_comunidade) not in delete_ids

    def test_transfer_ownership_promotes_moderator(self, auth_client):
        client, user = auth_client
        community = Comunidade.objects.create(nome='Ownership Community', descricao='Transfer test')
        MembroComunidade.objects.create(comunidade=community, usuario=user, role='admin')
        moderator = UsuarioFactory()
        MembroComunidade.objects.create(comunidade=community, usuario=moderator, role='moderator')

        url = reverse('communities-transfer-ownership', args=[community.id_comunidade])
        response = client.post(url, {'user_id': str(moderator.id_usuario)}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert MembroComunidade.objects.get(comunidade=community, usuario=moderator).role == 'admin'
        assert MembroComunidade.objects.get(comunidade=community, usuario=user).role == 'member'

    def test_delete_account_blocks_when_transfer_is_required(self, auth_client):
        client, user = auth_client
        user.set_password('password123')
        user.save(update_fields=['password'])

        community = Comunidade.objects.create(nome='Blocked Delete Community', descricao='Must transfer first')
        MembroComunidade.objects.create(comunidade=community, usuario=user, role='admin')
        moderator = UsuarioFactory()
        MembroComunidade.objects.create(comunidade=community, usuario=moderator, role='moderator')

        url = reverse('delete_account')
        response = client.delete(url, {'senha': 'password123'}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['requires_transfer'] is True
        assert len(response.data['comunidades_para_transferir']) == 1
        assert Usuario.objects.filter(id_usuario=user.id_usuario).exists()
        assert Comunidade.objects.filter(id_comunidade=community.id_comunidade).exists()

    def test_delete_account_deletes_orphan_community(self, auth_client):
        client, user = auth_client
        user.set_password('password123')
        user.save(update_fields=['password'])

        community = Comunidade.objects.create(nome='Orphan Community', descricao='Will be deleted with account')
        MembroComunidade.objects.create(comunidade=community, usuario=user, role='admin')

        url = reverse('delete_account')
        response = client.delete(url, {'senha': 'password123'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert not Usuario.objects.filter(id_usuario=user.id_usuario).exists()
        assert not Comunidade.objects.filter(id_comunidade=community.id_comunidade).exists()
