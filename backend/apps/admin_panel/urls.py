from django.urls import path
from . import views

urlpatterns = [
    path('admin/dashboard/', views.AdminDashboardView.as_view(), name='admin-dashboard'),
    path('admin/customers/', views.AdminCustomerListView.as_view(), name='admin-customers'),
]
