from django.db import models
from django.conf import settings
from django.db.models import F, Q


class Connection(models.Model):
    user_a = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='connections_as_user_a',
    )
    user_b = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='connections_as_user_b',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(
                fields=('user_a', 'user_b'),
                name='connect_unique_user_pair',
            ),
            models.CheckConstraint(
                condition=Q(user_a__lt=F('user_b')),
                name='connect_sorted_user_pair',
            ),
        ]

    def __str__(self):
        return f'{self.user_a_id} connected to {self.user_b_id}'
