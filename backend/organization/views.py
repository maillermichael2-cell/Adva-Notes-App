from django.shortcuts import render
from rest_framework import generics
from .seralizers import NotesSerializer
from .models import Notes

# Create your views here.

class NotesViews(generics.ListCreateAPIView):
    serializer_class = NotesSerializer

    def get_queryset(self):
        return Notes.objects.all()


class NotesEdit(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = NotesSerializer

    def get_queryset(self):
        return Notes.objects.all()