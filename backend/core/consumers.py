"""
WebSocket consumers para Chat em Tempo Real e Notificações.
Usa Django Channels com Redis como channel layer.
"""
import json
import logging
from datetime import datetime

from channels.generic.websocket import AsyncJsonWebSocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncJsonWebSocketConsumer):
    """
    Consumer WebSocket para chat 1:1 em tempo real.

    Conexão: ws://host/ws/chat/<conversa_id>/?token=<jwt>
    
    Eventos recebidos do cliente:
        - {"type": "chat.message", "content": "texto da mensagem"}
        - {"type": "chat.typing", "is_typing": true/false}
        - {"type": "chat.read"}

    Eventos enviados ao cliente:
        - {"type": "chat.message", "message": {...dados da mensagem...}}
        - {"type": "chat.typing", "user_id": "...", "is_typing": true/false}
        - {"type": "chat.read", "user_id": "...", "timestamp": "..."}
    """

    async def connect(self):
        self.user = self.scope.get('user', AnonymousUser())

        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.conversa_id = str(self.scope['url_route']['kwargs']['conversa_id'])
        self.room_group_name = f'chat_{self.conversa_id}'

        # Verificar se o usuário pertence a esta conversa
        has_access = await self._check_conversation_access()
        if not has_access:
            await self.close(code=4003)
            return

        # Entrar no grupo da conversa
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        logger.info(f"WS Chat conectado: user={self.user.id_usuario}, conversa={self.conversa_id}")

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
        logger.info(f"WS Chat desconectado: close_code={close_code}")

    async def receive_json(self, content):
        """Recebe mensagens JSON do cliente WebSocket."""
        msg_type = content.get('type', '')

        if msg_type == 'chat.message':
            await self._handle_message(content)
        elif msg_type == 'chat.typing':
            await self._handle_typing(content)
        elif msg_type == 'chat.read':
            await self._handle_read()
        else:
            await self.send_json({'error': 'Tipo de mensagem desconhecido'})

    async def _handle_message(self, content):
        """Processa nova mensagem de chat."""
        text = content.get('content', '').strip()
        if not text:
            await self.send_json({'error': 'Mensagem vazia'})
            return

        # Salvar no banco de dados
        message_data = await self._save_message(text)
        if not message_data:
            await self.send_json({'error': 'Erro ao salvar mensagem'})
            return

        # Broadcast para todos no grupo
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message_data,
            }
        )

        # Disparar push notification (via Celery)
        await self._trigger_push_notification(message_data)

    async def _handle_typing(self, content):
        """Processa indicador de digitação."""
        is_typing = content.get('is_typing', False)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_typing',
                'user_id': str(self.user.id_usuario),
                'is_typing': is_typing,
            }
        )

    async def _handle_read(self):
        """Processa confirmação de leitura."""
        marked = await self._mark_messages_read()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_read',
                'user_id': str(self.user.id_usuario),
                'timestamp': timezone.now().isoformat(),
                'marked_count': marked,
            }
        )

    # --- Channel layer event handlers ---

    async def chat_message(self, event):
        """Envia nova mensagem para o cliente WebSocket."""
        await self.send_json({
            'type': 'chat.message',
            'message': event['message'],
        })

    async def chat_typing(self, event):
        """Envia indicador de digitação (não envia para quem está digitando)."""
        if event['user_id'] != str(self.user.id_usuario):
            await self.send_json({
                'type': 'chat.typing',
                'user_id': event['user_id'],
                'is_typing': event['is_typing'],
            })

    async def chat_read(self, event):
        """Envia confirmação de leitura."""
        if event['user_id'] != str(self.user.id_usuario):
            await self.send_json({
                'type': 'chat.read',
                'user_id': event['user_id'],
                'timestamp': event['timestamp'],
            })

    # --- Database operations (sync → async) ---

    @database_sync_to_async
    def _check_conversation_access(self):
        """Verifica se o usuário pertence à conversa."""
        from core.models import Conversa
        try:
            conversa = Conversa.objects.get(id_conversa=self.conversa_id)
            return (
                conversa.usuario_a_id == self.user.id_usuario or
                conversa.usuario_b_id == self.user.id_usuario
            )
        except Conversa.DoesNotExist:
            return False

    @database_sync_to_async
    def _save_message(self, text):
        """Salva a mensagem no banco e retorna os dados serializados."""
        from core.models import Conversa, MensagemDireta
        try:
            conversa = Conversa.objects.get(id_conversa=self.conversa_id)

            # Determinar destinatário
            if conversa.usuario_a_id == self.user.id_usuario:
                partner = conversa.usuario_b
            else:
                partner = conversa.usuario_a

            # Verificar bloqueio
            from core.models import Bloqueio
            from django.db.models import Q
            if Bloqueio.objects.filter(
                Q(usuario=self.user, usuario_bloqueado=partner) |
                Q(usuario=partner, usuario_bloqueado=self.user)
            ).exists():
                return None

            msg = MensagemDireta.objects.create(
                usuario_remetente=self.user,
                usuario_destinatario=partner,
                conversa=conversa,
                conteudo=text,
                tipo_mensagem='text',
            )

            # Atualizar timestamp da conversa
            conversa.save(update_fields=['data_atualizacao'])

            return {
                'id_mensagem': str(msg.id_mensagem),
                'remetente_id': str(self.user.id_usuario),
                'remetente_nome': self.user.nome_usuario,
                'remetente_avatar': self.user.avatar_url,
                'conteudo': msg.conteudo,
                'tipo_mensagem': msg.tipo_mensagem,
                'data_envio': msg.data_envio.isoformat(),
                'lida': msg.lida,
            }
        except Exception as e:
            logger.error(f"Erro ao salvar mensagem WS: {e}")
            return None

    @database_sync_to_async
    def _mark_messages_read(self):
        """Marca todas as mensagens recebidas nesta conversa como lidas."""
        from core.models import MensagemDireta
        return MensagemDireta.objects.filter(
            conversa_id=self.conversa_id,
            usuario_destinatario=self.user,
            lida=False
        ).update(lida=True, data_leitura=timezone.now())

    @database_sync_to_async
    def _trigger_push_notification(self, message_data):
        """Dispara push notification via Celery para o destinatário."""
        from core.models import Conversa
        try:
            conversa = Conversa.objects.get(id_conversa=self.conversa_id)
            if conversa.usuario_a_id == self.user.id_usuario:
                partner_id = str(conversa.usuario_b_id)
            else:
                partner_id = str(conversa.usuario_a_id)

            from core.tasks import send_chat_push_notification
            send_chat_push_notification.delay(
                user_id=partner_id,
                sender_name=self.user.nome_usuario,
                message_preview=message_data.get('conteudo', '')[:100],
                conversa_id=self.conversa_id,
            )
        except Exception as e:
            logger.error(f"Erro ao disparar push de chat: {e}")


class NotificationConsumer(AsyncJsonWebSocketConsumer):
    """
    Consumer WebSocket para notificações em tempo real.

    Conexão: ws://host/ws/notifications/?token=<jwt>

    Eventos enviados ao cliente:
        - {"type": "notification.new", "notification": {...}}
        - {"type": "notification.count", "unread_count": N}
    """

    async def connect(self):
        self.user = self.scope.get('user', AnonymousUser())

        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_group = f'notifications_{self.user.id_usuario}'

        await self.channel_layer.group_add(
            self.user_group,
            self.channel_name
        )

        await self.accept()

        # Enviar contagem de não lidas ao conectar
        unread = await self._get_unread_count()
        await self.send_json({
            'type': 'notification.count',
            'unread_count': unread,
        })

        logger.info(f"WS Notifications conectado: user={self.user.id_usuario}")

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(
                self.user_group,
                self.channel_name
            )

    async def receive_json(self, content):
        """Recebe ações do cliente (ex: marcar como lida)."""
        msg_type = content.get('type', '')

        if msg_type == 'notification.read':
            notif_id = content.get('notification_id')
            if notif_id:
                await self._mark_as_read(notif_id)
                unread = await self._get_unread_count()
                await self.send_json({
                    'type': 'notification.count',
                    'unread_count': unread,
                })
        elif msg_type == 'notification.read_all':
            await self._mark_all_read()
            await self.send_json({
                'type': 'notification.count',
                'unread_count': 0,
            })

    # --- Channel layer event handlers ---

    async def notification_new(self, event):
        """Recebe nova notificação do channel layer e envia ao cliente."""
        await self.send_json({
            'type': 'notification.new',
            'notification': event['notification'],
        })

    async def notification_count(self, event):
        """Atualiza contagem de não lidas."""
        await self.send_json({
            'type': 'notification.count',
            'unread_count': event['unread_count'],
        })

    # --- Database operations ---

    @database_sync_to_async
    def _get_unread_count(self):
        from core.models import Notificacao
        return Notificacao.objects.filter(
            usuario_destino=self.user,
            lida=False
        ).count()

    @database_sync_to_async
    def _mark_as_read(self, notif_id):
        from core.models import Notificacao
        Notificacao.objects.filter(
            id_notificacao=notif_id,
            usuario_destino=self.user,
            lida=False
        ).update(lida=True, data_leitura=timezone.now())

    @database_sync_to_async
    def _mark_all_read(self):
        from core.models import Notificacao
        Notificacao.objects.filter(
            usuario_destino=self.user,
            lida=False
        ).update(lida=True, data_leitura=timezone.now())
