"""
Rotas WebSocket para Django Channels.
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Chat 1:1 em tempo real
    re_path(
        r'ws/chat/(?P<conversa_id>[0-9a-f-]+)/$',
        consumers.ChatConsumer.as_asgi()
    ),
    # Notificações em tempo real
    re_path(
        r'ws/notifications/$',
        consumers.NotificationConsumer.as_asgi()
    ),
]
