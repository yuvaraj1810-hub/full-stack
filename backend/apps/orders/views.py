"""
Order views — COD/UPI checkout, customer order history, admin order management.
"""
import uuid
from django.db import transaction
from django.db.models import Q
from rest_framework import status, filters
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cart.models import Cart, CartItem
from apps.products.models import Inventory, InventoryMovement
from apps.users.models import Address

from .models import Order, OrderItem, OrderStatusHistory
from .serializers import (
    OrderSerializer, OrderListSerializer,
    CODCheckoutSerializer, UPICheckoutSerializer,
    AdminOrderStatusUpdateSerializer,
)


class IsAdminOrStaff(IsAdminUser):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    (request.user.is_staff or request.user.is_superuser))


def _address_snapshot(address: Address) -> dict:
    return {
        'id': address.id,
        'full_name': address.full_name,
        'phone': address.phone,
        'address_line1': address.address_line1,
        'address_line2': address.address_line2,
        'city': address.city,
        'state': address.state,
        'pincode': address.pincode,
        'country': address.country,
    }


def _calculate_pricing(cart_items):
    """
    Server-side price calculation. Returns dict with paise values.
    Shipping: free above ₹499, else ₹49.
    Tax: 18% GST on subtotal (illustrative flat rate).
    """
    subtotal = sum(item.variant.price_paise * item.quantity for item in cart_items)
    shipping = 0 if subtotal >= 49900 else 4900
    tax = int(subtotal * 0.18)
    total = subtotal + shipping + tax
    return {
        'subtotal_paise': subtotal,
        'shipping_paise': shipping,
        'tax_paise': tax,
        'discount_paise': 0,
        'total_paise': total,
    }


@transaction.atomic
def _create_order(request, address, payment_method, idempotency_key=None):
    """
    Core order creation logic used by both COD and UPI.
    Returns (order, error_response).
    """
    # Idempotency: return existing order if key matches
    if idempotency_key:
        try:
            existing = Order.objects.get(idempotency_key=idempotency_key)
            return existing, None
        except Order.DoesNotExist:
            pass

    # Get cart
    try:
        cart = Cart.objects.prefetch_related(
            'items__variant__inventory',
            'items__variant__product',
        ).get(user=request.user)
    except Cart.DoesNotExist:
        return None, Response({'success': False, 'message': 'Cart is empty'}, status=400)

    cart_items = list(cart.items.select_related('variant__inventory', 'variant__product').all())
    if not cart_items:
        return None, Response({'success': False, 'message': 'Cart is empty'}, status=400)

    # Validate stock and lock inventory rows
    inventory_ids = [item.variant.id for item in cart_items]
    inventories = {
        inv.variant_id: inv
        for inv in Inventory.objects.select_for_update().filter(variant_id__in=inventory_ids)
    }

    for item in cart_items:
        inv = inventories.get(item.variant_id)
        if not inv:
            return None, Response({
                'success': False,
                'message': f'Inventory not found for {item.variant.sku}'
            }, status=400)
        if inv.available_quantity < item.quantity:
            return None, Response({
                'success': False,
                'message': f'Insufficient stock for {item.variant.product.name} ({item.variant.sku}). '
                           f'Available: {inv.available_quantity}, Requested: {item.quantity}'
            }, status=400)

    # Calculate pricing server-side
    pricing = _calculate_pricing(cart_items)

    # Create order
    order_number = Order.generate_order_number()
    order = Order.objects.create(
        order_number=order_number,
        idempotency_key=idempotency_key or uuid.uuid4(),
        customer=request.user,
        shipping_address_id=address.id,
        shipping_address_snapshot=_address_snapshot(address),
        payment_method=payment_method,
        payment_status=Order.PAYMENT_STATUS_PENDING,
        status=Order.STATUS_PLACED,
        **pricing,
    )

    # Create order items and reserve inventory
    for item in cart_items:
        inv = inventories[item.variant_id]
        OrderItem.objects.create(
            order=order,
            variant=item.variant,
            product_name=item.variant.product.name,
            sku=item.variant.sku,
            variant_attributes=item.variant.attributes,
            unit_price_paise=item.variant.price_paise,
            quantity=item.quantity,
            total_paise=item.variant.price_paise * item.quantity,
        )
        # Reserve inventory
        old_reserved = inv.reserved_quantity
        inv.reserved_quantity += item.quantity
        inv.save()
        InventoryMovement.objects.create(
            inventory=inv,
            movement_type='RESERVE',
            quantity_change=-item.quantity,
            quantity_before=inv.quantity,
            quantity_after=inv.quantity,
            reference=order_number,
            created_by=request.user,
        )

    # Record initial status history
    OrderStatusHistory.objects.create(
        order=order,
        from_status='',
        to_status=Order.STATUS_PLACED,
        payment_status=Order.PAYMENT_STATUS_PENDING,
        notes=f'Order placed via {payment_method}',
        changed_by=request.user,
    )

    # Clear the cart
    cart.items.all().delete()

    return order, None


# ─── COD CHECKOUT ─────────────────────────────────────────────────────────────

class CODCheckoutView(APIView):
    """POST /api/v1/checkout/cod/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CODCheckoutSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        address = serializer._address
        idempotency_key = serializer.validated_data.get('idempotency_key')

        order, error = _create_order(request, address, Order.PAYMENT_METHOD_COD, idempotency_key)
        if error:
            return error

        return Response({
            'success': True,
            'order_number': order.order_number,
            'payment_method': order.payment_method,
            'payment_status': order.payment_status,
            'order_status': order.status,
            'total_paise': order.total_paise,
            'order_id': order.id,
        }, status=status.HTTP_201_CREATED)


# ─── UPI CHECKOUT ─────────────────────────────────────────────────────────────

class UPICheckoutView(APIView):
    """POST /api/v1/checkout/upi/ — creates pending order and returns payment reference"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UPICheckoutSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        address = serializer._address
        idempotency_key = serializer.validated_data.get('idempotency_key')

        order, error = _create_order(request, address, Order.PAYMENT_METHOD_UPI, idempotency_key)
        if error:
            return error

        # Create a payment record
        from apps.payments.models import Payment
        payment = Payment.objects.create(
            order=order,
            payment_method=Order.PAYMENT_METHOD_UPI,
            amount_paise=order.total_paise,
            status=Payment.STATUS_PENDING,
        )

        return Response({
            'success': True,
            'order_number': order.order_number,
            'order_id': order.id,
            'payment_id': payment.id,
            'payment_method': order.payment_method,
            'payment_status': order.payment_status,
            'total_paise': order.total_paise,
            'message': 'Order created. Complete UPI payment to confirm.',
        }, status=status.HTTP_201_CREATED)


# ─── CUSTOMER ORDER HISTORY ───────────────────────────────────────────────────

class CustomerOrderListView(APIView):
    """GET /api/v1/orders/ — customer's own orders only"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Order.objects
            .filter(customer=request.user)
            .prefetch_related('items')
            .order_by('-created_at')
        )
        paginator = PageNumberPagination()
        paginator.page_size = 10
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(OrderListSerializer(page, many=True).data)


class CustomerOrderDetailView(APIView):
    """GET /api/v1/orders/{id}/ — customer's own order detail"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            # Enforce ownership at queryset level
            order = (
                Order.objects
                .filter(pk=pk, customer=request.user)
                .prefetch_related('items', 'status_history')
                .get()
            )
        except Order.DoesNotExist:
            return Response({'success': False, 'message': 'Order not found'}, status=404)
        return Response({'success': True, 'data': OrderSerializer(order).data})


# ─── ADMIN ORDER MANAGEMENT ───────────────────────────────────────────────────

class AdminOrderListView(APIView):
    """GET /api/v1/admin/orders/"""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        qs = (
            Order.objects
            .select_related('customer')
            .prefetch_related('items')
            .order_by('-created_at')
        )
        # Filters
        order_status = request.query_params.get('status')
        payment_status = request.query_params.get('payment_status')
        payment_method = request.query_params.get('payment_method')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        search = request.query_params.get('search')

        if order_status:
            qs = qs.filter(status=order_status)
        if payment_status:
            qs = qs.filter(payment_status=payment_status)
        if payment_method:
            qs = qs.filter(payment_method=payment_method)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        if search:
            qs = qs.filter(
                Q(order_number__icontains=search) |
                Q(customer__email__icontains=search) |
                Q(customer__first_name__icontains=search) |
                Q(customer__last_name__icontains=search)
            )

        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(OrderListSerializer(page, many=True).data)


class AdminOrderDetailView(APIView):
    """GET /api/v1/admin/orders/{id}/"""
    permission_classes = [IsAdminOrStaff]

    def get(self, request, pk):
        try:
            order = (
                Order.objects
                .select_related('customer')
                .prefetch_related('items', 'status_history__changed_by')
                .get(pk=pk)
            )
        except Order.DoesNotExist:
            return Response({'success': False, 'message': 'Order not found'}, status=404)
        return Response({'success': True, 'data': OrderSerializer(order).data})


class AdminOrderStatusUpdateView(APIView):
    """PATCH /api/v1/admin/orders/{id}/status/"""
    permission_classes = [IsAdminOrStaff]

    @transaction.atomic
    def patch(self, request, pk):
        try:
            order = Order.objects.select_for_update().get(pk=pk)
        except Order.DoesNotExist:
            return Response({'success': False, 'message': 'Order not found'}, status=404)

        serializer = AdminOrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        old_status = order.status
        new_status = data.get('status')
        new_payment_status = data.get('payment_status')
        notes = data.get('notes', '')

        if new_status and new_status != old_status:
            if not order.can_transition_to(new_status):
                return Response({
                    'success': False,
                    'message': f'Invalid transition: {old_status} → {new_status}. '
                               f'Allowed: {Order.VALID_TRANSITIONS.get(old_status, [])}'
                }, status=400)
            order.status = new_status

            # When delivered, commit reserved inventory
            if new_status == Order.STATUS_DELIVERED:
                for item in order.items.select_related('variant__inventory').all():
                    try:
                        inv = Inventory.objects.select_for_update().get(variant=item.variant)
                        inv.quantity -= item.quantity
                        inv.reserved_quantity -= item.quantity
                        inv.save()
                        InventoryMovement.objects.create(
                            inventory=inv,
                            movement_type='SALE',
                            quantity_change=-item.quantity,
                            quantity_before=inv.quantity + item.quantity,
                            quantity_after=inv.quantity,
                            reference=order.order_number,
                            created_by=request.user,
                        )
                    except Inventory.DoesNotExist:
                        pass

            # When cancelled, release reserved inventory
            if new_status == Order.STATUS_CANCELLED:
                for item in order.items.select_related('variant__inventory').all():
                    try:
                        inv = Inventory.objects.select_for_update().get(variant=item.variant)
                        inv.reserved_quantity = max(0, inv.reserved_quantity - item.quantity)
                        inv.save()
                        InventoryMovement.objects.create(
                            inventory=inv,
                            movement_type='RELEASE',
                            quantity_change=item.quantity,
                            quantity_before=inv.quantity,
                            quantity_after=inv.quantity,
                            reference=order.order_number,
                            created_by=request.user,
                        )
                    except Inventory.DoesNotExist:
                        pass

        if new_payment_status:
            # COD: only staff can mark as COLLECTED
            if order.payment_method == Order.PAYMENT_METHOD_COD and new_payment_status == Order.PAYMENT_STATUS_COLLECTED:
                order.payment_status = Order.PAYMENT_STATUS_COLLECTED
            elif new_payment_status in [s[0] for s in Order.PAYMENT_STATUS_CHOICES]:
                order.payment_status = new_payment_status

        tracking = data.get('tracking_number')
        if tracking:
            order.tracking_number = tracking

        order.save()

        OrderStatusHistory.objects.create(
            order=order,
            from_status=old_status,
            to_status=order.status,
            payment_status=order.payment_status,
            notes=notes,
            changed_by=request.user,
        )

        return Response({
            'success': True,
            'message': 'Order updated',
            'data': {
                'order_number': order.order_number,
                'status': order.status,
                'payment_status': order.payment_status,
            }
        })


class AdminOrderHistoryView(APIView):
    """GET /api/v1/admin/orders/history/ — full paginated order history"""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        qs = (
            Order.objects
            .select_related('customer')
            .prefetch_related('items', 'status_history')
            .order_by('-created_at')
        )
        # Same filters as list
        for param, field in [
            ('status', 'status'),
            ('payment_status', 'payment_status'),
            ('payment_method', 'payment_method'),
        ]:
            value = request.query_params.get(param)
            if value:
                qs = qs.filter(**{field: value})

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(order_number__icontains=search) |
                Q(customer__email__icontains=search) |
                Q(customer__first_name__icontains=search) |
                Q(customer__last_name__icontains=search)
            )

        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(OrderSerializer(page, many=True).data)
