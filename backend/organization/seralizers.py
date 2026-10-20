from .models import Notes
from rest_framework import serializers

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notes
        fields = '__all__'