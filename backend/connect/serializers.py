from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Connection


class ConnectedUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ('id', 'username', 'first_name', 'last_name')


class ConnectionSerializer(serializers.ModelSerializer):
    connected_user = serializers.SerializerMethodField()

    class Meta:
        model = Connection
        fields = ('id', 'connected_user', 'created_at')

    def get_connected_user(self, connection):
        current_user = self.context['request'].user
        other_user = (
            connection.user_b
            if connection.user_a_id == current_user.pk
            else connection.user_a
        )
        return ConnectedUserSerializer(other_user).data


class ScanQrCodeSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=4096)