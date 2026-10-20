from .views import OrganizationViews, OrganizationEdit
from rest_framework.urls import path


urlpatterns = [
    path('notes/', OrganizationViews.as_view(), name='org'),
    path('notes/<int:pk>/', OrganizationEdit.as_view(), name='orgedt')
]