"""
Product views — public endpoints and admin endpoints.
"""
from django.db import transaction
from django.utils.text import slugify
from django.utils.crypto import get_random_string
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, status, filters
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, Product, ProductVariant, ProductImage, Inventory, InventoryMovement
from .serializers import (
    CategorySerializer, PublicProductSerializer, ProductSerializer,
    AdminProductCreateSerializer, AdminProductUpdateSerializer,
    InventoryAdjustSerializer, InventoryMovementSerializer,
)


# ─── PERMISSIONS ──────────────────────────────────────────────────────────────

class IsAdminOrStaff(IsAdminUser):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    (request.user.is_staff or request.user.is_superuser))


# ─── PUBLIC ENDPOINTS ─────────────────────────────────────────────────────────

class PublicProductListView(generics.ListAPIView):
    """GET /api/v1/products/ — public storefront catalog"""
    serializer_class = PublicProductSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category']
    search_fields = ['name', 'description', 'variants__sku']
    ordering_fields = ['created_at', 'name']
    ordering = ['-created_at']

    def get_queryset(self):
        return (
            Product.objects
            .filter(is_active=True, variants__is_active=True)
            .select_related('category')
            .prefetch_related('variants__inventory', 'images')
            .distinct()
        )


class PublicProductDetailView(generics.RetrieveAPIView):
    """GET /api/v1/products/{slug}/"""
    serializer_class = PublicProductSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        return (
            Product.objects
            .filter(is_active=True)
            .select_related('category')
            .prefetch_related('variants__inventory', 'images')
        )


class CategoryListView(generics.ListAPIView):
    """GET /api/v1/categories/"""
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    queryset = Category.objects.filter(is_active=True)


class AdminCategoryListCreateView(APIView):
    """GET / POST /api/v1/admin/categories/"""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        cats = Category.objects.all().order_by('name')
        return Response({'results': CategorySerializer(cats, many=True).data})

    def post(self, request):
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'detail': 'Category name is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if Category.objects.filter(name__iexact=name).exists():
            return Response({'detail': f"Category '{name}' already exists."}, status=status.HTTP_400_BAD_REQUEST)

        base_slug = slugify(name) or 'category'
        slug = base_slug
        if Category.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{get_random_string(4).lower()}"

        cat = Category.objects.create(
            name=name,
            slug=slug,
            description=(request.data.get('description') or '').strip(),
            is_active=request.data.get('is_active', True),
        )
        return Response(CategorySerializer(cat).data, status=status.HTTP_201_CREATED)


class AdminCategoryDetailView(APIView):
    """PATCH / DELETE /api/v1/admin/categories/<int:pk>/"""
    permission_classes = [IsAdminOrStaff]

    def patch(self, request, pk):
        try:
            cat = Category.objects.get(pk=pk)
        except Category.DoesNotExist:
            return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

        if 'name' in request.data and request.data['name'].strip():
            cat.name = request.data['name'].strip()
        if 'description' in request.data:
            cat.description = request.data['description'].strip()
        if 'is_active' in request.data:
            cat.is_active = bool(request.data['is_active'])
        cat.save()
        return Response(CategorySerializer(cat).data)

    def delete(self, request, pk):
        try:
            cat = Category.objects.get(pk=pk)
        except Category.DoesNotExist:
            return Response({'detail': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

        if cat.products.exists():
            cat.is_active = False
            cat.save(update_fields=['is_active', 'updated_at'])
            return Response({'message': f"Category '{cat.name}' deactivated (has linked products)."})
        cat.delete()
        return Response({'message': f"Category '{cat.name}' deleted."})


# ─── ADMIN PRODUCT ENDPOINTS ──────────────────────────────────────────────────

class AdminProductListCreateView(APIView):
    """
    GET  /api/v1/admin/products/
    POST /api/v1/admin/products/
    """
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        qs = (
            Product.objects
            .select_related('category', 'created_by')
            .prefetch_related('variants__inventory', 'images')
            .order_by('-created_at')
        )
        # Optional filters
        is_active = request.query_params.get('is_active')
        category = request.query_params.get('category')
        search = request.query_params.get('search')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        if category:
            qs = qs.filter(category_id=category)
        if search:
            qs = qs.filter(name__icontains=search)

        # Pagination
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request)
        serializer = ProductSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)

    @transaction.atomic
    def post(self, request):
        serializer = AdminProductCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Build unique slug
        base_slug = slugify(data['name'])
        slug = base_slug
        counter = 1
        while Product.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{get_random_string(4)}"
            counter += 1

        # Create product
        product = Product.objects.create(
            name=data['name'],
            slug=slug,
            description=data.get('description', ''),
            category=serializer._category,
            is_active=data.get('is_active', True),
            created_by=request.user,
        )

        # Create variants and inventory
        for v_data in data['variants']:
            stock_quantity = v_data.pop('stock_quantity')
            variant = ProductVariant.objects.create(product=product, **v_data)
            inventory = Inventory.objects.create(variant=variant, quantity=stock_quantity)
            # Record initial stock movement
            InventoryMovement.objects.create(
                inventory=inventory,
                movement_type='RESTOCK',
                quantity_change=stock_quantity,
                quantity_before=0,
                quantity_after=stock_quantity,
                reference=f"Initial stock — product {product.id}",
                created_by=request.user,
            )

        # Reload with relations
        product.refresh_from_db()
        product_data = ProductSerializer(product, context={'request': request}).data

        return Response({
            'success': True,
            'message': 'Product created successfully',
            'data': {
                'id': product.id,
                'name': product.name,
                'slug': product.slug,
                'is_active': product.is_active,
                'product': product_data,
            }
        }, status=status.HTTP_201_CREATED)


class AdminProductDetailView(APIView):
    """
    GET    /api/v1/admin/products/{id}/
    PATCH  /api/v1/admin/products/{id}/
    DELETE /api/v1/admin/products/{id}/
    """
    permission_classes = [IsAdminOrStaff]

    def _get_product(self, pk):
        try:
            return (
                Product.objects
                .select_related('category', 'created_by')
                .prefetch_related('variants__inventory', 'images')
                .get(pk=pk)
            )
        except Product.DoesNotExist:
            return None

    def get(self, request, pk):
        product = self._get_product(pk)
        if not product:
            return Response({'success': False, 'message': 'Product not found'}, status=404)
        return Response({'success': True, 'data': ProductSerializer(product, context={'request': request}).data})

    @transaction.atomic
    def patch(self, request, pk):
        product = self._get_product(pk)
        if not product:
            return Response({'success': False, 'message': 'Product not found'}, status=404)
        serializer = AdminProductUpdateSerializer(product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'success': True, 'message': 'Product updated', 'data': ProductSerializer(product, context={'request': request}).data})

    @transaction.atomic
    def delete(self, request, pk):
        product = self._get_product(pk)
        if not product:
            return Response({'success': False, 'message': 'Product not found'}, status=404)
        # Soft-delete if product has orders, hard-delete if not
        from apps.orders.models import OrderItem
        has_orders = OrderItem.objects.filter(variant__product=product).exists()
        if has_orders:
            product.is_active = False
            product.variants.update(is_active=False)
            product.save()
            return Response({'success': True, 'message': 'Product deactivated (has associated orders)'})
        else:
            product.delete()
            return Response({'success': True, 'message': 'Product deleted'})


class AdminProductImageUploadView(APIView):
    """POST /api/v1/admin/products/{id}/images/ — multipart image upload"""
    permission_classes = [IsAdminOrStaff]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            product = Product.objects.get(pk=pk)
        except Product.DoesNotExist:
            return Response({'success': False, 'message': 'Product not found'}, status=404)

        images = request.FILES.getlist('images')
        if not images:
            return Response({'success': False, 'message': 'No images provided'}, status=400)

        created_images = []
        is_first = not product.images.exists()
        for i, image_file in enumerate(images):
            img = ProductImage.objects.create(
                product=product,
                image=image_file,
                alt_text=request.data.get('alt_text', product.name),
                is_primary=(is_first and i == 0),
                sort_order=product.images.count() + i,
            )
            created_images.append({
                'id': img.id,
                'url': request.build_absolute_uri(img.image.url) if img.image else None,
                'is_primary': img.is_primary,
            })

        return Response({'success': True, 'message': f'{len(created_images)} image(s) uploaded', 'images': created_images}, status=201)


class AdminInventoryAdjustView(APIView):
    """PATCH /api/v1/admin/inventory/{variant_id}/adjust/"""
    permission_classes = [IsAdminOrStaff]

    @transaction.atomic
    def patch(self, request, variant_id):
        try:
            inventory = Inventory.objects.select_for_update().get(variant_id=variant_id)
        except Inventory.DoesNotExist:
            return Response({'success': False, 'message': 'Inventory not found'}, status=404)

        serializer = InventoryAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_qty = serializer.validated_data['quantity']
        notes = serializer.validated_data['notes']

        old_qty = inventory.quantity
        change = new_qty - old_qty

        inventory.quantity = new_qty
        inventory.save()

        InventoryMovement.objects.create(
            inventory=inventory,
            movement_type='ADJUSTMENT',
            quantity_change=change,
            quantity_before=old_qty,
            quantity_after=new_qty,
            notes=notes,
            created_by=request.user,
        )

        return Response({
            'success': True,
            'message': 'Inventory adjusted',
            'data': {
                'sku': inventory.variant.sku,
                'quantity': new_qty,
                'available_quantity': inventory.available_quantity,
            }
        })
