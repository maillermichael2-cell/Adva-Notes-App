from django.conf import settings
from django.contrib.auth import get_user_model, logout
from django.core import signing
from django.db import transaction
from django.db.models import Q
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import OptionalJWTAuthentication
from .models import Connection
from .serializers import (
    ConnectedUserSerializer,
    ConnectionSerializer,
    ScanQrCodeSerializer,
)


QR_TOKEN_SALT = 'connect.user-qr'


@ensure_csrf_cookie
@api_view(['GET'])
@authentication_classes([
    OptionalJWTAuthentication,
    SessionAuthentication,
])
@permission_classes([AllowAny])
def session_status(request):
    user = (
        ConnectedUserSerializer(request.user).data
        if request.user.is_authenticated
        else None
    )
    return Response({
        'authenticated': request.user.is_authenticated,
        'user': user,
        'csrf_token': get_token(request),
        'google_oauth_configured': settings.GOOGLE_OAUTH_CONFIGURED,
    })


class SessionTokenView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = RefreshToken.for_user(request.user)
        response = Response({'access': str(refresh.access_token)})
        response.set_cookie(
            settings.JWT_REFRESH_COOKIE_NAME,
            str(refresh),
            max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
            httponly=True,
            secure=not settings.DEBUG,
            samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
            path=settings.JWT_REFRESH_COOKIE_PATH,
        )
        logout(request)
        return response


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def refresh_access_token(request):
    refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
    if not refresh:
        return Response(
            {'detail': 'Refresh token is required.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        refresh_token = RefreshToken(refresh)
        access_token = str(refresh_token.access_token)
    except TokenError:
        response = Response(
            {'detail': 'Refresh token is invalid or expired.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
        response.delete_cookie(
            settings.JWT_REFRESH_COOKIE_NAME,
            path=settings.JWT_REFRESH_COOKIE_PATH,
            samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
        )
        return response
    return Response({'access': access_token})


class ConnectionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        connections = Connection.objects.filter(
            Q(user_a=request.user) | Q(user_b=request.user)
        ).select_related('user_a', 'user_b')
        return Response({
            'user': ConnectedUserSerializer(request.user).data,
            'connections': ConnectionSerializer(
                connections,
                many=True,
                context={'request': request},
            ).data,
        })


class CreateQrTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = signing.dumps(
            {'user_id': request.user.pk},
            salt=QR_TOKEN_SALT,
        )
        return Response({
            'token': token,
            'expires_in': settings.CONNECT_QR_TOKEN_MAX_AGE_SECONDS,
        })


class ScanQrCodeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ScanQrCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            payload = signing.loads(
                serializer.validated_data['token'],
                salt=QR_TOKEN_SALT,
                max_age=settings.CONNECT_QR_TOKEN_MAX_AGE_SECONDS,
            )
            target_user_id = int(payload['user_id'])
        except (signing.BadSignature, KeyError, TypeError, ValueError) as error:
            raise ValidationError(
                {'token': 'This QR code is invalid or expired.'}
            ) from error

        if target_user_id == request.user.pk:
            raise ValidationError({'token': 'You cannot connect to yourself.'})

        user_model = get_user_model()
        try:
            target_user = user_model.objects.get(pk=target_user_id)
        except user_model.DoesNotExist as error:
            raise ValidationError(
                {'token': 'This QR code is invalid or expired.'}
            ) from error

        first_user_id, second_user_id = sorted(
            (request.user.pk, target_user.pk)
        )
        with transaction.atomic():
            connection, created = Connection.objects.get_or_create(
                user_a_id=first_user_id,
                user_b_id=second_user_id,
            )

        connection_data = ConnectionSerializer(
            connection,
            context={'request': request},
        ).data
        return Response(
            {'created': created, 'connection': connection_data},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    response = Response(status=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path=settings.JWT_REFRESH_COOKIE_PATH,
        samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
    )
    return response
