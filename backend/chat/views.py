from django.db.models import OuterRef, Q, Subquery
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from connect.models import Connection
from connect.serializers import ConnectedUserSerializer

from .models import ChatMessage
from .serializers import ChatMessageSerializer


def get_connection_for_users(user, peer_id):
    return Connection.objects.filter(
        (Q(user_a=user) & Q(user_b_id=peer_id))
        | (Q(user_b=user) & Q(user_a_id=peer_id))
    ).first()


class ConversationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        latest_messages = ChatMessage.objects.filter(
            connection_id=OuterRef('pk')
        ).order_by('-created_at', '-pk')
        return (
            Connection.objects.filter(
                Q(user_a=self.request.user) | Q(user_b=self.request.user)
            )
            .select_related('user_a', 'user_b')
            .annotate(
                last_message_content=Subquery(
                    latest_messages.values('content')[:1]
                ),
                last_message_sender_id=Subquery(
                    latest_messages.values('sender_id')[:1]
                ),
                last_message_created_at=Subquery(
                    latest_messages.values('created_at')[:1]
                ),
            )
        )

    def list(self, request, *args, **kwargs):
        conversations = []
        for connection in self.get_queryset():
            peer = (
                connection.user_b
                if connection.user_a_id == request.user.pk
                else connection.user_a
            )
            last_message = None
            if connection.last_message_created_at:
                last_message = {
                    'content': connection.last_message_content,
                    'sender_id': connection.last_message_sender_id,
                    'created_at': connection.last_message_created_at,
                }
            conversations.append({
                'user': ConnectedUserSerializer(peer).data,
                'last_message': last_message,
            })
        return Response(conversations)


class ConversationMessagesView(APIView):
    permission_classes = [IsAuthenticated]
    page_size = 50

    def get_connection(self, request, peer_id):
        connection = get_connection_for_users(request.user, peer_id)
        if connection is None:
            raise NotFound('You can only chat with connected users.')
        return connection

    def get(self, request, peer_id):
        connection = self.get_connection(request, peer_id)
        messages = list(
            ChatMessage.objects.filter(connection=connection)
            .select_related('sender')
            .order_by('-created_at', '-pk')[:self.page_size]
        )
        messages.reverse()
        return Response(ChatMessageSerializer(messages, many=True).data)

    def post(self, request, peer_id):
        connection = self.get_connection(request, peer_id)
        serializer = ChatMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save(connection=connection, sender=request.user)
        return Response(
            ChatMessageSerializer(message).data,
            status=status.HTTP_201_CREATED,
        )
