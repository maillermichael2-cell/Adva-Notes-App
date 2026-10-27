from .models import Notes
from rest_framework import serializers

class NotesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notes
        fields = '__all__'
        read_only_fields = ('owner',)