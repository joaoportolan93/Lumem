"""
Lumem Push Service
------------------
Wrapper da Firebase Cloud Messaging (FCM) HTTP v1 API.
Toda comunicação com o FCM passa por aqui.

Referência: https://firebase.google.com/docs/cloud-messaging/send-message
"""

import json
import logging
import os
import threading
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

FCM_ENDPOINT = 'https://fcm.googleapis.com/v1/projects/{project_id}/messages:send'

# Cache de credenciais em nível de módulo (thread-safe)
_credentials = None
_credentials_lock = threading.Lock()


class PushError(Exception):
    """Erro base para push notifications."""
    pass


class PushTemporaryError(PushError):
    """Erro temporário (rede, rate limit) — pode ser retentado."""
    pass


class PushPermanentError(PushError):
    """Erro permanente (token inválido, config ausente) — não deve ser retentado."""
    pass


def _get_credentials():
    """
    Retorna credenciais OAuth2 cacheadas. Renova automaticamente quando expiram.
    Thread-safe via lock para uso com Celery workers.
    """
    global _credentials

    creds_path = getattr(settings, 'FIREBASE_CREDENTIALS_PATH', None)
    if not creds_path or not os.path.exists(creds_path):
        raise PushPermanentError(
            f'FIREBASE_CREDENTIALS_PATH não configurado ou arquivo não encontrado: {creds_path}'
        )

    with _credentials_lock:
        if _credentials is None or not _credentials.valid:
            from google.oauth2 import service_account
            import google.auth.transport.requests

            _credentials = service_account.Credentials.from_service_account_file(
                creds_path,
                scopes=['https://www.googleapis.com/auth/firebase.messaging']
            )
            request = google.auth.transport.requests.Request()
            _credentials.refresh(request)

    return _credentials


def _get_access_token() -> str:
    """
    Gera um OAuth2 access token usando a service account do Firebase.
    Usa cache em nível de módulo para evitar I/O redundante.
    """
    creds = _get_credentials()

    # Se o token expirou, renovar
    if not creds.valid:
        import google.auth.transport.requests
        request = google.auth.transport.requests.Request()
        creds.refresh(request)

    return creds.token


def send_push(fcm_token: str, title: str, body: str, data: dict = None):
    """
    Envia uma notificação push para um dispositivo específico via FCM HTTP v1.

    Args:
        fcm_token:  token FCM do dispositivo destino (salvo em Usuario.fcm_token)
        title:      título da notificação (ex: "Nova curtida")
        body:       corpo da notificação (ex: "joao curtiu seu sonho")
        data:       payload extra acessível no app (ex: {'type': '3', 'post_id': 'uuid'})

    Returns:
        True se enviado com sucesso.

    Raises:
        PushPermanentError: token inválido, config ausente ou erro do FCM não retentável.
        PushTemporaryError: timeout, rate limit ou erro de rede retentável.
    """
    if not fcm_token:
        raise PushPermanentError('FCM token vazio')

    try:
        access_token = _get_access_token()
        project_id = settings.FIREBASE_PROJECT_ID
        url = FCM_ENDPOINT.format(project_id=project_id)

        payload = {
            'message': {
                'token': fcm_token,
                'notification': {
                    'title': title,
                    'body': body,
                },
                # data: todos os valores precisam ser strings
                'data': {k: str(v) for k, v in (data or {}).items()},
                # Configurações específicas por plataforma
                'android': {
                    'priority': 'high',
                    'notification': {
                        'sound': 'default',
                        'channel_id': 'lumem_notifications',
                    },
                },
                'apns': {
                    'payload': {
                        'aps': {
                            'sound': 'default',
                            'badge': 1,
                        }
                    },
                },
                'webpush': {
                    'notification': {
                        'icon': '/logo192.png',
                        'badge': '/badge.png',
                    },
                },
            }
        }

        response = requests.post(
            url,
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
            },
            data=json.dumps(payload),
            timeout=10,
        )

        if response.status_code == 200:
            return True

        # Token inválido ou dispositivo desregistrado — erro permanente
        if response.status_code == 404 or (
            response.status_code == 400 and
            'UNREGISTERED' in response.text
        ):
            logger.warning('FCM token inválido detectado, removendo do banco.')
            _invalidate_token(fcm_token)
            raise PushPermanentError(f'Token FCM inválido/desregistrado')

        # Rate limit ou erro temporário do servidor
        if response.status_code in (429, 500, 502, 503):
            raise PushTemporaryError(
                f'FCM erro temporário HTTP {response.status_code}: {response.text[:200]}'
            )

        # Outros erros (ex: 401 bad auth) — permanente
        logger.error(f'FCM erro HTTP {response.status_code}: {response.text[:300]}')
        raise PushPermanentError(f'FCM erro HTTP {response.status_code}')

    except (PushPermanentError, PushTemporaryError):
        raise  # Re-levantar exceções de push sem mascarar

    except requests.exceptions.Timeout:
        raise PushTemporaryError('Timeout ao conectar com FCM')

    except requests.exceptions.ConnectionError:
        raise PushTemporaryError('Erro de conexão com FCM')

    except Exception as e:
        logger.exception(f'Erro inesperado ao enviar push: {e}')
        raise PushTemporaryError(f'Erro inesperado: {e}')


def _invalidate_token(fcm_token: str):
    """
    Remove token inválido do banco de dados.
    Evita tentativas repetidas para tokens que o FCM rejeitou como UNREGISTERED.
    """
    from .models import Usuario
    Usuario.objects.filter(fcm_token=fcm_token).update(
        fcm_token=None,
        fcm_token_updated_at=None
    )
    logger.info('Token FCM inválido removido do banco.')
