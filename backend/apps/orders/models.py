"""
Order, OrderItem, OrderStatusHistory models
"""
import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Order(models.Model):
    # Status choices
    STATUS_PLACED = 'PLACED'
    STATUS_CONFIRMED = 'CONFIRMED'
    STATUS_PROCESSING = 'PROCESSING'
    STATUS_SHIPPED = 'SHIPPED'
    STATUS_OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY'
    STATUS_DELIVERED = 'DELIVERED'
    STATUS_CANCELLED = 'CANCELLED'
    STATUS_RETURNED = 'RETURNED'

    ORDER_STATUS_CHOICES = [
        (STATUS_PLACED, 'Placed'),
        (STATUS_CONFIRMED, 'Confirmed'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_SHIPPED, 'Shipped'),
        (STATUS_OUT_FOR_DELIVERY, 'Out for Delivery'),
        (STATUS_DELIVERED, 'Delivered'),
        (STATUS_CANCELLED, 'Cancelled'),
        (STATUS_RETURNED, 'Returned'),
    ]

    # Payment status
    PAYMENT_STATUS_PENDING = 'PENDING'
    PAYMENT_STATUS_PAID = 'PAID'
    PAYMENT_STATUS_COLLECTED = 'COLLECTED'
    PAYMENT_STATUS_FAILED = 'FAILED'
    PAYMENT_STATUS_REFUNDED = 'REFUNDED'
    PAYMENT_STATUS_CANCELLED = 'CANCELLED'

    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_STATUS_PENDING, 'Pending'),
        (PAYMENT_STATUS_PAID, 'Paid'),
        (PAYMENT_STATUS_COLLECTED, 'Collected'),
        (PAYMENT_STATUS_FAILED, 'Failed'),
        (PAYMENT_STATUS_REFUNDED, 'Refunded'),
        (PAYMENT_STATUS_CANCELLED, 'Cancelled'),
    ]

    # Payment method
    PAYMENT_METHOD_COD = 'COD'
    PAYMENT_METHOD_UPI = 'UPI'

    PAYMENT_METHOD_CHOICES = [
        (PAYMENT_METHOD_COD, 'Cash on Delivery'),
        (PAYMENT_METHOD_UPI, 'UPI'),
    ]

    # Valid transitions
    VALID_TRANSITIONS = {
        STATUS_PLACED: [STATUS_CONFIRMED, STATUS_CANCELLED],
        STATUS_CONFIRMED: [STATUS_PROCESSING, STATUS_CANCELLED],
        STATUS_PROCESSING: [STATUS_SHIPPED, STATUS_CANCELLED],
        STATUS_SHIPPED: [STATUS_OUT_FOR_DELIVERY],
        STATUS_OUT_FOR_DELIVERY: [STATUS_DELIVERED, STATUS_RETURNED],
        STATUS_DELIVERED: [STATUS_RETURNED],
        STATUS_CANCELLED: [],
        STATUS_RETURNED: [],
    }

    # Fields
    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    idempotency_key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='orders'
    )

    # Address snapshot
    shipping_address_id = models.IntegerField(null=True, blank=True)
    shipping_address_snapshot = models.JSONField(default=dict)

    # Pricing (all in paise)
    subtotal_paise = models.PositiveIntegerField(default=0)
    shipping_paise = models.PositiveIntegerField(default=0)
    tax_paise = models.PositiveIntegerField(default=0)
    discount_paise = models.PositiveIntegerField(default=0)
    total_paise = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=3, default='INR')

    # Payment
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_STATUS_PENDING)

    # Order status
    status = models.CharField(max_length=30, choices=ORDER_STATUS_CHOICES, default=STATUS_PLACED)

    # Tracking
    tracking_number = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'orders_order'
        indexes = [
            models.Index(fields=['customer', '-created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['payment_method']),
            models.Index(fields=['-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return self.order_number

    def can_transition_to(self, new_status):
        return new_status in self.VALID_TRANSITIONS.get(self.status, [])

    @classmethod
    def generate_order_number(cls):
        year = timezone.now().year
        # Get the last order number for this year
        prefix = f"CM-{year}-"
        last = cls.objects.filter(order_number__startswith=prefix).order_by('-order_number').first()
        if last:
            try:
                seq = int(last.order_number.split('-')[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:06d}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    variant = models.ForeignKey(
        'products.ProductVariant', on_delete=models.PROTECT, related_name='order_items'
    )
    # Historical snapshots
    product_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100)
    variant_attributes = models.JSONField(default=dict)
    unit_price_paise = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField()
    total_paise = models.PositiveIntegerField()

    class Meta:
        db_table = 'orders_item'
        indexes = [models.Index(fields=['order'])]

    def __str__(self):
        return f"{self.order.order_number} — {self.sku} x{self.quantity}"


class OrderStatusHistory(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=30, blank=True)
    to_status = models.CharField(max_length=30)
    payment_status = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'orders_status_history'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['order', '-created_at'])]

    def __str__(self):
        return f"{self.order.order_number}: {self.from_status} → {self.to_status}"
