"""
CloudMart Django API tests.
Run: pytest backend/tests/ -v
"""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        username='testadmin',
        email='admin@test.com',
        password='Admin@1234',
        first_name='Admin',
        last_name='Test',
    )


@pytest.fixture
def customer_user(db):
    return User.objects.create_user(
        username='testcustomer',
        email='customer@test.com',
        password='Customer@1234',
        first_name='Customer',
        last_name='Test',
    )


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    response = client.post('/api/v1/auth/login/', {
        'email': 'admin@test.com',
        'password': 'Admin@1234',
    })
    token = response.data['access']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


@pytest.fixture
def customer_client(customer_user):
    client = APIClient()
    response = client.post('/api/v1/auth/login/', {
        'email': 'customer@test.com',
        'password': 'Customer@1234',
    })
    token = response.data['access']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


@pytest.fixture
def category(db, admin_user):
    from apps.products.models import Category
    return Category.objects.create(name='Electronics', slug='electronics')


@pytest.fixture
def product_with_stock(db, admin_user, category):
    from apps.products.models import Product, ProductVariant, Inventory
    product = Product.objects.create(
        name='Test Headphones',
        slug='test-headphones',
        category=category,
        is_active=True,
        created_by=admin_user,
    )
    variant = ProductVariant.objects.create(
        product=product,
        sku='TEST-HP-001',
        price_paise=199900,
        original_price_paise=299900,
        attributes={'color': 'Black'},
    )
    Inventory.objects.create(variant=variant, quantity=50)
    return product, variant


# ─── Auth Tests ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_customer_cannot_access_admin_products(customer_client):
    """Ordinary customer cannot access admin APIs."""
    res = customer_client.get('/api/v1/admin/products/')
    assert res.status_code == 403


@pytest.mark.django_db
def test_unauthenticated_cannot_access_admin(api_client):
    res = api_client.get('/api/v1/admin/products/')
    assert res.status_code == 401


# ─── Product Tests ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_can_create_product(admin_client, category):
    """Admin can create a product using POST."""
    res = admin_client.post('/api/v1/admin/products/', {
        'name': 'Test Product',
        'description': 'A test product',
        'category_id': category.id,
        'is_active': True,
        'variants': [
            {
                'sku': 'TEST-SKU-001',
                'price_paise': 100000,
                'stock_quantity': 10,
                'attributes': {'color': 'Red'},
            }
        ]
    }, format='json')
    assert res.status_code == 201
    assert res.data['success'] is True
    assert res.data['data']['name'] == 'Test Product'


@pytest.mark.django_db
def test_product_saved_in_db(admin_client, category):
    """Product is saved in PostgreSQL after creation."""
    from apps.products.models import Product
    admin_client.post('/api/v1/admin/products/', {
        'name': 'DB Test Product',
        'description': '',
        'category_id': category.id,
        'is_active': True,
        'variants': [
            {'sku': 'DB-SKU-001', 'price_paise': 50000, 'stock_quantity': 5, 'attributes': {}}
        ]
    }, format='json')
    assert Product.objects.filter(name='DB Test Product').exists()


@pytest.mark.django_db
def test_active_product_appears_in_public_catalog(api_client, product_with_stock):
    """Active product appears on public storefront."""
    product, _ = product_with_stock
    res = api_client.get('/api/v1/products/')
    assert res.status_code == 200
    names = [p['name'] for p in res.data['results']]
    assert product.name in names


@pytest.mark.django_db
def test_duplicate_sku_rejected(admin_client, category, product_with_stock):
    """Duplicate SKU is rejected."""
    _, variant = product_with_stock
    res = admin_client.post('/api/v1/admin/products/', {
        'name': 'Another Product',
        'description': '',
        'category_id': category.id,
        'is_active': True,
        'variants': [
            {'sku': variant.sku, 'price_paise': 50000, 'stock_quantity': 5, 'attributes': {}}
        ]
    }, format='json')
    assert res.status_code == 400


# ─── Cart Tests ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_customer_can_add_to_cart(customer_client, product_with_stock):
    """Customer can add product to cart."""
    _, variant = product_with_stock
    res = customer_client.post('/api/v1/cart/items/', {
        'variant_id': variant.id,
        'quantity': 2,
    }, format='json')
    assert res.status_code == 201
    assert res.data['success'] is True


# ─── COD Checkout Tests ───────────────────────────────────────────────────────

@pytest.fixture
def customer_with_cart_and_address(customer_client, customer_user, product_with_stock):
    _, variant = product_with_stock
    addr_res = customer_client.post('/api/v1/addresses/', {
        'label': 'HOME',
        'full_name': 'Test Customer',
        'phone': '9876543210',
        'address_line1': '123 Test Street',
        'city': 'Chennai',
        'state': 'Tamil Nadu',
        'pincode': '600001',
    }, format='json')
    address_id = addr_res.data['id']
    return customer_client, customer_user, address_id, variant


@pytest.mark.django_db
def test_customer_can_place_cod_order(customer_with_cart_and_address):
    """Customer can place a COD order."""
    client, user, address_id, variant = customer_with_cart_and_address
    client.post('/api/v1/cart/items/', {'variant_id': variant.id, 'quantity': 1}, format='json')
    res = client.post('/api/v1/checkout/cod/', {
        'shipping_address_id': address_id,
        'payment_method': 'COD',
    }, format='json')
    assert res.status_code == 201
    assert res.data['success'] is True
    assert res.data['payment_method'] == 'COD'
    assert res.data['payment_status'] == 'PENDING'


@pytest.mark.django_db
def test_cod_order_appears_in_admin(customer_with_cart_and_address, admin_client):
    """COD order appears in admin order history."""
    client, user, address_id, variant = customer_with_cart_and_address
    client.post('/api/v1/cart/items/', {'variant_id': variant.id, 'quantity': 1}, format='json')
    cod_res = client.post('/api/v1/checkout/cod/', {
        'shipping_address_id': address_id,
        'payment_method': 'COD',
    }, format='json')
    print("COD RES:", cod_res.status_code, cod_res.data)
    res = admin_client.get('/api/v1/admin/orders/')
    print("ADMIN RES:", res.status_code, res.data)
    assert res.status_code == 200
    assert res.data['count'] >= 1


@pytest.mark.django_db
def test_cod_payment_pending_after_placement(customer_with_cart_and_address):
    """COD payment remains PENDING after placement."""
    from apps.orders.models import Order
    client, user, address_id, variant = customer_with_cart_and_address
    client.post('/api/v1/cart/items/', {'variant_id': variant.id, 'quantity': 1}, format='json')
    res = client.post('/api/v1/checkout/cod/', {
        'shipping_address_id': address_id,
        'payment_method': 'COD',
    }, format='json')
    order = Order.objects.get(id=res.data['order_id'])
    assert order.payment_status == 'PENDING'


@pytest.mark.django_db
def test_customers_cannot_see_other_orders(customer_with_cart_and_address, api_client, db):
    """Customers cannot view other customers' orders."""
    client, user, address_id, variant = customer_with_cart_and_address
    client.post('/api/v1/cart/items/', {'variant_id': variant.id, 'quantity': 1}, format='json')
    place_res = client.post('/api/v1/checkout/cod/', {
        'shipping_address_id': address_id,
        'payment_method': 'COD',
    }, format='json')
    order_id = place_res.data['order_id']

    # Create another customer
    other_user = User.objects.create_user(
        username='other', email='other@test.com', password='Other@1234'
    )
    other_client = APIClient()
    login_res = other_client.post('/api/v1/auth/login/', {
        'email': 'other@test.com', 'password': 'Other@1234'
    })
    other_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_res.data['access']}")
    res = other_client.get(f'/api/v1/orders/{order_id}/')
    assert res.status_code == 404


@pytest.mark.django_db
def test_duplicate_idempotency_key(customer_with_cart_and_address):
    """Duplicate checkout requests with same key do not create duplicate orders."""
    from apps.orders.models import Order
    client, user, address_id, variant = customer_with_cart_and_address
    client.post('/api/v1/cart/items/', {'variant_id': variant.id, 'quantity': 1}, format='json')
    import uuid
    key = str(uuid.uuid4())

    # Place order twice with same idempotency key
    res1 = client.post('/api/v1/checkout/cod/', {
        'shipping_address_id': address_id,
        'payment_method': 'COD',
        'idempotency_key': key,
    }, format='json')

    # Replenish cart
    from apps.products.models import ProductVariant
    v = ProductVariant.objects.get(sku='TEST-HP-001')
    client.post('/api/v1/cart/items/', {'variant_id': v.id, 'quantity': 1}, format='json')

    res2 = client.post('/api/v1/checkout/cod/', {
        'shipping_address_id': address_id,
        'payment_method': 'COD',
        'idempotency_key': key,
    }, format='json')

    assert res1.data['order_number'] == res2.data['order_number']
    assert Order.objects.filter(idempotency_key=key).count() == 1


# ─── UPI Simulation Tests ─────────────────────────────────────────────────────

@pytest.mark.django_db
def test_dev_upi_simulation_success(customer_with_cart_and_address):
    """Dev UPI simulation success flow."""
    from apps.orders.models import Order
    client, user, address_id, variant = customer_with_cart_and_address
    client.post('/api/v1/cart/items/', {'variant_id': variant.id, 'quantity': 1}, format='json')
    res = client.post('/api/v1/checkout/upi/', {
        'shipping_address_id': address_id,
        'payment_method': 'UPI',
    }, format='json')
    assert res.status_code == 201
    payment_id = res.data['payment_id']

    sim_res = client.post('/api/v1/payments/dev-upi/simulate/', {
        'payment_id': payment_id,
        'outcome': 'success',
    }, format='json')
    assert sim_res.status_code == 200
    assert sim_res.data['data']['payment_status'] == 'PAID'
    assert sim_res.data['data']['order_status'] == 'CONFIRMED'


@pytest.mark.django_db
def test_failed_upi_does_not_become_paid(customer_with_cart_and_address):
    """Failed UPI payment does not mark order as paid."""
    from apps.orders.models import Order
    client, user, address_id, variant = customer_with_cart_and_address
    client.post('/api/v1/cart/items/', {'variant_id': variant.id, 'quantity': 1}, format='json')
    res = client.post('/api/v1/checkout/upi/', {
        'shipping_address_id': address_id,
        'payment_method': 'UPI',
    }, format='json')
    payment_id = res.data['payment_id']

    sim_res = client.post('/api/v1/payments/dev-upi/simulate/', {
        'payment_id': payment_id,
        'outcome': 'failure',
    }, format='json')
    assert sim_res.data['data']['payment_status'] == 'FAILED'
    assert sim_res.data['data']['order_payment_status'] == 'FAILED'


# ─── Admin Status Transition Tests ───────────────────────────────────────────

@pytest.mark.django_db
def test_admin_can_update_valid_status(customer_with_cart_and_address, admin_client):
    """Admin can update valid fulfillment statuses."""
    client, user, address_id, variant = customer_with_cart_and_address
    client.post('/api/v1/cart/items/', {'variant_id': variant.id, 'quantity': 1}, format='json')
    res = client.post('/api/v1/checkout/cod/', {
        'shipping_address_id': address_id,
        'payment_method': 'COD',
    }, format='json')
    order_id = res.data['order_id']

    update_res = admin_client.patch(f'/api/v1/admin/orders/{order_id}/status/', {
        'status': 'CONFIRMED',
        'notes': 'Order confirmed by admin',
    }, format='json')
    assert update_res.status_code == 200
    assert update_res.data['data']['status'] == 'CONFIRMED'


@pytest.mark.django_db
def test_invalid_status_transition_rejected(customer_with_cart_and_address, admin_client):
    """Admin cannot move order into impossible state."""
    client, user, address_id, variant = customer_with_cart_and_address
    client.post('/api/v1/cart/items/', {'variant_id': variant.id, 'quantity': 1}, format='json')
    res = client.post('/api/v1/checkout/cod/', {
        'shipping_address_id': address_id,
        'payment_method': 'COD',
    }, format='json')
    order_id = res.data['order_id']

    # PLACED → SHIPPED is invalid (must go through CONFIRMED, PROCESSING)
    update_res = admin_client.patch(f'/api/v1/admin/orders/{order_id}/status/', {
        'status': 'SHIPPED',
    }, format='json')
    assert update_res.status_code == 400


@pytest.mark.django_db
def test_gmail_signup_persists_and_login_fetches_from_db():
    """Signing up with Gmail stores user in DB; logging in (even mixed-case) authenticates from DB."""
    client = APIClient()
    reg_res = client.post('/api/v1/auth/register/', {
        'username': 'TestGmailUser',
        'email': 'TestUser.One@Gmail.com',
        'first_name': 'Test',
        'last_name': 'User',
        'phone': '9876543210',
        'password': 'Password@123',
        'confirm_password': 'Password@123',
    }, format='json')
    assert reg_res.status_code == 201
    assert reg_res.data['success'] is True
    assert reg_res.data['data']['user']['email'] == 'testuser.one@gmail.com'
    assert User.objects.filter(email='testuser.one@gmail.com').exists()

    # Duplicate email with different case must be rejected
    dup_res = client.post('/api/v1/auth/register/', {
        'username': 'otheruser',
        'email': 'TESTUSER.ONE@gmail.com',
        'first_name': 'Other',
        'last_name': 'User',
        'phone': '9876543211',
        'password': 'Password@123',
        'confirm_password': 'Password@123',
    }, format='json')
    assert dup_res.status_code == 400

    # Login with exact email
    login_res = client.post('/api/v1/auth/login/', {
        'email': 'testuser.one@gmail.com',
        'password': 'Password@123',
    }, format='json')
    assert login_res.status_code == 200
    assert 'access' in login_res.data
    assert login_res.data['user']['email'] == 'testuser.one@gmail.com'

    # Login with mixed-case email and whitespace
    mixed_res = client.post('/api/v1/auth/login/', {
        'email': ' TestUser.One@GMAIL.COM ',
        'password': 'Password@123',
    }, format='json')
    assert mixed_res.status_code == 200
    assert 'access' in mixed_res.data

    # Fetch profile from DB using token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {mixed_res.data['access']}")
    me_res = client.get('/api/v1/auth/me/')
    assert me_res.status_code == 200
    assert me_res.data['email'] == 'testuser.one@gmail.com'
    assert me_res.data['username'] == 'testgmailuser'


@pytest.mark.django_db
def test_httponly_cookie_session_refresh_and_logout():
    """Login sets HttpOnly cookies; /auth/me/ & /auth/token/refresh/ work via cookies; logout clears them."""
    from django.conf import settings
    from django.core.cache import cache
    cache.clear()

    User.objects.create_user(
        username='cookieuser',
        email='cookie.user@gmail.com',
        password='StrongPass@123',
        first_name='Cookie',
        last_name='User',
    )

    client = APIClient()
    login_res = client.post('/api/v1/auth/login/', {
        'email': 'cookie.user@gmail.com',
        'password': 'StrongPass@123',
    }, format='json')
    assert login_res.status_code == 200
    assert settings.AUTH_COOKIE_ACCESS in login_res.cookies
    assert settings.AUTH_COOKIE_REFRESH in login_res.cookies
    assert login_res.cookies[settings.AUTH_COOKIE_ACCESS]['httponly'] is True
    assert login_res.cookies[settings.AUTH_COOKIE_REFRESH]['httponly'] is True

    # Simulate browser refresh: no Authorization header, only cookies
    me_res = client.get('/api/v1/auth/me/')
    assert me_res.status_code == 200
    assert me_res.data['email'] == 'cookie.user@gmail.com'

    # Refresh via HttpOnly cookie
    refresh_res = client.post('/api/v1/auth/token/refresh/', {}, format='json')
    assert refresh_res.status_code == 200
    assert settings.AUTH_COOKIE_ACCESS in refresh_res.cookies

    # Logout clears cookies and invalidates session
    logout_res = client.post('/api/v1/auth/logout/', {}, format='json')
    assert logout_res.status_code == 200
    assert logout_res.cookies[settings.AUTH_COOKIE_ACCESS].value == ''
    assert logout_res.cookies[settings.AUTH_COOKIE_REFRESH].value == ''


@pytest.mark.django_db
def test_forgot_and_reset_password_flow(mailoutbox):
    """Forgot password emails signed reset link; reset password updates DB hash and allows login."""
    import re
    from django.core.cache import cache
    cache.clear()

    user = User.objects.create_user(
        username='resetuser',
        email='reset.user@gmail.com',
        password='OldPassword@123',
        first_name='Reset',
        last_name='User',
    )

    client = APIClient()
    fp_res = client.post('/api/v1/auth/forgot-password/', {
        'email': 'Reset.User@gmail.com',
    }, format='json')
    assert fp_res.status_code == 200
    assert len(mailoutbox) == 1

    body = mailoutbox[0].body
    match = re.search(r'uid=([^&\s]+)&token=([^\s]+)', body)
    assert match is not None
    uid, token = match.group(1), match.group(2)

    reset_res = client.post('/api/v1/auth/reset-password/', {
        'uid': uid,
        'token': token,
        'new_password': 'NewStrongPass@456',
        'confirm_password': 'NewStrongPass@456',
    }, format='json')
    assert reset_res.status_code == 200

    # Old password fails, new password succeeds
    old_login = client.post('/api/v1/auth/login/', {
        'email': 'reset.user@gmail.com',
        'password': 'OldPassword@123',
    }, format='json')
    assert old_login.status_code == 401

    new_login = client.post('/api/v1/auth/login/', {
        'email': 'reset.user@gmail.com',
        'password': 'NewStrongPass@456',
    }, format='json')
    assert new_login.status_code == 200
    user.refresh_from_db()
    assert user.check_password('NewStrongPass@456')


@pytest.mark.django_db
def test_admin_dashboard_access_control():
    """Only authorized staff/superusers can access the admin dashboard."""
    from django.core.cache import cache
    cache.clear()

    User.objects.create_user(
        username='regularcust',
        email='regular.cust@gmail.com',
        password='StrongPass@123',
    )
    User.objects.create_superuser(
        username='superadmin',
        email='super.admin@gmail.com',
        password='SuperPass@123',
    )

    cust_client = APIClient()
    cust_client.post('/api/v1/auth/login/', {
        'email': 'regular.cust@gmail.com',
        'password': 'StrongPass@123',
    }, format='json')
    assert cust_client.get('/api/v1/admin/dashboard/').status_code == 403

    admin_client = APIClient()
    admin_client.post('/api/v1/auth/login/', {
        'email': 'super.admin@gmail.com',
        'password': 'SuperPass@123',
    }, format='json')
    assert admin_client.get('/api/v1/admin/dashboard/').status_code == 200


@pytest.mark.django_db
def test_login_rate_limiting():
    """Repeated failed login attempts trigger 429 rate limiting."""
    from django.core.cache import cache
    cache.clear()

    client = APIClient()
    statuses = []
    for _ in range(12):
        res = client.post('/api/v1/auth/login/', {
            'email': 'nobody@gmail.com',
            'password': 'WrongPassword@123',
        }, format='json')
        statuses.append(res.status_code)

    assert 429 in statuses
    cache.clear()
