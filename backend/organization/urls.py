from .views import NotesViews, NotesEdit
from rest_framework.urls import path


urlpatterns = [
    path('notes/', NotesViews.as_view(), name='org'),
    path('notes/<int:pk>/', NotesEdit.as_view(), name='orgedt')
]