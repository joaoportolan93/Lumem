"""
Middleware de autenticação JWT para conexões WebSocket (Django Channels).
Extrai o token da query string (?token=xxx) e autentica o usuário.
"""
import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(token_str):
    """Valida o JWT e retorna o usuário correspondente."""
    try:
        from core.models import Usuario

        access_token = AccessToken(token_str)
        user_id = access_token['user_id']
        user = Usuario.objects.get(id_usuario=user_id)

        if user.status != 1:  # Só permite usuários ativos
            return AnonymousUser()

        return user
    except Exception as e:
        logger.debug(f"Falha na autenticação WebSocket: {e}")
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Middleware que autentica conexões WebSocket via JWT na query string.

    Uso no cliente:
        ws://host/ws/chat/<id>/?token=<jwt_access_token>
    """

    async def __call__(self, scope, receive, send):
        # Extrair token da query string
        query_string = scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        token_list = params.get('token', [])

        if token_list:
            token_str = token_list[0]
            scope['user'] = await get_user_from_token(token_str)
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)
