from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Address

User = get_user_model()


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Case-insensitive email authentication for JWT login."""

    def validate(self, attrs):
        email = (attrs.get(self.username_field) or '').strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if user is not None:
            attrs[self.username_field] = user.email
        else:
            attrs[self.username_field] = email
        return super().validate(attrs)


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'phone', 'password', 'confirm_password']

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return email

    def validate_username(self, value):
        username = value.strip().lower()
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return username

    def validate(self, data):
        if data['password'] != data.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        validate_password(data['password'])
        return data

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return data


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'phone', 'full_name',
                  'is_staff', 'is_active', 'created_at']
        read_only_fields = ['id', 'email', 'is_staff', 'created_at']


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ['id', 'label', 'full_name', 'phone', 'address_line1', 'address_line2',
                  'city', 'state', 'pincode', 'country', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        user = self.context['request'].user
        # If this is set as default, unset others
        if validated_data.get('is_default', False):
            Address.objects.filter(user=user).update(is_default=False)
        return Address.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        user = self.context['request'].user
        if validated_data.get('is_default', False):
            Address.objects.filter(user=user).exclude(pk=instance.pk).update(is_default=False)
        return super().update(instance, validated_data)
