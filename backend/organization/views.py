from django.shortcuts import render
from rest_framework import generics
from .seralizers import OrganizationSerializer
from .models import Notes

# Create your views here.

class OrganizationViews(generics.ListCreateAPIView):
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        return Notes.objects.all()


class OrganizationEdit(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        return Notes.objects.all()