from django.contrib import admin

from .models import ChatMessage


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('connection', 'sender', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('content', 'sender__username')
    readonly_fields = ('created_at',)
