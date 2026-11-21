"""
Admin Panel — dashboard metrics, customer management.
"""
from django.db.models import Count, Sum, Q
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from apps.orders.models import Order
from apps.products.models import Product, Inventory
from apps.users.models import User


class IsAdminOrStaff(IsAdminUser):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    (request.user.is_staff or request.user.is_superuser))


class AdminDashboardView(APIView):
    """GET /api/v1/admin/dashboard/ — real metrics from PostgreSQL"""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        # Product metrics
        total_products = Product.objects.count()
        active_products = Product.objects.filter(is_active=True).count()

        # Order metrics
        order_qs = Order.objects.all()
        total_orders = order_qs.count()
        pending_orders = order_qs.filter(status=Order.STATUS_PLACED).count()
        confirmed_orders = order_qs.filter(status=Order.STATUS_CONFIRMED).count()
        delivered_orders = order_qs.filter(status=Order.STATUS_DELIVERED).count()
        cancelled_orders = order_qs.filter(status=Order.STATUS_CANCELLED).count()

        # Payment metrics
        cod_orders = order_qs.filter(payment_method=Order.PAYMENT_METHOD_COD).count()
        upi_orders = order_qs.filter(payment_method=Order.PAYMENT_METHOD_UPI).count()

        # Revenue (from paid/collected orders)
        collected_revenue = order_qs.filter(
            payment_status__in=[Order.PAYMENT_STATUS_PAID, Order.PAYMENT_STATUS_COLLECTED]
        ).aggregate(total=Sum('total_paise'))['total'] or 0

        pending_revenue = order_qs.filter(
            payment_status=Order.PAYMENT_STATUS_PENDING
        ).aggregate(total=Sum('total_paise'))['total'] or 0

        # Low stock
        low_stock_count = Inventory.objects.filter(
            quantity__lte=10
        ).count()

        # Recent orders (last 10)
        recent_orders = Order.objects.select_related('customer').order_by('-created_at')[:10]
        recent_orders_data = [{
            'id': o.id,
            'order_number': o.order_number,
            'customer_name': o.customer.full_name,
            'customer_email': o.customer.email,
            'total_paise': o.total_paise,
            'payment_method': o.payment_method,
            'payment_status': o.payment_status,
            'status': o.status,
            'created_at': o.created_at,
        } for o in recent_orders]

        return Response({
            'success': True,
            'data': {
                'products': {
                    'total': total_products,
                    'active': active_products,
                    'low_stock': low_stock_count,
                },
                'orders': {
                    'total': total_orders,
                    'pending': pending_orders,
                    'confirmed': confirmed_orders,
                    'delivered': delivered_orders,
                    'cancelled': cancelled_orders,
                    'cod': cod_orders,
                    'upi': upi_orders,
                },
                'revenue': {
                    'collected_paise': collected_revenue,
                    'pending_paise': pending_revenue,
                },
                'recent_orders': recent_orders_data,
            }
        })


class AdminCustomerListView(APIView):
    """GET /api/v1/admin/customers/"""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        qs = User.objects.filter(is_staff=False, is_superuser=False).order_by('-date_joined')
        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(phone__icontains=search)
            )

        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request)

        data = [{
            'id': u.id,
            'email': u.email,
            'full_name': u.full_name,
            'phone': u.phone,
            'is_active': u.is_active,
            'date_joined': u.date_joined,
            'order_count': Order.objects.filter(customer=u).count(),
        } for u in page]

        return paginator.get_paginated_response(data)
