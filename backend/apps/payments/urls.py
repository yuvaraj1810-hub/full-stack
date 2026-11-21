from django.urls import path
from . import views

urlpatterns = [
    path('payments/<uuid:payment_id>/status/', views.PaymentStatusView.as_view(), name='payment-status'),
    path('payments/dev-upi/simulate/', views.DevUPISimulateView.as_view(), name='dev-upi-simulate'),
    path('admin/payments/', views.AdminPaymentListView.as_view(), name='admin-payments'),
    path('admin/payments/<uuid:payment_id>/collect/', views.AdminCODCollectView.as_view(), name='admin-cod-collect'),
]
