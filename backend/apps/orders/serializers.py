from rest_framework import serializers
from .models import Order, OrderItem, OrderStatusHistory
from apps.users.serializers import AddressSerializer


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['id', 'variant', 'product_name', 'sku', 'variant_attributes',
                  'unit_price_paise', 'quantity', 'total_paise']


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.CharField(source='changed_by.email', read_only=True)

    class Meta:
        model = OrderStatusHistory
        fields = ['id', 'from_status', 'to_status', 'payment_status',
                  'notes', 'changed_by_email', 'created_at']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 'customer_email', 'customer_phone',
            'shipping_address_snapshot',
            'subtotal_paise', 'shipping_paise', 'tax_paise', 'discount_paise', 'total_paise', 'currency',
            'payment_method', 'payment_status', 'status', 'tracking_number', 'notes',
            'items', 'status_history', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'order_number', 'created_at', 'updated_at']


class OrderListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views."""
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer_name', 'customer_email',
            'total_paise', 'payment_method', 'payment_status', 'status',
            'item_count', 'created_at',
        ]

    def get_item_count(self, obj):
        return obj.items.count()


class AdminOrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.ORDER_STATUS_CHOICES, required=False)
    payment_status = serializers.ChoiceField(choices=Order.PAYMENT_STATUS_CHOICES, required=False)
    notes = serializers.CharField(max_length=1000, allow_blank=True, default='')
    tracking_number = serializers.CharField(max_length=100, allow_blank=True, required=False)

    def validate(self, data):
        if not data.get('status') and not data.get('payment_status'):
            raise serializers.ValidationError("Provide at least one of status or payment_status.")
        return data


class CODCheckoutSerializer(serializers.Serializer):
    shipping_address_id = serializers.IntegerField()
    payment_method = serializers.ChoiceField(choices=['COD'])
    idempotency_key = serializers.UUIDField(required=False)

    def validate_shipping_address_id(self, value):
        from apps.users.models import Address
        request = self.context['request']
        try:
            self._address = Address.objects.get(pk=value, user=request.user)
        except Address.DoesNotExist:
            raise serializers.ValidationError("Address not found or does not belong to you.")
        return value


class UPICheckoutSerializer(serializers.Serializer):
    shipping_address_id = serializers.IntegerField()
    payment_method = serializers.ChoiceField(choices=['UPI'])
    idempotency_key = serializers.UUIDField(required=False)

    def validate_shipping_address_id(self, value):
        from apps.users.models import Address
        request = self.context['request']
        try:
            self._address = Address.objects.get(pk=value, user=request.user)
        except Address.DoesNotExist:
            raise serializers.ValidationError("Address not found or does not belong to you.")
        return value
