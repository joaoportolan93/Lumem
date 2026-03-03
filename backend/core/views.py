from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models, transaction
import os
import uuid
from .serializers import RegisterSerializer, UserSerializer, UserUpdateSerializer, LogoutSerializer, PasswordResetSerializer
from .throttles import LoginRateThrottle, RegisterRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView

User = get_user_model()

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


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login view with rate limiting and ban check"""
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        # First check if user is banned before attempting login
        email = request.data.get('email')
        if email:
            try:
                user = User.objects.get(email=email)
                if user.status == 2:  # Suspenso/Banido
                    return Response({
                        'error': 'Conta banida',
                        'message': 'Sua conta foi banida por tempo indeterminado devido a violação das regras da comunidade.',
                        'banned': True
                    }, status=status.HTTP_403_FORBIDDEN)
            except User.DoesNotExist:
                pass  # Let the parent handle invalid credentials
        
        return super().post(request, *args, **kwargs)

class UserProfileView(APIView):
    """Get current authenticated user's profile"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        serializer = UserSerializer(request.user, context={'request': request})
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
                {'error': 'Você só pode editar seu próprio perfil'},
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
            return Response({'message': 'Logout realizado com sucesso'}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetView(APIView):
    """Reset password by verifying identity via email + username"""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'message': 'Senha redefinida com sucesso!'},
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
                {'error': 'Nenhum arquivo enviado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['avatar']
        
        # Validate file extension
        ext = file.name.split('.')[-1].lower()
        if ext not in self.ALLOWED_EXTENSIONS:
            return Response(
                {'error': f'Formato não permitido. Use: {", ".join(self.ALLOWED_EXTENSIONS)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file size
        if file.size > self.MAX_FILE_SIZE:
            return Response(
                {'error': 'Arquivo muito grande. Máximo: 5MB'},
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
            'message': 'Avatar atualizado com sucesso',
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
from .models import Publicacao, Seguidor, ReacaoPublicacao, Comentario, Hashtag, PublicacaoHashtag, PublicacaoSalva
from .serializers import PublicacaoSerializer, PublicacaoCreateSerializer, SeguidorSerializer, HashtagSerializer, SearchSerializer, NotificacaoSerializer
from django.utils import timezone
from django.db.models import Count, Q

class PublicacaoViewSet(viewsets.ModelViewSet):
    """ViewSet for dream posts CRUD operations"""
    permission_classes = (permissions.IsAuthenticated,)
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PublicacaoCreateSerializer
        return PublicacaoSerializer
    
    def get_serializer_context(self):
        return {'request': self.request}
    
    def get_queryset(self):
        """Return dreams based on tab parameter: following or foryou"""
        user = self.request.user
        
        # Helper to get following IDs
        following_ids = Seguidor.objects.filter(
            usuario_seguidor=user, status=1
        ).values_list('usuario_seguido_id', flat=True)

        # Get blocked user IDs to exclude their posts
        from .models import Bloqueio
        blocked_user_ids = Bloqueio.objects.filter(
            usuario=user
        ).values_list('usuario_bloqueado_id', flat=True)

        # Base filter: exclude posts from banned users, blocked users,
        # AND private accounts (unless followed or own posts)
        privacy_filter = (
            Q(usuario__privacidade_padrao=1) |  # Public accounts
            Q(usuario__in=following_ids) |       # Followed private accounts
            Q(usuario=user)                      # Own posts
        )
        base_filter = Q(usuario__status=1) & ~Q(usuario__in=blocked_user_ids) & privacy_filter

        # Post visibility rules:
        # 1: Public -> Visible to all who pass base_filter
        # 2: Close Friends/Followers -> Visible if current user follows author
        # 3: Private -> Only visible to the author
        visibility_q = (
            Q(visibilidade=1) |
            (Q(visibilidade=2) & Q(usuario__in=following_ids)) |
            Q(usuario=user)
        )

        if self.action == 'list':
            tab = self.request.query_params.get('tab', 'following')
            
            if tab == 'mine':
                # My Dreams: All dreams by the current user
                return Publicacao.objects.filter(
                    usuario=user
                ).order_by('-data_publicacao')

            if tab == 'saved':
                # Saved Dreams: Posts saved by the user
                return Publicacao.objects.filter(
                    base_filter,
                    visibility_q,
                    publicacaosalva__usuario=user
                ).order_by('-publicacaosalva__data_salvo')
            
            if tab == 'community':
                community_id = self.request.query_params.get('community_id')
                if community_id:
                    return Publicacao.objects.filter(
                        base_filter,
                        visibility_q,
                        comunidade_id=community_id
                    ).order_by('-data_publicacao')

            if tab == 'my_community_posts':
                # My Community Posts: Only current user's posts in communities
                return Publicacao.objects.filter(
                    usuario=user,
                    comunidade__isnull=False
                ).order_by('-data_publicacao')

            if tab == 'user_posts':
                # Specific user's feed posts (no community posts)
                user_id = self.request.query_params.get('user_id')
                if user_id:
                    target_user = get_object_or_404(User, pk=user_id)
                    # Respect privacy
                    is_private = target_user.privacidade_padrao == 2
                    is_following = target_user.pk in following_ids
                    is_self = target_user.pk == user.pk
                    if is_private and not is_following and not is_self:
                        return Publicacao.objects.none()
                    return Publicacao.objects.filter(
                        base_filter,
                        visibility_q,
                        usuario_id=user_id,
                        comunidade__isnull=True
                    ).order_by('-data_publicacao')

            if tab == 'user_community_posts':
                # Specific user's community posts
                user_id = self.request.query_params.get('user_id')
                if user_id:
                    target_user = get_object_or_404(User, pk=user_id)
                    is_private = target_user.privacidade_padrao == 2
                    is_following = target_user.pk in following_ids
                    is_self = target_user.pk == user.pk
                    if is_private and not is_following and not is_self:
                        return Publicacao.objects.none()
                    return Publicacao.objects.filter(
                        base_filter,
                        visibility_q,
                        usuario_id=user_id,
                        comunidade__isnull=False
                    ).order_by('-data_publicacao')

            if tab == 'user_media':
                # Posts with media (images). Optional user_id filter.
                user_id = self.request.query_params.get('user_id')
                media_filter = Q(imagem__isnull=False) & ~Q(imagem='')
                if user_id:
                    target_user = get_object_or_404(User, pk=user_id)
                    is_private = target_user.privacidade_padrao == 2
                    is_following = target_user.pk in following_ids
                    is_self = target_user.pk == user.pk
                    if is_private and not is_following and not is_self:
                        return Publicacao.objects.none()
                    return Publicacao.objects.filter(
                        base_filter,
                        visibility_q,
                        usuario_id=user_id
                    ).filter(media_filter).order_by('-data_publicacao')
                else:
                    # Own media posts
                    return Publicacao.objects.filter(
                        usuario=user
                    ).filter(media_filter).order_by('-data_publicacao')

            if tab == 'foryou':
                # For You: Public dreams ordered by engagement (likes + comments)
                return Publicacao.objects.filter(
                    base_filter,
                    visibilidade=1
                ).annotate(
                    engagement=Count('reacaopublicacao', distinct=True) + Count('comentario', distinct=True)
                ).order_by('-engagement', '-data_publicacao')[:50]
            
            # Following: Dreams from people user follows + own dreams
            return Publicacao.objects.filter(
                base_filter,
                visibility_q,
                Q(usuario__in=following_ids) | Q(usuario=user)
            ).order_by('-data_publicacao')

        # For detailed actions (retrieve, like, etc), return all accessible posts
        # Accessible = Satisfies visibility rules AND base filters
        return Publicacao.objects.filter(
            base_filter,
            visibility_q
        ).distinct()
    
    def perform_create(self, serializer):
        post = serializer.save(usuario=self.request.user)
        
        # Extract hashtags
        import re
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
    
    def perform_update(self, serializer):
        serializer.save(editado=True, data_edicao=timezone.now())
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.usuario.id_usuario != request.user.id_usuario:
            return Response(
                {'error': 'Você só pode editar seus próprios sonhos'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.usuario.id_usuario != request.user.id_usuario:
            return Response(
                {'error': 'Você só pode excluir seus próprios sonhos'},
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
            message = 'Post removido dos salvos'
        else:
            PublicacaoSalva.objects.create(
                publicacao=dream,
                usuario=request.user
            )
            is_saved = True
            message = 'Post salvo com sucesso'

        return Response({
            'is_saved': is_saved,
            'message': message
        }, status=status.HTTP_200_OK)


class FollowView(APIView):
    """Views for following/unfollowing users"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        """Follow a user"""
        user_to_follow = get_object_or_404(User, pk=pk)
        
        # Can't follow yourself
        if request.user.id_usuario == pk:
            return Response(
                {'error': 'Você não pode seguir a si mesmo'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Can't follow a blocked user or a user who blocked you
        from .models import Bloqueio
        if Bloqueio.objects.filter(
            Q(usuario=request.user, usuario_bloqueado=user_to_follow) |
            Q(usuario=user_to_follow, usuario_bloqueado=request.user)
        ).exists():
            return Response(
                {'error': 'Não é possível seguir este usuário'},
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
                    {'error': 'Você já está seguindo este usuário'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if existing.status == 3:
                return Response(
                    {'error': 'Solicitação já enviada', 'follow_status': 'pending'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Reactivate if was blocked/inactive - check privacy
            if user_to_follow.privacidade_padrao == 2:
                existing.status = 3  # Pending for private accounts
                existing.data_seguimento = timezone.now()
                existing.save()
                return Response({
                    'message': f'Solicitação enviada para {user_to_follow.nome_usuario}',
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
                    'message': f'Solicitação enviada para {user_to_follow.nome_usuario}',
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
            'message': f'Você agora está seguindo {user_to_follow.nome_usuario}',
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
                {'error': 'Você não está seguindo este usuário'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        was_pending = follow.status == 3
        follow.delete()
        
        return Response({
            'message': f'Você deixou de seguir {user_to_unfollow.nome_usuario}' if not was_pending else 'Solicitação cancelada',
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
                    {'error': 'Esta conta é privada. Apenas seguidores aprovados podem ver esta lista.'},
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
                    {'error': 'Esta conta é privada. Apenas seguidores aprovados podem ver esta lista.'},
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
            return Response({'error': 'Você não pode bloquear a si mesmo'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if already blocked
        from .models import Bloqueio
        if Bloqueio.objects.filter(usuario=request.user, usuario_bloqueado=user_to_block).exists():
            return Response({'message': 'Usuário já está bloqueado'}, status=status.HTTP_200_OK)
        
        # Create block
        Bloqueio.objects.create(usuario=request.user, usuario_bloqueado=user_to_block)
        
        # Also unfollow if following
        Seguidor.objects.filter(usuario_seguidor=request.user, usuario_seguido=user_to_block).delete()
        Seguidor.objects.filter(usuario_seguidor=user_to_block, usuario_seguido=request.user).delete()
        
        return Response({'message': f'Você bloqueou {user_to_block.nome_usuario}'}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        """Unblock a user"""
        user_to_unblock = get_object_or_404(User, pk=pk)
        
        from .models import Bloqueio
        deleted, _ = Bloqueio.objects.filter(usuario=request.user, usuario_bloqueado=user_to_unblock).delete()
        
        if not deleted:
            return Response({'error': 'Este usuário não está bloqueado'}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({'message': f'Você desbloqueou {user_to_unblock.nome_usuario}'}, status=status.HTTP_200_OK)


class MuteView(APIView):
    """Views for muting/unmuting users"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        """Mute a user"""
        user_to_mute = get_object_or_404(User, pk=pk)
        
        if request.user.id_usuario == pk:
            return Response({'error': 'Você não pode silenciar a si mesmo'}, status=status.HTTP_400_BAD_REQUEST)
        
        from .models import Silenciamento
        if Silenciamento.objects.filter(usuario=request.user, usuario_silenciado=user_to_mute).exists():
            return Response({'message': 'Usuário já está silenciado'}, status=status.HTTP_200_OK)
        
        Silenciamento.objects.create(usuario=request.user, usuario_silenciado=user_to_mute)
        
        return Response({'message': f'Você silenciou {user_to_mute.nome_usuario}'}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        """Unmute a user"""
        user_to_unmute = get_object_or_404(User, pk=pk)
        
        from .models import Silenciamento
        deleted, _ = Silenciamento.objects.filter(usuario=request.user, usuario_silenciado=user_to_unmute).delete()
        
        if not deleted:
            return Response({'error': 'Este usuário não está silenciado'}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({'message': f'Você deixou de silenciar {user_to_unmute.nome_usuario}'}, status=status.HTTP_200_OK)


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
                {'error': 'Solicitação não encontrada'},
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
                'message': 'Solicitação aceita',
                'status': 'accepted'
            }, status=status.HTTP_200_OK)
        
        elif action == 'reject':
            follow_request.delete()
            return Response({
                'message': 'Solicitação recusada',
                'status': 'rejected'
            }, status=status.HTTP_200_OK)
        
        return Response(
            {'error': 'Ação inválida. Use "accept" ou "reject"'},
            status=status.HTTP_400_BAD_REQUEST
        )

# Comments ViewSet
from .serializers import ComentarioSerializer, ComentarioCreateSerializer

class ComentarioViewSet(viewsets.ModelViewSet):
    """ViewSet for comments on dream posts - Twitter-like"""
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser,)
    
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
                {'error': 'Você só pode editar seus próprios comentários'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.usuario.id_usuario != request.user.id_usuario:
            return Response(
                {'error': 'Você só pode excluir seus próprios comentários'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Prevent deletion if comment has replies to preserve thread structure
        if instance.respostas.filter(status=1).exists():
            return Response(
                {'error': 'Não é possível excluir um comentário que possui respostas. Exclua as respostas primeiro.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().destroy(request, *args, **kwargs)


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


# Helper function to create notifications
def create_notification(usuario_destino, usuario_origem, tipo, id_referencia=None, conteudo=None):
    """Create a notification if destino != origem AND user has that notification type enabled"""
    if usuario_destino.id_usuario != usuario_origem.id_usuario:
        # Check user's notification settings
        try:
            settings = ConfiguracaoUsuario.objects.get(usuario=usuario_destino)
            
            # Map notification types to settings fields
            # tipo: 1=Nova Publicação, 2=Comentário, 3=Curtida, 4=Seguidor Novo
            notification_settings = {
                1: settings.notificacoes_novas_publicacoes,
                2: settings.notificacoes_comentarios,
                3: settings.notificacoes_reacoes,
                4: settings.notificacoes_seguidor_novo,
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
            return Response({'message': 'Status atualizado', 'status': new_status})
        
        return Response({'error': 'Status inválido'}, status=status.HTTP_400_BAD_REQUEST)


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
            return Response({'message': 'Denúncia ignorada'})

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
            return Response({'message': 'Conteúdo removido'})

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
            return Response({'message': 'Usuário banido'})

        return Response({'error': 'Ação inválida'}, status=status.HTTP_400_BAD_REQUEST)


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
                {'error': 'Campos obrigatórios: id_conteudo, tipo_conteudo, motivo_denuncia'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate tipo_conteudo
        if tipo_conteudo not in [1, 2, 3]:
            return Response(
                {'error': 'tipo_conteudo inválido. Use: 1 (Post), 2 (Comment), 3 (User)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate motivo_denuncia
        if motivo_denuncia not in [1, 2, 3]:
            return Response(
                {'error': 'motivo_denuncia inválido. Use: 1, 2 ou 3'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if content exists
        if tipo_conteudo == 1:
            if not Publicacao.objects.filter(id_publicacao=id_conteudo).exists():
                return Response({'error': 'Publicação não encontrada'}, status=status.HTTP_404_NOT_FOUND)
        elif tipo_conteudo == 2:
            if not Comentario.objects.filter(id_comentario=id_conteudo).exists():
                return Response({'error': 'Comentário não encontrado'}, status=status.HTTP_404_NOT_FOUND)
        elif tipo_conteudo == 3:
            if not User.objects.filter(id_usuario=id_conteudo).exists():
                return Response({'error': 'Usuário não encontrado'}, status=status.HTTP_404_NOT_FOUND)

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
            'message': 'Denúncia enviada com sucesso',
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
            'message': 'Amigo próximo adicionado' if follow.is_close_friend else 'Amigo próximo removido'
        }, status=status.HTTP_200_OK)
# ==========================================
# COMMUNITIES VIEWS
# ==========================================

from .models import Comunidade, MembroComunidade, BanimentoComunidade
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
            return False, f'Formato não permitido. Use: {", ".join(self.ALLOWED_EXTENSIONS)}'
        if file.size > self.MAX_FILE_SIZE:
            return False, 'Arquivo muito grande. Máximo: 5MB'
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
            return Response({'error': 'Apenas moderadores podem alterar o ícone'}, status=status.HTTP_403_FORBIDDEN)

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
        return Response({'message': 'Ícone atualizado!', 'imagem': image_url}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='upload-banner')
    def upload_banner(self, request, pk=None):
        """Upload community banner image (moderators only)"""
        community = self.get_object()
        if not self._check_moderator(request, community):
            return Response({'error': 'Apenas moderadores podem alterar o banner'}, status=status.HTTP_403_FORBIDDEN)

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
        return Response({'message': 'Banner atualizado!', 'banner': banner_url}, status=status.HTTP_200_OK)

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
            return Response({'error': 'Apenas administradores podem excluir a comunidade'}, status=status.HTTP_403_FORBIDDEN)
        
        community.delete()
        return Response({'message': 'Comunidade excluída com sucesso'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Join a community"""
        community = self.get_object()
        user = request.user
        
        # Check if already member
        if MembroComunidade.objects.filter(comunidade=community, usuario=user).exists():
            return Response({'error': 'Você já é membro desta comunidade'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if banned
        if BanimentoComunidade.objects.filter(comunidade=community, usuario=user).exists():
            return Response({'error': 'Você está banido desta comunidade'}, status=status.HTTP_403_FORBIDDEN)
            
        MembroComunidade.objects.create(comunidade=community, usuario=user, role='member')
        return Response({
            'message': 'Bem-vindo à comunidade!',
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
             return Response({'error': 'Você não é membro desta comunidade'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Prevent last admin from leaving
        if membership.role == 'admin':
            admin_count = MembroComunidade.objects.filter(comunidade=community, role='admin').count()
            if admin_count <= 1:
                return Response({'error': 'Você é o único admin. Promova outro membro antes de sair.'}, status=status.HTTP_400_BAD_REQUEST)
        
        membership.delete()
        return Response({
            'message': 'Você saiu da comunidade',
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
            return Response({'error': 'Apenas administradores podem gerenciar roles'}, status=status.HTTP_403_FORBIDDEN)
        
        target_user_id = request.data.get('user_id')
        new_role = request.data.get('role')
        
        if not target_user_id or not new_role:
            return Response({'error': 'Campos obrigatórios: user_id, role'}, status=status.HTTP_400_BAD_REQUEST)
        
        if new_role not in ['member', 'moderator', 'admin']:
            return Response({'error': 'Role inválido. Use: member, moderator, admin'}, status=status.HTTP_400_BAD_REQUEST)
        
        membership = MembroComunidade.objects.filter(
            comunidade=community, 
            usuario_id=target_user_id
        ).first()
        
        if not membership:
            return Response({'error': 'Usuário não é membro desta comunidade'}, status=status.HTTP_404_NOT_FOUND)
        
        # Prevent removing own admin role if last admin
        if membership.usuario == user and membership.role == 'admin' and new_role != 'admin':
            admin_count = MembroComunidade.objects.filter(comunidade=community, role='admin').count()
            if admin_count <= 1:
                return Response({'error': 'Você é o único admin. Promova outro membro antes de se rebaixar.'}, status=status.HTTP_400_BAD_REQUEST)
        
        membership.role = new_role
        membership.save()
        
        role_names = {'member': 'Membro', 'moderator': 'Moderador', 'admin': 'Administrador'}
        return Response({
            'message': f'Usuário agora é {role_names.get(new_role)}',
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
                {'error': 'Apenas moderadores podem ver estatísticas'}, 
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
            return Response({'error': 'Apenas moderadores podem editar a comunidade'}, status=status.HTTP_403_FORBIDDEN)
        
        # Only allow updating specific fields
        allowed_fields = {'nome', 'descricao', 'regras'}
        update_data = {k: v for k, v in request.data.items() if k in allowed_fields}
        
        if not update_data:
            return Response({'error': 'Nenhum campo válido para atualizar'}, status=status.HTTP_400_BAD_REQUEST)
        
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
            return Response({'error': 'Apenas moderadores podem banir membros'}, status=status.HTTP_403_FORBIDDEN)
        
        target_user_id = request.data.get('user_id')
        motivo = request.data.get('motivo', '')
        
        if not target_user_id:
            return Response({'error': 'Campo obrigatório: user_id'}, status=status.HTTP_400_BAD_REQUEST)
        
        target_user = User.objects.filter(id_usuario=target_user_id).first()
        if not target_user:
            return Response({'error': 'Usuário não encontrado'}, status=status.HTTP_404_NOT_FOUND)
        
        # Prevent banning admins
        target_membership = MembroComunidade.objects.filter(comunidade=community, usuario=target_user).first()
        if target_membership and target_membership.role == 'admin':
            return Response({'error': 'Não é possível banir um administrador'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Prevent self-ban
        if target_user.id_usuario == request.user.id_usuario:
            return Response({'error': 'Você não pode banir a si mesmo'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if already banned
        if BanimentoComunidade.objects.filter(comunidade=community, usuario=target_user).exists():
            return Response({'error': 'Usuário já está banido'}, status=status.HTTP_400_BAD_REQUEST)
        
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
            'message': f'Usuário {target_user.nome_usuario} foi banido da comunidade',
            'user_id': target_user_id
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='unban-member')
    def unban_member(self, request, pk=None):
        """Unban a member from the community (Moderators only)"""
        community = self.get_object()
        if not self._check_moderator(request, community):
            return Response({'error': 'Apenas moderadores podem desbanir membros'}, status=status.HTTP_403_FORBIDDEN)
        
        target_user_id = request.data.get('user_id')
        if not target_user_id:
            return Response({'error': 'Campo obrigatório: user_id'}, status=status.HTTP_400_BAD_REQUEST)
        
        ban = BanimentoComunidade.objects.filter(comunidade=community, usuario_id=target_user_id).first()
        if not ban:
            return Response({'error': 'Usuário não está banido'}, status=status.HTTP_404_NOT_FOUND)
        
        ban.delete()
        return Response({
            'message': 'Usuário desbanido com sucesso',
            'user_id': target_user_id
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='banned-members')
    def banned_members(self, request, pk=None):
        """List banned members (Moderators only)"""
        community = self.get_object()
        if not self._check_moderator(request, community):
            return Response({'error': 'Apenas moderadores podem ver banidos'}, status=status.HTTP_403_FORBIDDEN)
        
        bans = BanimentoComunidade.objects.filter(
            comunidade=community
        ).select_related('usuario', 'moderador').order_by('-data_ban')
        
        serializer = BanimentoComunidadeSerializer(bans, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='invite-moderator')
    def invite_moderator(self, request, pk=None):
        """Invite/promote a user to moderator (Admins only)"""
        community = self.get_object()
        
        # Only admins can invite moderators
        is_admin = MembroComunidade.objects.filter(
            comunidade=community,
            usuario=request.user,
            role='admin'
        ).exists()
        
        if not is_admin and not request.user.is_admin:
            return Response({'error': 'Apenas administradores podem convidar moderadores'}, status=status.HTTP_403_FORBIDDEN)
        
        target_user_id = request.data.get('user_id')
        if not target_user_id:
            return Response({'error': 'Campo obrigatório: user_id'}, status=status.HTTP_400_BAD_REQUEST)
        
        target_user = User.objects.filter(id_usuario=target_user_id).first()
        if not target_user:
            return Response({'error': 'Usuário não encontrado'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if banned
        if BanimentoComunidade.objects.filter(comunidade=community, usuario=target_user).exists():
            return Response({'error': 'Usuário está banido desta comunidade'}, status=status.HTTP_400_BAD_REQUEST)
        
        # If already a member, promote to moderator
        membership = MembroComunidade.objects.filter(comunidade=community, usuario=target_user).first()
        if membership:
            if membership.role in ['moderator', 'admin']:
                return Response({'error': 'Usuário já é moderador/admin'}, status=status.HTTP_400_BAD_REQUEST)
            membership.role = 'moderator'
            membership.save()
        else:
            # Add as moderator directly
            MembroComunidade.objects.create(
                comunidade=community,
                usuario=target_user,
                role='moderator'
            )
        
        return Response({
            'message': f'{target_user.nome_usuario} agora é moderador da comunidade',
            'user_id': target_user_id,
            'role': 'moderator'
        }, status=status.HTTP_200_OK)


# Rascunho (Draft) ViewSet
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

