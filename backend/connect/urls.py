from django.urls import path

from .views import (
    ConnectionListView,
    CreateQrTokenView,
    ScanQrCodeView,
    logout_view,
    session_status,
)


urlpatterns = [
    path('session/', session_status, name='connect-session'),
    path('connections/', ConnectionListView.as_view(), name='connect-connections'),
    path('qr-token/', CreateQrTokenView.as_view(), name='connect-qr-token'),
    path('scan/', ScanQrCodeView.as_view(), name='connect-scan'),
    path('logout/', logout_view, name='connect-logout'),
]