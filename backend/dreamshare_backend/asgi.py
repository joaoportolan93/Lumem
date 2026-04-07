"""
ASGI config for dreamshare_backend project.

Configura o roteamento para HTTP (Django) e WebSocket (Channels).
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dreamshare_backend.settings')
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

from core.middleware import JWTAuthMiddleware
from core.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
