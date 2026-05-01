from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password, check_password
from django.utils.translation import gettext as _

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    seguidores_count = serializers.SerializerMethodField()
    seguindo_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    is_blocked = serializers.SerializerMethodField()
    is_muted = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id_usuario', 'nome_usuario', 'email', 'nome_completo', 'bio', 'avatar_url',
                  'data_nascimento', 'data_criacao', 'seguidores_count', 'seguindo_count',
                  'is_following', 'is_blocked', 'is_muted', 'is_admin', 'privacidade_padrao')

    def get_avatar_url(self, obj):
        if obj.avatar_url:
           request = self.context.get('request')
           if request:
               return request.build_absolute_uri(obj.avatar_url)
           return obj.avatar_url
        return None

    def get_seguidores_count(self, obj):
        if hasattr(obj, 'annotated_seguidores_count'):
            return obj.annotated_seguidores_count
        from .models import Seguidor
        return Seguidor.objects.filter(usuario_seguido=obj, status=1).count()

    def get_seguindo_count(self, obj):
        if hasattr(obj, 'annotated_seguindo_count'):
            return obj.annotated_seguindo_count
        from .models import Seguidor
        return Seguidor.objects.filter(usuario_seguidor=obj, status=1).count()

    def get_is_following(self, obj):
        if hasattr(obj, 'annotated_is_following'):
            return obj.annotated_is_following
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if request.user.id_usuario == obj.id_usuario:
                return None  # Não mostra para o próprio usuário
            from .models import Seguidor
            return Seguidor.objects.filter(
                usuario_seguidor=request.user,
                usuario_seguido=obj,
                status=1
            ).exists()
        return False

    def get_is_blocked(self, obj):
        if hasattr(obj, 'annotated_is_blocked'):
            return obj.annotated_is_blocked
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from .models import Bloqueio
            return Bloqueio.objects.filter(
                usuario=request.user,
                usuario_bloqueado=obj
            ).exists()
        return False

    def get_is_muted(self, obj):
        if hasattr(obj, 'annotated_is_muted'):
            return obj.annotated_is_muted
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from .models import Silenciamento
            return Silenciamento.objects.filter(
                usuario=request.user,
                usuario_silenciado=obj
            ).exists()
        return False

class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer para o endpoint seguro de troca de senha quando o usuário já está autenticado.
    Requer a senha antiga para confirmar a identidade.
    """
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError(_("Senha atual está incorreta."))
        return value

    def validate_new_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError(_("A nova senha deve ter no mínimo 6 caracteres."))
        return value


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer de cadastro orientado para adultos (+18).
    Valida:
      - data_nascimento obrigatória
      - Bloqueia cadastro de menores de 18 anos
      - Exige aceite explícito dos Termos e Política de Privacidade
    """
    password = serializers.CharField(write_only=True)
    aceite_termos = serializers.BooleanField(write_only=True)

    class Meta:
        model = User
        fields = ('nome_usuario', 'email', 'nome_completo', 'password',
                  'data_nascimento', 'aceite_termos')

    def validate_data_nascimento(self, value):
        from datetime import date
        if not value:
            raise serializers.ValidationError(_('A data de nascimento é obrigatória.'))
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 18:
            raise serializers.ValidationError(
                _('O Lumem é restrito a usuários com 18 anos ou mais.')
            )
        return value

    def validate_aceite_termos(self, value):
        if not value:
            raise serializers.ValidationError(
                _('Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.')
            )
        return value

    def create(self, validated_data):
        from django.utils import timezone as tz
        validated_data.pop('aceite_termos')

        user = User.objects.create_user(
            email=validated_data['email'],
            nome_usuario=validated_data['nome_usuario'],
            nome_completo=validated_data['nome_completo'],
            password=validated_data['password'],
        )
        user.data_nascimento = validated_data.get('data_nascimento')
        user.aceite_termos_em = tz.now()
        user.is_active = True
        user.save(update_fields=['data_nascimento', 'aceite_termos_em', 'is_active'])

        return user

class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile"""
    class Meta:
        model = User
        fields = ('nome_completo', 'nome_usuario', 'bio', 'avatar_url', 'data_nascimento', 'privacidade_padrao')
        extra_kwargs = {
            'nome_completo': {'required': False},
            'nome_usuario': {'required': False},
            'bio': {'required': False},
            'avatar_url': {'required': False},
            'data_nascimento': {'required': False},
            'privacidade_padrao': {'required': False},
        }

class LogoutSerializer(serializers.Serializer):
    """Serializer for logout - blacklists refresh token"""
    refresh = serializers.CharField()

    default_error_messages = {
        'bad_token': _('Token inválido ou expirado.')
    }

    def validate(self, attrs):
        self.token = attrs['refresh']
        return attrs

    def save(self, **kwargs):
        try:
            RefreshToken(self.token).blacklist()
        except TokenError:
            self.fail('bad_token')



class RequestPasswordResetCodeSerializer(serializers.Serializer):
    """Serializer for requesting a password reset email code"""
    email = serializers.EmailField()

    def validate(self, attrs):
        email = attrs.get('email', '').lower()
        if not User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                _('Não foi encontrado nenhum usuário com este endereço de email.')
            )
        attrs['email'] = email
        return attrs


class VerifyAndResetPasswordSerializer(serializers.Serializer):
    """Serializer for verifying the email code and resetting password"""
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=6, write_only=True)

    def validate(self, attrs):
        email = attrs.get('email', '').lower()
        code = attrs.get('code', '')
        
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                _('Não foi encontrado nenhum usuário com este endereço de email.')
            )
            
        from .models import PasswordResetCode
        # Need to check if there's a valid code
        valid_code = PasswordResetCode.objects.filter(
            usuario=user,
            code=code,
            is_used=False
        ).order_by('-created_at').first()
        
        if not valid_code:
            raise serializers.ValidationError(_('Código inválido ou inexistente.'))
            
        if not valid_code.is_valid():
            raise serializers.ValidationError(_('Este código expirou. Solicite um novo código.'))
            
        attrs['user'] = user
        attrs['valid_code'] = valid_code
        return attrs

    def save(self, **kwargs):
        user = self.validated_data['user']
        valid_code = self.validated_data['valid_code']
        
        user.set_password(self.validated_data['new_password'])
        user.save()
        
        valid_code.is_used = True
        valid_code.save(update_fields=['is_used'])
        return user


# Dream (Publicacao) Serializers
from .models import Publicacao

class PublicacaoSerializer(serializers.ModelSerializer):
    """Serializer for reading dream posts"""
    usuario = UserSerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()
    comentarios_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    comunidade_id = serializers.UUIDField(source='comunidade.id_comunidade', read_only=True, default=None)
    comunidade_nome = serializers.CharField(source='comunidade.nome', read_only=True, default=None)
    
    is_efemero = serializers.BooleanField(read_only=True)
    expira_em = serializers.DateTimeField(read_only=True)
    tempo_restante_segundos = serializers.SerializerMethodField()
    
    class Meta:
        model = Publicacao
        fields = (
            'id_publicacao', 'usuario', 'titulo', 'conteudo_texto',
            'data_sonho', 'tipo_sonho', 'visibilidade', 'emocoes_sentidas', 'imagem', 'video',
            'data_publicacao', 'editado', 'data_edicao', 'views_count',
            'likes_count', 'comentarios_count', 'is_liked', 'is_saved',
            'comunidade_id', 'comunidade_nome',
            'is_efemero', 'expira_em', 'tempo_restante_segundos'
        )
        read_only_fields = ('id_publicacao', 'usuario', 'data_publicacao', 'editado', 'data_edicao', 'views_count', 'is_efemero', 'expira_em')

    def get_tempo_restante_segundos(self, obj):
        if not obj.is_efemero or not obj.expira_em:
            return None
        from django.utils import timezone
        remaining = (obj.expira_em - timezone.now()).total_seconds()
        return max(0, int(remaining))

    def get_likes_count(self, obj):
        if hasattr(obj, 'annotated_likes_count'):
            return obj.annotated_likes_count
        from .models import ReacaoPublicacao
        return ReacaoPublicacao.objects.filter(publicacao=obj).count()

    def get_comentarios_count(self, obj):
        if hasattr(obj, 'annotated_comentarios_count'):
            return obj.annotated_comentarios_count
        from .models import Comentario
        return Comentario.objects.filter(publicacao=obj, status=1).count()

    def get_is_liked(self, obj):
        if hasattr(obj, 'annotated_is_liked'):
            return obj.annotated_is_liked
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from .models import ReacaoPublicacao
            return ReacaoPublicacao.objects.filter(
                publicacao=obj,
                usuario=request.user
            ).exists()
        return False

    def get_is_saved(self, obj):
        if hasattr(obj, 'annotated_is_saved'):
            return obj.annotated_is_saved
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from .models import PublicacaoSalva
            return PublicacaoSalva.objects.filter(
                publicacao=obj,
                usuario=request.user
            ).exists()
        return False


class PublicacaoCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating dream posts"""
    class Meta:
        model = Publicacao
        fields = (
            'titulo', 'conteudo_texto', 'data_sonho', 'tipo_sonho',
            'visibilidade', 'emocoes_sentidas', 'localizacao', 'imagem', 'video', 'comunidade'
        )
        extra_kwargs = {
            'titulo': {'required': False},
            'data_sonho': {'required': False},
            'tipo_sonho': {'required': False},
            'visibilidade': {'required': False},
            'emocoes_sentidas': {'required': False},
            'localizacao': {'required': False},
            'imagem': {'required': False},
            'video': {'required': False},
            'comunidade': {'required': False},
        }


# Seguidor Serializer
from .models import Seguidor

class SeguidorSerializer(serializers.ModelSerializer):
    """Serializer for follow relationship"""
    usuario_seguidor = UserSerializer(read_only=True)
    usuario_seguido = UserSerializer(read_only=True)
    
    class Meta:
        model = Seguidor
        fields = ('id_seguidor', 'usuario_seguidor', 'usuario_seguido', 'data_seguimento', 'status')
        read_only_fields = ('id_seguidor', 'data_seguimento', 'status')


# Comentario Serializers
from .models import Comentario

class ComentarioSerializer(serializers.ModelSerializer):
    """Serializer for reading comments - Twitter-like structure"""
    usuario = UserSerializer(read_only=True)
    respostas = serializers.SerializerMethodField()
    respostas_count = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    replying_to = serializers.SerializerMethodField()
    post_owner = serializers.SerializerMethodField()
    imagem_url = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Comentario
        fields = (
            'id_comentario', 'usuario', 'conteudo_texto', 'data_comentario', 
            'editado', 'respostas', 'respostas_count', 'likes_count', 'is_liked', 
            'can_delete', 'can_edit', 'replying_to', 'post_owner',
            'imagem_url', 'video_url', 'views_count'
        )
        read_only_fields = fields

    def get_respostas(self, obj):
        # Recursive serialization - limit depth to avoid infinite loops
        depth = self.context.get('depth', 0)
        if depth < 3 and obj.respostas.exists():
            context = {**self.context, 'depth': depth + 1}
            return ComentarioSerializer(
                obj.respostas.filter(status=1).order_by('data_comentario'), 
                many=True, 
                context=context
            ).data
        return []

    def get_respostas_count(self, obj):
        return obj.respostas.filter(status=1).count()

    def get_likes_count(self, obj):
        from .models import ReacaoComentario
        return ReacaoComentario.objects.filter(comentario=obj).count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from .models import ReacaoComentario
            return ReacaoComentario.objects.filter(
                comentario=obj,
                usuario=request.user
            ).exists()
        return False

    def get_can_delete(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Align with ComentarioViewSet.destroy: only the comment author can delete
            return obj.usuario.id_usuario == request.user.id_usuario
        return False

    def get_can_edit(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.usuario.id_usuario == request.user.id_usuario
        return False

    def get_replying_to(self, obj):
        """Returns info about who this comment is replying to (for 'Em resposta a' display)"""
        if obj.comentario_pai:
            parent = obj.comentario_pai
            result = {
                'comment_author': {
                    'id': parent.usuario.id_usuario,
                    'nome_usuario': parent.usuario.nome_usuario,
                    'nome_completo': parent.usuario.nome_completo,
                }
            }
            # If replying to a reply, also include the post owner
            if parent.comentario_pai:
                post_owner = obj.publicacao.usuario
                if post_owner.id_usuario != parent.usuario.id_usuario:
                    result['post_owner'] = {
                        'id': post_owner.id_usuario,
                        'nome_usuario': post_owner.nome_usuario,
                    }
            return result
        return None

    def get_post_owner(self, obj):
        """Returns the post owner info for context"""
        owner = obj.publicacao.usuario
        return {
            'id': owner.id_usuario,
            'nome_usuario': owner.nome_usuario,
        }

    def get_imagem_url(self, obj):
        if obj.imagem:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.imagem.url)
            return obj.imagem.url
        return None

    def get_video_url(self, obj):
        if obj.video:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.video.url)
            return obj.video.url
        return None


class ComentarioCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating comments with media support"""
    class Meta:
        model = Comentario
        fields = ('conteudo_texto', 'comentario_pai', 'imagem', 'video')
        extra_kwargs = {
            'comentario_pai': {'required': False},
            'conteudo_texto': {'required': False},
            'imagem': {'required': False},
            'video': {'required': False},
        }

    def validate(self, data):
        # At least text or media must be provided
        if not data.get('conteudo_texto') and not data.get('imagem') and not data.get('video'):
            raise serializers.ValidationError(_("Comentário deve ter texto ou mídia"))
        return data


# Notificacao Serializers
from .models import Notificacao

class NotificacaoSerializer(serializers.ModelSerializer):
    """Serializer for reading notifications"""
    usuario_origem = UserSerializer(read_only=True)
    tipo_notificacao_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Notificacao
        fields = ('id_notificacao', 'usuario_origem', 'tipo_notificacao', 'tipo_notificacao_display', 
                  'id_referencia', 'conteudo', 'lida', 'data_criacao')
        read_only_fields = ('id_notificacao', 'usuario_origem', 'tipo_notificacao', 'id_referencia', 
                           'conteudo', 'data_criacao')

    def get_tipo_notificacao_display(self, obj):
        tipos = {1: 'post', 2: 'comment', 3: 'like', 4: 'follower', 6: 'community_invite', 7: 'mention'}
        return tipos.get(obj.tipo_notificacao, 'other')


# Hashtag Serializer
from .models import Hashtag

class HashtagSerializer(serializers.ModelSerializer):
    """Serializer for hashtags"""
    class Meta:
        model = Hashtag
        fields = ('id_hashtag', 'texto_hashtag', 'contagem_uso')


class SearchSerializer(serializers.Serializer):
    """Serializer for search results"""
    results = serializers.DictField()
    counts = serializers.DictField()


# User Settings Serializers
from .models import ConfiguracaoUsuario

class UserSettingsSerializer(serializers.ModelSerializer):
    """Serializer for user settings (ConfiguracaoUsuario)"""
    class Meta:
        model = ConfiguracaoUsuario
        fields = (
            'notificacoes_novas_publicacoes',
            'notificacoes_comentarios',
            'notificacoes_seguidor_novo',
            'notificacoes_reacoes',
            'notificacoes_mensagens_diretas',
            'tema_interface',
            'idioma',
            'mostrar_visualizacoes',
            'mostrar_feed_algoritmico',
            'interesses',
            'ultima_atualizacao'
        )
        read_only_fields = ('ultima_atualizacao',)

    def validate_interesses(self, value):
        """Garante que interesses é uma lista de strings válidas."""
        if not isinstance(value, list):
            raise serializers.ValidationError("interesses deve ser uma lista.")
        if len(value) > 20:
            raise serializers.ValidationError("Máximo de 20 interesses permitidos.")
        for item in value:
            if not isinstance(item, str):
                raise serializers.ValidationError("Cada interesse deve ser uma string.")
            if len(item) > 50:
                raise serializers.ValidationError(
                    f"Interesse '{item[:20]}...' excede 50 caracteres."
                )
        return value


class CloseFriendSerializer(serializers.ModelSerializer):
    """Serializer for followers with close friend status"""
    id_usuario = serializers.UUIDField(source='usuario_seguidor.id_usuario', read_only=True)
    nome_usuario = serializers.CharField(source='usuario_seguidor.nome_usuario', read_only=True)
    nome_completo = serializers.CharField(source='usuario_seguidor.nome_completo', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Seguidor
        fields = ('id_usuario', 'nome_usuario', 'nome_completo', 'avatar_url', 'is_close_friend')
        
    def get_avatar_url(self, obj):
        user = obj.usuario_seguidor
        if user.avatar_url:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(user.avatar_url)
            return user.avatar_url
        return None

# Comunidade Serializers
from .models import Comunidade

class ComunidadeSerializer(serializers.ModelSerializer):
    """Serializer for communities"""
    membros_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    is_moderator = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    moderators = serializers.SerializerMethodField()

    class Meta:
        model = Comunidade
        fields = ('id_comunidade', 'nome', 'descricao', 'imagem', 'banner', 'regras', 'data_criacao', 'membros_count', 'is_member', 'is_moderator', 'is_admin', 'user_role', 'moderators')
        read_only_fields = ('id_comunidade', 'data_criacao', 'membros_count', 'is_member', 'is_moderator', 'is_admin', 'user_role', 'moderators')

    def get_membros_count(self, obj):
        return obj.membros.count()

    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.membros.filter(id_usuario=request.user.id_usuario).exists()
        return False

    def get_is_moderator(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from .models import MembroComunidade
            return MembroComunidade.objects.filter(
                comunidade=obj, 
                usuario=request.user, 
                role__in=['moderator', 'admin']
            ).exists()
        return False

    def get_is_admin(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from .models import MembroComunidade
            return MembroComunidade.objects.filter(
                comunidade=obj, 
                usuario=request.user, 
                role='admin'
            ).exists()
        return False

    def get_user_role(self, obj):
        """Returns the user's role in this community. Uses user_id query param if present, otherwise current user."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from .models import MembroComunidade
            # If user_id query param exists, show that user's role
            target_user_id = request.query_params.get('user_id')
            if target_user_id:
                membership = MembroComunidade.objects.filter(
                    comunidade=obj,
                    usuario_id=target_user_id
                ).first()
            else:
                membership = MembroComunidade.objects.filter(
                    comunidade=obj, 
                    usuario=request.user
                ).first()
            if membership:
                return membership.role
        return None

    def get_moderators(self, obj):
        from .models import MembroComunidade
        mods = MembroComunidade.objects.filter(
            comunidade=obj,
            role__in=['moderator', 'admin']
        ).select_related('usuario')
        
        return [
            {
                'id': mod.usuario.id_usuario,
                'username': mod.usuario.nome_usuario,
                'role': mod.role,
                'avatar': mod.usuario.avatar_url if mod.usuario.avatar_url else None
            }
            for mod in mods
        ]

class CommunityStatsSerializer(serializers.Serializer):
    """Serializer for community moderator insights"""
    # Growth
    total_members = serializers.IntegerField()
    new_members_last_7_days = serializers.IntegerField()
    new_members_last_30_days = serializers.IntegerField()
    
    # Engagement
    total_posts = serializers.IntegerField()
    posts_last_7_days = serializers.IntegerField()
    active_members_last_7_days = serializers.IntegerField()
    
    # Queer/Reports
    pending_reports = serializers.IntegerField()


class BanimentoComunidadeSerializer(serializers.Serializer):
    """Serializer for community bans"""
    id_ban = serializers.UUIDField(read_only=True)
    user_id = serializers.UUIDField(source='usuario.id_usuario', read_only=True)
    username = serializers.CharField(source='usuario.nome_usuario')
    nome_completo = serializers.CharField(source='usuario.nome_completo')
    avatar_url = serializers.SerializerMethodField()
    moderador_username = serializers.CharField(source='moderador.nome_usuario', default=None)
    motivo = serializers.CharField()
    data_ban = serializers.DateTimeField()

    def get_avatar_url(self, obj):
        if obj.usuario.avatar_url:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.usuario.avatar_url)
            return obj.usuario.avatar_url
        return None


# Rascunho (Draft) Serializer
from .models import Rascunho

class RascunhoSerializer(serializers.ModelSerializer):
    """Serializer for post drafts"""
    comunidade_nome = serializers.CharField(source='comunidade.nome', read_only=True)
    
    class Meta:
        model = Rascunho
        fields = (
            'id_rascunho', 'comunidade', 'comunidade_nome', 'titulo', 
            'conteudo_texto', 'tipo_post', 'imagem', 'tags',
            'data_criacao', 'data_atualizacao'
        )
        read_only_fields = ('id_rascunho', 'data_criacao', 'data_atualizacao', 'comunidade_nome')
        extra_kwargs = {
            'comunidade': {'required': False},
            'titulo': {'required': False},
            'conteudo_texto': {'required': False},
            'imagem': {'required': False},
            'tags': {'required': False},
        }


# Mensagem Direta (Direct Message / Chat) Serializers
from .models import MensagemDireta

class MensagemDiretaSerializer(serializers.ModelSerializer):
    """Serializer for reading direct messages"""
    remetente = UserSerializer(source='usuario_remetente', read_only=True)
    destinatario = UserSerializer(source='usuario_destinatario', read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = MensagemDireta
        fields = (
            'id_mensagem', 'remetente', 'destinatario', 'conteudo',
            'data_envio', 'lida', 'data_leitura', 'is_mine'
        )
        read_only_fields = ('id_mensagem', 'remetente', 'destinatario', 'data_envio', 'lida', 'data_leitura')

    def get_is_mine(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.usuario_remetente.id_usuario == request.user.id_usuario
        return False


class ConversationSerializer(serializers.Serializer):
    """Serializer for conversation list (aggregated view of DMs) - LEGACY V1"""
    user = UserSerializer(read_only=True)
    last_message = serializers.CharField()
    last_message_date = serializers.DateTimeField()
    unread_count = serializers.IntegerField()


# ========== V2 DM Serializers ==========
from .models import UploadChat, Conversa

class UploadChatSerializer(serializers.ModelSerializer):
    """Serializer para upload de mídia de chat (two-step upload)"""
    class Meta:
        model = UploadChat
        fields = ['id_upload', 'arquivo', 'mime_type', 'tamanho_bytes', 'data_upload']
        read_only_fields = ['id_upload', 'mime_type', 'tamanho_bytes', 'data_upload']


class UserMiniSerializer(serializers.ModelSerializer):
    """Serializer mínimo de usuário para uso dentro de mensagens/conversas"""
    class Meta:
        model = User
        fields = ['id_usuario', 'nome_usuario', 'nome_completo', 'avatar_url']
        read_only_fields = fields


class MensagemDiretaV2Serializer(serializers.ModelSerializer):
    """Serializer V2 para mensagens diretas com suporte a mídia e posts"""
    remetente = UserMiniSerializer(source='usuario_remetente', read_only=True)
    upload_info = UploadChatSerializer(source='upload', read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = MensagemDireta
        fields = [
            'id_mensagem', 'remetente', 'conteudo', 'tipo_mensagem',
            'upload_info', 'publicacao_compartilhada',
            'data_envio', 'lida', 'data_leitura', 'is_mine',
        ]
        read_only_fields = [
            'id_mensagem', 'remetente', 'data_envio', 'lida', 'data_leitura',
        ]

    def get_is_mine(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.usuario_remetente_id == request.user.id_usuario
        return False


class ConversaListSerializer(serializers.ModelSerializer):
    """Serializer para listar conversas no inbox V2"""
    parceiro = serializers.SerializerMethodField()
    ultima_mensagem = serializers.SerializerMethodField()
    nao_lidas = serializers.SerializerMethodField()

    class Meta:
        model = Conversa
        fields = ['id_conversa', 'parceiro', 'ultima_mensagem', 'nao_lidas', 'data_atualizacao']

    def get_parceiro(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        user = request.user
        partner = obj.usuario_b if obj.usuario_a_id == user.id_usuario else obj.usuario_a
        return UserMiniSerializer(partner).data

    def get_ultima_mensagem(self, obj):
        # Usa annotation se disponível, senão busca no banco
        if hasattr(obj, 'annotated_last_message'):
            return obj.annotated_last_message
        msg = obj.mensagens.order_by('-data_envio').first()
        if msg:
            return msg.conteudo[:100] if msg.conteudo else f'[{msg.tipo_mensagem}]'
        return None

    def get_nao_lidas(self, obj):
        if hasattr(obj, 'annotated_unread_count'):
            return obj.annotated_unread_count
        request = self.context.get('request')
        if not request:
            return 0
        return obj.mensagens.filter(
            usuario_destinatario=request.user,
            lida=False
        ).count()


# ==========================================
# NOTIFICAÇÕES ADMIN SERIALIZERS
# ==========================================

from .models import NotificacaoAdmin, ConfiguracaoNotificacaoAdmin, AuditLogChat

class NotificacaoAdminSerializer(serializers.ModelSerializer):
    criado_por_nome = serializers.CharField(source='criado_por.nome_usuario', read_only=True, default=None)

    class Meta:
        model = NotificacaoAdmin
        fields = (
            'id_notificacao', 'titulo', 'mensagem', 'tipo', 'destinatarios',
            'criado_por', 'criado_por_nome', 'data_criacao', 'data_envio',
            'enviada', 'total_enviados',
        )
        read_only_fields = ('id_notificacao', 'criado_por', 'criado_por_nome', 'data_criacao', 'data_envio', 'enviada', 'total_enviados')


class ConfiguracaoNotificacaoAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracaoNotificacaoAdmin
        fields = (
            'id_config', 'push_habilitado', 'email_habilitado',
            'frequencia_max_diaria', 'horario_silencio_inicio',
            'horario_silencio_fim', 'ultima_atualizacao',
        )
        read_only_fields = ('id_config', 'ultima_atualizacao')


class AuditLogChatSerializer(serializers.ModelSerializer):
    admin_nome = serializers.CharField(source='admin.nome_usuario', read_only=True, default=None)
    conversa_id = serializers.UUIDField(source='conversa.id_conversa', read_only=True, default=None)
    mensagem_id = serializers.UUIDField(source='mensagem.id_mensagem', read_only=True, default=None)

    class Meta:
        model = AuditLogChat
        fields = (
            'id_log', 'conversa_id', 'mensagem_id', 'acao',
            'admin', 'admin_nome', 'detalhes', 'ip_address', 'data_acao',
        )
        read_only_fields = ('id_log', 'data_acao')

