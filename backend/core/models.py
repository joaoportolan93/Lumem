from django.db import models
from django.db.models import CheckConstraint, Q, F
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid6

class UsuarioManager(BaseUserManager):
    def create_user(self, email, nome_usuario, nome_completo, password=None):
        if not email:
            raise ValueError('Usuários devem ter um endereço de email')
        if not nome_usuario:
            raise ValueError('Usuários devem ter um nome de usuário')

        user = self.model(
            email=self.normalize_email(email),
            nome_usuario=nome_usuario,
            nome_completo=nome_completo,
        )

        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, nome_usuario, nome_completo, password=None):
        user = self.create_user(
            email,
            password=password,
            nome_usuario=nome_usuario,
            nome_completo=nome_completo,
        )
        user.is_admin = True
        user.save(using=self._db)
        return user

class Usuario(AbstractBaseUser):
    id_usuario = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    nome_usuario = models.CharField(max_length=50, unique=True)
    email = models.CharField(max_length=100, unique=True)
    # senha_hash is handled by AbstractBaseUser's password field
    nome_completo = models.CharField(max_length=100)
    bio = models.TextField(null=True, blank=True)
    avatar_url = models.CharField(max_length=255, null=True, blank=True)
    data_nascimento = models.DateField(null=True, blank=True)
    data_criacao = models.DateTimeField(default=timezone.now)
    verificado = models.BooleanField(default=False)
    is_admin = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)  # Required for authentication
    
    # Remove secret questions completely
    
    STATUS_CHOICES = (
        (1, _('Ativo')),
        (2, _('Suspenso')),
        (3, _('Desativado')),
    )
    status = models.SmallIntegerField(choices=STATUS_CHOICES, default=1)
    
    PRIVACIDADE_CHOICES = (
        (1, _('Público')),
        (2, _('Privado')),
    )
    privacidade_padrao = models.SmallIntegerField(choices=PRIVACIDADE_CHOICES, default=1)

    objects = UsuarioManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nome_usuario', 'nome_completo']

    class Meta:
        db_table = 'usuarios'

    def __str__(self):
        return self.nome_usuario

    @property
    def is_staff(self):
        return self.is_admin

    def has_perm(self, perm, obj=None):
        return self.is_admin

    def has_module_perms(self, app_label):
        return self.is_admin

class Seguidor(models.Model):
    id_seguidor = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario_seguidor = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='seguindo', db_column='id_usuario_seguidor')
    usuario_seguido = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='seguidores', db_column='id_usuario_seguido')
    data_seguimento = models.DateTimeField(default=timezone.now)
    
    STATUS_CHOICES = (
        (1, _('Ativo')),
        (2, _('Bloqueado')),
        (3, _('Pendente')),
    )
    status = models.SmallIntegerField(choices=STATUS_CHOICES, default=1)
    is_close_friend = models.BooleanField(default=False)

    class Meta:
        db_table = 'seguidores'
        unique_together = ('usuario_seguidor', 'usuario_seguido')

class Publicacao(models.Model):
    id_publicacao = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario')
    conteudo_texto = models.TextField()
    titulo = models.CharField(max_length=150, null=True, blank=True)
    data_sonho = models.DateField(null=True, blank=True)
    tipo_sonho = models.CharField(max_length=50, null=True, blank=True)
    data_publicacao = models.DateTimeField(default=timezone.now)
    editado = models.BooleanField(default=False)
    data_edicao = models.DateTimeField(null=True, blank=True)
    comunidade = models.ForeignKey('Comunidade', on_delete=models.SET_NULL, null=True, blank=True, related_name='publicacoes', db_column='id_comunidade')
    
    VISIBILIDADE_CHOICES = (
        (1, _('Público')),
        (2, _('Lista de Amigos')),
        (3, _('Privado')),
    )
    visibilidade = models.SmallIntegerField(choices=VISIBILIDADE_CHOICES, default=1)
    localizacao = models.CharField(max_length=100, null=True, blank=True)
    emocoes_sentidas = models.TextField(null=True, blank=True)
    imagem = models.ImageField(upload_to='dream_images/', null=True, blank=True)
    video = models.FileField(upload_to='dream_videos/', null=True, blank=True)
    views_count = models.IntegerField(default=0)

    class Meta:
        db_table = 'publicacoes'

class MidiaPublicacao(models.Model):
    id_midia = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    publicacao = models.ForeignKey(Publicacao, on_delete=models.CASCADE, db_column='id_publicacao')
    
    TIPO_MIDIA_CHOICES = (
        (1, _('Imagem')),
        (2, _('Vídeo')),
        (3, _('GIF')),
        (4, _('Áudio')),
    )
    tipo_midia = models.SmallIntegerField(choices=TIPO_MIDIA_CHOICES)
    url_midia = models.CharField(max_length=255)
    descricao = models.TextField(null=True, blank=True)
    posicao_ordem = models.SmallIntegerField(default=0)
    data_upload = models.DateTimeField(default=timezone.now)
    tamanho_bytes = models.IntegerField(null=True, blank=True)
    largura = models.IntegerField(null=True, blank=True)
    altura = models.IntegerField(null=True, blank=True)
    duracao = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'midia_publicacoes'

class Hashtag(models.Model):
    id_hashtag = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    texto_hashtag = models.CharField(max_length=50, unique=True)
    contagem_uso = models.IntegerField(default=1)
    primeira_utilizacao = models.DateTimeField(default=timezone.now)
    ultima_utilizacao = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hashtags'

class PublicacaoHashtag(models.Model):
    publicacao = models.ForeignKey(Publicacao, on_delete=models.CASCADE, db_column='id_publicacao')
    hashtag = models.ForeignKey(Hashtag, on_delete=models.CASCADE, db_column='id_hashtag')
    data_associacao = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'publicacao_hashtags'
        unique_together = ('publicacao', 'hashtag')

class Comentario(models.Model):
    id_comentario = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    publicacao = models.ForeignKey(Publicacao, on_delete=models.CASCADE, db_column='id_publicacao')
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario')
    conteudo_texto = models.TextField(blank=True, default='')
    data_comentario = models.DateTimeField(default=timezone.now)
    editado = models.BooleanField(default=False)
    data_edicao = models.DateTimeField(null=True, blank=True)
    comentario_pai = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, db_column='id_comentario_pai', related_name='respostas')
    
    # Media fields for Twitter-like comments
    imagem = models.ImageField(upload_to='comment_images/', null=True, blank=True)
    video = models.FileField(upload_to='comment_videos/', null=True, blank=True)
    
    # Engagement metrics
    views_count = models.IntegerField(default=0)
    
    STATUS_CHOICES = (
        (1, _('Ativo')),
        (2, _('Removido')),
        (3, _('Denunciado')),
    )
    status = models.SmallIntegerField(choices=STATUS_CHOICES, default=1)

    class Meta:
        db_table = 'comentarios'


class ReacaoPublicacao(models.Model):
    id_reacao = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    publicacao = models.ForeignKey(Publicacao, on_delete=models.CASCADE, db_column='id_publicacao')
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario')
    data_reacao = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'reacoes_publicacoes'
        unique_together = ('publicacao', 'usuario')

class PublicacaoSalva(models.Model):
    id_salvo = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    publicacao = models.ForeignKey(Publicacao, on_delete=models.CASCADE, db_column='id_publicacao')
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario')
    data_salvo = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'publicacoes_salvas'
        unique_together = ('publicacao', 'usuario')

class ReacaoComentario(models.Model):
    id_reacao = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    comentario = models.ForeignKey(Comentario, on_delete=models.CASCADE, db_column='id_comentario')
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario')
    
    TIPO_REACAO_CHOICES = (
        (1, _('Gostei')),
        (2, _('Amei')),
        (3, _('Confuso')),
        (4, _('Assustado')),
        (5, _('Relacionável')),
    )
    tipo_reacao = models.SmallIntegerField(choices=TIPO_REACAO_CHOICES)
    data_reacao = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'reacoes_comentarios'
        unique_together = ('comentario', 'usuario')

class ListaAmigosProximos(models.Model):
    id_lista = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario_dono = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario_dono')
    nome_lista = models.CharField(max_length=50, default='Amigos Próximos')
    data_criacao = models.DateTimeField(default=timezone.now)
    data_atualizacao = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'lista_amigos_proximos'

class MembroListaAmigos(models.Model):
    lista = models.ForeignKey(ListaAmigosProximos, on_delete=models.CASCADE, db_column='id_lista')
    usuario_membro = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario_membro')
    data_adicao = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'membros_lista_amigos'
        unique_together = ('lista', 'usuario_membro')

class Notificacao(models.Model):
    id_notificacao = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario_destino = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='notificacoes_recebidas', db_column='id_usuario_destino')
    usuario_origem = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='notificacoes_geradas', db_column='id_usuario_origem')
    
    TIPO_NOTIFICACAO_CHOICES = (
        (1, _('Nova Publicação')),
        (2, _('Comentário')),
        (3, _('Curtida')),
        (4, _('Seguidor Novo')),
        (5, _('Solicitação de Seguidor')),
    )
    tipo_notificacao = models.SmallIntegerField(choices=TIPO_NOTIFICACAO_CHOICES)
    id_referencia = models.CharField(max_length=36, null=True, blank=True)
    conteudo = models.TextField(null=True, blank=True)
    lida = models.BooleanField(default=False)
    data_criacao = models.DateTimeField(default=timezone.now)
    data_leitura = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'notificacoes'

class ElementoSonho(models.Model):
    id_elemento = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    nome_elemento = models.CharField(max_length=100)
    categoria = models.CharField(max_length=50, null=True, blank=True)
    descricao = models.TextField(null=True, blank=True)
    contagem_usos = models.IntegerField(default=1)

    class Meta:
        db_table = 'elementos_sonhos'

class PublicacaoElemento(models.Model):
    publicacao = models.ForeignKey(Publicacao, on_delete=models.CASCADE, db_column='id_publicacao')
    elemento = models.ForeignKey(ElementoSonho, on_delete=models.CASCADE, db_column='id_elemento')
    data_associacao = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'publicacao_elementos'
        unique_together = ('publicacao', 'elemento')

class UploadChat(models.Model):
    """Mídia de chat enviada em duas etapas (step 1: upload, step 2: vincular à mensagem)"""
    id_upload = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='chat_uploads', db_column='id_usuario')
    arquivo = models.FileField(upload_to='chat_media/')
    mime_type = models.CharField(max_length=100, blank=True, default='')
    tamanho_bytes = models.PositiveIntegerField(null=True, blank=True)
    data_upload = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'uploads_chat'

    def __str__(self):
        return f"Upload {self.id_upload} por {self.usuario}"


class Conversa(models.Model):
    """Conversa 1:1 determinística entre dois usuários"""
    id_conversa = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario_a = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='conversas_a', db_column='id_usuario_a')
    usuario_b = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='conversas_b', db_column='id_usuario_b')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'conversas'
        constraints = [
            CheckConstraint(
                condition=Q(usuario_a__lt=F('usuario_b')),
                name='conversa_usuario_a_lt_b'
            ),
            models.UniqueConstraint(
                fields=['usuario_a', 'usuario_b'],
                name='conversa_unica_1_para_1'
            ),
        ]
        indexes = [
            models.Index(fields=['-data_atualizacao'], name='idx_conversa_updated'),
        ]
        ordering = ['-data_atualizacao']

    def __str__(self):
        return f"Conversa {self.id_conversa}: {self.usuario_a} <-> {self.usuario_b}"

    @staticmethod
    def get_or_create_for_users(user1, user2):
        """Cria ou retorna a conversa determinística entre dois usuários (menor ID = usuario_a)."""
        if str(user1.id_usuario) < str(user2.id_usuario):
            a, b = user1, user2
        else:
            a, b = user2, user1
        conversa, created = Conversa.objects.get_or_create(
            usuario_a=a, usuario_b=b
        )
        return conversa, created


class MensagemDireta(models.Model):
    id_mensagem = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario_remetente = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='mensagens_enviadas', db_column='id_usuario_remetente')
    usuario_destinatario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='mensagens_recebidas', db_column='id_usuario_destinatario')
    conteudo = models.TextField(blank=True, null=True)
    data_envio = models.DateTimeField(default=timezone.now)
    lida = models.BooleanField(default=False)
    data_leitura = models.DateTimeField(null=True, blank=True)
    deletada_remetente = models.BooleanField(default=False)
    deletada_destinatario = models.BooleanField(default=False)

    # Novos campos V2
    conversa = models.ForeignKey(Conversa, on_delete=models.CASCADE, related_name='mensagens', null=True, blank=True, db_column='id_conversa')

    TIPO_MENSAGEM_CHOICES = (
        ('text', _('Texto')),
        ('media', _('Mídia')),
        ('post', _('Publicação')),
    )
    tipo_mensagem = models.CharField(max_length=20, choices=TIPO_MENSAGEM_CHOICES, default='text')
    upload = models.ForeignKey(UploadChat, on_delete=models.SET_NULL, null=True, blank=True, db_column='id_upload')
    publicacao_compartilhada = models.ForeignKey('Publicacao', on_delete=models.SET_NULL, null=True, blank=True, related_name='compartilhamentos_chat', db_column='id_publicacao_compartilhada')

    class Meta:
        db_table = 'mensagens_diretas'
        ordering = ['-data_envio']

class Denuncia(models.Model):
    id_denuncia = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario_denunciante = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario_denunciante')
    
    TIPO_CONTEUDO_CHOICES = (
        (1, _('Publicação')),
        (2, _('Comentário')),
        (3, _('Usuário')),
    )
    tipo_conteudo = models.SmallIntegerField(choices=TIPO_CONTEUDO_CHOICES)
    id_conteudo = models.CharField(max_length=36)
    
    MOTIVO_DENUNCIA_CHOICES = (
        (1, _('Conteúdo Inadequado')),
        (2, _('Assédio')),
        (3, _('Spam')),
    )
    motivo_denuncia = models.SmallIntegerField(choices=MOTIVO_DENUNCIA_CHOICES)
    descricao_denuncia = models.TextField(null=True, blank=True)
    data_denuncia = models.DateTimeField(default=timezone.now)
    
    STATUS_DENUNCIA_CHOICES = (
        (1, _('Pendente')),
        (2, _('Analisada')),
        (3, _('Resolvida')),
    )
    status_denuncia = models.SmallIntegerField(choices=STATUS_DENUNCIA_CHOICES, default=1)
    data_resolucao = models.DateTimeField(null=True, blank=True)
    
    ACAO_TOMADA_CHOICES = (
        (1, _('Nenhuma')),
        (2, _('Removido')),
        (3, _('Usuário Suspenso')),
    )
    acao_tomada = models.SmallIntegerField(choices=ACAO_TOMADA_CHOICES, null=True, blank=True)

    class Meta:
        db_table = 'denuncias'

class EstatisticaSonho(models.Model):
    id_estatistica = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario')
    total_sonhos = models.IntegerField(default=0)
    pesadelos_registrados = models.IntegerField(default=0)
    sonhos_lucidos_registrados = models.IntegerField(default=0)
    elementos_recorrentes_top = models.JSONField(null=True, blank=True)
    padrao_sono_medio = models.CharField(max_length=50, null=True, blank=True)
    ultimo_calculo = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'estatisticas_sonhos'

class ConfiguracaoUsuario(models.Model):
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, primary_key=True, db_column='id_usuario')
    notificacoes_novas_publicacoes = models.BooleanField(default=True)
    notificacoes_comentarios = models.BooleanField(default=True)
    notificacoes_seguidor_novo = models.BooleanField(default=True)
    notificacoes_reacoes = models.BooleanField(default=True)
    notificacoes_mensagens_diretas = models.BooleanField(default=True)
    
    TEMA_INTERFACE_CHOICES = (
        (1, _('Claro')),
        (2, _('Escuro')),
        (3, _('Sistema')),
    )
    tema_interface = models.SmallIntegerField(choices=TEMA_INTERFACE_CHOICES, default=1)
    idioma = models.CharField(max_length=10, default='pt-BR')
    mostrar_visualizacoes = models.BooleanField(default=True)
    mostrar_feed_algoritmico = models.BooleanField(default=True)
    ultima_atualizacao = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'configuracoes_usuario'


class Comunidade(models.Model):
    id_comunidade = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    nome = models.CharField(max_length=100, unique=True)
    descricao = models.TextField()
    imagem = models.ImageField(upload_to='community_images/', null=True, blank=True)
    banner = models.ImageField(upload_to='community_banners/', null=True, blank=True)
    regras = models.JSONField(default=list, blank=True)
    membros = models.ManyToManyField(Usuario, through='MembroComunidade', related_name='comunidades', blank=True)
    data_criacao = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'comunidades'

    def __str__(self):
        return self.nome

class MembroComunidade(models.Model):
    id_membro = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    comunidade = models.ForeignKey(Comunidade, on_delete=models.CASCADE, db_column='id_comunidade')
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario')
    data_entrada = models.DateTimeField(default=timezone.now)
    
    ROLE_CHOICES = (
        ('member', _('Membro')),
        ('moderator', _('Moderador')),
        ('admin', _('Administrador')),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    is_moderator = models.BooleanField(default=False)

    class Meta:
        db_table = 'membros_comunidade'
        unique_together = ('comunidade', 'usuario')

    def save(self, *args, **kwargs):
        if self.role in ['moderator', 'admin']:
            self.is_moderator = True
        else:
            self.is_moderator = False
        super().save(*args, **kwargs)


class BanimentoComunidade(models.Model):
    id_ban = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    comunidade = models.ForeignKey(Comunidade, on_delete=models.CASCADE, db_column='id_comunidade', related_name='banimentos')
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario', related_name='bans_comunidade')
    moderador = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, db_column='id_moderador', related_name='bans_aplicados')
    motivo = models.TextField(blank=True, default='')
    data_ban = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'banimentos_comunidade'
        unique_together = ('comunidade', 'usuario')

    def __str__(self):
        return f"Ban: {self.usuario} em {self.comunidade}"


# Signal to auto-create ConfiguracaoUsuario when a new Usuario is created
@receiver(post_save, sender=Usuario)
def create_user_settings(sender, instance, created, **kwargs):
    if created:
        ConfiguracaoUsuario.objects.get_or_create(usuario=instance)


class Rascunho(models.Model):
    """Draft model for saving post drafts before publishing"""
    id_rascunho = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='id_usuario', related_name='rascunhos')
    comunidade = models.ForeignKey('Comunidade', on_delete=models.SET_NULL, null=True, blank=True, db_column='id_comunidade')
    titulo = models.CharField(max_length=300, null=True, blank=True)
    conteudo_texto = models.TextField(blank=True, default='')
    
    TIPO_POST_CHOICES = (
        ('texto', _('Texto')),
        ('multimidia', _('Multimídia')),
        ('link', _('Link')),
    )
    tipo_post = models.CharField(max_length=20, choices=TIPO_POST_CHOICES, default='texto')
    imagem = models.ImageField(upload_to='drafts/', null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rascunhos'
        ordering = ['-data_atualizacao']

    def __str__(self):
        return f"Rascunho de {self.usuario.nome_usuario} - {self.titulo or 'Sem título'}"


class Bloqueio(models.Model):
    """Blocked users - blocked user's content is hidden from the blocker"""
    id_bloqueio = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='bloqueios_feitos', db_column='id_usuario')
    usuario_bloqueado = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='bloqueios_recebidos', db_column='id_usuario_bloqueado')
    data_bloqueio = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'bloqueios'
        unique_together = ('usuario', 'usuario_bloqueado')


class Silenciamento(models.Model):
    """Muted users - muted user's content is deprioritized/hidden from feed"""
    id_silenciamento = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='silenciamentos_feitos', db_column='id_usuario')
    usuario_silenciado = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='silenciamentos_recebidos', db_column='id_usuario_silenciado')
    data_silenciamento = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'silenciamentos'
        unique_together = ('usuario', 'usuario_silenciado')


class PasswordResetCode(models.Model):
    id_code = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='reset_codes', db_column='id_usuario')
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        db_table = 'password_reset_codes'

    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at
