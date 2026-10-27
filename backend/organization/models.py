from django.db import models
from django.conf import settings

# Create your models here.

class Notes(models.Model):
    class Meta:
        ordering = ('-id',)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notes',
        null=True,
        blank=True,
    )
    notes_name = models.CharField(max_length=200)
    notes = models.TextField()

    def __str__(self):
        return self.notes_name