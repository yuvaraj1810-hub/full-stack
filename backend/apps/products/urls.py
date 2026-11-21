from django.urls import path
from . import views

urlpatterns = [
    # Public
    path('products/', views.PublicProductListView.as_view(), name='public-products'),
    path('products/<slug:slug>/', views.PublicProductDetailView.as_view(), name='public-product-detail'),
    path('categories/', views.CategoryListView.as_view(), name='categories'),

    # Admin
    path('admin/products/', views.AdminProductListCreateView.as_view(), name='admin-products'),
    path('admin/products/<int:pk>/', views.AdminProductDetailView.as_view(), name='admin-product-detail'),
    path('admin/products/<int:pk>/images/', views.AdminProductImageUploadView.as_view(), name='admin-product-images'),
    path('admin/inventory/<int:variant_id>/adjust/', views.AdminInventoryAdjustView.as_view(), name='admin-inventory-adjust'),
]
