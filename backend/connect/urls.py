from django.urls import path

from .views import (
    ConnectionListView,
    CreateQrTokenView,
    ScanQrCodeView,
    SessionTokenView,
    logout_view,
    refresh_access_token,
    session_status,
)


urlpatterns = [
    path('session/', session_status, name='connect-session'),
    path('token/', SessionTokenView.as_view(), name='connect-token'),
    path(
        'token/refresh/',
        refresh_access_token,
        name='connect-token-refresh',
    ),
    path('connections/', ConnectionListView.as_view(), name='connect-connections'),
    path('qr-token/', CreateQrTokenView.as_view(), name='connect-qr-token'),
    path('scan/', ScanQrCodeView.as_view(), name='connect-scan'),
    path('logout/', logout_view, name='connect-logout'),
]