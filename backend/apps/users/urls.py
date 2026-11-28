from django.urls import path
from . import views

urlpatterns = [
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/token/refresh/', views.CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/forgot-password/', views.ForgotPasswordView.as_view(), name='forgot_password'),
    path('auth/reset-password/', views.ResetPasswordConfirmView.as_view(), name='reset_password'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('addresses/', views.AddressListCreateView.as_view(), name='address-list'),
    path('addresses/<int:pk>/', views.AddressDetailView.as_view(), name='address-detail'),
]
