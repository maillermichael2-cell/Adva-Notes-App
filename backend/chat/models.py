from django.db import models
from django.conf import settings
from connect.models import Connection


class ChatMessage(models.Model):
    connection = models.ForeignKey(
        Connection,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_chat_messages',
    )
    content = models.CharField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('created_at', 'pk')
        indexes = [
            models.Index(fields=('connection', '-created_at', '-id')),
        ]

    def __str__(self):
        return f'{self.sender_id}: {self.content[:40]}'
