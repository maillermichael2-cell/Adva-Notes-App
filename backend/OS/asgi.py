"""
ASGI config for apiHolder project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'OS.settings')

django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.conf import settings

from chat.routing import websocket_urlpatterns


application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': OriginValidator(
        AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
        settings.CORS_ALLOWED_ORIGINS,
    ),
})
