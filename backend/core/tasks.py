"""
Tarefas assíncronas do Celery para o app core.
Executadas em background pelo Celery Worker com broker Redis.
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_push_to_user(self, usuario_destino_id: str, title: str, body: str, data: dict = None):
    """
    Envia push para um único usuário via FCM HTTP v1 (push_service.py).

    Chamada por create_notification() para eventos de interação
    (curtidas, comentários, seguidores, menções).

    Retries automáticos com backoff de 60s apenas para erros temporários.
    Erros permanentes (token inválido, config ausente) não são retentados.

    Args:
        usuario_destino_id: UUID do usuário destino (como string)
        title:              título da notificação
        body:               corpo da notificação
        data:               payload extra para o app
    """
    from .models import Usuario
    from .push_service import send_push, PushTemporaryError, PushPermanentError

    try:
        user = Usuario.objects.get(id_usuario=usuario_destino_id, status=1)

        # Sem token = usuário nunca instalou o app ou revogou permissão
        if not user.fcm_token:
            logger.debug(f'Usuário {usuario_destino_id} sem FCM token, push ignorado.')
            return

        send_push(user.fcm_token, title, body, data)
        logger.info(f'Push enviado para usuário {usuario_destino_id}: "{title}"')

    except PushPermanentError as e:
        # Token inválido, config ausente — não faz retry
        logger.warning(f'Push permanente falhou para {usuario_destino_id}: {e}')

    except PushTemporaryError as e:
        # Timeout, rate limit, erro de rede — retry automático
        logger.warning(f'Push temporário falhou para {usuario_destino_id}: {e}. Retentando...')
        raise self.retry(exc=e)

    except Usuario.DoesNotExist:
        logger.warning(f'Usuário {usuario_destino_id} não encontrado, push cancelado.')


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def send_chat_push_notification(self, user_id, sender_name, message_preview, conversa_id):
    """
    Envia push notification de nova mensagem de chat.
    Respeita as configurações de notificação do usuário.
    """
    try:
        from core.models import Usuario, ConfiguracaoUsuario
        from core.firebase_service import send_push_notification

        user = Usuario.objects.get(id_usuario=user_id)

        # Verificar se o usuário tem FCM token
        if not user.fcm_token:
            logger.debug(f"Usuário {user_id} sem FCM token. Push não enviado.")
            return

        # Verificar configurações do usuário
        try:
            config = ConfiguracaoUsuario.objects.get(usuario=user)
            if not config.notificacoes_mensagens_diretas:
                logger.debug(f"Usuário {user_id} desabilitou notificações de DM.")
                return
        except ConfiguracaoUsuario.DoesNotExist:
            pass

        result = send_push_notification(
            token=user.fcm_token,
            title=f"💬 {sender_name}",
            body=message_preview or "Nova mensagem",
            data={
                'type': 'chat_message',
                'conversa_id': conversa_id,
                'sender_name': sender_name,
            }
        )
        logger.info(f"Push de chat enviado para {user_id}: {result}")

    except Exception as exc:
        logger.error(f"Erro ao enviar push de chat: {exc}")
        self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def send_notification_push(self, user_id, title, body, notification_type, reference_id=None):
    """
    Envia push notification genérica (curtida, comentário, seguidor, etc).
    Respeita as configurações de notificação do usuário.
    """
    try:
        from core.models import Usuario, ConfiguracaoUsuario
        from core.firebase_service import send_push_notification

        user = Usuario.objects.get(id_usuario=user_id)

        if not user.fcm_token:
            return

        # Verificar configurações do usuário por tipo
        try:
            config = ConfiguracaoUsuario.objects.get(usuario=user)
            type_config_map = {
                'like': config.notificacoes_reacoes,
                'comment': config.notificacoes_comentarios,
                'follower': config.notificacoes_seguidor_novo,
                'post': config.notificacoes_novas_publicacoes,
                'dm': config.notificacoes_mensagens_diretas,
            }
            if not type_config_map.get(notification_type, True):
                logger.debug(f"Usuário {user_id} desabilitou notif tipo {notification_type}.")
                return
        except ConfiguracaoUsuario.DoesNotExist:
            pass

        data = {
            'type': notification_type,
        }
        if reference_id:
            data['reference_id'] = str(reference_id)

        send_push_notification(
            token=user.fcm_token,
            title=title,
            body=body,
            data=data,
        )

    except Exception as exc:
        logger.error(f"Erro ao enviar push notification: {exc}")
        self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def send_broadcast_push(self, notification_admin_id):
    """
    Envia uma notificação broadcast (criada pelo admin) para todos os usuários
    que possuem FCM token e têm notificações habilitadas.
    """
    try:
        from core.models import NotificacaoAdmin, Usuario
        from core.firebase_service import send_push_multicast

        notif = NotificacaoAdmin.objects.get(id_notificacao=notification_admin_id)

        if notif.enviada:
            logger.warning(f"Broadcast {notification_admin_id} já foi enviado.")
            return

        # Coletar tokens FCM dos destinatários
        if notif.destinatarios == 'todos':
            tokens = list(
                Usuario.objects.filter(
                    status=1,
                    fcm_token__isnull=False,
                ).exclude(
                    fcm_token=''
                ).values_list('fcm_token', flat=True)
            )
        else:
            # Futuramente: segmentação por grupo/comunidade/etc
            tokens = []

        if tokens:
            # Enviar em lotes de 500 (limite FCM)
            batch_size = 500
            total_success = 0
            total_failure = 0

            for i in range(0, len(tokens), batch_size):
                batch = tokens[i:i + batch_size]
                response = send_push_multicast(
                    tokens=batch,
                    title=notif.titulo,
                    body=notif.mensagem,
                    data={
                        'type': 'admin_broadcast',
                        'notification_id': str(notif.id_notificacao),
                    }
                )
                if response:
                    total_success += response.success_count
                    total_failure += response.failure_count

            logger.info(
                f"Broadcast {notification_admin_id} concluído: "
                f"{total_success} sucesso, {total_failure} falhas, "
                f"{len(tokens)} tokens total"
            )

        # Marcar como enviada
        notif.enviada = True
        notif.data_envio = timezone.now()
        notif.total_enviados = len(tokens)
        notif.save(update_fields=['enviada', 'data_envio', 'total_enviados'])

    except Exception as exc:
        logger.error(f"Erro ao enviar broadcast: {exc}")
        self.retry(exc=exc)


@shared_task
def cleanup_old_notifications():
    """
    Tarefa periódica: remove notificações lidas com mais de 90 dias.
    """
    from core.models import Notificacao
    from datetime import timedelta

    cutoff = timezone.now() - timedelta(days=90)
    deleted_count, _ = Notificacao.objects.filter(
        lida=True,
        data_criacao__lt=cutoff
    ).delete()
    logger.info(f"Limpeza de notificações: {deleted_count} removidas")


def send_realtime_notification(user_id, notification_data):
    """
    Função auxiliar para enviar notificação via WebSocket channel layer.
    Chamada pelas views ao criar notificações.
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        group_name = f'notifications_{user_id}'

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'notification.new',
                'notification': notification_data,
            }
        )
    except Exception as e:
        logger.error(f"Erro ao enviar notificação via WS: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# FEED ALGORITHM TASKS
# ══════════════════════════════════════════════════════════════════════════════

@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def compute_post_embedding_task(self, post_id):
    """
    Computa embedding semântico de um post recém-criado.
    Executada assincronamente via Celery ao criar publicação.
    """
    try:
        from core.models import Publicacao, PostEmbedding
        from core.feed_embeddings import compute_embedding

        post = Publicacao.objects.get(id_publicacao=post_id)
        text = f"{post.titulo or ''} {post.conteudo_texto or ''}"

        if not text.strip():
            logger.debug(f"Post {post_id} sem texto para embedding. Pulando.")
            return

        raw = compute_embedding(text)
        PostEmbedding.objects.update_or_create(
            publicacao=post,
            defaults={'vetor': raw}
        )
        logger.info(f"Embedding computado para post {post_id}")

    except Publicacao.DoesNotExist:
        logger.warning(f"Post {post_id} não encontrado para embedding.")
    except Exception as exc:
        logger.error(f"Erro ao computar embedding do post {post_id}: {exc}")
        self.retry(exc=exc)


@shared_task
def update_user_interest_vectors():
    """
    Atualiza vetores de interesse de usuários ativos (executada a cada hora).
    O vetor é a média dos embeddings dos posts engajados nos últimos 30 dias.
    Armazenado no Redis com TTL de 2 horas.
    """
    from core.models import Usuario
    from core.feed_embeddings import compute_user_interest_vector
    from django.core.cache import cache

    ativos = Usuario.objects.filter(status=1, is_active=True)
    count = 0
    errors = 0

    for user in ativos.iterator(chunk_size=100):
        try:
            vec_bytes = compute_user_interest_vector(user)
            if vec_bytes:
                cache.set(f'user_interest_vec:{user.id_usuario}', vec_bytes, 7200)
                count += 1
        except Exception as e:
            errors += 1
            logger.error(f"Erro ao computar vetor de interesse de {user.id_usuario}: {e}")

    logger.info(f"Vetores de interesse atualizados: {count} usuários ({errors} erros)")


@shared_task
def cleanup_posts_vistos():
    """
    Remove registros de PostVisto com mais de 30 dias (executada diariamente às 4h).
    Posts com mais de 30 dias não entram no pool de candidatos, então
    manter esses registros é desperdício de espaço.
    """
    from core.models import PostVisto
    from datetime import timedelta

    cutoff = timezone.now() - timedelta(days=30)
    deleted, _ = PostVisto.objects.filter(data_visto__lt=cutoff).delete()
    logger.info(f"Limpeza de PostVisto: {deleted} registros removidos")

