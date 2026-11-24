from urllib.parse import urlparse
from rest_framework import serializers
from .models import Category, Product, ProductVariant, ProductImage, Inventory, InventoryMovement


class RelativeImageField(serializers.ImageField):
    """ImageField that ensures image URLs are returned as clean root-relative paths
    (e.g., /media/...) instead of internal Docker URLs (http://backend:8000/media/...)."""
    def to_representation(self, value):
        if not value:
            return None
        try:
            url = value.url
            if url.startswith('http://') or url.startswith('https://'):
                return urlparse(url).path
            return url
        except AttributeError:
            return None


class CategorySerializer(serializers.ModelSerializer):
    image = RelativeImageField(required=False, allow_null=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'image', 'parent', 'is_active']


class ProductImageSerializer(serializers.ModelSerializer):
    image = RelativeImageField()

    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'alt_text', 'is_primary', 'sort_order']


class InventorySerializer(serializers.ModelSerializer):
    available_quantity = serializers.ReadOnlyField()
    is_low_stock = serializers.ReadOnlyField()
    is_in_stock = serializers.ReadOnlyField()

    class Meta:
        model = Inventory
        fields = ['quantity', 'reserved_quantity', 'available_quantity',
                  'low_stock_threshold', 'is_low_stock', 'is_in_stock']


class ProductVariantSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_id = serializers.IntegerField(source='product.id', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    product_image = serializers.SerializerMethodField()
    inventory = InventorySerializer(read_only=True)
    price_inr = serializers.ReadOnlyField()
    discount_percent = serializers.ReadOnlyField()
    stock_quantity = serializers.ReadOnlyField()

    class Meta:
        model = ProductVariant
        fields = ['id', 'sku', 'price_paise', 'original_price_paise', 'price_inr',
                  'discount_percent', 'attributes', 'is_active', 'inventory', 'stock_quantity',
                  'product_name', 'product_id', 'product_slug', 'product_image']

    def get_product_image(self, obj):
        try:
            img = obj.product.images.filter(is_primary=True).first() or obj.product.images.first()
            if img and img.image:
                url = img.image.url
                if url.startswith('http://') or url.startswith('https://'):
                    return urlparse(url).path
                return url
            return None
        except Exception:
            return None


class ProductVariantCreateSerializer(serializers.ModelSerializer):
    stock_quantity = serializers.IntegerField(min_value=0, write_only=True)

    class Meta:
        model = ProductVariant
        fields = ['sku', 'price_paise', 'original_price_paise', 'attributes', 'is_active', 'stock_quantity']

    def validate_sku(self, value):
        if ProductVariant.objects.filter(sku=value).exists():
            raise serializers.ValidationError(f"SKU '{value}' already exists.")
        return value

    def validate_price_paise(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than 0.")
        return value


class ProductSerializer(serializers.ModelSerializer):
    """Full product serializer for admin and detail views."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    min_price = serializers.ReadOnlyField()
    primary_image = ProductImageSerializer(read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'slug', 'description', 'category', 'category_name',
                  'is_active', 'variants', 'images', 'min_price', 'primary_image',
                  'created_by_email', 'created_at', 'updated_at']
        read_only_fields = ['id', 'slug', 'min_price', 'created_at', 'updated_at']


class PublicProductSerializer(serializers.ModelSerializer):
    """Minimal product serializer for public storefront."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    min_price = serializers.ReadOnlyField()
    primary_image = ProductImageSerializer(read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'slug', 'description', 'category', 'category_name',
                  'variants', 'images', 'min_price', 'primary_image', 'is_active']


class AdminProductCreateSerializer(serializers.Serializer):
    """Serializer for POST /api/v1/admin/products/"""
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True, default='')
    category_id = serializers.IntegerField()
    is_active = serializers.BooleanField(default=True)
    variants = ProductVariantCreateSerializer(many=True, min_length=1)

    def validate_category_id(self, value):
        from .models import Category
        try:
            self._category = Category.objects.get(pk=value, is_active=True)
        except Category.DoesNotExist:
            raise serializers.ValidationError(f"Category with id {value} does not exist or is inactive.")
        return value

    def validate(self, data):
        # Ensure no duplicate SKUs within the payload
        skus = [v['sku'] for v in data.get('variants', [])]
        if len(skus) != len(set(skus)):
            raise serializers.ValidationError({'variants': 'Duplicate SKUs in request.'})
        return data


class AdminProductUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['name', 'description', 'category', 'is_active']


class InventoryMovementSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(source='inventory.variant.sku', read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)

    class Meta:
        model = InventoryMovement
        fields = ['id', 'sku', 'movement_type', 'quantity_change',
                  'quantity_before', 'quantity_after', 'reference',
                  'notes', 'created_by_email', 'created_at']


class InventoryAdjustSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=0)
    notes = serializers.CharField(max_length=500, allow_blank=True, default='')
