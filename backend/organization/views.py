from django.shortcuts import render
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .seralizers import NotesSerializer
from .models import Notes

# Create your views here.

class NotesViews(generics.ListCreateAPIView):
    serializer_class = NotesSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notes.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class NotesEdit(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = NotesSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notes.objects.filter(owner=self.request.user)