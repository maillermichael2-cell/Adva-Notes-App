from django.test import TestCase
from rest_framework.test import APIClient

from .models import Notes


class NotesApiQueryTests(TestCase):
    def test_notes_list_query_count_does_not_grow_with_results(self):
        Notes.objects.bulk_create([
            Notes(notes_name=f'Note {index}', notes='Content')
            for index in range(20)
        ])
        client = APIClient()

        with self.assertNumQueries(1):
            response = client.get('/api/V1/notes/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 20)
