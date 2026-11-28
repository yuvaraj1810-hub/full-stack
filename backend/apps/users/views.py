from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Address
from .serializers import (
    AddressSerializer,
    EmailTokenObtainPairSerializer,
    ForgotPasswordSerializer,
    ResetPasswordConfirmSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)

User = get_user_model()


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


class PasswordResetRateThrottle(AnonRateThrottle):
    scope = 'password_reset'


def _set_auth_cookies(response, access_token: str | None = None, refresh_token: str | None = None):
    """Attach HttpOnly JWT cookies to the response."""
    secure = getattr(settings, 'AUTH_COOKIE_SECURE', False)
    samesite = getattr(settings, 'AUTH_COOKIE_SAMESITE', 'Lax')

    if access_token:
        access_lifetime = settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME']
        response.set_cookie(
            key=getattr(settings, 'AUTH_COOKIE_ACCESS', 'cm_access'),
            value=access_token,
            max_age=int(access_lifetime.total_seconds()),
            httponly=True,
            secure=secure,
            samesite=samesite,
            path='/',
        )
    if refresh_token:
        refresh_lifetime = settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']
        response.set_cookie(
            key=getattr(settings, 'AUTH_COOKIE_REFRESH', 'cm_refresh'),
            value=refresh_token,
            max_age=int(refresh_lifetime.total_seconds()),
            httponly=True,
            secure=secure,
            samesite=samesite,
            path='/',
        )


def _clear_auth_cookies(response):
    """Delete HttpOnly JWT cookies on logout."""
    response.delete_cookie(getattr(settings, 'AUTH_COOKIE_ACCESS', 'cm_access'), path='/')
    response.delete_cookie(getattr(settings, 'AUTH_COOKIE_REFRESH', 'cm_refresh'), path='/')


class RegisterView(generics.CreateAPIView):
    """POST /api/v1/auth/register/"""
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'success': True,
            'message': 'Account created successfully',
            'data': {
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login/ — returns JWT tokens + sets HttpOnly cookies"""
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data['access']
            refresh_token = response.data.get('refresh')
            token = AccessToken(access_token)
            user = User.objects.get(id=token['user_id'])
            response.data['user'] = UserSerializer(user).data
            response.data['success'] = True
            _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """POST /api/v1/auth/token/refresh/ — reads refresh token from body or HttpOnly cookie"""
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if not data.get('refresh'):
            cookie_refresh = request.COOKIES.get(getattr(settings, 'AUTH_COOKIE_REFRESH', 'cm_refresh'))
            if cookie_refresh:
                data['refresh'] = cookie_refresh
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        resp_data = serializer.validated_data
        response = Response(resp_data, status=status.HTTP_200_OK)
        _set_auth_cookies(
            response,
            access_token=resp_data.get('access'),
            refresh_token=resp_data.get('refresh'),
        )
        return response


class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — blacklist refresh token and clear HttpOnly cookies"""
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh') or request.COOKIES.get(
            getattr(settings, 'AUTH_COOKIE_REFRESH', 'cm_refresh')
        )
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass
        response = Response({'success': True, 'message': 'Logged out successfully'})
        _clear_auth_cookies(response)
        return response


class ForgotPasswordView(APIView):
    """POST /api/v1/auth/forgot-password/ — send password reset link"""
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
            reset_link = f"{frontend_url}/user/reset-password?uid={uid}&token={token}"
            send_mail(
                subject='CloudMart — Reset Your Password',
                message=(
                    f"Hi {user.first_name or user.username},\n\n"
                    f"Use the link below to reset your CloudMart password:\n{reset_link}\n\n"
                    "If you did not request this, you can safely ignore this email."
                ),
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@cloudmart.local'),
                recipient_list=[user.email],
                fail_silently=True,
            )

        return Response({
            'success': True,
            'message': 'If an account with that email exists, a password reset link has been sent.',
        })


class ResetPasswordConfirmView(APIView):
    """POST /api/v1/auth/reset-password/ — validate token & set new password"""
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        serializer = ResetPasswordConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id, is_active=True)
        except Exception:
            return Response(
                {'success': False, 'message': 'Invalid or expired password reset link.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {'success': False, 'message': 'Invalid or expired password reset link.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user)
        except DjangoValidationError as exc:
            return Response(
                {'success': False, 'new_password': list(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=['password'])

        return Response({'success': True, 'message': 'Password has been reset successfully. Please sign in.'})


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/me/"""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class AddressListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/addresses/"""
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user).order_by('-is_default', '-created_at')


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE /api/v1/addresses/{id}/"""
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)
