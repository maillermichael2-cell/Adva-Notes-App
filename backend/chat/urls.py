from django.urls import path

from .views import ConversationListView, ConversationMessagesView


urlpatterns = [
    path('conversations/', ConversationListView.as_view(), name='chat-conversations'),
    path(
        'conversations/<int:peer_id>/messages/',
        ConversationMessagesView.as_view(),
        name='chat-messages',
    ),
]
