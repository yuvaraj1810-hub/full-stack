"""
Payment views — dev UPI simulator, payment status, COD collection, admin payment list.
"""
from django.conf import settings
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order, OrderStatusHistory
from apps.products.models import Inventory, InventoryMovement
from .models import Payment, PaymentEvent


class IsAdminOrStaff(IsAdminUser):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    (request.user.is_staff or request.user.is_superuser))


class PaymentStatusView(APIView):
    """GET /api/v1/payments/{id}/status/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        try:
            payment = Payment.objects.select_related('order').get(pk=payment_id)
        except Payment.DoesNotExist:
            return Response({'success': False, 'message': 'Payment not found'}, status=404)

        # Customers may only view their own payment
        if not (request.user.is_staff or request.user.is_superuser):
            if payment.order.customer_id != request.user.id:
                return Response({'success': False, 'message': 'Not found'}, status=404)

        return Response({
            'success': True,
            'data': {
                'payment_id': str(payment.id),
                'order_number': payment.order.order_number,
                'payment_method': payment.payment_method,
                'status': payment.status,
                'amount_paise': payment.amount_paise,
                'provider_reference': payment.provider_reference,
                'dev_simulation': payment.dev_simulation,
                'created_at': payment.created_at,
                'updated_at': payment.updated_at,
            }
        })


class DevUPISimulateView(APIView):
    """
    POST /api/v1/payments/dev-upi/simulate/
    Development-only simulated UPI payment outcome.
    DISABLED in production.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(settings, 'UPI_DEV_SIMULATOR_ENABLED', False):
            return Response({
                'success': False,
                'message': 'UPI simulator is disabled in production.'
            }, status=403)

        payment_id = request.data.get('payment_id')
        outcome = request.data.get('outcome')  # 'success' | 'failure' | 'cancelled'

        if outcome not in ('success', 'failure', 'cancelled'):
            return Response({
                'success': False,
                'message': "outcome must be one of: success, failure, cancelled"
            }, status=400)

        try:
            payment = Payment.objects.select_related('order').get(pk=payment_id)
        except Payment.DoesNotExist:
            return Response({'success': False, 'message': 'Payment not found'}, status=404)

        # Customers may only simulate their own payment
        if payment.order.customer_id != request.user.id:
            return Response({'success': False, 'message': 'Not found'}, status=404)

        if payment.status != Payment.STATUS_PENDING:
            return Response({
                'success': False,
                'message': f'Payment already in terminal state: {payment.status}'
            }, status=400)

        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=payment.order_id)
            old_order_status = order.status

            if outcome == 'success':
                payment.status = Payment.STATUS_PAID
                payment.dev_simulation = True
                payment.provider_reference = f'DEV-SIM-{payment.id}'
                order.payment_status = Order.PAYMENT_STATUS_PAID
                order.status = Order.STATUS_CONFIRMED
                event_type = PaymentEvent.EVENT_TYPES[2][0]  # SUCCESS

            elif outcome == 'failure':
                payment.status = Payment.STATUS_FAILED
                payment.dev_simulation = True
                order.payment_status = Order.PAYMENT_STATUS_FAILED
                # Release reserved inventory on failure
                for item in order.items.select_related('variant').all():
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
                        )
                    except Inventory.DoesNotExist:
                        pass
                event_type = PaymentEvent.EVENT_TYPES[3][0]  # FAILURE

            else:  # cancelled
                payment.status = Payment.STATUS_CANCELLED
                payment.dev_simulation = True
                order.payment_status = Order.PAYMENT_STATUS_CANCELLED
                # Release inventory
                for item in order.items.select_related('variant').all():
                    try:
                        inv = Inventory.objects.select_for_update().get(variant=item.variant)
                        inv.reserved_quantity = max(0, inv.reserved_quantity - item.quantity)
                        inv.save()
                    except Inventory.DoesNotExist:
                        pass
                event_type = PaymentEvent.EVENT_TYPES[4][0]  # CANCELLED

            payment.save()
            order.save()

            PaymentEvent.objects.create(
                payment=payment,
                event_type='DEV_SIMULATED',
                payload={'outcome': outcome, 'simulated_by': request.user.email},
                notes=f'Dev simulation: {outcome}',
                created_by=request.user,
            )
            OrderStatusHistory.objects.create(
                order=order,
                from_status=old_order_status,
                to_status=order.status,
                payment_status=order.payment_status,
                notes=f'Dev UPI simulation: {outcome}',
                changed_by=request.user,
            )

        return Response({
            'success': True,
            'message': f'UPI payment simulation: {outcome}',
            'data': {
                'payment_id': str(payment.id),
                'payment_status': payment.status,
                'order_status': order.status,
                'order_payment_status': order.payment_status,
                'dev_simulation': True,
            }
        })


class AdminCODCollectView(APIView):
    """
    POST /api/v1/admin/payments/{payment_id}/collect/
    Staff-only action to record verified COD cash collection.
    """
    permission_classes = [IsAdminOrStaff]

    @transaction.atomic
    def post(self, request, payment_id):
        try:
            payment = Payment.objects.select_related('order').get(pk=payment_id)
        except Payment.DoesNotExist:
            return Response({'success': False, 'message': 'Payment not found'}, status=404)

        if payment.payment_method != Payment.METHOD_COD:
            return Response({'success': False, 'message': 'Only COD payments can be collected.'}, status=400)

        if payment.status == Payment.STATUS_COLLECTED:
            return Response({'success': False, 'message': 'Already collected.'}, status=400)

        notes = request.data.get('notes', '')

        payment.status = Payment.STATUS_COLLECTED
        payment.collected_by = request.user
        payment.save()

        order = Order.objects.select_for_update().get(pk=payment.order_id)
        old_status = order.payment_status
        order.payment_status = Order.PAYMENT_STATUS_COLLECTED
        order.save()

        PaymentEvent.objects.create(
            payment=payment,
            event_type='COD_COLLECTED',
            payload={'collected_by': request.user.email, 'notes': notes},
            notes=notes,
            created_by=request.user,
        )
        OrderStatusHistory.objects.create(
            order=order,
            from_status=order.status,
            to_status=order.status,
            payment_status=Order.PAYMENT_STATUS_COLLECTED,
            notes=f'COD cash collected by {request.user.email}. {notes}',
            changed_by=request.user,
        )

        return Response({
            'success': True,
            'message': 'COD collection recorded.',
            'data': {
                'order_number': order.order_number,
                'payment_status': payment.status,
                'collected_by': request.user.email,
            }
        })


class AdminPaymentListView(APIView):
    """GET /api/v1/admin/payments/"""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        from rest_framework.serializers import ModelSerializer
        qs = Payment.objects.select_related('order__customer', 'collected_by').order_by('-created_at')

        method = request.query_params.get('method')
        pstatus = request.query_params.get('status')
        if method:
            qs = qs.filter(payment_method=method)
        if pstatus:
            qs = qs.filter(status=pstatus)

        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request)

        data = [{
            'id': str(p.id),
            'order_number': p.order.order_number,
            'customer_email': p.order.customer.email,
            'payment_method': p.payment_method,
            'status': p.status,
            'amount_paise': p.amount_paise,
            'dev_simulation': p.dev_simulation,
            'provider_reference': p.provider_reference,
            'collected_by': p.collected_by.email if p.collected_by else None,
            'created_at': p.created_at,
        } for p in page]

        return paginator.get_paginated_response(data)
