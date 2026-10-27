from django.urls import path

from .views import NotesEdit, NotesViews


urlpatterns = [
    path('notes/', NotesViews.as_view(), name='org'),
    path('notes/<int:pk>/', NotesEdit.as_view(), name='orgedt'),
]