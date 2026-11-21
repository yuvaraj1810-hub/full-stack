"""
Payment and PaymentEvent models
"""
import uuid
from django.conf import settings
from django.db import models


class Payment(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_PAID = 'PAID'
    STATUS_COLLECTED = 'COLLECTED'
    STATUS_FAILED = 'FAILED'
    STATUS_REFUNDED = 'REFUNDED'
    STATUS_CANCELLED = 'CANCELLED'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PAID, 'Paid'),
        (STATUS_COLLECTED, 'Collected (COD)'),
        (STATUS_FAILED, 'Failed'),
        (STATUS_REFUNDED, 'Refunded'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    METHOD_COD = 'COD'
    METHOD_UPI = 'UPI'
    METHOD_CHOICES = [
        (METHOD_COD, 'Cash on Delivery'),
        (METHOD_UPI, 'UPI'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField('orders.Order', on_delete=models.PROTECT, related_name='payment')
    payment_method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    amount_paise = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    provider_reference = models.CharField(max_length=200, blank=True, help_text='Gateway transaction ID')
    dev_simulation = models.BooleanField(default=False, help_text='True if this was a dev-mode simulation')
    collected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='collected_payments', help_text='Staff who recorded COD collection'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments_payment'
        indexes = [
            models.Index(fields=['order']),
            models.Index(fields=['status']),
            models.Index(fields=['payment_method']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"Payment {self.id} — {self.order.order_number} — {self.status}"


class PaymentEvent(models.Model):
    """Audit trail of payment state changes."""
    EVENT_TYPES = [
        ('CREATED', 'Created'),
        ('INITIATED', 'Initiated'),
        ('SUCCESS', 'Success'),
        ('FAILURE', 'Failure'),
        ('CANCELLED', 'Cancelled'),
        ('REFUND_INITIATED', 'Refund Initiated'),
        ('REFUNDED', 'Refunded'),
        ('COD_COLLECTED', 'COD Collected'),
        ('DEV_SIMULATED', 'Dev Simulated'),
    ]

    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES)
    payload = models.JSONField(default=dict)
    notes = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payments_event'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['payment', '-created_at'])]

    def __str__(self):
        return f"{self.event_type} — {self.payment_id}"
