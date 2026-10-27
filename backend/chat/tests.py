from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from OS.asgi import application
from connect.models import Connection

from .models import ChatMessage


class ChatApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.alice = user_model.objects.create_user(username='chat-alice')
        self.bob = user_model.objects.create_user(username='chat-bob')
        self.stranger = user_model.objects.create_user(username='chat-stranger')
        self.connection = Connection.objects.create(
            user_a_id=min(self.alice.pk, self.bob.pk),
            user_b_id=max(self.alice.pk, self.bob.pk),
        )
        self.client = APIClient()

    def test_chat_api_requires_authentication(self):
        response = self.client.get('/api/V1/chat/conversations/')
        self.assertIn(response.status_code, (401, 403))

    def test_connected_users_can_read_and_send_messages(self):
        self.client.force_authenticate(user=self.alice)
        messages_url = (
            f'/api/V1/chat/conversations/{self.bob.pk}/messages/'
        )

        response = self.client.post(
            messages_url,
            {'content': '  Hello Bob  '},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['content'], 'Hello Bob')
        self.assertEqual(response.data['sender'], self.alice.pk)

        history_response = self.client.get(messages_url)
        self.assertEqual(history_response.status_code, 200)
        self.assertEqual(len(history_response.data), 1)

        conversations_response = self.client.get(
            '/api/V1/chat/conversations/'
        )
        self.assertEqual(conversations_response.status_code, 200)
        self.assertEqual(len(conversations_response.data), 1)
        self.assertEqual(
            conversations_response.data[0]['user']['id'],
            self.bob.pk,
        )
        self.assertEqual(
            conversations_response.data[0]['last_message']['content'],
            'Hello Bob',
        )

    def test_unconnected_users_cannot_read_or_send_messages(self):
        self.client.force_authenticate(user=self.stranger)
        messages_url = (
            f'/api/V1/chat/conversations/{self.alice.pk}/messages/'
        )

        self.assertEqual(self.client.get(messages_url).status_code, 404)
        self.assertEqual(
            self.client.post(
                messages_url,
                {'content': 'Not allowed'},
                format='json',
            ).status_code,
            404,
        )
        self.assertEqual(ChatMessage.objects.count(), 0)


class ChatWebSocketTests(TransactionTestCase):
    def setUp(self):
        user_model = get_user_model()
        self.alice = user_model.objects.create_user(
            username='socket-alice',
            password='test-password',
        )
        self.bob = user_model.objects.create_user(
            username='socket-bob',
            password='test-password',
        )
        Connection.objects.create(
            user_a_id=min(self.alice.pk, self.bob.pk),
            user_b_id=max(self.alice.pk, self.bob.pk),
        )

    def communicator_for(self, user, peer_id):
        access_token = str(RefreshToken.for_user(user).access_token)
        return WebsocketCommunicator(
            application,
            f'/ws/chat/{peer_id}/',
            headers=[
                (b'origin', b'http://localhost:3000'),
            ],
            subprotocols=['bearer', access_token],
        )

    def test_authenticated_connected_users_exchange_persisted_messages(self):
        alice_socket = self.communicator_for(self.alice, self.bob.pk)
        bob_socket = self.communicator_for(self.bob, self.alice.pk)

        async def exchange_messages():
            alice_connected, _ = await alice_socket.connect()
            bob_connected, _ = await bob_socket.connect()
            await alice_socket.send_json_to({'message': 'Hello over WS'})
            alice_event = await alice_socket.receive_json_from()
            bob_event = await bob_socket.receive_json_from()
            await alice_socket.disconnect()
            await bob_socket.disconnect()
            return alice_connected, bob_connected, alice_event, bob_event

        alice_connected, bob_connected, alice_event, bob_event = (
            async_to_sync(exchange_messages)()
        )

        self.assertTrue(alice_connected)
        self.assertTrue(bob_connected)
        self.assertEqual(alice_event['message']['content'], 'Hello over WS')
        self.assertEqual(bob_event['message']['content'], 'Hello over WS')
        self.assertEqual(ChatMessage.objects.count(), 1)

    def test_unconnected_user_cannot_open_websocket(self):
        stranger = get_user_model().objects.create_user(
            username='socket-stranger',
            password='test-password',
        )
        socket = self.communicator_for(stranger, self.alice.pk)

        connected, close_code = async_to_sync(socket.connect)()

        self.assertFalse(connected)
        self.assertEqual(close_code, 4403)
