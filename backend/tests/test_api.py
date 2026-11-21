"""
CloudMart Django API tests.
Run: pytest backend/tests/ -v
"""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()


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
