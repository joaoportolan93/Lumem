"""
Lumem Push Service
------------------
Wrapper da Firebase Cloud Messaging (FCM) HTTP v1 API.
Toda comunicação com o FCM passa por aqui.

Referência: https://firebase.google.com/docs/cloud-messaging/send-message
"""

import json
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

FCM_ENDPOINT = 'https://fcm.googleapis.com/v1/projects/{project_id}/messages:send'


def _get_access_token() -> str:
    """
    Gera um OAuth2 access token usando a service account do Firebase.
    O token tem validade de ~1h e é renovado automaticamente pela lib.

    Requer: pip install google-auth
    """
    from google.oauth2 import service_account
    import google.auth.transport.requests

    credentials = service_account.Credentials.from_service_account_file(
        settings.FIREBASE_CREDENTIALS_PATH,
        scopes=['https://www.googleapis.com/auth/firebase.messaging']
    )
    request = google.auth.transport.requests.Request()
    credentials.refresh(request)
    return credentials.token


def send_push(fcm_token: str, title: str, body: str, data: dict = None) -> bool:
    """
    Envia uma notificação push para um dispositivo específico via FCM HTTP v1.

    Args:
        fcm_token:  token FCM do dispositivo destino (salvo em Usuario.fcm_token)
        title:      título da notificação (ex: "Nova curtida")
        body:       corpo da notificação (ex: "joao curtiu seu sonho")
        data:       payload extra acessível no app (ex: {'type': '3', 'post_id': 'uuid'})

    Returns:
        True se enviado com sucesso, False caso contrário.
    """
    if not fcm_token:
        return False

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

        # Token inválido ou dispositivo desregistrado — limpar do banco
        if response.status_code == 404 or (
            response.status_code == 400 and
            'UNREGISTERED' in response.text
        ):
            logger.warning('FCM token inválido detectado, removendo do banco.')
            _invalidate_token(fcm_token)
            return False

        logger.error(f'FCM erro HTTP {response.status_code}: {response.text[:300]}')
        return False

    except Exception as e:
        logger.exception(f'Erro inesperado ao enviar push: {e}')
        return False


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
