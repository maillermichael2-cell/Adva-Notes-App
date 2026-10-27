from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


class JwtAuthMiddleware:
    def __init__(self, application):
        self.application = application

    async def __call__(self, scope, receive, send):
        protocols = list(scope.get('subprotocols', []))
        token = None
        if 'bearer' in protocols:
            bearer_index = protocols.index('bearer')
            if bearer_index + 1 < len(protocols):
                token = protocols[bearer_index + 1]
                del protocols[bearer_index:bearer_index + 2]

        user = AnonymousUser()
        if token:
            try:
                validated_token = AccessToken(token)
                user = await self.get_user(validated_token)
            except (AuthenticationFailed, TokenError):
                user = AnonymousUser()

        await self.application(
            {**scope, 'subprotocols': protocols, 'user': user},
            receive,
            send,
        )

    @database_sync_to_async
    def get_user(self, validated_token):
        return JWTAuthentication().get_user(validated_token)
