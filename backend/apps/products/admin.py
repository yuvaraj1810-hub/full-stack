
from decimal import Decimal

from django import forms
from django.contrib import admin
from django.db import transaction
from django.core.exceptions import ValidationError

from .models import (
    Category,
    Product,
    ProductVariant,
    ProductImage,
    Inventory,
    InventoryMovement,
)


# ==========================================
# CATEGORY ADMIN
# ==========================================

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        "name", "slug", "is_active", "created_at"
    )
    prepopulated_fields = {"slug": ("name",)}
    list_filter = ("is_active",)
    search_fields = ("name",)


# ==========================================
# PRODUCT VARIANT FORM
# Price entered in RUPEES
# Inventory quantity entered with each variant
# ==========================================

class ProductVariantForm(forms.ModelForm):
    price_inr = forms.DecimalField(
        label="Selling Price (₹)",
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
        help_text="Example: 1999.00",
    )

    original_price_inr = forms.DecimalField(
        label="Original Price / MRP (₹)",
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
    )

    stock_quantity = forms.IntegerField(
        label="Stock Quantity",
        min_value=0,
        initial=0,
    )

    class Meta:
        model = ProductVariant
        exclude = (
            "price_paise",
            "original_price_paise",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.instance and self.instance.pk:
            self.fields["price_inr"].initial = (
                Decimal(self.instance.price_paise) / 100
            )

            if self.instance.original_price_paise is not None:
                self.fields["original_price_inr"].initial = (
                    Decimal(self.instance.original_price_paise) / 100
                )

            inventory = Inventory.objects.filter(
                variant=self.instance
            ).first()

            if inventory:
                self.fields["stock_quantity"].initial = (
                    inventory.quantity
                )

    def clean(self):
        cleaned = super().clean()

        selling = cleaned.get("price_inr")
        original = cleaned.get("original_price_inr")
        stock = cleaned.get("stock_quantity")

        if (
            selling is not None
            and original is not None
            and original < selling
        ):
            self.add_error(
                "original_price_inr",
                "MRP cannot be less than selling price."
            )

        if self.instance and self.instance.pk and stock is not None:
            inventory = Inventory.objects.filter(
                variant=self.instance
            ).first()

            if inventory and stock < inventory.reserved_quantity:
                self.add_error(
                    "stock_quantity",
                    "Stock cannot be less than reserved quantity."
                )

        return cleaned

    def save(self, commit=True):
        obj = super().save(commit=False)

        selling = self.cleaned_data["price_inr"]
        original = self.cleaned_data.get("original_price_inr")

        obj.price_paise = int(selling * 100)

        obj.original_price_paise = (
            int(original * 100)
            if original is not None
            else None
        )

        if commit:
            obj.save()
            self.save_m2m()

        return obj


# ==========================================
# PRODUCT VARIANTS INLINE
# ==========================================

class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    form = ProductVariantForm
    extra = 1

    fields = (
        "sku",
        "price_inr",
        "original_price_inr",
        "stock_quantity",
        "attributes",
        "is_active",
    )


# ==========================================
# PRODUCT IMAGES INLINE
# ==========================================

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1

    fields = (
        "image",
        "alt_text",
        "is_primary",
        "sort_order",
    )


# ==========================================
# INVENTORY HELPER
# ==========================================

def save_variant_inventory(variant, stock, user):
    inventory, created = Inventory.objects.select_for_update().get_or_create(
        variant=variant,
        defaults={
            "quantity": 0,
            "reserved_quantity": 0,
        },
    )

    before = inventory.quantity

    if stock < inventory.reserved_quantity:
        raise ValidationError(
            "Stock cannot be less than reserved quantity."
        )

    if before != stock:
        inventory.quantity = stock
        inventory.save(update_fields=["quantity", "updated_at"])

        InventoryMovement.objects.create(
            inventory=inventory,
            movement_type=(
                "RESTOCK" if created else "ADJUSTMENT"
            ),
            quantity_change=stock - before,
            quantity_before=before,
            quantity_after=stock,
            reference="Django Admin",
            notes="Stock updated using product administration.",
            created_by=user,
        )


# ==========================================
# PRODUCT ADMIN
# ==========================================

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "display_price",
        "is_active",
        "created_at",
    )

    list_filter = ("is_active", "category")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}

    actions = ["fetch_missing_images"]

    @admin.action(description="Fetch and associate missing product images")
    def fetch_missing_images(self, request, queryset):
        from .image_service import get_providers, product_needs_image, save_candidate_to_product
        from django.contrib import messages

        providers = get_providers(provider_name='auto')
        updated = 0
        skipped = 0
        failed = 0

        for product in queryset:
            if not product_needs_image(product):
                skipped += 1
                continue

            candidate = None
            for provider in providers:
                candidate = provider.search_image(product)
                if candidate:
                    break

            if candidate:
                success, msg, _ = save_candidate_to_product(product, candidate, dry_run=False)
                if success:
                    updated += 1
                else:
                    failed += 1
            else:
                failed += 1

        self.message_user(
            request,
            f"Image fetch complete: {updated} product(s) updated with new images, {skipped} already had images, {failed} need manual review.",
            messages.SUCCESS if updated > 0 else messages.WARNING,
        )

    inlines = [
        ProductVariantInline,
        ProductImageInline,
    ]

    readonly_fields = ("created_at", "updated_at")

    @admin.display(description="Starting Price")
    def display_price(self, obj):
        price = obj.min_price

        if price is None:
            return "Not set"

        return f"₹{Decimal(price) / 100:,.2f}"

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user

        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)

        # Django Admin saves the Product and its inlines
        # inside an atomic transaction.
        # Now synchronize inventory from variant forms.

        for formset in formsets:
            if formset.model is not ProductVariant:
                continue

            for variant_form in formset.forms:
                if not variant_form.cleaned_data:
                    continue

                if variant_form.cleaned_data.get("DELETE"):
                    continue

                variant = variant_form.instance

                if not variant.pk:
                    continue

                stock = variant_form.cleaned_data.get(
                    "stock_quantity"
                )

                if stock is not None:
                    save_variant_inventory(
                        variant,
                        stock,
                        request.user,
                    )


# ==========================================
# PRODUCT VARIANT ADMIN
# ==========================================

@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    form = ProductVariantForm

    list_display = (
        "sku",
        "product",
        "display_price",
        "stock_quantity",
        "is_active",
    )

    list_filter = ("is_active",)
    search_fields = ("sku", "product__name")

    exclude = (
        "price_paise",
        "original_price_paise",
    )

    @admin.display(description="Selling Price")
    def display_price(self, obj):
        return f"₹{Decimal(obj.price_paise) / 100:,.2f}"

    def save_model(self, request, obj, form, change):
        with transaction.atomic():
            super().save_model(request, obj, form, change)

            save_variant_inventory(
                obj,
                form.cleaned_data["stock_quantity"],
                request.user,
            )


# ==========================================
# PRODUCT IMAGE ADMIN
# ==========================================

@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "alt_text",
        "is_primary",
        "sort_order",
    )

    list_filter = ("is_primary",)
    search_fields = ("product__name", "alt_text")


# ==========================================
# INVENTORY ADMIN
# ==========================================

@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = (
        "variant",
        "quantity",
        "reserved_quantity",
        "available_stock",
        "low_stock_threshold",
    )

    search_fields = ("variant__sku",)

    readonly_fields = ("reserved_quantity",)

    @admin.display(description="Available Stock")
    def available_stock(self, obj):
        return obj.available_quantity


# ==========================================
# INVENTORY MOVEMENT HISTORY
# ==========================================

@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = (
        "inventory",
        "movement_type",
        "quantity_change",
        "quantity_before",
        "quantity_after",
        "created_at",
    )

    list_filter = ("movement_type",)

    readonly_fields = (
        "inventory",
        "movement_type",
        "quantity_change",
        "quantity_before",
        "quantity_after",
        "reference",
        "notes",
        "created_by",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
