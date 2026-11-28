"""
Custom JWT authentication that reads tokens from either the Authorization
header (Bearer) or an HttpOnly cookie.
"""
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class CookieJWTAuthentication(JWTAuthentication):
    """Authenticate via Authorization: Bearer <token> or HttpOnly cookie."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        cookie_name = getattr(settings, 'AUTH_COOKIE_ACCESS', 'cm_access')
        raw_token = request.COOKIES.get(cookie_name)
        if not raw_token:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except (InvalidToken, TokenError):
            return None
