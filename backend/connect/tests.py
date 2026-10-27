from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.core import signing
from django.test import Client, TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Connection
from .views import QR_TOKEN_SALT


class ConnectionApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.alice = user_model.objects.create_user(
            username='alice',
            password='test-password',
        )
        self.bob = user_model.objects.create_user(
            username='bob',
            password='test-password',
        )
        self.client = APIClient()

    def create_qr_token(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.post('/api/V1/connect/qr-token/')
        self.assertEqual(response.status_code, 200)
        return response.data['token']

    def test_session_status_returns_csrf_and_auth_state(self):
        response = self.client.get('/api/V1/connect/session/')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['authenticated'])
        self.assertTrue(response.data['csrf_token'])
        self.assertIsNone(response.data['user'])

    def test_qr_connect_creates_one_mutual_connection(self):
        token = self.create_qr_token(self.alice)
        self.client.force_authenticate(user=self.bob)

        response = self.client.post(
            '/api/V1/connect/scan/',
            {'token': token},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['created'])
        self.assertEqual(
            response.data['connection']['connected_user']['username'],
            'alice',
        )
        self.assertEqual(Connection.objects.count(), 1)

        duplicate_response = self.client.post(
            '/api/V1/connect/scan/',
            {'token': token},
            format='json',
        )
        self.assertEqual(duplicate_response.status_code, 200)
        self.assertFalse(duplicate_response.data['created'])
        self.assertEqual(Connection.objects.count(), 1)

        connections_response = self.client.get(
            '/api/V1/connect/connections/'
        )
        self.assertEqual(connections_response.status_code, 200)
        self.assertEqual(len(connections_response.data['connections']), 1)

        self.client.force_authenticate(user=self.alice)
        alice_connections_response = self.client.get(
            '/api/V1/connect/connections/'
        )
        self.assertEqual(
            alice_connections_response.data['connections'][0][
                'connected_user'
            ]['username'],
            'bob',
        )

    def test_connections_list_query_count_does_not_grow_with_results(self):
        user_model = get_user_model()
        other_users = [
            user_model.objects.create_user(username=f'network-user-{index}')
            for index in range(20)
        ]
        Connection.objects.bulk_create([
            Connection(
                user_a_id=min(self.alice.pk, other_user.pk),
                user_b_id=max(self.alice.pk, other_user.pk),
            )
            for other_user in other_users
        ])
        self.client.force_authenticate(user=self.alice)

        with self.assertNumQueries(1):
            response = self.client.get('/api/V1/connect/connections/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['connections']), 20)

    def test_scan_rejects_invalid_and_self_qr_codes(self):
        self.client.force_authenticate(user=self.alice)
        invalid_response = self.client.post(
            '/api/V1/connect/scan/',
            {'token': 'invalid'},
            format='json',
        )
        self.assertEqual(invalid_response.status_code, 400)

        self_token = self.create_qr_token(self.alice)
        self_response = self.client.post(
            '/api/V1/connect/scan/',
            {'token': self_token},
            format='json',
        )
        self.assertEqual(self_response.status_code, 400)
        self.assertEqual(Connection.objects.count(), 0)

    @override_settings(CONNECT_QR_TOKEN_MAX_AGE_SECONDS=-1)
    def test_scan_rejects_expired_qr_code(self):
        token = signing.dumps(
            {'user_id': self.alice.pk},
            salt=QR_TOKEN_SALT,
        )
        self.client.force_authenticate(user=self.bob)

        response = self.client.post(
            '/api/V1/connect/scan/',
            {'token': token},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Connection.objects.count(), 0)

    def test_connection_endpoints_require_authentication(self):
        for url, method in (
            ('/api/V1/connect/qr-token/', self.client.post),
            ('/api/V1/connect/scan/', self.client.post),
            ('/api/V1/connect/connections/', self.client.get),
        ):
            with self.subTest(url=url):
                response = method(url, {}, format='json')
                self.assertIn(response.status_code, (401, 403))

    def test_api_accepts_bearer_token_without_a_session(self):
        access_token = str(RefreshToken.for_user(self.alice).access_token)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

        response = client.get('/api/V1/connect/connections/')

        self.assertEqual(response.status_code, 200)
        self.assertNotIn('sessionid', client.cookies)

    def test_session_exchange_issues_refresh_cookie_and_stateless_access_token(self):
        client = APIClient()
        client.force_authenticate(user=self.alice)

        response = client.post('/api/V1/connect/token/', {}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['access'])
        self.assertTrue(response.cookies['refresh_token']['httponly'])
        self.assertEqual(response.cookies['refresh_token']['path'], '/api/V1/connect/token/')

        client.force_authenticate(user=None)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        protected_response = client.get('/api/V1/connect/connections/')
        self.assertEqual(protected_response.status_code, 200)

    def test_refresh_endpoint_returns_access_token_from_cookie(self):
        refresh_token = str(RefreshToken.for_user(self.alice))
        client = APIClient()
        client.cookies['refresh_token'] = refresh_token

        response = client.post('/api/V1/connect/token/refresh/')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['access'])
        self.assertNotIn('refresh', response.data)

    @override_settings(
        SOCIALACCOUNT_PROVIDERS={
            'google': {
                'APPS': [{
                    'client_id': 'test-client-id',
                    'secret': 'test-client-secret',
                    'key': '',
                }],
                'SCOPE': ['profile', 'email'],
            },
        },
    )
    def test_google_oauth_starts_with_a_csrf_protected_post(self):
        client = Client(
            enforce_csrf_checks=True,
            HTTP_HOST='localhost:8080',
        )
        session_response = client.get('/api/V1/connect/session/')
        csrf_token = session_response.data['csrf_token']

        response = client.post(
            '/accounts/google/login/',
            {'csrfmiddlewaretoken': csrf_token},
        )

        self.assertEqual(response.status_code, 302)
        redirect = urlparse(response['Location'])
        self.assertEqual(redirect.hostname, 'accounts.google.com')
        self.assertEqual(
            parse_qs(redirect.query)['redirect_uri'][0],
            'http://localhost:8080/accounts/google/login/callback/',
        )
