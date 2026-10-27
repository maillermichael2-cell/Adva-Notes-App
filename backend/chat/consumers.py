from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.db.models import Q

from connect.models import Connection

from .models import ChatMessage
from .serializers import ChatMessageSerializer


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope['user']
        if not user.is_authenticated:
            await self.close(code=4401)
            return

        peer_id = self.scope['url_route']['kwargs']['peer_id']
        if peer_id == user.pk:
            await self.close(code=4403)
            return

        self.connection_id = await self.get_connection_id(user.pk, peer_id)
        if self.connection_id is None:
            await self.close(code=4403)
            return

        self.group_name = f'chat-{self.connection_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )

    async def receive_json(self, content, **kwargs):
        text = content.get('message') if isinstance(content, dict) else None
        if not isinstance(text, str) or not text.strip():
            await self.send_json({
                'type': 'error',
                'message': 'Enter a message before sending.',
            })
            return

        text = text.strip()
        if len(text) > 2000:
            await self.send_json({
                'type': 'error',
                'message': 'Messages must be 2000 characters or fewer.',
            })
            return

        message = await self.save_message(text)
        await self.channel_layer.group_send(
            self.group_name,
            {'type': 'chat.message', 'message': message},
        )

    async def chat_message(self, event):
        await self.send_json({
            'type': 'message',
            'message': event['message'],
        })

    @database_sync_to_async
    def get_connection_id(self, user_id, peer_id):
        return (
            Connection.objects.filter(
                (Q(user_a_id=user_id) & Q(user_b_id=peer_id))
                | (Q(user_b_id=user_id) & Q(user_a_id=peer_id))
            )
            .values_list('pk', flat=True)
            .first()
        )

    @database_sync_to_async
    def save_message(self, text):
        message = ChatMessage.objects.create(
            connection_id=self.connection_id,
            sender=self.scope['user'],
            content=text,
        )
        return ChatMessageSerializer(message).data
