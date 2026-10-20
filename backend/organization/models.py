from django.db import models

# Create your models here.

class Notes(models.Model):
    notes_name = models.CharField(max_length=200)
    notes = models.TextField()

    def __str__(self):
        return self.notes_name