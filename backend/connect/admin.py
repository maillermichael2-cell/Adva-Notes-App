from django.contrib import admin

from .models import Connection


@admin.register(Connection)
class ConnectionAdmin(admin.ModelAdmin):
    list_display = ('user_a', 'user_b', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user_a__username', 'user_b__username')
