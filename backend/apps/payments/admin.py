from django.contrib import admin
from .models import Payment, PaymentEvent


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'payment_method', 'status', 'amount_paise', 'dev_simulation', 'created_at']
    list_filter = ['payment_method', 'status', 'dev_simulation']
    search_fields = ['order__order_number', 'provider_reference']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(PaymentEvent)
class PaymentEventAdmin(admin.ModelAdmin):
    list_display = ['payment', 'event_type', 'created_at']
    list_filter = ['event_type']
    readonly_fields = ['created_at']
