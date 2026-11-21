from django.urls import path
from . import views

urlpatterns = [
    # Customer checkout
    path('checkout/cod/', views.CODCheckoutView.as_view(), name='checkout-cod'),
    path('checkout/upi/', views.UPICheckoutView.as_view(), name='checkout-upi'),

    # Customer order history
    path('orders/', views.CustomerOrderListView.as_view(), name='customer-orders'),
    path('orders/<int:pk>/', views.CustomerOrderDetailView.as_view(), name='customer-order-detail'),

    # Admin orders
    path('admin/orders/', views.AdminOrderListView.as_view(), name='admin-orders'),
    path('admin/orders/history/', views.AdminOrderHistoryView.as_view(), name='admin-order-history'),
    path('admin/orders/<int:pk>/', views.AdminOrderDetailView.as_view(), name='admin-order-detail'),
    path('admin/orders/<int:pk>/status/', views.AdminOrderStatusUpdateView.as_view(), name='admin-order-status'),
]
