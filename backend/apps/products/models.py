"""
Product models: Category, Product, ProductVariant, ProductImage, Inventory, InventoryMovement
"""
from django.db import models
from django.conf import settings


class Category(models.Model):
    name = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products_category'
        verbose_name_plural = 'categories'
        indexes = [models.Index(fields=['slug']), models.Index(fields=['is_active'])]
        ordering = ['name']

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='products')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_products'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products_product'
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['is_active']),
            models.Index(fields=['category']),
            models.Index(fields=['-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def primary_image(self):
        return self.images.filter(is_primary=True).first()

    @property
    def min_price(self):
        """Return lowest variant price in paise."""
        variant = self.variants.filter(is_active=True).order_by('price_paise').first()
        return variant.price_paise if variant else None


class ProductVariant(models.Model):
    """A specific variant of a product (e.g., Red/XL, Black/M)."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    sku = models.CharField(max_length=100, unique=True)
    price_paise = models.PositiveIntegerField(help_text='Price in Indian paise (₹1 = 100 paise)')
    original_price_paise = models.PositiveIntegerField(null=True, blank=True, help_text='MRP in paise')
    attributes = models.JSONField(default=dict, blank=True, help_text='e.g. {"color": "Black", "size": "M"}')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products_variant'
        indexes = [
            models.Index(fields=['sku']),
            models.Index(fields=['product']),
        ]

    def __str__(self):
        return f"{self.product.name} — {self.sku}"

    @property
    def stock_quantity(self):
        inventory = getattr(self, '_inventory', None)
        if inventory is None:
            try:
                inventory = self.inventory
            except Inventory.DoesNotExist:
                return 0
        return inventory.quantity

    @property
    def price_inr(self):
        return self.price_paise / 100

    @property
    def discount_percent(self):
        if self.original_price_paise and self.original_price_paise > self.price_paise:
            return int((1 - self.price_paise / self.original_price_paise) * 100)
        return 0


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/')
    alt_text = models.CharField(max_length=200, blank=True)
    is_primary = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'products_image'
        ordering = ['sort_order', 'created_at']
        indexes = [models.Index(fields=['product', 'is_primary'])]

    def __str__(self):
        return f"Image for {self.product.name}"


class Inventory(models.Model):
    variant = models.OneToOneField(ProductVariant, on_delete=models.CASCADE, related_name='inventory')
    quantity = models.IntegerField(default=0)
    reserved_quantity = models.IntegerField(default=0, help_text='Reserved for pending orders')
    low_stock_threshold = models.IntegerField(default=10)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products_inventory'
        verbose_name_plural = 'inventories'

    def __str__(self):
        return f"Inventory: {self.variant.sku} — {self.quantity} units"

    @property
    def available_quantity(self):
        return max(0, self.quantity - self.reserved_quantity)

    @property
    def is_low_stock(self):
        return self.available_quantity <= self.low_stock_threshold

    @property
    def is_in_stock(self):
        return self.available_quantity > 0


class InventoryMovement(models.Model):
    MOVEMENT_TYPES = [
        ('RESTOCK', 'Restock'),
        ('SALE', 'Sale'),
        ('RESERVE', 'Reserve'),
        ('RELEASE', 'Release'),
        ('ADJUSTMENT', 'Adjustment'),
        ('RETURN', 'Return'),
        ('DAMAGE', 'Damage'),
    ]

    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity_change = models.IntegerField(help_text='Positive=add, Negative=remove')
    quantity_before = models.IntegerField()
    quantity_after = models.IntegerField()
    reference = models.CharField(max_length=200, blank=True, help_text='Order number or batch ref')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'products_inventory_movement'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['inventory', '-created_at']),
        ]

    def __str__(self):
        return f"{self.movement_type}: {self.quantity_change:+d} for {self.inventory.variant.sku}"
