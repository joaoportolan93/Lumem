"""
Serviço de integração com Firebase Cloud Messaging (FCM).
Envia push notifications para dispositivos móveis via Firebase Admin SDK.
Credenciais lidas do .env (FIREBASE_CREDENTIALS_PATH).
"""
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

_firebase_app = None


def _get_firebase_app():
    """Inicializa o Firebase Admin SDK (singleton)."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    credentials_path = settings.FIREBASE_CREDENTIALS_PATH
    if not credentials_path:
        logger.warning("FIREBASE_CREDENTIALS_PATH não configurado. Push notifications desabilitadas.")
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials as fb_credentials

        cred = fb_credentials.Certificate(credentials_path)
        _firebase_app = firebase_admin.initialize_app(cred, {
            'projectId': settings.FIREBASE_PROJECT_ID,
        })
        logger.info("Firebase Admin SDK inicializado com sucesso.")
        return _firebase_app
    except Exception as e:
        logger.error(f"Erro ao inicializar Firebase Admin SDK: {e}")
        return None


def send_push_notification(token, title, body, data=None):
    """
    Envia uma push notification para um único dispositivo via FCM.

    Args:
        token: FCM token do dispositivo
        title: Título da notificação
        body: Corpo da mensagem
        data: Dict com dados extras (opcional)
    Returns:
        str: Message ID se sucesso, None se falha
    """
    app = _get_firebase_app()
    if app is None:
        logger.warning("Firebase não inicializado. Push não enviado.")
        return None

    if not token:
        logger.warning("Token FCM vazio. Push não enviado.")
        return None

    try:
        from firebase_admin import messaging

        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=data or {},
            token=token,
        )

        response = messaging.send(message)
        logger.info(f"Push enviado com sucesso: {response}")
        return response
    except Exception as e:
        logger.error(f"Erro ao enviar push notification: {e}")
        return None


def send_push_multicast(tokens, title, body, data=None):
    """
    Envia push notification para múltiplos dispositivos via FCM.

    Args:
        tokens: Lista de FCM tokens
        title: Título da notificação
        body: Corpo da mensagem
        data: Dict com dados extras (opcional)
    Returns:
        BatchResponse ou None
    """
    app = _get_firebase_app()
    if app is None:
        logger.warning("Firebase não inicializado. Push multicast não enviado.")
        return None

    if not tokens:
        logger.warning("Lista de tokens vazia. Push multicast não enviado.")
        return None

    # Filtrar tokens válidos (não nulos/vazios)
    valid_tokens = [t for t in tokens if t]
    if not valid_tokens:
        return None

    try:
        from firebase_admin import messaging

        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=data or {},
            tokens=valid_tokens,
        )

        response = messaging.send_each_for_multicast(message)
        logger.info(
            f"Push multicast enviado: {response.success_count} sucesso, "
            f"{response.failure_count} falhas de {len(valid_tokens)} tokens"
        )
        return response
    except Exception as e:
        logger.error(f"Erro ao enviar push multicast: {e}")
        return None
