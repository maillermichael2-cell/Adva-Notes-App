from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Notes


class NotesApiQueryTests(TestCase):
    def test_notes_list_query_count_does_not_grow_with_results(self):
        owner = get_user_model().objects.create_user(username='notes-owner')
        Notes.objects.bulk_create([
            Notes(notes_name=f'Note {index}', notes='Content', owner=owner)
            for index in range(20)
        ])
        client = APIClient()
        client.force_authenticate(user=owner)

        with self.assertNumQueries(1):
            response = client.get('/api/V1/notes/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 20)


class NotesApiAuthenticationTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(username='note-owner')
        self.other_user = user_model.objects.create_user(username='other-user')
        self.note = Notes.objects.create(
            owner=self.owner,
            notes_name='Private note',
            notes='Only the owner should see this.',
        )
        self.client = APIClient()

    def test_notes_endpoints_require_authentication(self):
        response = self.client.get('/api/V1/notes/')
        self.assertIn(response.status_code, (401, 403))

        response = self.client.post(
            '/api/V1/notes/',
            {'notes_name': 'Unauthorized', 'notes': 'No access'},
            format='json',
        )
        self.assertIn(response.status_code, (401, 403))

    def test_users_only_list_and_modify_their_own_notes(self):
        self.client.force_authenticate(user=self.other_user)

        list_response = self.client.get('/api/V1/notes/')
        detail_response = self.client.get(
            f'/api/V1/notes/{self.note.pk}/'
        )
        update_response = self.client.patch(
            f'/api/V1/notes/{self.note.pk}/',
            {'notes_name': 'Stolen'},
            format='json',
        )
        delete_response = self.client.delete(
            f'/api/V1/notes/{self.note.pk}/'
        )

        self.assertEqual(list_response.data, [])
        self.assertEqual(detail_response.status_code, 404)
        self.assertEqual(update_response.status_code, 404)
        self.assertEqual(delete_response.status_code, 404)
        self.assertTrue(Notes.objects.filter(pk=self.note.pk).exists())

    def test_created_notes_are_owned_by_authenticated_user(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            '/api/V1/notes/',
            {'notes_name': 'New note', 'notes': 'Private content'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        created_note = Notes.objects.get(pk=response.data['id'])
        self.assertEqual(created_note.owner, self.owner)
