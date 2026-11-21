from rest_framework import serializers
from .models import Cart, CartItem
from apps.products.serializers import ProductVariantSerializer


class CartItemSerializer(serializers.ModelSerializer):
    variant = ProductVariantSerializer(read_only=True)
    subtotal_paise = serializers.ReadOnlyField()

    class Meta:
        model = CartItem
        fields = ['id', 'variant', 'quantity', 'subtotal_paise', 'added_at']


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_paise = serializers.ReadOnlyField()
    item_count = serializers.ReadOnlyField()

    class Meta:
        model = Cart
        fields = ['id', 'items', 'total_paise', 'item_count', 'updated_at']


class AddToCartSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=100)

    def validate_variant_id(self, value):
        from apps.products.models import ProductVariant
        try:
            self._variant = ProductVariant.objects.select_related('inventory').get(
                pk=value, is_active=True, product__is_active=True
            )
        except ProductVariant.DoesNotExist:
            raise serializers.ValidationError("Product variant not found or unavailable.")
        return value


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=0, max_value=100)
