from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models, transaction, IntegrityError
from django.utils.translation import gettext as _
from django.db.models.functions import Lower
import os
import uuid
import random
import string
import re
from django.core.mail import send_mail
from .serializers import RegisterSerializer, UserSerializer, UserUpdateSerializer, LogoutSerializer, RequestPasswordResetCodeSerializer, VerifyAndResetPasswordSerializer, ChangePasswordSerializer
from .models import PasswordResetCode
from .throttles import LoginRateThrottle, RegisterRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
import requests

User = get_user_model()


def _get_delete_account_community_scan(user):
    """Scan communities where the user is admin without N+1 queries.
    Returns (comunidades_para_transferir, comunidades_para_deletar_instances, comunidades_para_deletar_payload)."""
    from .models import MembroComunidade

    admin_memberships = list(
        MembroComunidade.objects.filter(usuario=user, role='admin').select_related('comunidade')
    )
    if not admin_memberships:
        return [], [], []

    community_map = {m.comunidade_id: m.comunidade for m in admin_memberships}
    community_ids = list(community_map.keys())

    all_members = list(
        MembroComunidade.objects.filter(comunidade_id__in=community_ids)
        .exclude(usuario=user)
        .select_related('usuario')
    )

    totals_map = {
        row['comunidade_id']: row['total_membros']
        for row in MembroComunidade.objects.filter(comunidade_id__in=community_ids)
        .values('comunidade_id')
        .annotate(total_membros=models.Count('id_membro'))
    }

    grouped = {}
    for membership in all_members:
        grouped.setdefault(membership.comunidade_id, []).append(membership)

    comunidades_para_transferir = []
    comunidades_para_deletar_instances = []
    comunidades_para_deletar_payload = []

    for community_id in community_ids:
        community = community_map[community_id]
        members = grouped.get(community_id, [])

        has_other_admin = any(m.role == 'admin' for m in members)
        if has_other_admin:
            continue

        moderators = [m for m in members if m.role == 'moderator']
        if moderators:
            comunidades_para_transferir.append({
                'id_comunidade': str(community.id_comunidade),
                'nome': community.nome,
                'moderadores': [
                    {
                        'id_usuario': str(m.usuario.id_usuario),
                        'nome_usuario': m.usuario.nome_usuario,
                        'nome_completo': m.usuario.nome_completo,
                        'avatar_url': m.usuario.avatar_url,
                    }
                    for m in moderators
                ]
            })
            continue

        total_membros = totals_map.get(community_id, 0)
        comunidades_para_deletar_instances.append(community)
        comunidades_para_deletar_payload.append({
            'id_comunidade': str(community.id_comunidade),
            'nome': community.nome,
            'total_membros': total_membros,
        })

    return comunidades_para_transferir, comunidades_para_deletar_instances, comunidades_para_deletar_payload

class SearchView(APIView):
    """Unified search endpoint for posts, users, and hashtags"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        search_type = request.query_params.get('type', 'all')
        limit = int(request.query_params.get('limit', 20))

        if not query:
            return Response({'results': {}, 'counts': {}}, status=status.HTTP_200_OK)

        results = {}
        counts = {}

        # Search Posts
        if search_type in ['all', 'posts']:
            posts = Publicacao.objects.filter(
                models.Q(conteudo_texto__icontains=query) | models.Q(titulo__icontains=query),
                visibilidade=1  # Only public posts
            ).annotate(
                engagement=Count('reacaopublicacao', distinct=True) + Count('comentario', distinct=True)
            ).order_by('-engagement')[:limit]
            results['posts'] = PublicacaoSerializer(posts, many=True, context={'request': request}).data
            counts['posts'] = len(results['posts'])

        # Search Users
        if search_type in ['all', 'users']:
            users = User.objects.filter(
                models.Q(nome_usuario__icontains=query) | models.Q(nome_completo__icontains=query)
            ).exclude(id_usuario=request.user.id_usuario)[:limit]
            results['users'] = UserSerializer(users, many=True, context={'request': request}).data
            counts['users'] = len(results['users'])

        # Search Hashtags
        if search_type in ['all', 'hashtags']:
            hashtags = Hashtag.objects.filter(
                texto_hashtag__istartswith=query.lstrip('#')
            ).order_by('-contagem_uso')[:limit]
            results['hashtags'] = HashtagSerializer(hashtags, many=True).data
            counts['hashtags'] = len(results['hashtags'])

        serializer = SearchSerializer(data={'results': results, 'counts': counts})
        serializer.is_valid()
        return Response(serializer.data)

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)
    throttle_classes = [RegisterRateThrottle]

class ChangePasswordView(generics.UpdateAPIView):
    """
    Endpoint para troca segura de senha para usuários logados.
    Requer a confirmação da senha atual.
    """
    serializer_class = ChangePasswordSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            # set_password is fully functional in AbstractBaseUser
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            # Quando a senha é alterada, é boa prática invalidar tokens
            # Não é estritamente obrigatório no DRF JWT se não tiver blacklist restrita para todos os devices,
            # mas vamos retornar sucesso para o front redirecionar caso ele queira deslogar o usuário ou algo do tipo
            return Response({'message': _('Senha alterada com sucesso.')}, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login view with rate limiting, ban check and age-gate interception."""
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        email = request.data.get('email')
        if email:
            try:
                user = User.objects.get(email=email)
                if user.status == 2:  # Suspenso/Banido
                    return Response({
                        'error': _('Conta banida'),
                        'message': _('Sua conta foi banida por tempo indeterminado devido a violação das regras da comunidade.'),
                        'banned': True
                    }, status=status.HTTP_403_FORBIDDEN)
            except User.DoesNotExist:
                pass  # Let the parent handle invalid credentials

        response = super().post(request, *args, **kwargs)

        # Após login bem-sucedido, retornar info de ausência de idade sem persistir em colunas deletadas
        if response.status_code == 200:
            try:
                user = User.objects.get(email=email)
                # Mantemos a flag 'pendente_idade' na resposta para manter o frontend legando funcionando
                response.data['pendente_idade'] = not bool(user.data_nascimento)
            except User.DoesNotExist:
                pass

        return response

class GoogleLoginView(APIView):
    """Handles Google OAuth login/registration with age-gate interception.
    Novos usuários e usuários legados sem data_nascimento recebem a flag
    pendente_idade=True e devem ser redirecionados para /complete-registration."""
    permission_classes = (permissions.AllowAny,)
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        access_token = request.data.get('access_token')
        if not access_token:
            return Response({'error': _('Token não fornecido.')}, status=status.HTTP_400_BAD_REQUEST)

        # Buscar informações do usuário no Google
        google_response = requests.get(
            f'https://www.googleapis.com/oauth2/v3/userinfo?access_token={access_token}'
        )
        if not google_response.ok:
            return Response({'error': _('Token do Google inválido.')}, status=status.HTTP_400_BAD_REQUEST)

        user_info = google_response.json()
        email = user_info.get('email')
        nome_completo = user_info.get('name', '')

        if not email:
            return Response({'error': _('O e-mail não foi retornado pelo Google.')}, status=status.HTTP_400_BAD_REQUEST)

        is_new_user = False
        try:
            user = User.objects.get(email=email)
            if user.status == 2:  # Banido
                return Response({
                    'error': _('Conta banida'),
                    'message': _('Sua conta foi banida por tempo indeterminado devido a violação das regras da comunidade.'),
                    'banned': True
                }, status=status.HTTP_403_FORBIDDEN)

            # Usuário legado não quebra, flag enviada apenas via Response depois.
        except User.DoesNotExist:
            # Criar conta Google — inativa até fornecer data de nascimento
            is_new_user = True
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            while User.objects.filter(nome_usuario=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            user = User.objects.create_user(
                nome_usuario=username,
                email=email,
                nome_completo=nome_completo
            )

        # Gerar tokens JWT
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user, context={'request': request}).data,
            'pendente_idade': not bool(user.data_nascimento),
            'is_new_user': is_new_user,
        })


class DeleteAccountPreCheckView(APIView):
    """Verifica a situação das comunidades do usuário antes da exclusão da conta.
    Retorna quais comunidades precisam de transferência de admin e quais serão deletadas."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        comunidades_para_transferir, _, comunidades_para_deletar = _get_delete_account_community_scan(request.user)

        return Response({
            'can_proceed': len(comunidades_para_transferir) == 0,
            'comunidades_para_transferir': comunidades_para_transferir,
            'comunidades_para_deletar': comunidades_para_deletar,
        })


class DeleteAccountView(APIView):
    """Permite que o próprio usuário exclua sua conta de forma permanente.
    Exigido pela LGPD, Art. 18, VI — direito à eliminação dos dados pessoais.
    Logs de moderação são preservados conforme o Art. 15 do Marco Civil."""
    permission_classes = (permissions.IsAuthenticated,)

    def delete(self, request):
        from django.contrib.auth.hashers import check_password

        # Exige confirmação da senha atual (ou flag 'confirmar' para contas Google sem senha)
        senha_confirmacao = request.data.get('senha')
        confirmar = request.data.get('confirmar', False)

        user = request.user

        # Se o usuário tem senha, exigir confirmação
        if user.has_usable_password():
            if not senha_confirmacao:
                return Response(
                    {'error': _('A confirmação de senha é obrigatória.')},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not check_password(senha_confirmacao, user.password):
                return Response(
                    {'error': _('Senha incorreta. A conta não foi excluída.')},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            # Conta Google: exigir flag de confirmação explícita
            if not confirmar:
                return Response(
                    {'error': _('Confirmação explícita necessária para excluir a conta.')},
                    status=status.HTTP_400_BAD_REQUEST
                )

        with transaction.atomic():
            comunidades_para_transferir, comunidades_para_deletar, _ = _get_delete_account_community_scan(user)

            if comunidades_para_transferir:
                return Response(
                    {
                        'error': _('Você ainda é o único administrador de comunidades que possuem moderadores. '
                                    'Transfira a administração antes de excluir sua conta.'),
                        'requires_transfer': True,
                        'comunidades_para_transferir': comunidades_para_transferir,
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Deletar comunidades órfãs (sem moderadores)
            for community in comunidades_para_deletar:
                community.delete()

            # Invalidar tokens ativos
            try:
                refresh_token = request.data.get('refresh')
                if refresh_token:
                    from rest_framework_simplejwt.tokens import RefreshToken as RT
                    RT(refresh_token).blacklist()
            except Exception:
                pass  # Não bloquear a exclusão se o token já for inválido

            user.delete()  # CASCADE elimina posts, comentários, mensagens, etc.

        return Response(
            {'message': _('Sua conta e todos os seus dados foram excluídos permanentemente.')},
            status=status.HTTP_200_OK
        )


class DataExportView(APIView):
    """Exporta todos os dados do usuário autenticado em formato JSON.
    Exigido pela LGPD, Art. 18, V — direito à portabilidade dos dados."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        from .models import Publicacao, Comentario, Seguidor

        posts = list(Publicacao.objects.filter(usuario=user).values(
            'id_publicacao', 'titulo', 'conteudo_texto', 'data_sonho',
            'tipo_sonho', 'visibilidade', 'emocoes_sentidas', 'data_publicacao'
        ))

        comentarios = list(Comentario.objects.filter(usuario=user).values(
            'id_comentario', 'conteudo_texto', 'data_comentario', 'publicacao_id'
        ))

        seguindo = list(Seguidor.objects.filter(
            usuario_seguidor=user, status=1
        ).values('usuario_seguido__nome_usuario', 'data_seguimento'))

        data = {
            'perfil': {
                'nome_usuario': user.nome_usuario,
                'nome_completo': user.nome_completo,
                'email': user.email,
                'bio': user.bio,
                'data_nascimento': str(user.data_nascimento) if user.data_nascimento else None,
                'data_criacao': str(user.data_criacao),
                'aceite_termos_em': str(user.aceite_termos_em) if user.aceite_termos_em else None,
            },
            'publicacoes': posts,
            'comentarios': comentarios,
            'seguindo': seguindo,
        }

        from django.http import JsonResponse
        import json
        response = JsonResponse(data, json_dumps_params={'ensure_ascii': False, 'indent': 2})
        response['Content-Disposition'] = f'attachment; filename="lumem_dados_{user.nome_usuario}.json"'
        return response

class UserProfileView(APIView):
    """Get/update current authenticated user's profile"""
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        serializer = UserSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    def put(self, request):
        user = request.user
        data = request.data

        if 'nome_completo' in data:
            user.nome_completo = data['nome_completo']
        if 'nome_usuario' in data:
            new_username = data['nome_usuario']
            # Verificar se o username já está em uso por outro usuário
            if User.objects.filter(nome_usuario=new_username).exclude(id_usuario=user.id_usuario).exists():
                return Response(
                    {'nome_usuario': ['Este nome de usuário já está em uso.']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.nome_usuario = new_username
        if 'bio' in data:
            user.bio = data['bio']
        if 'data_nascimento' in data:
            user.data_nascimento = data['data_nascimento'] or None
        if 'avatar' in request.FILES:
            user.avatar_url = request.FILES['avatar']

        user.save()
        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data)

class UserDetailView(APIView):
    """Get or update a specific user's profile"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        serializer = UserSerializer(user, context={'request': request})
        data = serializer.data
        
        # Add follow_status for the requesting user
        if request.user.id_usuario != pk:
            from .models import Seguidor
            follow = Seguidor.objects.filter(
                usuario_seguidor=request.user,
                usuario_seguido=user
            ).first()
            if follow:
                if follow.status == 1:
                    data['follow_status'] = 'following'
                elif follow.status == 3:
                    data['follow_status'] = 'pending'
                else:
                    data['follow_status'] = 'none'
            else:
                data['follow_status'] = 'none'
        else:
            data['follow_status'] = None  # Own profile
        
        # Add ban info if user is banned
        if user.status == 2:
            # Try to find the most recent resolved report against this user
            from .models import Denuncia
            last_report = Denuncia.objects.filter(
                tipo_conteudo=3,  # User report
                id_conteudo=user.id_usuario,
                status_denuncia=3  # Resolved
            ).order_by('-data_resolucao').first()
            
            ban_reasons = {
                1: 'Conteúdo Inadequado',
                2: 'Assédio / Discurso de Ódio',
                3: 'Spam / Enganoso'
            }
            
            data['is_banned'] = True
            data['ban_reason'] = ban_reasons.get(last_report.motivo_denuncia, 'Violação das regras') if last_report else 'Violação das regras da comunidade'
        else:
            data['is_banned'] = False
        
        return Response(data)

    def put(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        
        # Only allow users to update their own profile
        if request.user.id_usuario != pk:
            return Response(
                {'error': _('Você só pode editar seu próprio perfil')},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(user, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        return self.put(request, pk)

class LogoutView(APIView):
    """Logout by blacklisting the refresh token"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': _('Logout realizado com sucesso')}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RequestPasswordResetCodeView(APIView):
    """Sends a 6-digit code to the user's email for password reset"""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = RequestPasswordResetCodeSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = User.objects.get(email__iexact=email)
            
            # Expire old codes
            PasswordResetCode.objects.filter(usuario=user, is_used=False).update(is_used=True)
            
            # Generate 6-digit code
            code = ''.join(random.choices(string.digits, k=6))
            
            # Save new code
            from django.utils import timezone
            PasswordResetCode.objects.create(
                usuario=user,
                code=code,
                expires_at=timezone.now() + timezone.timedelta(minutes=15)
            )
            
            # Send Email
            try:
                send_mail(
                    subject=_('Lumem - Código de Verificação'),
                    message=_('Seu código de verificação para redefinir a senha é: %(code)s. Ele é válido por 15 minutos.') % {'code': code},
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@lumem.com'),
                    recipient_list=[email],
                    fail_silently=True,
                )
            except Exception as e:
                print(f"Failed to send email: {e}")
                
            return Response(
                {'message': _('Código enviado com sucesso para o seu e-mail.')},
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VerifyAndResetPasswordView(APIView):
    """Verifies the code and resets the password"""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = VerifyAndResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'message': _('Senha redefinida com sucesso!')},
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AvatarUploadView(APIView):
    """Upload avatar image for authenticated user"""
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser,)

    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

    def post(self, request):
        if 'avatar' not in request.FILES:
            return Response(
                {'error': _('Nenhum arquivo enviado')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['avatar']
        
        # Validate file extension
        ext = file.name.split('.')[-1].lower()
        if ext not in self.ALLOWED_EXTENSIONS:
            return Response(
                {'error': _('Formato não permitido. Use: %(ext)s') % {'ext': ', '.join(self.ALLOWED_EXTENSIONS)}},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file size
        if file.size > self.MAX_FILE_SIZE:
            return Response(
                {'error': _('Arquivo muito grande. Máximo: 5MB')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create unique filename
        filename = f"avatar_{request.user.id_usuario}_{uuid.uuid4().hex[:8]}.{ext}"
        
        # Ensure avatars directory exists
        avatars_dir = os.path.join(settings.MEDIA_ROOT, 'avatars')
        os.makedirs(avatars_dir, exist_ok=True)
        
        # Delete old avatar file if it exists
        if request.user.avatar_url:
            old_path = os.path.join(settings.BASE_DIR, request.user.avatar_url.lstrip('/'))
            if os.path.isfile(old_path):
                try:
                    os.remove(old_path)
                except OSError:
                    pass  # Silently ignore if file can't be deleted
        
        # Save file
        filepath = os.path.join(avatars_dir, filename)
        with open(filepath, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)
        
        # Update user's avatar_url
        avatar_url = f"{settings.MEDIA_URL}avatars/{filename}"
        request.user.avatar_url = avatar_url
        request.user.save(update_fields=['avatar_url'])
        
        # Build absolute URL for response
        absolute_avatar_url = request.build_absolute_uri(avatar_url)
        
        return Response({
            'message': _('Avatar atualizado com sucesso'),
            'avatar_url': absolute_avatar_url
        }, status=status.HTTP_200_OK)


class SuggestedUsersView(APIView):
    """Get suggested users to follow"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from .models import Seguidor
        
        # Get IDs of users the current user already follows
        following_ids = Seguidor.objects.filter(
            usuario_seguidor=request.user, status=1
        ).values_list('usuario_seguido_id', flat=True)
        
        # Get users that the current user doesn't follow yet (excluding self)
        suggested = User.objects.exclude(
            id_usuario__in=list(following_ids) + [request.user.id_usuario]
        ).order_by('?')[:5]  # Random 5 users
        
        serializer = UserSerializer(suggested, many=True, context={'request': request})
        return Response(serializer.data)


# Dream (Publicacao) Views
from rest_framework import viewsets
from rest_framework.decorators import action
from .models import Publicacao, Seguidor, ReacaoPublicacao, Comentario, Hashtag, PublicacaoHashtag, PublicacaoSalva, PublicacaoMencao, ComentarioMencao
from .serializers import PublicacaoSerializer, PublicacaoCreateSerializer, SeguidorSerializer, HashtagSerializer, SearchSerializer, NotificacaoSerializer
from django.utils import timezone
from django.db.models import Count, Q

class PublicacaoViewSet(viewsets.ModelViewSet):
    """ViewSet for dream posts CRUD operations"""
    permission_classes = (permissions.IsAuthenticated,)
    MENTION_PATTERN = re.compile(r'(?<![\w@])@([A-Za-z0-9_]{1,50})\b')

    def _extract_mentioned_usernames(self, post):
        raw_text = f"{post.titulo or ''}\n{post.conteudo_texto or ''}"
        usernames = {
            match.group(1).lower()
            for match in self.MENTION_PATTERN.finditer(raw_text)
        }
        return list(usernames)[:20]

    def _resolve_mentioned_users(self, usernames):
        normalized = {u.lower() for u in usernames}
        if not normalized:
            return {}

        users = User.objects.filter(status=1).annotate(
            username_lower=Lower('nome_usuario')
        ).filter(username_lower__in=normalized)

        return {u.username_lower: u for u in users}

    def _sync_post_mentions(self, post):
        """Sync mention relationships for a post and notify newly mentioned users."""
        from .models import Bloqueio, Notificacao

        usernames = self._extract_mentioned_usernames(post)
        if not usernames:
            PublicacaoMencao.objects.filter(publicacao=post).delete()
            Notificacao.objects.filter(
                tipo_notificacao=7,
                id_referencia=str(post.id_publicacao),
                usuario_origem=post.usuario,
            ).delete()
            return

        users_map = self._resolve_mentioned_users(usernames)
        mentioned_users = [
            user for user in users_map.values()
            if user.id_usuario != post.usuario.id_usuario
        ]

        if not mentioned_users:
            PublicacaoMencao.objects.filter(publicacao=post).delete()
            Notificacao.objects.filter(
                tipo_notificacao=7,
                id_referencia=str(post.id_publicacao),
                usuario_origem=post.usuario,
            ).delete()
            return

        candidate_ids = {u.id_usuario for u in mentioned_users}
        block_rows = Bloqueio.objects.filter(
            Q(usuario=post.usuario, usuario_bloqueado_id__in=candidate_ids)
            | Q(usuario_id__in=candidate_ids, usuario_bloqueado=post.usuario)
        ).values_list('usuario_id', 'usuario_bloqueado_id')

        blocked_ids = set()
        for usuario_id, bloqueado_id in block_rows:
            if usuario_id == post.usuario.id_usuario:
                blocked_ids.add(bloqueado_id)
            else:
                blocked_ids.add(usuario_id)

        final_users = [u for u in mentioned_users if u.id_usuario not in blocked_ids]
        new_ids = {u.id_usuario for u in final_users}

        existing_mentions = PublicacaoMencao.objects.filter(publicacao=post)
        existing_ids = set(existing_mentions.values_list('usuario_mencionado_id', flat=True))

        ids_to_remove = existing_ids - new_ids
        ids_to_add = new_ids - existing_ids

        if ids_to_remove:
            PublicacaoMencao.objects.filter(
                publicacao=post,
                usuario_mencionado_id__in=ids_to_remove,
            ).delete()
            Notificacao.objects.filter(
                tipo_notificacao=7,
                id_referencia=str(post.id_publicacao),
                usuario_origem=post.usuario,
                usuario_destino_id__in=ids_to_remove,
            ).delete()

        users_by_id = {u.id_usuario: u for u in final_users}
        for user_id in ids_to_add:
            mentioned_user = users_by_id.get(user_id)
            if not mentioned_user:
                continue

            try:
                _, created = PublicacaoMencao.objects.get_or_create(
                    publicacao=post,
                    usuario_mencionado=mentioned_user,
                    defaults={'usuario_mencionador': post.usuario},
                )
            except IntegrityError:
                created = False

            if not created:
                continue
            create_notification(
                usuario_destino=mentioned_user,
                usuario_origem=post.usuario,
                tipo=7,
                id_referencia=post.id_publicacao,
                conteudo=post.titulo or post.conteudo_texto[:80],
            )
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PublicacaoCreateSerializer
        return PublicacaoSerializer
    
    def get_serializer_context(self):
        return {'request': self.request}

    def list(self, request, *args, **kwargs):
        """
        Override para interceptar tab=foryou e usar o algoritmo personalizado.
        Para outras tabs, delega ao fluxo padrão do DRF.
        """
        tab = request.query_params.get('tab', 'following')

        if tab == 'foryou' and request.user.is_authenticated:
            from .feed_algorithm import get_foryou_feed
            import logging
            _log = logging.getLogger(__name__)

            try:
                page = int(request.query_params.get('page', 1))
            except (ValueError, TypeError):
                page = 1

            try:
                post_ids, has_more = get_foryou_feed(request.user, page=page, page_size=15)
            except Exception as exc:
                _log.error(
                    'Erro ao gerar foryou feed para user %s: %s',
                    request.user.id_usuario, exc, exc_info=True
                )
                return Response({'results': [], 'page': page, 'has_more': False})

            if not post_ids:
                return Response({'results': [], 'page': page, 'has_more': False})

            try:
                # Re-buscar pelo queryset anotado para preservar is_liked, is_saved, etc.
                qs = self.get_queryset().filter(id_publicacao__in=post_ids)

                # Preservar a ordem definida pelo algoritmo (score DESC)
                ordering = {pid: idx for idx, pid in enumerate(post_ids)}
                posts = sorted(qs, key=lambda p: ordering.get(p.id_publicacao, 999))

                serializer = self.get_serializer(posts, many=True)
                return Response({
                    'results': serializer.data,
                    'page': page,
                    'has_more': has_more,
                })
            except Exception as exc:
                _log.error(
                    'Erro ao serializar foryou feed para user %s: %s',
                    request.user.id_usuario, exc, exc_info=True
                )
                return Response({'results': [], 'page': page, 'has_more': False})

        return super().list(request, *args, **kwargs)
    
    def get_queryset(self):
        """Return dreams based on tab parameter: following or foryou"""
        user = self.request.user
        qs = Publicacao.objects.none()

        if user.is_authenticated:
            following_ids = Seguidor.objects.filter(
                usuario_seguidor=user, status=1
            ).values_list('usuario_seguido_id', flat=True)

            from .models import Bloqueio
            blocked_user_ids = Bloqueio.objects.filter(
                usuario=user).values_list('usuario_bloqueado_id', flat=True)

            privacy_filter = (
                Q(usuario__privacidade_padrao=1) |
                Q(usuario__in=following_ids) |
                Q(usuario=user)
            )
            base_filter = Q(usuario__status=1) & ~Q(usuario__in=blocked_user_ids) & privacy_filter
            visibility_q = (
                Q(visibilidade=1) |
                (Q(visibilidade=2) & Q(usuario__in=following_ids)) |
                Q(usuario=user)
            )
        else:
            following_ids = []
            base_filter = Q(usuario__status=1, usuario__privacidade_padrao=1)
            visibility_q = Q(visibilidade=1)

        if self.action == 'list':
            tab = self.request.query_params.get('tab', 'following')
            
            if tab == 'mine' and user.is_authenticated:
                qs = Publicacao.objects.filter(usuario=user).order_by('-data_publicacao')

            elif tab == 'saved' and user.is_authenticated:
                qs = Publicacao.objects.filter(
                    base_filter, visibility_q, publicacaosalva__usuario=user
                ).order_by('-publicacaosalva__data_salvo')
            
            elif tab == 'community':
                community_id = self.request.query_params.get('community_id')
                if community_id:
                    qs = Publicacao.objects.filter(
                        base_filter, visibility_q, comunidade_id=community_id
                    ).order_by('-data_publicacao')

            elif tab == 'my_community_posts' and user.is_authenticated:
                qs = Publicacao.objects.filter(
                    usuario=user, comunidade__isnull=False
                ).order_by('-data_publicacao')

            elif tab == 'user_posts':
                user_id = self.request.query_params.get('user_id')
                if user_id:
                    from django.shortcuts import get_object_or_404
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    target_user = get_object_or_404(User, pk=user_id)
                    is_private = target_user.privacidade_padrao == 2
                    is_following = target_user.pk in following_ids
                    is_self = target_user.pk == user.pk if user.is_authenticated else False
                    if not (is_private and not is_following and not is_self):
                        qs = Publicacao.objects.filter(
                            base_filter, visibility_q, usuario_id=user_id, comunidade__isnull=True
                        ).order_by('-data_publicacao')

            elif tab == 'user_community_posts':
                user_id = self.request.query_params.get('user_id')
                if user_id:
                    from django.shortcuts import get_object_or_404
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    target_user = get_object_or_404(User, pk=user_id)
                    is_private = target_user.privacidade_padrao == 2
                    is_following = target_user.pk in following_ids
                    is_self = target_user.pk == user.pk if user.is_authenticated else False
                    if not (is_private and not is_following and not is_self):
                        qs = Publicacao.objects.filter(
                            base_filter, visibility_q, usuario_id=user_id, comunidade__isnull=False
                        ).order_by('-data_publicacao')

            elif tab == 'user_media':
                user_id = self.request.query_params.get('user_id')
                media_filter = (Q(imagem__isnull=False) & ~Q(imagem='')) | (Q(video__isnull=False) & ~Q(video=''))
                if user_id:
                    from django.shortcuts import get_object_or_404
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    target_user = get_object_or_404(User, pk=user_id)
                    is_private = target_user.privacidade_padrao == 2
                    is_following = target_user.pk in following_ids
                    is_self = target_user.pk == user.pk if user.is_authenticated else False
                    if not (is_private and not is_following and not is_self):
                        qs = Publicacao.objects.filter(
                            base_filter, visibility_q, usuario_id=user_id
                        ).filter(media_filter).order_by('-data_publicacao')
                elif user.is_authenticated:
                    qs = Publicacao.objects.filter(usuario=user).filter(media_filter).order_by('-data_publicacao')

            elif tab == 'foryou':
                # O list() já ordena via algoritmo — não precisamos de
                # engagement annotation aqui (evita conflito com
                # annotated_likes_count que também usa Count('reacaopublicacao')).
                from .models import Silenciamento as _Silenciamento  # evita UnboundLocalError
                muted_ids = []
                if user.is_authenticated:
                    muted_ids = list(
                        _Silenciamento.objects.filter(
                            usuario=user
                        ).values_list('usuario_silenciado_id', flat=True)
                    )

                qs = Publicacao.objects.filter(
                    base_filter, visibilidade=1
                ).exclude(
                    usuario__in=muted_ids
                )

            
            else:
                if user.is_authenticated:
                    qs = Publicacao.objects.filter(
                        base_filter, visibility_q, Q(usuario__in=following_ids) | Q(usuario=user)
                    ).order_by('-data_publicacao')
                else:
                    qs = Publicacao.objects.filter(
                        base_filter, visibility_q
                    ).order_by('-data_publicacao')
        else:
            qs = Publicacao.objects.filter(base_filter, visibility_q).distinct()

        # N+1 Optimization logic: select_related, prefetch_related, and annotations
        from django.db.models import Prefetch, Exists, OuterRef
        from django.contrib.auth import get_user_model
        from .models import Bloqueio, Silenciamento, ReacaoPublicacao, PublicacaoSalva

        User = get_user_model()
        qs = qs.select_related('comunidade')

        user_qs = User.objects.annotate(
            annotated_seguidores_count=Count('seguidores', filter=Q(seguidores__status=1), distinct=True),
            annotated_seguindo_count=Count('seguindo', filter=Q(seguindo__status=1), distinct=True)
        )

        if user.is_authenticated:
            user_qs = user_qs.annotate(
                annotated_is_following=Exists(
                    Seguidor.objects.filter(usuario_seguidor=user, usuario_seguido=OuterRef('pk'), status=1)
                ),
                annotated_is_blocked=Exists(
                    Bloqueio.objects.filter(usuario=user, usuario_bloqueado=OuterRef('pk'))
                ),
                annotated_is_muted=Exists(
                    Silenciamento.objects.filter(usuario=user, usuario_silenciado=OuterRef('pk'))
                )
            )
            qs = qs.annotate(
                annotated_is_liked=Exists(
                    ReacaoPublicacao.objects.filter(publicacao=OuterRef('pk'), usuario=user)
                ),
                annotated_is_saved=Exists(
                    PublicacaoSalva.objects.filter(publicacao=OuterRef('pk'), usuario=user)
                )
            )

        qs = qs.annotate(
            annotated_likes_count=Count('reacaopublicacao', distinct=True),
            annotated_comentarios_count=Count('comentario', filter=Q(comentario__status=1), distinct=True)
        ).prefetch_related(
            Prefetch('usuario', queryset=user_qs)
        )

        return qs
    
    @action(detail=False, methods=['get'])
    def algorithm(self, request):
        """
        Endpoint reservado para o futuro algoritmo de recomendação de feed.
        Atualmente retorna a mesma lógica da aba 'foryou' (baseado em engajamento).
        URL acessível via: GET /api/dreams/algorithm/
        """
        queryset = self.get_queryset().filter(
            visibilidade=1
        ).annotate(
            engagement=Count('reacaopublicacao', distinct=True) + Count('comentario', distinct=True)
        ).order_by('-engagement', '-data_publicacao')
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path=r'hashtag/(?P<hashtag>[^/.]+)')
    def by_hashtag(self, request, hashtag=None):
        """
        Retorna o feed de publicações associadas a uma hashtag específica.
        URL acessível via: GET /api/dreams/hashtag/<hashtag>/
        """
        if not hashtag:
            return Response([])
            
        queryset = self.get_queryset().filter(
            publicacaohashtag__hashtag__texto_hashtag__iexact=hashtag
        ).order_by('-data_publicacao')
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        post = serializer.save(usuario=self.request.user)
        
        # Extract hashtags
        hashtags = re.findall(r'#(\w+)', post.conteudo_texto)
        
        for tag_text in set(hashtags):
            hashtag, created = Hashtag.objects.get_or_create(texto_hashtag=tag_text)
            if not created:
                hashtag.contagem_uso += 1
                hashtag.ultima_utilizacao = timezone.now()
                hashtag.save()
            
            PublicacaoHashtag.objects.create(
                publicacao=post,
                hashtag=hashtag
            )

        self._sync_post_mentions(post)

        # Computar embedding semântico via Celery (async, não bloqueia a resposta)
        from .tasks import compute_post_embedding_task
        compute_post_embedding_task.delay(str(post.id_publicacao))
    
    def perform_update(self, serializer):
        post = serializer.save(editado=True, data_edicao=timezone.now())
        self._sync_post_mentions(post)
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.usuario.id_usuario != request.user.id_usuario:
            return Response(
                {'error': _('Você só pode editar seus próprios sonhos')},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        
        # Determine if user is authorized to delete the post
        is_author = instance.usuario.id_usuario == user.id_usuario
        is_community_mod = False
        
        if instance.comunidade:
            from .models import MembroComunidade
            is_community_mod = MembroComunidade.objects.filter(
                comunidade=instance.comunidade,
                usuario=user,
                role__in=['moderator', 'admin']
            ).exists()
            
        if not (is_author or is_community_mod or user.is_admin):
            return Response(
                {'error': _('Você não tem permissão para excluir esta publicação')},
                status=status.HTTP_403_FORBIDDEN
            )
            
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """Toggle like on a dream post"""
        dream = self.get_object()
        existing_like = ReacaoPublicacao.objects.filter(
            publicacao=dream,
            usuario=request.user
        ).first()

        if existing_like:
            existing_like.delete()
            is_liked = False
        else:
            ReacaoPublicacao.objects.create(
                publicacao=dream,
                usuario=request.user
            )
            is_liked = True
            # Create notification for like (tipo 3 = Curtida)
            from .views import create_notification
            create_notification(
                usuario_destino=dream.usuario,
                usuario_origem=request.user,
                tipo=3,
                id_referencia=dream.id_publicacao,
                conteudo=dream.titulo or dream.conteudo_texto[:50]
            )

        likes_count = ReacaoPublicacao.objects.filter(publicacao=dream).count()

        return Response({
            'is_liked': is_liked,
            'likes_count': likes_count
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='save')
    def save_post(self, request, pk=None):
        """Toggle save on a dream post"""
        dream = self.get_object()
        existing_save = PublicacaoSalva.objects.filter(
            publicacao=dream,
            usuario=request.user
        ).first()

        if existing_save:
            existing_save.delete()
            is_saved = False
            message = _('Post removido dos salvos')
        else:
            PublicacaoSalva.objects.create(
                publicacao=dream,
                usuario=request.user
            )
            is_saved = True
            message = _('Post salvo com sucesso')

        return Response({
            'is_saved': is_saved,
            'message': message
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def view(self, request, pk=None):
        """
        Registra que o usuário viu este post no feed.
        Incrementa views_count e cria registro de PostVisto para deduplicação.
        URL: POST /api/dreams/{id}/view/
        """
        from .models import PostVisto

        post = self.get_object()

        # Incremento atômico do contador de views
        Publicacao.objects.filter(pk=pk).update(views_count=F('views_count') + 1)

        # Registrar visualização para deduplicação no feed
        if request.user.is_authenticated:
            PostVisto.objects.get_or_create(
                usuario=request.user,
                publicacao=post
            )

        # Retornar o valor atualizado do banco (Fix #5: sem valor stale)
        post.refresh_from_db(fields=['views_count'])
        return Response({'views_count': post.views_count}, status=status.HTTP_200_OK)


class RascunhoViewSet(viewsets.ModelViewSet):
    """ViewSet para gerenciar rascunhos de publicações"""
    from .serializers import RascunhoSerializer
    from .models import Rascunho
    
    serializer_class = RascunhoSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        from .models import Rascunho
        return Rascunho.objects.filter(usuario=self.request.user).order_by('-data_atualizacao')

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

class FollowView(APIView):
    """Views for following/unfollowing users"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        """Follow a user"""
        user_to_follow = get_object_or_404(User, pk=pk)
        
        # Can't follow yourself
        if request.user.id_usuario == pk:
            return Response(
                {'error': _('Você não pode seguir a si mesmo')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Can't follow a blocked user or a user who blocked you
        from .models import Bloqueio
        if Bloqueio.objects.filter(
            Q(usuario=request.user, usuario_bloqueado=user_to_follow) |
            Q(usuario=user_to_follow, usuario_bloqueado=request.user)
        ).exists():
            return Response(
                {'error': _('Não é possível seguir este usuário')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already following or pending
        existing = Seguidor.objects.filter(
            usuario_seguidor=request.user,
            usuario_seguido=user_to_follow
        ).first()
        
        if existing:
            if existing.status == 1:
                return Response(
                    {'error': _('Você já está seguindo este usuário')},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if existing.status == 3:
                return Response(
                    {'error': _('Solicitação já enviada'), 'follow_status': 'pending'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Reactivate if was blocked/inactive - check privacy
            if user_to_follow.privacidade_padrao == 2:
                existing.status = 3  # Pending for private accounts
                existing.data_seguimento = timezone.now()
                existing.save()
                return Response({
                    'message': _('Solicitação enviada para %(username)s') % {'username': user_to_follow.nome_usuario},
                    'follow_status': 'pending'
                }, status=status.HTTP_200_OK)
            else:
                existing.status = 1
                existing.save()
        else:
            # Determine status based on target's privacy setting
            if user_to_follow.privacidade_padrao == 2:
                # Private account: create pending follow request
                Seguidor.objects.create(
                    usuario_seguidor=request.user,
                    usuario_seguido=user_to_follow,
                    status=3  # Pendente
                )
                # Create notification for follow request (tipo 5 = Solicitação de Seguidor)
                from .views import create_notification
                create_notification(
                    usuario_destino=user_to_follow,
                    usuario_origem=request.user,
                    tipo=5  # New type for follow request
                )
                return Response({
                    'message': _('Solicitação enviada para %(username)s') % {'username': user_to_follow.nome_usuario},
                    'follow_status': 'pending'
                }, status=status.HTTP_200_OK)
            else:
                # Public account: follow immediately
                Seguidor.objects.create(
                    usuario_seguidor=request.user,
                    usuario_seguido=user_to_follow,
                    status=1
                )
        
        # Create notification for new follower (tipo 4 = Seguidor Novo)
        from .views import create_notification
        create_notification(
            usuario_destino=user_to_follow,
            usuario_origem=request.user,
            tipo=4
        )
        
        return Response({
            'message': _('Você agora está seguindo %(username)s') % {'username': user_to_follow.nome_usuario},
            'follow_status': 'following'
        }, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        """Unfollow a user or cancel pending request"""
        user_to_unfollow = get_object_or_404(User, pk=pk)
        
        follow = Seguidor.objects.filter(
            usuario_seguidor=request.user,
            usuario_seguido=user_to_unfollow,
            status__in=[1, 3]  # Active or Pending
        ).first()
        
        if not follow:
            return Response(
                {'error': _('Você não está seguindo este usuário')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        was_pending = follow.status == 3
        follow.delete()
        
        return Response({
            'message': _('Você deixou de seguir %(username)s') % {'username': user_to_unfollow.nome_usuario} if not was_pending else _('Solicitação cancelada'),
            'follow_status': 'none'
        }, status=status.HTTP_200_OK)


class UserFollowersView(APIView):
    """List followers of a user, respecting privacy settings"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        target_user = get_object_or_404(User, pk=pk)
        is_own = request.user.id_usuario == pk

        # Privacy check: private accounts restrict list to owner or active followers
        if not is_own and target_user.privacidade_padrao == 2:
            is_follower = Seguidor.objects.filter(
                usuario_seguidor=request.user,
                usuario_seguido=target_user,
                status=1
            ).exists()
            if not is_follower:
                return Response(
                    {'error': _('Esta conta é privada. Apenas seguidores aprovados podem ver esta lista.')},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Get active followers
        follower_relations = Seguidor.objects.filter(
            usuario_seguido=target_user,
            status=1
        ).select_related('usuario_seguidor')

        # IDs the requesting user follows (for is_following flag)
        my_following_ids = set(
            Seguidor.objects.filter(
                usuario_seguidor=request.user, status=1
            ).values_list('usuario_seguido_id', flat=True)
        )

        data = []
        for rel in follower_relations:
            u = rel.usuario_seguidor
            data.append({
                'id_usuario': u.id_usuario,
                'nome_usuario': u.nome_usuario,
                'nome_completo': u.nome_completo,
                'avatar_url': u.avatar_url,
                'is_following': u.id_usuario in my_following_ids,
            })

        return Response(data)


class UserFollowingView(APIView):
    """List users that a user is following, respecting privacy settings"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        target_user = get_object_or_404(User, pk=pk)
        is_own = request.user.id_usuario == pk

        # Privacy check
        if not is_own and target_user.privacidade_padrao == 2:
            is_follower = Seguidor.objects.filter(
                usuario_seguidor=request.user,
                usuario_seguido=target_user,
                status=1
            ).exists()
            if not is_follower:
                return Response(
                    {'error': _('Esta conta é privada. Apenas seguidores aprovados podem ver esta lista.')},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Get users the target is actively following
        following_relations = Seguidor.objects.filter(
            usuario_seguidor=target_user,
            status=1
        ).select_related('usuario_seguido')

        my_following_ids = set(
            Seguidor.objects.filter(
                usuario_seguidor=request.user, status=1
            ).values_list('usuario_seguido_id', flat=True)
        )

        data = []
        for rel in following_relations:
            u = rel.usuario_seguido
            data.append({
                'id_usuario': u.id_usuario,
                'nome_usuario': u.nome_usuario,
                'nome_completo': u.nome_completo,
                'avatar_url': u.avatar_url,
                'is_following': u.id_usuario in my_following_ids,
            })

        return Response(data)


class BlockView(APIView):
    """Views for blocking/unblocking users"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        """Block a user"""
        user_to_block = get_object_or_404(User, pk=pk)
        
        if request.user.id_usuario == pk:
            return Response({'error': _('Você não pode bloquear a si mesmo')}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if already blocked
        from .models import Bloqueio
        if Bloqueio.objects.filter(usuario=request.user, usuario_bloqueado=user_to_block).exists():
            return Response({'message': _('Usuário já está bloqueado')}, status=status.HTTP_200_OK)
        
        # Create block
        Bloqueio.objects.create(usuario=request.user, usuario_bloqueado=user_to_block)
        
        # Also unfollow if following
        Seguidor.objects.filter(usuario_seguidor=request.user, usuario_seguido=user_to_block).delete()
        Seguidor.objects.filter(usuario_seguidor=user_to_block, usuario_seguido=request.user).delete()
        
        return Response({'message': _('Você bloqueou %(username)s') % {'username': user_to_block.nome_usuario}}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        """Unblock a user"""
        user_to_unblock = get_object_or_404(User, pk=pk)
        
        from .models import Bloqueio
        deleted, _ = Bloqueio.objects.filter(usuario=request.user, usuario_bloqueado=user_to_unblock).delete()
        
        if not deleted:
            return Response({'error': _('Este usuário não está bloqueado')}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({'message': _('Você desbloqueou %(username)s') % {'username': user_to_unblock.nome_usuario}}, status=status.HTTP_200_OK)


class MuteView(APIView):
    """Views for muting/unmuting users"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        """Mute a user"""
        user_to_mute = get_object_or_404(User, pk=pk)
        
        if request.user.id_usuario == pk:
            return Response({'error': _('Você não pode silenciar a si mesmo')}, status=status.HTTP_400_BAD_REQUEST)
        
        from .models import Silenciamento
        if Silenciamento.objects.filter(usuario=request.user, usuario_silenciado=user_to_mute).exists():
            return Response({'message': _('Usuário já está silenciado')}, status=status.HTTP_200_OK)
        
        Silenciamento.objects.create(usuario=request.user, usuario_silenciado=user_to_mute)
        
        return Response({'message': _('Você silenciou %(username)s') % {'username': user_to_mute.nome_usuario}}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        """Unmute a user"""
        user_to_unmute = get_object_or_404(User, pk=pk)
        
        from .models import Silenciamento
        deleted, _ = Silenciamento.objects.filter(usuario=request.user, usuario_silenciado=user_to_unmute).delete()
        
        if not deleted:
            return Response({'error': _('Este usuário não está silenciado')}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({'message': _('Você deixou de silenciar %(username)s') % {'username': user_to_unmute.nome_usuario}}, status=status.HTTP_200_OK)


class FollowRequestsView(APIView):
    """Get pending follow requests for the current user"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        pending_requests = Seguidor.objects.filter(
            usuario_seguido=request.user,
            status=3  # Pendente
        ).order_by('-data_seguimento')
        
        data = []
        for req in pending_requests:
            user = req.usuario_seguidor
            data.append({
                'id_usuario': user.id_usuario,
                'nome_usuario': user.nome_usuario,
                'nome_completo': user.nome_completo,
                'avatar_url': request.build_absolute_uri(user.avatar_url) if user.avatar_url else None,
                'data_solicitacao': req.data_seguimento.isoformat(),
            })
        
        return Response(data)


class FollowRequestActionView(APIView):
    """Accept or reject a pending follow request"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        action = request.data.get('action')  # 'accept' or 'reject'
        
        # Find the pending follow request
        follow_request = Seguidor.objects.filter(
            usuario_seguidor_id=pk,
            usuario_seguido=request.user,
            status=3  # Pendente
        ).first()
        
        if not follow_request:
            return Response(
                {'error': _('Solicitação não encontrada')},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if action == 'accept':
            follow_request.status = 1  # Ativo
            follow_request.save()
            
            # Create notification for follower that request was accepted
            create_notification(
                usuario_destino=follow_request.usuario_seguidor,
                usuario_origem=request.user,
                tipo=4,  # Seguidor Novo (they are now following)
                conteudo='aceitou sua solicitação de seguir'
            )
            
            return Response({
                'message': _('Solicitação aceita'),
                'status': 'accepted'
            }, status=status.HTTP_200_OK)
        
        elif action == 'reject':
            follow_request.delete()
            return Response({
                'message': _('Solicitação recusada'),
                'status': 'rejected'
            }, status=status.HTTP_200_OK)
        
        return Response(
            {'error': _('Ação inválida. Use "accept" ou "reject"')},
            status=status.HTTP_400_BAD_REQUEST
        )

# Comments ViewSet
from .serializers import ComentarioSerializer, ComentarioCreateSerializer

class ComentarioViewSet(viewsets.ModelViewSet):
    """ViewSet for comments on dream posts - Twitter-like"""
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser,)
    MENTION_PATTERN = re.compile(r'(?<![\w@])@([A-Za-z0-9_]{1,50})\b')

    def _extract_mentioned_usernames(self, comment):
        raw_text = comment.conteudo_texto or ''
        usernames = {
            match.group(1).lower()
            for match in self.MENTION_PATTERN.finditer(raw_text)
        }
        return list(usernames)[:20]

    def _resolve_mentioned_users(self, usernames):
        normalized = {u.lower() for u in usernames}
        if not normalized:
            return {}

        users = User.objects.filter(status=1).annotate(
            username_lower=Lower('nome_usuario')
        ).filter(username_lower__in=normalized)

        return {u.username_lower: u for u in users}

    def _comment_reference(self, comment):
        return f"{comment.publicacao_id}::{comment.id_comentario}"

    def _sync_comment_mentions(self, comment):
        from .models import Bloqueio, Notificacao

        usernames = self._extract_mentioned_usernames(comment)
        reference = self._comment_reference(comment)

        if not usernames:
            ComentarioMencao.objects.filter(comentario=comment).delete()
            Notificacao.objects.filter(
                tipo_notificacao=7,
                id_referencia=reference,
                usuario_origem=comment.usuario,
            ).delete()
            return

        users_map = self._resolve_mentioned_users(usernames)
        mentioned_users = [
            user for user in users_map.values()
            if user.id_usuario != comment.usuario.id_usuario
        ]

        if not mentioned_users:
            ComentarioMencao.objects.filter(comentario=comment).delete()
            Notificacao.objects.filter(
                tipo_notificacao=7,
                id_referencia=reference,
                usuario_origem=comment.usuario,
            ).delete()
            return

        candidate_ids = {u.id_usuario for u in mentioned_users}
        block_rows = Bloqueio.objects.filter(
            Q(usuario=comment.usuario, usuario_bloqueado_id__in=candidate_ids)
            | Q(usuario_id__in=candidate_ids, usuario_bloqueado=comment.usuario)
        ).values_list('usuario_id', 'usuario_bloqueado_id')

        blocked_ids = set()
        for usuario_id, bloqueado_id in block_rows:
            if usuario_id == comment.usuario.id_usuario:
                blocked_ids.add(bloqueado_id)
            else:
                blocked_ids.add(usuario_id)

        final_users = [u for u in mentioned_users if u.id_usuario not in blocked_ids]
        new_ids = {u.id_usuario for u in final_users}

        existing_mentions = ComentarioMencao.objects.filter(comentario=comment)
        existing_ids = set(existing_mentions.values_list('usuario_mencionado_id', flat=True))

        ids_to_remove = existing_ids - new_ids
        ids_to_add = new_ids - existing_ids

        if ids_to_remove:
            ComentarioMencao.objects.filter(
                comentario=comment,
                usuario_mencionado_id__in=ids_to_remove,
            ).delete()
            Notificacao.objects.filter(
                tipo_notificacao=7,
                id_referencia=reference,
                usuario_origem=comment.usuario,
                usuario_destino_id__in=ids_to_remove,
            ).delete()

        users_by_id = {u.id_usuario: u for u in final_users}
        for user_id in ids_to_add:
            mentioned_user = users_by_id.get(user_id)
            if not mentioned_user:
                continue

            try:
                _, created = ComentarioMencao.objects.get_or_create(
                    comentario=comment,
                    usuario_mencionado=mentioned_user,
                    defaults={'usuario_mencionador': comment.usuario},
                )
            except IntegrityError:
                created = False

            if not created:
                continue

            create_notification(
                usuario_destino=mentioned_user,
                usuario_origem=comment.usuario,
                tipo=7,
                id_referencia=reference,
                conteudo=comment.conteudo_texto[:80] if comment.conteudo_texto else _('comentou e mencionou você'),
            )
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ComentarioCreateSerializer
        return ComentarioSerializer
    
    def get_serializer_context(self):
        return {'request': self.request, 'depth': 0}
    
    def get_queryset(self):
        """Return comments for a specific dream with optional ordering"""
        dream_id = self.kwargs.get('dream_pk')
        if not dream_id:
            return Comentario.objects.none()
        
        # Base queryset: all active comments for this dream
        base_queryset = Comentario.objects.filter(
            publicacao_id=dream_id,
            status=1
        )
        
        # For detail actions (retrieve, update, destroy), return ALL comments
        # This allows deleting/editing nested replies, not just root comments
        if self.action in ['retrieve', 'update', 'partial_update', 'destroy', 'like']:
            return base_queryset
        
        # For list action, only return root comments (children are nested in serializer)
        queryset = base_queryset.filter(comentario_pai__isnull=True)
        
        # Handle ordering parameter
        ordering = self.request.query_params.get('ordering', 'recent')
        
        if ordering == 'relevance':
            # Order by engagement (likes + replies)
            from django.db.models import Count
            queryset = queryset.annotate(
                engagement=Count('reacaocomentario', distinct=True) + Count('respostas', distinct=True)
            ).order_by('-engagement', '-data_comentario')
        elif ordering == 'likes':
            # Order by like count
            from django.db.models import Count
            queryset = queryset.annotate(
                like_count=Count('reacaocomentario')
            ).order_by('-like_count', '-data_comentario')
        else:  # 'recent' is default
            queryset = queryset.order_by('-data_comentario')
        
        return queryset
    
    def perform_create(self, serializer):
        dream_id = self.kwargs.get('dream_pk')
        dream = get_object_or_404(Publicacao, pk=dream_id)
        comment = serializer.save(usuario=self.request.user, publicacao=dream)
        
        # Create notification
        if comment.comentario_pai:
            # It's a reply - notify the comment author
            if comment.comentario_pai.usuario.id_usuario != self.request.user.id_usuario:
                content = comment.conteudo_texto[:50] if comment.conteudo_texto else "enviou uma mídia"
                create_notification(
                    usuario_destino=comment.comentario_pai.usuario,
                    usuario_origem=self.request.user,
                    tipo=2,
                    id_referencia=dream.id_publicacao,
                    conteudo=f"respondeu seu comentário: {content}"
                )
        else:
            # It's a root comment - notify the post owner
            if dream.usuario.id_usuario != self.request.user.id_usuario:
                content = comment.conteudo_texto[:100] if comment.conteudo_texto else "enviou uma mídia"
                create_notification(
                    usuario_destino=dream.usuario,
                    usuario_origem=self.request.user,
                    tipo=2,
                    id_referencia=dream.id_publicacao,
                    conteudo=content
                )

        self._sync_comment_mentions(comment)

    def perform_update(self, serializer):
        comment = serializer.save(editado=True, data_edicao=timezone.now())
        self._sync_comment_mentions(comment)
    
    def create(self, request, *args, **kwargs):
        """Override create to return full serialized comment"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Return full comment data with all fields, using the instance just created
        comment = serializer.instance
        
        response_serializer = ComentarioSerializer(comment, context={'request': request, 'depth': 0})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.usuario.id_usuario != request.user.id_usuario:
            return Response(
                {'error': _('Você só pode editar seus próprios comentários')},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.usuario.id_usuario != request.user.id_usuario:
            return Response(
                {'error': _('Você só pode excluir seus próprios comentários')},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Soft-delete all nested replies recursively
        def soft_delete_replies(comment):
            for reply in comment.respostas.filter(status=1):
                soft_delete_replies(reply)
                reply.status = 0
                reply.save(update_fields=['status'])
        
        soft_delete_replies(instance)
        
        # Soft-delete the comment itself
        instance.status = 0
        instance.save(update_fields=['status'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def react(self, request, dream_pk=None, pk=None):
        """Toggle or change a reaction on a comment"""
        comment = self.get_object()
        user = request.user
        tipo = request.data.get('tipo', 1) # Default to 1 (Gostei/Like)
        
        from .models import ReacaoComentario
        existing_reacao = ReacaoComentario.objects.filter(comentario=comment, usuario=user).first()
        
        if existing_reacao:
            if existing_reacao.tipo_reacao == tipo:
                # Remove reaction if clicking the same one
                existing_reacao.delete()
                return Response({'status': 'removed', 'likes_count': ReacaoComentario.objects.filter(comentario=comment).count()}, status=status.HTTP_200_OK)
            else:
                # Change reaction type
                existing_reacao.tipo_reacao = tipo
                existing_reacao.data_reacao = timezone.now()
                existing_reacao.save()
                return Response({'status': 'updated', 'tipo': tipo, 'likes_count': ReacaoComentario.objects.filter(comentario=comment).count()}, status=status.HTTP_200_OK)
        else:
            # Create new reaction
            ReacaoComentario.objects.create(comentario=comment, usuario=user, tipo_reacao=tipo)
            
            # Notify comment author (tipo 3 = Curtida/Reação)
            if comment.usuario.id_usuario != user.id_usuario:
                content = f"reagiu ao seu comentário"
                create_notification(
                    usuario_destino=comment.usuario,
                    usuario_origem=user,
                    tipo=3,
                    id_referencia=comment.publicacao.id_publicacao,
                    conteudo=content
                )
                
            return Response({'status': 'created', 'tipo': tipo, 'likes_count': ReacaoComentario.objects.filter(comentario=comment).count()}, status=status.HTTP_201_CREATED)



# Notifications ViewSet
from .models import Notificacao
from .serializers import NotificacaoSerializer

class NotificacaoViewSet(viewsets.ModelViewSet):
    """ViewSet for user notifications"""
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = NotificacaoSerializer
    http_method_names = ['get', 'patch']
    
    def get_queryset(self):
        """Return notifications for the current user"""
        return Notificacao.objects.filter(
            usuario_destino=self.request.user
        ).order_by('-data_criacao')[:50]
    
    @action(detail=True, methods=['patch'])
    def read(self, request, pk=None):
        """Mark a notification as read"""
        notification = self.get_object()
        notification.lida = True
        notification.data_leitura = timezone.now()
        notification.save()
        return Response({'lida': True}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['patch'])
    def read_all(self, request):
        """Mark all notifications as read"""
        updated = Notificacao.objects.filter(
            usuario_destino=request.user,
            lida=False
        ).update(lida=True, data_leitura=timezone.now())
        return Response({'marked_read': updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        """Get the count of unread notifications for the current user"""
        count = Notificacao.objects.filter(
            usuario_destino=request.user,
            lida=False
        ).count()
        return Response({'unread_count': count}, status=status.HTTP_200_OK)


# Helper function to create notifications
def create_notification(usuario_destino, usuario_origem, tipo, id_referencia=None, conteudo=None):
    """Create a notification if destino != origem AND user has that notification type enabled"""
    if usuario_destino.id_usuario != usuario_origem.id_usuario:
        # Check user's notification settings
        try:
            settings = ConfiguracaoUsuario.objects.get(usuario=usuario_destino)
            
            # Map notification types to settings fields
            # tipo: 1=Nova Publicação, 2=Comentário, 3=Curtida, 4=Seguidor Novo, 7=Menção
            notification_settings = {
                1: settings.notificacoes_novas_publicacoes,
                2: settings.notificacoes_comentarios,
                3: settings.notificacoes_reacoes,
                4: settings.notificacoes_seguidor_novo,
                7: settings.notificacoes_comentarios,
            }
            
            # Check if this notification type is enabled
            if not notification_settings.get(tipo, True):
                return  # User has disabled this notification type
                
        except ConfiguracaoUsuario.DoesNotExist:
            # No settings exist, allow all notifications by default
            pass
        
        Notificacao.objects.create(
            usuario_destino=usuario_destino,
            usuario_origem=usuario_origem,
            tipo_notificacao=tipo,
            id_referencia=str(id_referencia) if id_referencia else None,
            conteudo=conteudo
        )

        # ── Disparar push notification ──────────────────────────
        if usuario_destino.fcm_token:
            from .tasks import send_push_to_user

            # Mapeamento de tipos para textos legíveis
            TIPO_PUSH = {
                1: ('Nova publicação 🌙',     f'{usuario_origem.nome_usuario} publicou um novo sonho'),
                2: ('Novo comentário 💬',     f'{usuario_origem.nome_usuario} comentou no seu sonho'),
                3: ('Nova curtida ✨',        f'{usuario_origem.nome_usuario} curtiu seu sonho'),
                4: ('Novo seguidor 👤',       f'{usuario_origem.nome_usuario} começou a te seguir'),
                5: ('Solicitação de seguir',  f'{usuario_origem.nome_usuario} quer te seguir'),
                7: ('Você foi mencionado 🔔', f'{usuario_origem.nome_usuario} mencionou você em um sonho'),
            }

            title, body = TIPO_PUSH.get(
                tipo,
                ('Lumem', conteudo or 'Você tem uma nova notificação')
            )

            send_push_to_user.delay(
                str(usuario_destino.id_usuario),
                title=title,
                body=body,
                data={
                    'type': str(tipo),
                    'reference_id': str(id_referencia) if id_referencia else '',
                    'origem_usuario': usuario_origem.nome_usuario,
                },
            )
        # ─────────────────────────────────────────────────────────


# ==========================================
# ADMIN VIEWS - Issue #29
# ==========================================

from .models import Denuncia
from datetime import timedelta

class IsAdminPermission(permissions.BasePermission):
    """Custom permission to only allow admins"""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_admin


class AdminStatsView(APIView):
    """Admin dashboard statistics - Issue #29"""
    permission_classes = [IsAdminPermission]

    def get(self, request):
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)

        # Basic stats
        total_users = User.objects.count()
        banned_users = User.objects.filter(status=2).count()
        total_dreams = Publicacao.objects.count()
        pending_reports = Denuncia.objects.filter(status_denuncia=1).count()

        # Last 7 days data for charts
        daily_stats = []
        for i in range(7):
            day = today - timedelta(days=6-i)
            next_day = day + timedelta(days=1)
            signups = User.objects.filter(
                data_criacao__date=day
            ).count()
            reports = Denuncia.objects.filter(
                data_denuncia__date=day
            ).count()
            daily_stats.append({
                'date': day.isoformat(),
                'signups': signups,
                'reports': reports
            })

        return Response({
            'kpis': {
                'total_users': total_users,
                'banned_users': banned_users,
                'total_dreams': total_dreams,
                'pending_reports': pending_reports,
            },
            'daily_stats': daily_stats
        })


class AdminUsersView(APIView):
    """Admin user management - Issue #29"""
    permission_classes = [IsAdminPermission]

    def get(self, request):
        search = request.query_params.get('search', '')
        users = User.objects.all()
        
        if search:
            users = users.filter(
                models.Q(nome_usuario__icontains=search) |
                models.Q(email__icontains=search) |
                models.Q(id_usuario__icontains=search) if search.isdigit() else models.Q(nome_usuario__icontains=search)
            )
        
        users = users.order_by('-data_criacao')[:100]
        
        data = [{
            'id_usuario': u.id_usuario,
            'nome_usuario': u.nome_usuario,
            'email': u.email,
            'nome_completo': u.nome_completo,
            'avatar_url': u.avatar_url,
            'status': u.status,
            'status_display': dict(User.STATUS_CHOICES).get(u.status, 'Unknown'),
            'data_criacao': u.data_criacao.isoformat(),
            'is_admin': u.is_admin,
        } for u in users]
        
        return Response(data)


class AdminUserDetailView(APIView):
    """Admin user detail/actions - Issue #29"""
    permission_classes = [IsAdminPermission]

    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        return Response({
            'id_usuario': user.id_usuario,
            'nome_usuario': user.nome_usuario,
            'email': user.email,
            'nome_completo': user.nome_completo,
            'bio': user.bio,
            'avatar_url': user.avatar_url,
            'data_nascimento': user.data_nascimento,
            'data_criacao': user.data_criacao.isoformat(),
            'status': user.status,
            'is_admin': user.is_admin,
            'verificado': user.verificado,
            'posts_count': Publicacao.objects.filter(usuario=user).count(),
            'followers_count': Seguidor.objects.filter(usuario_seguido=user, status=1).count(),
            'following_count': Seguidor.objects.filter(usuario_seguidor=user, status=1).count(),
        })

    def patch(self, request, pk):
        """Update user status (ban/unban)"""
        user = get_object_or_404(User, pk=pk)
        new_status = request.data.get('status')
        
        if new_status in [1, 2, 3]:
            user.status = new_status
            user.save()
            return Response({'message': _('Status atualizado'), 'status': new_status})
        
        return Response({'error': _('Status inválido')}, status=status.HTTP_400_BAD_REQUEST)


class AdminReportsView(APIView):
    """Admin moderation queue - Issue #29"""
    permission_classes = [IsAdminPermission]

    def get(self, request):
        status_filter = request.query_params.get('status', '1')  # Default pending
        reports = Denuncia.objects.filter(status_denuncia=int(status_filter)).order_by('-data_denuncia')[:50]
        
        data = []
        for r in reports:
            item = {
                'id_denuncia': r.id_denuncia,
                'tipo_conteudo': r.tipo_conteudo,
                'tipo_conteudo_display': dict(Denuncia.TIPO_CONTEUDO_CHOICES).get(r.tipo_conteudo),
                'id_conteudo': r.id_conteudo,
                'motivo_denuncia': r.motivo_denuncia,
                'motivo_display': dict(Denuncia.MOTIVO_DENUNCIA_CHOICES).get(r.motivo_denuncia),
                'descricao_denuncia': r.descricao_denuncia,
                'data_denuncia': r.data_denuncia.isoformat(),
                'status_denuncia': r.status_denuncia,
                'reporter': {
                    'id': r.usuario_denunciante.id_usuario,
                    'username': r.usuario_denunciante.nome_usuario,
                }
            }
            
            # Get reported content
            if r.tipo_conteudo == 1:  # Post
                post = Publicacao.objects.filter(id_publicacao=r.id_conteudo).first()
                if post:
                    item['content'] = {
                        'type': 'post',
                        'id': post.id_publicacao,
                        'titulo': post.titulo,
                        'conteudo_texto': post.conteudo_texto,
                        'usuario': {
                            'id': post.usuario.id_usuario,
                            'username': post.usuario.nome_usuario,
                        }
                    }
            elif r.tipo_conteudo == 2:  # Comment
                comment = Comentario.objects.filter(id_comentario=r.id_conteudo).first()
                if comment:
                    item['content'] = {
                        'type': 'comment',
                        'id': comment.id_comentario,
                        'texto': comment.conteudo_texto,
                        'usuario': {
                            'id': comment.usuario.id_usuario,
                            'username': comment.usuario.nome_usuario,
                        }
                    }
            elif r.tipo_conteudo == 3:  # User
                reported_user = User.objects.filter(id_usuario=r.id_conteudo).first()
                if reported_user:
                    item['content'] = {
                        'type': 'user',
                        'id': reported_user.id_usuario,
                        'username': reported_user.nome_usuario,
                    }
            
            data.append(item)
        
        return Response(data)


class AdminReportActionView(APIView):
    """Handle report actions - Issue #29"""
    permission_classes = [IsAdminPermission]

    def post(self, request, pk):
        report = get_object_or_404(Denuncia, pk=pk)
        action = request.data.get('action')  # ignore, remove, ban

        if action == 'ignore':
            report.status_denuncia = 3  # Resolvida
            report.acao_tomada = 1  # Nenhuma
            report.data_resolucao = timezone.now()
            report.save()
            return Response({'message': _('Denúncia ignorada')})

        elif action == 'remove':
            # Remove content based on type
            if report.tipo_conteudo == 1:  # Post
                Publicacao.objects.filter(id_publicacao=report.id_conteudo).delete()
            elif report.tipo_conteudo == 2:  # Comment
                Comentario.objects.filter(id_comentario=report.id_conteudo).update(status=2)
            
            report.status_denuncia = 3
            report.acao_tomada = 2  # Removido
            report.data_resolucao = timezone.now()
            report.save()
            return Response({'message': _('Conteúdo removido')})

        elif action == 'ban':
            # Get user to ban based on content type
            user_to_ban = None
            if report.tipo_conteudo == 1:
                post = Publicacao.objects.filter(id_publicacao=report.id_conteudo).first()
                if post:
                    user_to_ban = post.usuario
            elif report.tipo_conteudo == 2:
                comment = Comentario.objects.filter(id_comentario=report.id_conteudo).first()
                if comment:
                    user_to_ban = comment.usuario
            elif report.tipo_conteudo == 3:
                user_to_ban = User.objects.filter(id_usuario=report.id_conteudo).first()
            
            if user_to_ban:
                user_to_ban.status = 2  # Suspenso
                user_to_ban.save()
            
            report.status_denuncia = 3
            report.acao_tomada = 3  # Usuário Suspenso
            report.data_resolucao = timezone.now()
            report.save()
            return Response({'message': _('Usuário banido')})

        return Response({'error': _('Ação inválida')}, status=status.HTTP_400_BAD_REQUEST)


class CreateReportView(APIView):
    """Create a new report (denuncia) from users"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        id_conteudo = request.data.get('id_conteudo')
        tipo_conteudo = request.data.get('tipo_conteudo')
        motivo_denuncia = request.data.get('motivo_denuncia')
        descricao_denuncia = request.data.get('descricao_denuncia')

        if not all([id_conteudo, tipo_conteudo, motivo_denuncia]):
            return Response(
                {'error': _('Campos obrigatórios: id_conteudo, tipo_conteudo, motivo_denuncia')},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate tipo_conteudo
        if tipo_conteudo not in [1, 2, 3]:
            return Response(
                {'error': _('tipo_conteudo inválido. Use: 1 (Post), 2 (Comment), 3 (User)')},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate motivo_denuncia
        if motivo_denuncia not in [1, 2, 3]:
            return Response(
                {'error': _('motivo_denuncia inválido. Use: 1, 2 ou 3')},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if content exists
        if tipo_conteudo == 1:
            if not Publicacao.objects.filter(id_publicacao=id_conteudo).exists():
                return Response({'error': _('Publicação não encontrada')}, status=status.HTTP_404_NOT_FOUND)
        elif tipo_conteudo == 2:
            if not Comentario.objects.filter(id_comentario=id_conteudo).exists():
                return Response({'error': _('Comentário não encontrado')}, status=status.HTTP_404_NOT_FOUND)
        elif tipo_conteudo == 3:
            if not User.objects.filter(id_usuario=id_conteudo).exists():
                return Response({'error': _('Usuário não encontrado')}, status=status.HTTP_404_NOT_FOUND)

        # Create report
        report = Denuncia.objects.create(
            usuario_denunciante=request.user,
            tipo_conteudo=tipo_conteudo,
            id_conteudo=id_conteudo,
            motivo_denuncia=motivo_denuncia,
            descricao_denuncia=descricao_denuncia,
            status_denuncia=1  # Pendente
        )

        return Response({
            'message': _('Denúncia enviada com sucesso'),
            'id_denuncia': report.id_denuncia
        }, status=status.HTTP_201_CREATED)


# ==========================================
# USER SETTINGS & CLOSE FRIENDS VIEWS
# ==========================================

from .models import ConfiguracaoUsuario
from .serializers import UserSettingsSerializer, CloseFriendSerializer

class UserSettingsView(APIView):
    """Get or update user settings (ConfiguracaoUsuario)"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        # Auto-create settings if not exists (for existing users)
        settings_obj, created = ConfiguracaoUsuario.objects.get_or_create(
            usuario=request.user
        )
        serializer = UserSettingsSerializer(settings_obj)
        return Response(serializer.data)

    def patch(self, request):
        settings_obj, created = ConfiguracaoUsuario.objects.get_or_create(
            usuario=request.user
        )
        serializer = UserSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(ultima_atualizacao=timezone.now())
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CloseFriendsManagerView(APIView):
    """List followers with close friend status for management"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        # Get all people who follow the current user (they can be close friends)
        followers = Seguidor.objects.filter(
            usuario_seguido=request.user,
            status=1
        ).select_related('usuario_seguidor').order_by('-is_close_friend', '-data_seguimento')
        
        serializer = CloseFriendSerializer(followers, many=True, context={'request': request})
        return Response(serializer.data)


class ToggleCloseFriendView(APIView):
    """Toggle close friend status for a follower"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        # Find the follow relationship where pk is the follower's user id
        follow = get_object_or_404(
            Seguidor,
            usuario_seguidor_id=pk,
            usuario_seguido=request.user,
            status=1
        )
        
        # Toggle the close friend status
        follow.is_close_friend = not follow.is_close_friend
        follow.save()
        
        return Response({
            'id_usuario': pk,
            'is_close_friend': follow.is_close_friend,
            'message': _('Amigo próximo adicionado') if follow.is_close_friend else _('Amigo próximo removido')
        }, status=status.HTTP_200_OK)
# ==========================================
# COMMUNITIES VIEWS
# ==========================================

from .models import Comunidade, MembroComunidade, BanimentoComunidade, ConviteModerador, Notificacao
from .serializers import ComunidadeSerializer, CommunityStatsSerializer, BanimentoComunidadeSerializer

class ComunidadeViewSet(viewsets.ModelViewSet):
    """ViewSet for communities"""
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = ComunidadeSerializer
    queryset = Comunidade.objects.all()
    parser_classes = (MultiPartParser, FormParser, JSONParser,)

    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

    def _validate_image(self, file):
        """Validate uploaded image file"""
        ext = file.name.split('.')[-1].lower()
        if ext not in self.ALLOWED_EXTENSIONS:
            return False, _('Formato não permitido. Use: %(ext)s') % {'ext': ', '.join(self.ALLOWED_EXTENSIONS)}
        if file.size > self.MAX_FILE_SIZE:
            return False, _('Arquivo muito grande. Máximo: 5MB')
        return True, ext

    def _check_moderator(self, request, community):
        """Check if user is moderator/admin of this community"""
        return MembroComunidade.objects.filter(
            comunidade=community,
            usuario=request.user,
            role__in=['moderator', 'admin']
        ).exists() or request.user.is_admin

    @action(detail=True, methods=['post'], url_path='upload-icon')
    def upload_icon(self, request, pk=None):
        """Upload community icon image (moderators only)"""
        community = self.get_object()
        if not self._check_moderator(request, community):
            return Response({'error': _('Apenas moderadores podem alterar o ícone')}, status=status.HTTP_403_FORBIDDEN)

        if 'image' not in request.FILES:
            return Response({'error': 'Nenhum arquivo enviado'}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES['image']
        valid, result = self._validate_image(file)
        if not valid:
            return Response({'error': result}, status=status.HTTP_400_BAD_REQUEST)

        # Use transaction to ensure atomicity
        with transaction.atomic():
            # Delete old image if it exists
            if community.imagem:
                community.imagem.delete(save=False)

            # Generate filename and save using Django's storage system
            # Note: ImageField's upload_to='community_images/' will prepend the directory automatically
            filename = f"community_icon_{community.id_comunidade}_{uuid.uuid4().hex[:8]}.{result}"
            community.imagem.save(filename, file, save=True)

        # Build absolute URL for response
        image_url = request.build_absolute_uri(community.imagem.url)
        return Response({'message': _('Ícone atualizado!'), 'imagem': image_url}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='upload-banner')
    def upload_banner(self, request, pk=None):
        """Upload community banner image (moderators only)"""
        community = self.get_object()
        if not self._check_moderator(request, community):
            return Response({'error': _('Apenas moderadores podem alterar o banner')}, status=status.HTTP_403_FORBIDDEN)

        if 'image' not in request.FILES:
            return Response({'error': 'Nenhum arquivo enviado'}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES['image']
        valid, result = self._validate_image(file)
        if not valid:
            return Response({'error': result}, status=status.HTTP_400_BAD_REQUEST)

        # Use transaction to ensure atomicity
        with transaction.atomic():
            # Delete old banner if it exists
            if community.banner:
                community.banner.delete(save=False)

            # Generate filename and save using Django's storage system
            # Note: ImageField's upload_to='community_banners/' will prepend the directory automatically
            filename = f"community_banner_{community.id_comunidade}_{uuid.uuid4().hex[:8]}.{result}"
            community.banner.save(filename, file, save=True)

        # Build absolute URL for response
        banner_url = request.build_absolute_uri(community.banner.url)
        return Response({'message': _('Banner atualizado!'), 'banner': banner_url}, status=status.HTTP_200_OK)

    def get_serializer_context(self):
        return {'request': self.request}

    def get_queryset(self):
        """Filter communities - supports member, user_id, and role filters"""
        queryset = Comunidade.objects.all().order_by('-data_criacao')
        
        user_id = self.request.query_params.get('user_id')
        role = self.request.query_params.get('role')
        
        if user_id:
            # Filter communities a specific user belongs to
            queryset = queryset.filter(membrocomunidade__usuario_id=user_id)
            if role:
                # Filter by role(s), e.g. "admin,moderator"
                roles = [r.strip() for r in role.split(',')]
                queryset = queryset.filter(membrocomunidade__usuario_id=user_id, membrocomunidade__role__in=roles)
        elif self.request.query_params.get('member') == 'true':
            queryset = queryset.filter(membros=self.request.user)
            if role:
                roles = [r.strip() for r in role.split(',')]
                queryset = queryset.filter(membrocomunidade__usuario=self.request.user, membrocomunidade__role__in=roles)
        
        return queryset.distinct()

    def perform_create(self, serializer):
        """Create community and add creator as ADMIN"""
        comunidade = serializer.save()
        # Add creator as admin of the community
        MembroComunidade.objects.create(
            comunidade=comunidade,
            usuario=self.request.user,
            role='admin'
        )

    def destroy(self, request, *args, **kwargs):
        """Delete a community (Admins only)"""
        community = self.get_object()
        user = request.user
        
        # Check if current user is admin of this community
        is_community_admin = MembroComunidade.objects.filter(
            comunidade=community, 
            usuario=user,
            role='admin'
        ).exists()
        
        if not is_community_admin and not user.is_admin:
            return Response({'error': _('Apenas administradores podem excluir a comunidade')}, status=status.HTTP_403_FORBIDDEN)
        
        community.delete()
        return Response({'message': _('Comunidade excluída com sucesso')}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Join a community"""
        community = self.get_object()
        user = request.user
        
        # Check if already member
        if MembroComunidade.objects.filter(comunidade=community, usuario=user).exists():
            return Response({'error': _('Você já é membro desta comunidade')}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if banned
        if BanimentoComunidade.objects.filter(comunidade=community, usuario=user).exists():
            return Response({'error': _('Você está banido desta comunidade')}, status=status.HTTP_403_FORBIDDEN)
            
        MembroComunidade.objects.create(comunidade=community, usuario=user, role='member')
        return Response({
            'message': _('Bem-vindo à comunidade!'),
            'is_member': True,
            'membros_count': community.membros.count()
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """Leave a community"""
        community = self.get_object()
        user = request.user
        
        membership = MembroComunidade.objects.filter(comunidade=community, usuario=user).first()
        if not membership:
             return Response({'error': _('Você não é membro desta comunidade')}, status=status.HTTP_400_BAD_REQUEST)
        
        # Prevent last admin from leaving
        if membership.role == 'admin':
            admin_count = MembroComunidade.objects.filter(comunidade=community, role='admin').count()
            if admin_count <= 1:
                return Response({'error': _('Você é o único admin. Promova outro membro antes de sair.')}, status=status.HTTP_400_BAD_REQUEST)
        
        membership.delete()
        return Response({
            'message': _('Você saiu da comunidade'),
            'is_member': False,
            'membros_count': community.membros.count()
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='manage-role')
    def manage_role(self, request, pk=None):
        """Promote/demote a member (Admins only)"""
        community = self.get_object()
        user = request.user
        
        # Check if current user is admin
        is_admin = MembroComunidade.objects.filter(
            comunidade=community, 
            usuario=user,
            role='admin'
        ).exists()
        
        if not is_admin and not user.is_admin:
            return Response({'error': _('Apenas administradores podem gerenciar roles')}, status=status.HTTP_403_FORBIDDEN)
        
        target_user_id = request.data.get('user_id')
        new_role = request.data.get('role')
        
        if not target_user_id or not new_role:
            return Response({'error': _('Campos obrigatórios: user_id, role')}, status=status.HTTP_400_BAD_REQUEST)
        
        if new_role not in ['member', 'moderator', 'admin']:
            return Response({'error': _('Role inválido. Use: member, moderator, admin')}, status=status.HTTP_400_BAD_REQUEST)
        
        membership = MembroComunidade.objects.filter(
            comunidade=community, 
            usuario_id=target_user_id
        ).first()
        
        if not membership:
            return Response({'error': _('Usuário não é membro desta comunidade')}, status=status.HTTP_404_NOT_FOUND)
        
        # Prevent removing own admin role if last admin
        if membership.usuario == user and membership.role == 'admin' and new_role != 'admin':
            admin_count = MembroComunidade.objects.filter(comunidade=community, role='admin').count()
            if admin_count <= 1:
                return Response({'error': _('Você é o único admin. Promova outro membro antes de se rebaixar.')}, status=status.HTTP_400_BAD_REQUEST)
        
        membership.role = new_role
        membership.save()
        
        role_names = {'member': _('Membro'), 'moderator': _('Moderador'), 'admin': _('Administrador')}
        return Response({
            'message': _('Usuário agora é %(role)s') % {'role': role_names.get(new_role)},
            'user_id': target_user_id,
            'new_role': new_role
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """List all members of a community with their roles"""
        community = self.get_object()
        
        memberships = MembroComunidade.objects.filter(
            comunidade=community
        ).select_related('usuario').order_by('-role', '-data_entrada')
        
        data = [{
            'id_usuario': m.usuario.id_usuario,
            'nome_usuario': m.usuario.nome_usuario,
            'nome_completo': m.usuario.nome_completo,
            'avatar_url': m.usuario.avatar_url,
            'role': m.role,
            'data_entrada': m.data_entrada.isoformat()
        } for m in memberships]
        
        return Response(data)

    @action(detail=True, methods=['get'])
    def moderator_stats(self, request, pk=None):
        """Get community statistics (Moderators only)"""
        community = self.get_object()
        user = request.user

        # Check permission (Owner or Moderator)
        is_mod = MembroComunidade.objects.filter(
            comunidade=community, 
            usuario=user,
            role__in=['moderator', 'admin']
        ).exists()

        if not is_mod and not user.is_admin:
             return Response(
                {'error': _('Apenas moderadores podem ver estatísticas')}, 
                status=status.HTTP_403_FORBIDDEN
            )

        # Calculate Stats
        today = timezone.now()
        seven_days_ago = today - timedelta(days=7)
        thirty_days_ago = today - timedelta(days=30)
        
        total_members = community.membros.count()
        new_members_7 = MembroComunidade.objects.filter(comunidade=community, data_entrada__gte=seven_days_ago).count()
        new_members_30 = MembroComunidade.objects.filter(comunidade=community, data_entrada__gte=thirty_days_ago).count()
        
        total_posts = community.publicacoes.count()
        posts_7 = community.publicacoes.filter(data_publicacao__gte=seven_days_ago).count()
        
        # Active members: users who posted in last 7 days
        active_members_7 = community.publicacoes.filter(
            data_publicacao__gte=seven_days_ago
        ).values('usuario').distinct().count()
        
        pending_reports = 0 

        data = {
            'total_members': total_members,
            'new_members_last_7_days': new_members_7,
            'new_members_last_30_days': new_members_30,
            'total_posts': total_posts,
            'posts_last_7_days': posts_7,
            'active_members_last_7_days': active_members_7,
            'pending_reports': pending_reports
        }
        
        serializer = CommunityStatsSerializer(data=data)
        serializer.is_valid()
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        """Update community info (Moderators/Admins only)"""
        community = self.get_object()
        if not self._check_moderator(request, community):
            return Response({'error': _('Apenas moderadores podem editar a comunidade')}, status=status.HTTP_403_FORBIDDEN)
        
        # Only allow updating specific fields
        allowed_fields = {'nome', 'descricao', 'regras'}
        update_data = {k: v for k, v in request.data.items() if k in allowed_fields}
        
        if not update_data:
            return Response({'error': _('Nenhum campo válido para atualizar')}, status=status.HTTP_400_BAD_REQUEST)
        
        for field, value in update_data.items():
            setattr(community, field, value)
        community.save()
        
        serializer = self.get_serializer(community)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        """PATCH - delegates to update"""
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='ban-member')
    def ban_member(self, request, pk=None):
        """Ban a member from the community (Moderators only)"""
        community = self.get_object()
        if not self._check_moderator(request, community):
            return Response({'error': _('Apenas moderadores podem banir membros')}, status=status.HTTP_403_FORBIDDEN)
        
        target_user_id = request.data.get('user_id')
        motivo = request.data.get('motivo', '')
        
        if not target_user_id:
            return Response({'error': _('Campo obrigatório: user_id')}, status=status.HTTP_400_BAD_REQUEST)
        
        target_user = User.objects.filter(id_usuario=target_user_id).first()
        if not target_user:
            return Response({'error': _('Usuário não encontrado')}, status=status.HTTP_404_NOT_FOUND)
        
        # Prevent banning admins
        target_membership = MembroComunidade.objects.filter(comunidade=community, usuario=target_user).first()
        if target_membership and target_membership.role == 'admin':
            return Response({'error': _('Não é possível banir um administrador')}, status=status.HTTP_400_BAD_REQUEST)
        
        # Prevent self-ban
        if target_user.id_usuario == request.user.id_usuario:
            return Response({'error': _('Você não pode banir a si mesmo')}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if already banned
        if BanimentoComunidade.objects.filter(comunidade=community, usuario=target_user).exists():
            return Response({'error': _('Usuário já está banido')}, status=status.HTTP_400_BAD_REQUEST)
        
        # Remove membership if exists
        if target_membership:
            target_membership.delete()
        
        # Create ban record
        BanimentoComunidade.objects.create(
            comunidade=community,
            usuario=target_user,
            moderador=request.user,
            motivo=motivo
        )
        
        return Response({
            'message': _('Usuário %(username)s foi banido da comunidade') % {'username': target_user.nome_usuario},
            'user_id': target_user_id
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='unban-member')
    def unban_member(self, request, pk=None):
        """Unban a member from the community (Moderators only)"""
        community = self.get_object()
        if not self._check_moderator(request, community):
            return Response({'error': _('Apenas moderadores podem desbanir membros')}, status=status.HTTP_403_FORBIDDEN)
        
        target_user_id = request.data.get('user_id')
        if not target_user_id:
            return Response({'error': _('Campo obrigatório: user_id')}, status=status.HTTP_400_BAD_REQUEST)
        
        ban = BanimentoComunidade.objects.filter(comunidade=community, usuario_id=target_user_id).first()
        if not ban:
            return Response({'error': _('Usuário não está banido')}, status=status.HTTP_404_NOT_FOUND)
        
        ban.delete()
        return Response({
            'message': _('Usuário desbanido com sucesso'),
            'user_id': target_user_id
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='banned-members')
    def banned_members(self, request, pk=None):
        """List banned members (Moderators only)"""
        community = self.get_object()
        if not self._check_moderator(request, community):
            return Response({'error': _('Apenas moderadores podem ver banidos')}, status=status.HTTP_403_FORBIDDEN)
        
        bans = BanimentoComunidade.objects.filter(
            comunidade=community
        ).select_related('usuario', 'moderador').order_by('-data_ban')
        
        serializer = BanimentoComunidadeSerializer(bans, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='invite-moderator')
    def invite_moderator(self, request, pk=None):
        """Invite a user to be moderator (Admins only)"""
        community = self.get_object()
        
        # Only admins can invite moderators
        is_admin = MembroComunidade.objects.filter(
            comunidade=community,
            usuario=request.user,
            role='admin'
        ).exists()
        
        if not is_admin and not request.user.is_admin:
            return Response({'error': _('Apenas administradores podem convidar moderadores')}, status=status.HTTP_403_FORBIDDEN)
        
        target_user_id = request.data.get('user_id')
        if not target_user_id:
            return Response({'error': _('Campo obrigatório: user_id')}, status=status.HTTP_400_BAD_REQUEST)
        
        target_user = User.objects.filter(id_usuario=target_user_id).first()
        if not target_user:
            return Response({'error': _('Usuário não encontrado')}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if banned
        if BanimentoComunidade.objects.filter(comunidade=community, usuario=target_user).exists():
            return Response({'error': _('Usuário está banido desta comunidade')}, status=status.HTTP_400_BAD_REQUEST)
        
        # If already a moderator/admin
        membership = MembroComunidade.objects.filter(comunidade=community, usuario=target_user).first()
        if membership and membership.role in ['moderator', 'admin']:
            return Response({'error': _('Usuário já é moderador/admin')}, status=status.HTTP_400_BAD_REQUEST)
            
        # Check if an invite is already pending
        pending_invite = ConviteModerador.objects.filter(
            comunidade=community,
            usuario_convidado=target_user,
            status='pending'
        ).first()
        if pending_invite:
            return Response({'error': _('Já existe um convite pendente para este usuário')}, status=status.HTTP_400_BAD_REQUEST)

        # Create invite
        convite = ConviteModerador.objects.create(
            comunidade=community,
            usuario_convidado=target_user,
            admin_convidador=request.user,
            status='pending'
        )

        # Triggers a Community Invite notification
        Notificacao.objects.create(
            usuario_destino=target_user,
            usuario_origem=request.user,
            tipo_notificacao=6,  # 6 = Convite de Moderação
            id_referencia=f"{community.id_comunidade}::{convite.id_convite}",
            conteudo=community.nome
        )
        
        return Response({
            'message': _('Convite enviado para %(username)s') % {'username': target_user.nome_usuario},
            'user_id': target_user_id,
            'invite_id': convite.id_convite
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='accept-invite')
    def accept_invite(self, request, pk=None):
        """Accept a community moderator info"""
        community = self.get_object()
        invite_id = request.data.get('invite_id')
        
        if not invite_id:
            return Response({'error': _('ID do convite obrigatório')}, status=status.HTTP_400_BAD_REQUEST)

        convite = ConviteModerador.objects.filter(id_convite=invite_id, comunidade=community, usuario_convidado=request.user).first()
        
        if not convite:
            return Response({'error': _('Convite não encontrado')}, status=status.HTTP_404_NOT_FOUND)
            
        if convite.status != 'pending':
            return Response({'error': _('Convite já resolvido')}, status=status.HTTP_400_BAD_REQUEST)

        # Check if user is banned from this community
        if BanimentoComunidade.objects.filter(comunidade=community, usuario=request.user).exists():
            return Response({'error': _('Você está banido desta comunidade')}, status=status.HTTP_403_FORBIDDEN)

        # Process acceptance
        convite.status = 'accepted'
        convite.save()

        # Add or promote — never downgrade an admin
        membership = MembroComunidade.objects.filter(comunidade=community, usuario=request.user).first()
        if membership:
            if membership.role == 'member':
                membership.role = 'moderator'
                membership.save()
            # If already admin or moderator, keep current role
        else:
            MembroComunidade.objects.create(
                comunidade=community,
                usuario=request.user,
                role='moderator'
            )
            
        # Clean up related notification manually so it doesn't linger visually if requested
        Notificacao.objects.filter(id_referencia=f"{community.id_comunidade}::{invite_id}", usuario_destino=request.user).delete()

        return Response({
            'message': _('Você agora é moderador de %(community_name)s') % {'community_name': community.nome},
            'community_id': community.id_comunidade
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject-invite')
    def reject_invite(self, request, pk=None):
        """Reject a community moderator info"""
        community = self.get_object()
        invite_id = request.data.get('invite_id')
        
        if not invite_id:
            return Response({'error': _('ID do convite obrigatório')}, status=status.HTTP_400_BAD_REQUEST)

        convite = ConviteModerador.objects.filter(id_convite=invite_id, comunidade=community, usuario_convidado=request.user).first()
        
        if not convite:
            return Response({'error': _('Convite não encontrado')}, status=status.HTTP_404_NOT_FOUND)

        if convite.status != 'pending':
            return Response({'error': _('Convite já resolvido')}, status=status.HTTP_400_BAD_REQUEST)

        convite.status = 'rejected'
        convite.save()
        
        # Remove original notification 
        Notificacao.objects.filter(id_referencia=f"{community.id_comunidade}::{invite_id}", usuario_destino=request.user).delete()

        return Response({
            'message': _('Convite recusado')
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='transfer-ownership')
    def transfer_ownership(self, request, pk=None):
        """Transfere a administração da comunidade para um moderador.
        Usado antes da exclusão de conta para resolver comunidades pendentes."""
        community = self.get_object()
        user = request.user

        # Verificar se o usuário atual é admin
        is_admin = MembroComunidade.objects.filter(
            comunidade=community,
            usuario=user,
            role='admin'
        ).exists()

        if not is_admin:
            return Response(
                {'error': _('Apenas administradores podem transferir a administração')},
                status=status.HTTP_403_FORBIDDEN
            )

        target_user_id = request.data.get('user_id')
        if not target_user_id:
            return Response(
                {'error': _('Campo obrigatório: user_id')},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Buscar o membro alvo
        target_membership = MembroComunidade.objects.filter(
            comunidade=community,
            usuario_id=target_user_id
        ).first()

        if not target_membership:
            return Response(
                {'error': _('Usuário não é membro desta comunidade')},
                status=status.HTTP_404_NOT_FOUND
            )

        if target_membership.role not in ['moderator', 'admin']:
            return Response(
                {'error': _('Apenas moderadores podem receber a administração')},
                status=status.HTTP_400_BAD_REQUEST
            )

        if target_membership.role == 'admin':
            return Response(
                {'error': _('Usuário já é administrador')},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Promover moderador a admin
            target_membership.role = 'admin'
            target_membership.save()

            # Rebaixar o admin atual a membro
            current_membership = MembroComunidade.objects.filter(
                comunidade=community,
                usuario=user,
                role='admin'
            ).first()
            if current_membership:
                current_membership.role = 'member'
                current_membership.save()

        return Response({
            'message': _('Administração transferida para %(username)s') % {
                'username': target_membership.usuario.nome_usuario
            },
            'new_admin_id': str(target_user_id),
        }, status=status.HTTP_200_OK)
from .models import Rascunho
from .serializers import RascunhoSerializer

class RascunhoViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user's post drafts"""
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = RascunhoSerializer

    def get_queryset(self):
        """Return only the current user's drafts"""
        return Rascunho.objects.filter(usuario=self.request.user)

    def perform_create(self, serializer):
        """Automatically set the current user as the draft owner"""
        serializer.save(usuario=self.request.user)


# ==========================================
# EXPLORE PAGE: TRENDS & TOP COMMUNITY POSTS
# ==========================================

class TrendView(APIView):
    """
    Returns trending data for the Explore page:
    - Top hashtags by usage count
    - Top emotions/dream types from recent posts
    """
    permission_classes = (permissions.IsAuthenticated,)

    # Valid options must match CreateDreamModal.jsx exactly
    VALID_DREAM_TYPES = {'Lúcido', 'Normal', 'Pesadelo', 'Recorrente'}
    VALID_EMOTIONS = {'Feliz', 'Medo', 'Surpresa', 'Triste', 'Raiva', 'Confuso', 'Paz', 'Êxtase'}

    def get(self, request):
        from collections import Counter

        # --- Trending Hashtags (top 15 by contagem_uso) ---
        trending_hashtags = Hashtag.objects.order_by('-contagem_uso', '-ultima_utilizacao')[:15]
        hashtags_data = [
            {
                'id_hashtag': h.id_hashtag,
                'texto_hashtag': h.texto_hashtag,
                'contagem_uso': h.contagem_uso,
            }
            for h in trending_hashtags
        ]

        # --- Trending Emotions & Dream Types from recent posts (last 30 days) ---
        thirty_days_ago = timezone.now() - timedelta(days=30)
        recent_posts = Publicacao.objects.filter(
            data_publicacao__gte=thirty_days_ago,
            visibilidade=1  # Only public posts
        ).values_list('emocoes_sentidas', 'tipo_sonho')

        emotion_counter = Counter()
        tipo_counter = Counter()

        for emocoes, tipo in recent_posts:
            # emocoes_sentidas is a text field — may contain comma-separated values
            # Values are stored as "😊 Feliz" — strip emoji prefix to get the keyword
            if emocoes:
                for emo in emocoes.split(','):
                    cleaned = emo.strip()
                    # Extract the text part after the emoji (e.g. "😊 Feliz" -> "Feliz")
                    parts = cleaned.split(' ', 1)
                    keyword = parts[-1] if len(parts) > 1 else parts[0]
                    if keyword in self.VALID_EMOTIONS:
                        # Use the cleaned text keyword (without emoji) as the counter key
                        emotion_counter[keyword] += 1
            if tipo:
                stripped = tipo.strip()
                if stripped in self.VALID_DREAM_TYPES:
                    tipo_counter[stripped] += 1

        trending_emotions = [
            {'nome': nome, 'contagem': count}
            for nome, count in emotion_counter.most_common(8)
        ]

        trending_tipos = [
            {'nome': nome, 'contagem': count}
            for nome, count in tipo_counter.most_common(4)
        ]

        return Response({
            'hashtags': hashtags_data,
            'emocoes': trending_emotions,
            'tipos_sonho': trending_tipos,
        })


class TopCommunityPostsView(APIView):
    """
    Returns top 10 most relevant posts from random communities,
    ranked by engagement (likes + comments).
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        import random as _random

        # Pick up to 5 random communities that have posts
        community_ids = list(
            Comunidade.objects.filter(
                publicacoes__isnull=False
            ).values_list('id_comunidade', flat=True).distinct()
        )

        if not community_ids:
            return Response({'posts': [], 'comunidades': []})

        # Select up to 5 random communities
        selected_ids = _random.sample(community_ids, min(5, len(community_ids)))

        # Get top 10 posts from those communities, ordered by engagement
        top_posts = (
            Publicacao.objects.filter(
                comunidade_id__in=selected_ids,
                visibilidade=1  # Public only
            )
            .select_related('usuario', 'comunidade')
            .annotate(
                likes_count=Count('reacaopublicacao'),
                comentarios_count=Count('comentario'),
                engagement=Count('reacaopublicacao') + Count('comentario'),
            )
            .order_by('-engagement', '-data_publicacao')[:10]
        )

        serializer = PublicacaoSerializer(
            top_posts, many=True, context={'request': request}
        )

        # Also send the selected communities info
        selected_communities = Comunidade.objects.filter(id_comunidade__in=selected_ids)
        communities_data = [
            {
                'id_comunidade': c.id_comunidade,
                'nome': c.nome,
                'imagem': request.build_absolute_uri(c.imagem.url) if c.imagem else None,
                'membros_count': c.membros.count(),
            }
            for c in selected_communities
        ]

        return Response({
            'posts': serializer.data,
            'comunidades': communities_data,
        })


# ==========================================
# CHAT / DIRECT MESSAGES VIEWS
# ==========================================
from .models import MensagemDireta, Bloqueio
from .serializers import MensagemDiretaSerializer


class ConversationListView(APIView):
    """List all conversations for the current user (aggregated by partner)"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user

        # Get all messages involving this user (not deleted by them)
        sent = MensagemDireta.objects.filter(
            usuario_remetente=user, deletada_remetente=False
        )
        received = MensagemDireta.objects.filter(
            usuario_destinatario=user, deletada_destinatario=False
        )

        # Build a dict of conversations keyed by the OTHER user's id
        conversations = {}

        for msg in sent.select_related('usuario_destinatario').order_by('-data_envio'):
            partner = msg.usuario_destinatario
            pid = str(partner.id_usuario)
            if pid not in conversations:
                conversations[pid] = {
                    'user': partner,
                    'last_message': msg.conteudo[:100],
                    'last_message_date': msg.data_envio,
                    'unread_count': 0,
                }

        for msg in received.select_related('usuario_remetente').order_by('-data_envio'):
            partner = msg.usuario_remetente
            pid = str(partner.id_usuario)
            if pid not in conversations:
                conversations[pid] = {
                    'user': partner,
                    'last_message': msg.conteudo[:100],
                    'last_message_date': msg.data_envio,
                    'unread_count': 0,
                }
            elif msg.data_envio > conversations[pid]['last_message_date']:
                conversations[pid]['last_message'] = msg.conteudo[:100]
                conversations[pid]['last_message_date'] = msg.data_envio

            if not msg.lida:
                conversations[pid]['unread_count'] += 1

        # Sort by most recent message
        sorted_convos = sorted(
            conversations.values(),
            key=lambda c: c['last_message_date'],
            reverse=True
        )

        # Serialize the user objects
        from .serializers import UserSerializer
        result = []
        for convo in sorted_convos:
            result.append({
                'user': UserSerializer(convo['user'], context={'request': request}).data,
                'last_message': convo['last_message'],
                'last_message_date': convo['last_message_date'],
                'unread_count': convo['unread_count'],
            })

        return Response(result, status=status.HTTP_200_OK)


class ChatView(APIView):
    """Get message history with a user, or send a new message"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        """Get chat history with user <pk>"""
        user = request.user
        partner = get_object_or_404(User, pk=pk)

        messages = MensagemDireta.objects.filter(
            (Q(usuario_remetente=user, usuario_destinatario=partner, deletada_remetente=False) |
             Q(usuario_remetente=partner, usuario_destinatario=user, deletada_destinatario=False))
        ).select_related('usuario_remetente', 'usuario_destinatario').order_by('data_envio')

        # Auto-mark received messages as read
        messages.filter(
            usuario_remetente=partner,
            usuario_destinatario=user,
            lida=False
        ).update(lida=True, data_leitura=timezone.now())

        serializer = MensagemDiretaSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, pk):
        """Send a message to user <pk>"""
        user = request.user
        partner = get_object_or_404(User, pk=pk)

        if user.id_usuario == partner.id_usuario:
            return Response({'error': _('Você não pode enviar mensagem para si mesmo')}, status=status.HTTP_400_BAD_REQUEST)

        # Check if blocked
        if Bloqueio.objects.filter(
            Q(usuario=user, usuario_bloqueado=partner) |
            Q(usuario=partner, usuario_bloqueado=user)
        ).exists():
            return Response({'error': _('Não é possível enviar mensagem para este usuário')}, status=status.HTTP_403_FORBIDDEN)

        conteudo = request.data.get('conteudo', '').strip()
        if not conteudo:
            return Response({'error': _('Mensagem não pode ser vazia')}, status=status.HTTP_400_BAD_REQUEST)

        msg = MensagemDireta.objects.create(
            usuario_remetente=user,
            usuario_destinatario=partner,
            conteudo=conteudo,
        )

        serializer = MensagemDiretaSerializer(msg, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MessageReadView(APIView):
    """Mark a specific message as read"""
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, pk):
        msg = get_object_or_404(MensagemDireta, pk=pk, usuario_destinatario=request.user)
        msg.lida = True
        msg.data_leitura = timezone.now()
        msg.save()
        return Response({'lida': True}, status=status.HTTP_200_OK)


# ========== V2 DM Views ==========
from .models import Conversa, UploadChat
from .serializers import (
    ConversaListSerializer, MensagemDiretaV2Serializer, UploadChatSerializer
)
from rest_framework.parsers import MultiPartParser, FormParser
from django.db import transaction


class ConversaViewSet(viewsets.ModelViewSet):
    """
    ViewSet V2 para Mensagens Diretas baseado em Conversas explícitas.
    Endpoints:
    - GET  /api/v2/conversations/           → Inbox (listar conversas)
    - POST /api/v2/conversations/           → Criar/buscar conversa com um usuário
    - GET  /api/v2/conversations/<id>/messages/ → Histórico da conversa
    - POST /api/v2/conversations/<id>/send/  → Enviar mensagem
    - POST /api/v2/conversations/<id>/read/  → Marcar como lida
    - GET  /api/v2/conversations/unread-count/ → Total de não lidas
    """
    serializer_class = ConversaListSerializer
    permission_classes = (permissions.IsAuthenticated,)
    lookup_field = 'id_conversa'
    http_method_names = ['get', 'post']

    def get_queryset(self):
        user = self.request.user
        return Conversa.objects.filter(
            Q(usuario_a=user) | Q(usuario_b=user)
        ).select_related('usuario_a', 'usuario_b')

    def list(self, request):
        """Inbox: listar conversas do usuário com última mensagem e contagem de não lidas."""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = ConversaListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = ConversaListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request):
        """Criar ou buscar conversa 1:1 com um usuário alvo."""
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': _('user_id é obrigatório')}, status=status.HTTP_400_BAD_REQUEST)

        partner = get_object_or_404(User, pk=user_id)

        if partner.id_usuario == request.user.id_usuario:
            return Response({'error': _('Não é possível criar conversa consigo mesmo')}, status=status.HTTP_400_BAD_REQUEST)

        # Verificar bloqueio
        if Bloqueio.objects.filter(
            Q(usuario=request.user, usuario_bloqueado=partner) |
            Q(usuario=partner, usuario_bloqueado=request.user)
        ).exists():
            return Response({'error': _('Não é possível iniciar conversa com este usuário')}, status=status.HTTP_403_FORBIDDEN)

        conversa, created = Conversa.get_or_create_for_users(request.user, partner)
        serializer = ConversaListSerializer(conversa, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='messages')
    def messages(self, request, id_conversa=None):
        """Histórico de mensagens da conversa, paginado, mais recentes primeiro."""
        conversa = self.get_object()
        mensagens = conversa.mensagens.select_related(
            'usuario_remetente', 'upload', 'publicacao_compartilhada'
        ).all()

        page = self.paginate_queryset(mensagens)
        if page is not None:
            serializer = MensagemDiretaV2Serializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = MensagemDiretaV2Serializer(mensagens, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='send')
    def send(self, request, id_conversa=None):
        """Enviar mensagem na conversa (texto, mídia via upload_id, ou post via post_id)."""
        conversa = self.get_object()
        user = request.user

        # Determinar o parceiro
        if conversa.usuario_a_id == user.id_usuario:
            partner = conversa.usuario_b
        else:
            partner = conversa.usuario_a

        # Verificar bloqueio
        if Bloqueio.objects.filter(
            Q(usuario=user, usuario_bloqueado=partner) |
            Q(usuario=partner, usuario_bloqueado=user)
        ).exists():
            return Response({'error': _('Não é possível enviar mensagem para este usuário')}, status=status.HTTP_403_FORBIDDEN)

        conteudo = request.data.get('conteudo', '').strip()
        upload_id = request.data.get('upload_id')
        post_id = request.data.get('post_id')

        # Determinar tipo de mensagem
        tipo = 'text'
        upload_obj = None
        post_obj = None

        if upload_id:
            try:
                upload_obj = UploadChat.objects.get(id_upload=upload_id, usuario=user)
                tipo = 'media'
            except UploadChat.DoesNotExist:
                return Response({'error': _('Upload não encontrado ou não pertence a você')}, status=status.HTTP_400_BAD_REQUEST)
        elif post_id:
            try:
                from .models import Publicacao
                post_obj = Publicacao.objects.get(id_publicacao=post_id)
                tipo = 'post'
            except Publicacao.DoesNotExist:
                return Response({'error': _('Publicação não encontrada')}, status=status.HTTP_400_BAD_REQUEST)
        elif not conteudo:
            return Response({'error': _('Mensagem não pode ser vazia')}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            msg = MensagemDireta.objects.create(
                usuario_remetente=user,
                usuario_destinatario=partner,
                conversa=conversa,
                conteudo=conteudo if conteudo else None,
                tipo_mensagem=tipo,
                upload=upload_obj,
                publicacao_compartilhada=post_obj,
            )
            # Atualizar timestamp da conversa para ordenar no inbox
            conversa.save(update_fields=['data_atualizacao'])

        serializer = MensagemDiretaV2Serializer(msg, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='read')
    def mark_read(self, request, id_conversa=None):
        """Marcar todas as mensagens recebidas na conversa como lidas."""
        conversa = self.get_object()
        updated = conversa.mensagens.filter(
            usuario_destinatario=request.user,
            lida=False
        ).update(lida=True, data_leitura=timezone.now())
        return Response({'marked_read': updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        """Total de mensagens não lidas em todas as conversas do usuário."""
        count = MensagemDireta.objects.filter(
            usuario_destinatario=request.user,
            lida=False,
            deletada_destinatario=False,
        ).count()
        return Response({'unread_count': count}, status=status.HTTP_200_OK)


class UploadChatView(APIView):
    """Upload e exclusão de mídia para chat (two-step upload)."""
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        """Step 1: Upload de arquivo de mídia para posterior vinculação a mensagem."""
        arquivo = request.FILES.get('arquivo')
        if not arquivo:
            return Response({'error': _('Arquivo é obrigatório')}, status=status.HTTP_400_BAD_REQUEST)

        # Validar tamanho (10MB máximo)
        max_size = 10 * 1024 * 1024
        if arquivo.size > max_size:
            return Response({'error': _('Arquivo excede o tamanho máximo de 10MB')}, status=status.HTTP_400_BAD_REQUEST)

        # Detectar mime_type
        mime_type = arquivo.content_type or 'application/octet-stream'

        upload = UploadChat.objects.create(
            usuario=request.user,
            arquivo=arquivo,
            mime_type=mime_type,
            tamanho_bytes=arquivo.size,
        )

        serializer = UploadChatSerializer(upload)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def delete(self, request, pk=None):
        """Excluir upload não utilizado."""
        upload = get_object_or_404(UploadChat, pk=pk, usuario=request.user)
        upload.arquivo.delete(save=False)
        upload.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ==========================================
# FCM TOKEN REGISTRATION
# ==========================================

class FCMTokenView(APIView):
    """Registrar ou atualizar o token FCM do dispositivo do usuário."""
    permission_classes = (permissions.IsAuthenticated,)

    def put(self, request):
        token = request.data.get('fcm_token', '').strip()
        if not token:
            return Response({'error': _('fcm_token é obrigatório')}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.fcm_token = token
        user.fcm_token_updated_at = timezone.now()
        user.save(update_fields=['fcm_token', 'fcm_token_updated_at'])

        return Response({'message': _('Token FCM atualizado com sucesso')}, status=status.HTTP_200_OK)

    def delete(self, request):
        """Remove o token FCM (ex: ao fazer logout)."""
        user = request.user
        user.fcm_token = None
        user.fcm_token_updated_at = None
        user.save(update_fields=['fcm_token', 'fcm_token_updated_at'])

        return Response({'message': _('Token FCM removido')}, status=status.HTTP_200_OK)


# ==========================================
# ADMIN: NOTIFICAÇÕES BROADCAST
# ==========================================

from .models import NotificacaoAdmin, ConfiguracaoNotificacaoAdmin, AuditLogChat
from .serializers import NotificacaoAdminSerializer, ConfiguracaoNotificacaoAdminSerializer, AuditLogChatSerializer


class AdminNotificacaoListCreateView(APIView):
    """Listar e criar notificações broadcast (admin only)."""
    permission_classes = [IsAdminPermission]

    def get(self, request):
        """Lista todas as notificações broadcast."""
        notifs = NotificacaoAdmin.objects.all().select_related('criado_por')

        # Filtros
        status_filter = request.query_params.get('status')
        if status_filter == 'enviada':
            notifs = notifs.filter(enviada=True)
        elif status_filter == 'rascunho':
            notifs = notifs.filter(enviada=False)

        tipo_filter = request.query_params.get('tipo')
        if tipo_filter:
            notifs = notifs.filter(tipo=tipo_filter)

        serializer = NotificacaoAdminSerializer(notifs[:50], many=True)
        return Response(serializer.data)

    def post(self, request):
        """Criar uma nova notificação broadcast (rascunho)."""
        serializer = NotificacaoAdminSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(criado_por=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminNotificacaoDetailView(APIView):
    """Detalhe, edição e exclusão de notificação broadcast (admin only)."""
    permission_classes = [IsAdminPermission]

    def get(self, request, pk):
        notif = get_object_or_404(NotificacaoAdmin, pk=pk)
        serializer = NotificacaoAdminSerializer(notif)
        return Response(serializer.data)

    def patch(self, request, pk):
        notif = get_object_or_404(NotificacaoAdmin, pk=pk)
        if notif.enviada:
            return Response({'error': _('Não é possível editar notificação já enviada')}, status=status.HTTP_400_BAD_REQUEST)

        serializer = NotificacaoAdminSerializer(notif, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        notif = get_object_or_404(NotificacaoAdmin, pk=pk)
        if notif.enviada:
            return Response({'error': _('Não é possível excluir notificação já enviada')}, status=status.HTTP_400_BAD_REQUEST)
        notif.delete()
        return Response({'message': _('Notificação excluída')}, status=status.HTTP_200_OK)


class AdminNotificacaoSendView(APIView):
    """Disparar envio de uma notificação broadcast (admin only)."""
    permission_classes = [IsAdminPermission]

    def post(self, request, pk):
        notif = get_object_or_404(NotificacaoAdmin, pk=pk)

        if notif.enviada:
            return Response({'error': _('Notificação já foi enviada')}, status=status.HTTP_400_BAD_REQUEST)

        # Disparar task Celery para envio assíncrono
        from .tasks import send_broadcast_push
        send_broadcast_push.delay(str(notif.id_notificacao))

        return Response({
            'message': _('Envio de notificação iniciado em background'),
            'id_notificacao': str(notif.id_notificacao),
        }, status=status.HTTP_200_OK)


class AdminNotificacaoConfigView(APIView):
    """Configurações globais de notificações (admin only, singleton)."""
    permission_classes = [IsAdminPermission]

    def get(self, request):
        config, _ = ConfiguracaoNotificacaoAdmin.objects.get_or_create(pk=1)
        serializer = ConfiguracaoNotificacaoAdminSerializer(config)
        return Response(serializer.data)

    def patch(self, request):
        config, _ = ConfiguracaoNotificacaoAdmin.objects.get_or_create(pk=1)
        serializer = ConfiguracaoNotificacaoAdminSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(atualizado_por=request.user)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminNotificacaoStatsView(APIView):
    """Estatísticas de notificações (admin only)."""
    permission_classes = [IsAdminPermission]

    def get(self, request):
        from django.db.models import Sum

        total_broadcasts = NotificacaoAdmin.objects.count()
        total_enviadas = NotificacaoAdmin.objects.filter(enviada=True).count()
        total_rascunhos = NotificacaoAdmin.objects.filter(enviada=False).count()
        total_pushes = NotificacaoAdmin.objects.filter(enviada=True).aggregate(
            total=Sum('total_enviados')
        )['total'] or 0

        # Estatísticas de notificações in-app
        total_notif_inapp = Notificacao.objects.count()
        total_notif_lidas = Notificacao.objects.filter(lida=True).count()
        taxa_leitura = round((total_notif_lidas / total_notif_inapp * 100), 1) if total_notif_inapp > 0 else 0

        # Usuários com FCM token
        users_com_fcm = User.objects.filter(fcm_token__isnull=False).exclude(fcm_token='').count()
        users_total = User.objects.filter(status=1).count()

        return Response({
            'broadcasts': {
                'total': total_broadcasts,
                'enviadas': total_enviadas,
                'rascunhos': total_rascunhos,
                'total_pushes_enviados': total_pushes,
            },
            'notificacoes_inapp': {
                'total': total_notif_inapp,
                'lidas': total_notif_lidas,
                'taxa_leitura_pct': taxa_leitura,
            },
            'dispositivos': {
                'usuarios_com_fcm_token': users_com_fcm,
                'usuarios_ativos_total': users_total,
                'cobertura_pct': round((users_com_fcm / users_total * 100), 1) if users_total > 0 else 0,
            },
        })


# ==========================================
# ADMIN: AUDITORIA DE CHAT
# ==========================================

class AdminChatConversationsView(APIView):
    """Listar todas as conversas para auditoria (admin only)."""
    permission_classes = [IsAdminPermission]

    def get(self, request):
        from .models import Conversa
        from django.db.models import Count, Max

        conversas = Conversa.objects.select_related('usuario_a', 'usuario_b').annotate(
            total_mensagens=Count('mensagens'),
            ultima_mensagem_data=Max('mensagens__data_envio'),
            mensagens_moderadas=Count('mensagens', filter=Q(mensagens__moderada=True)),
        ).order_by('-data_atualizacao')

        # Filtros
        user_filter = request.query_params.get('user')
        if user_filter:
            conversas = conversas.filter(
                Q(usuario_a__nome_usuario__icontains=user_filter) |
                Q(usuario_b__nome_usuario__icontains=user_filter)
            )

        flagged = request.query_params.get('flagged')
        if flagged == 'true':
            conversas = conversas.filter(mensagens_moderadas__gt=0)

        data = []
        for c in conversas[:100]:
            data.append({
                'id_conversa': str(c.id_conversa),
                'usuario_a': {
                    'id': str(c.usuario_a.id_usuario),
                    'nome_usuario': c.usuario_a.nome_usuario,
                    'nome_completo': c.usuario_a.nome_completo,
                    'avatar_url': c.usuario_a.avatar_url,
                },
                'usuario_b': {
                    'id': str(c.usuario_b.id_usuario),
                    'nome_usuario': c.usuario_b.nome_usuario,
                    'nome_completo': c.usuario_b.nome_completo,
                    'avatar_url': c.usuario_b.avatar_url,
                },
                'total_mensagens': c.total_mensagens,
                'mensagens_moderadas': c.mensagens_moderadas,
                'ultima_mensagem_data': c.ultima_mensagem_data.isoformat() if c.ultima_mensagem_data else None,
                'data_criacao': c.data_criacao.isoformat(),
            })

        # Registrar no audit log
        AuditLogChat.objects.create(
            admin=request.user,
            acao='view',
            detalhes={'action': 'list_conversations', 'filters': dict(request.query_params)},
            ip_address=self._get_client_ip(request),
        )

        return Response(data)

    def _get_client_ip(self, request):
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class AdminChatMessagesView(APIView):
    """Ver mensagens de uma conversa específica (admin only)."""
    permission_classes = [IsAdminPermission]

    def get(self, request, pk):
        from .models import Conversa

        conversa = get_object_or_404(Conversa, pk=pk)
        mensagens = conversa.mensagens.select_related(
            'usuario_remetente', 'usuario_destinatario', 'moderada_por'
        ).order_by('data_envio')

        # Filtros
        keyword = request.query_params.get('q')
        if keyword:
            mensagens = mensagens.filter(conteudo__icontains=keyword)

        date_from = request.query_params.get('date_from')
        if date_from:
            mensagens = mensagens.filter(data_envio__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            mensagens = mensagens.filter(data_envio__lte=date_to)

        data = []
        for msg in mensagens[:500]:
            data.append({
                'id_mensagem': str(msg.id_mensagem),
                'remetente': {
                    'id': str(msg.usuario_remetente.id_usuario),
                    'nome_usuario': msg.usuario_remetente.nome_usuario,
                    'avatar_url': msg.usuario_remetente.avatar_url,
                },
                'destinatario': {
                    'id': str(msg.usuario_destinatario.id_usuario),
                    'nome_usuario': msg.usuario_destinatario.nome_usuario,
                },
                'conteudo': msg.conteudo,
                'tipo_mensagem': msg.tipo_mensagem,
                'data_envio': msg.data_envio.isoformat(),
                'lida': msg.lida,
                'moderada': msg.moderada,
                'moderada_por': msg.moderada_por.nome_usuario if msg.moderada_por else None,
                'moderada_em': msg.moderada_em.isoformat() if msg.moderada_em else None,
                'motivo_moderacao': msg.motivo_moderacao,
            })

        # Registrar audit log
        AuditLogChat.objects.create(
            conversa=conversa,
            admin=request.user,
            acao='view',
            detalhes={'action': 'view_messages', 'conversa_id': str(pk), 'msg_count': len(data)},
            ip_address=self._get_client_ip(request),
        )

        return Response({
            'conversa': {
                'id_conversa': str(conversa.id_conversa),
                'usuario_a': conversa.usuario_a.nome_usuario,
                'usuario_b': conversa.usuario_b.nome_usuario,
            },
            'mensagens': data,
            'total': len(data),
        })

    def _get_client_ip(self, request):
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class AdminChatModerateView(APIView):
    """Moderar uma mensagem de chat (admin only)."""
    permission_classes = [IsAdminPermission]

    def post(self, request, pk):
        msg = get_object_or_404(MensagemDireta, pk=pk)
        action = request.data.get('action')  # 'moderate' ou 'restore'
        motivo = request.data.get('motivo', '')

        if action == 'moderate':
            msg.moderada = True
            msg.moderada_por = request.user
            msg.moderada_em = timezone.now()
            msg.motivo_moderacao = motivo
            msg.save(update_fields=['moderada', 'moderada_por', 'moderada_em', 'motivo_moderacao'])

            # Registrar audit log
            AuditLogChat.objects.create(
                conversa=msg.conversa,
                mensagem=msg,
                admin=request.user,
                acao='moderate',
                detalhes={
                    'action': 'moderate_message',
                    'original_content': msg.conteudo[:500] if msg.conteudo else None,
                    'motivo': motivo,
                },
                ip_address=self._get_client_ip(request),
            )

            return Response({'message': _('Mensagem moderada com sucesso'), 'moderada': True})

        elif action == 'restore':
            msg.moderada = False
            msg.moderada_por = None
            msg.moderada_em = None
            msg.motivo_moderacao = None
            msg.save(update_fields=['moderada', 'moderada_por', 'moderada_em', 'motivo_moderacao'])

            AuditLogChat.objects.create(
                conversa=msg.conversa,
                mensagem=msg,
                admin=request.user,
                acao='restore',
                detalhes={'action': 'restore_message'},
                ip_address=self._get_client_ip(request),
            )

            return Response({'message': _('Mensagem restaurada'), 'moderada': False})

        return Response({'error': _('Ação inválida. Use: moderate, restore')}, status=status.HTTP_400_BAD_REQUEST)

    def _get_client_ip(self, request):
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class AdminChatAuditLogView(APIView):
    """Consultar log de auditoria de chat (admin only)."""
    permission_classes = [IsAdminPermission]

    def get(self, request):
        logs = AuditLogChat.objects.select_related('admin', 'conversa', 'mensagem').all()

        # Filtros
        admin_filter = request.query_params.get('admin')
        if admin_filter:
            logs = logs.filter(admin__nome_usuario__icontains=admin_filter)

        acao_filter = request.query_params.get('acao')
        if acao_filter:
            logs = logs.filter(acao=acao_filter)

        serializer = AuditLogChatSerializer(logs[:100], many=True)
        return Response(serializer.data)


class AdminChatStatsView(APIView):
    """Estatísticas gerais de chat (admin only)."""
    permission_classes = [IsAdminPermission]

    def get(self, request):
        from .models import Conversa
        from datetime import timedelta

        hoje = timezone.now()
        semana = hoje - timedelta(days=7)
        mes = hoje - timedelta(days=30)

        total_conversas = Conversa.objects.count()
        total_mensagens = MensagemDireta.objects.count()
        mensagens_semana = MensagemDireta.objects.filter(data_envio__gte=semana).count()
        mensagens_mes = MensagemDireta.objects.filter(data_envio__gte=mes).count()
        mensagens_moderadas = MensagemDireta.objects.filter(moderada=True).count()

        # Conversas mais ativas (últimos 7 dias)
        from django.db.models import Count
        top_conversas = Conversa.objects.annotate(
            msgs_recentes=Count('mensagens', filter=Q(mensagens__data_envio__gte=semana))
        ).filter(msgs_recentes__gt=0).order_by('-msgs_recentes').select_related('usuario_a', 'usuario_b')[:10]

        top_data = [{
            'id_conversa': str(c.id_conversa),
            'usuario_a': c.usuario_a.nome_usuario,
            'usuario_b': c.usuario_b.nome_usuario,
            'msgs_recentes': c.msgs_recentes,
        } for c in top_conversas]

        return Response({
            'total_conversas': total_conversas,
            'total_mensagens': total_mensagens,
            'mensagens_ultimos_7_dias': mensagens_semana,
            'mensagens_ultimos_30_dias': mensagens_mes,
            'mensagens_moderadas': mensagens_moderadas,
            'top_conversas_semana': top_data,
        })

