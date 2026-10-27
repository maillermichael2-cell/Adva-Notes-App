from rest_framework import serializers

from .models import ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ('id', 'sender', 'content', 'created_at')
        read_only_fields = ('id', 'sender', 'created_at')

    def validate_content(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Message cannot be empty.')
        return value
