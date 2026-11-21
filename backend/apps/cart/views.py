from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Cart, CartItem
from .serializers import CartSerializer, AddToCartSerializer, UpdateCartItemSerializer


class CartView(APIView):
    """GET /api/v1/cart/ — get current user cart"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response({'success': True, 'data': CartSerializer(cart).data})

    def delete(self, request):
        """Clear entire cart"""
        try:
            cart = Cart.objects.get(user=request.user)
            cart.items.all().delete()
        except Cart.DoesNotExist:
            pass
        return Response({'success': True, 'message': 'Cart cleared'})


class CartItemView(APIView):
    """POST /api/v1/cart/items/ — add item"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AddToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variant = serializer._variant
        quantity = serializer.validated_data['quantity']

        # Check stock
        try:
            available = variant.inventory.available_quantity
        except Exception:
            available = 0
        if available < quantity:
            return Response({
                'success': False,
                'message': f'Only {available} items available in stock.'
            }, status=400)

        cart, _ = Cart.objects.get_or_create(user=request.user)
        cart_item, created = CartItem.objects.get_or_create(cart=cart, variant=variant)
        if not created:
            new_qty = cart_item.quantity + quantity
            if new_qty > available:
                return Response({'success': False, 'message': f'Cannot add more. Only {available} available.'}, status=400)
            cart_item.quantity = new_qty
            cart_item.save()
        else:
            cart_item.quantity = quantity
            cart_item.save()

        return Response({
            'success': True,
            'message': 'Item added to cart',
            'data': CartSerializer(cart).data
        }, status=status.HTTP_201_CREATED)


class CartItemDetailView(APIView):
    """PATCH/DELETE /api/v1/cart/items/{id}/"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            item = CartItem.objects.select_related('cart', 'variant__inventory').get(
                pk=pk, cart__user=request.user
            )
        except CartItem.DoesNotExist:
            return Response({'success': False, 'message': 'Cart item not found'}, status=404)

        serializer = UpdateCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quantity = serializer.validated_data['quantity']

        if quantity == 0:
            item.delete()
            return Response({'success': True, 'message': 'Item removed from cart'})

        available = item.variant.inventory.available_quantity
        if quantity > available:
            return Response({'success': False, 'message': f'Only {available} available.'}, status=400)

        item.quantity = quantity
        item.save()
        return Response({'success': True, 'message': 'Cart updated', 'data': CartSerializer(item.cart).data})

    def delete(self, request, pk):
        try:
            item = CartItem.objects.get(pk=pk, cart__user=request.user)
            item.delete()
        except CartItem.DoesNotExist:
            return Response({'success': False, 'message': 'Cart item not found'}, status=404)
        return Response({'success': True, 'message': 'Item removed'})
