"""
Management command: seed_data
Creates demo categories, products, admin user and a sample customer.
"""
from typing import Any
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from django.contrib.auth import get_user_model
from apps.products.models import Category, Product, ProductVariant, Inventory, InventoryMovement

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed CloudMart with demo data'

    def handle(self, *args, **options):
        self.stdout.write('Seeding data...')

        # Admin (never hardcode credentials; create via `python manage.py createsuperuser`)
        admin_user = User.objects.filter(is_superuser=True).order_by('id').first()
        if not admin_user:
            self.stdout.write(self.style.WARNING(
                'No superuser found. Create an admin account with: python manage.py createsuperuser'
            ))

        # Categories
        categories_data = [
            ('Electronics', 'electronics'),
            ('Clothing', 'clothing'),
            ('Home & Kitchen', 'home-kitchen'),
            ('Books', 'books'),
            ('Sports', 'sports'),
        ]
        categories: dict[str, Category] = {}
        for name, slug in categories_data:
            cat, _ = Category.objects.get_or_create(slug=slug, defaults={'name': name})
            categories[slug] = cat

        # Products
        products_data: list[dict[str, Any]] = [
            {
                'name': 'Wireless Bluetooth Headphones',
                'description': 'Premium noise-cancelling wireless headphones with 30hr battery life.',
                'category': 'electronics',
                'variants': [
                    {'sku': 'CM-HEADPHONE-BLK', 'price_paise': 199900, 'original_price_paise': 299900, 'attributes': {'color': 'Black'}, 'stock': 25},
                    {'sku': 'CM-HEADPHONE-WHT', 'price_paise': 199900, 'original_price_paise': 299900, 'attributes': {'color': 'White'}, 'stock': 15},
                ],
            },
            {
                'name': 'Cotton Classic T-Shirt',
                'description': 'Soft 100% cotton t-shirt available in multiple sizes.',
                'category': 'clothing',
                'variants': [
                    {'sku': 'CM-TSHIRT-S', 'price_paise': 59900, 'original_price_paise': 79900, 'attributes': {'size': 'S', 'color': 'White'}, 'stock': 50},
                    {'sku': 'CM-TSHIRT-M', 'price_paise': 59900, 'original_price_paise': 79900, 'attributes': {'size': 'M', 'color': 'White'}, 'stock': 60},
                    {'sku': 'CM-TSHIRT-L', 'price_paise': 59900, 'original_price_paise': 79900, 'attributes': {'size': 'L', 'color': 'White'}, 'stock': 40},
                ],
            },
            {
                'name': 'Stainless Steel Water Bottle',
                'description': '1-litre double-walled insulated bottle, keeps hot 12hr and cold 24hr.',
                'category': 'home-kitchen',
                'variants': [
                    {'sku': 'CM-BOTTLE-SLV', 'price_paise': 89900, 'original_price_paise': 129900, 'attributes': {'color': 'Silver'}, 'stock': 30},
                    {'sku': 'CM-BOTTLE-BLU', 'price_paise': 89900, 'original_price_paise': 129900, 'attributes': {'color': 'Blue'}, 'stock': 20},
                ],
            },
            {
                'name': 'Python Programming — Complete Guide',
                'description': 'Comprehensive Python book for beginners to advanced developers.',
                'category': 'books',
                'variants': [
                    {'sku': 'CM-BOOK-PYTHON', 'price_paise': 49900, 'original_price_paise': 69900, 'attributes': {}, 'stock': 100},
                ],
            },
            {
                'name': 'Yoga Mat Premium',
                'description': 'Non-slip 6mm thick eco-friendly yoga mat with carry strap.',
                'category': 'sports',
                'variants': [
                    {'sku': 'CM-YOGA-PURPLE', 'price_paise': 149900, 'original_price_paise': 199900, 'attributes': {'color': 'Purple'}, 'stock': 20},
                    {'sku': 'CM-YOGA-GREEN', 'price_paise': 149900, 'original_price_paise': 199900, 'attributes': {'color': 'Green'}, 'stock': 15},
                ],
            },
            {
                'name': 'Smart LED Desk Lamp',
                'description': 'USB-C rechargeable LED lamp with touch dimmer and 5 colour temperatures.',
                'category': 'electronics',
                'variants': [
                    {'sku': 'CM-LAMP-WHT', 'price_paise': 129900, 'original_price_paise': 179900, 'attributes': {'color': 'White'}, 'stock': 8},
                ],
            },
        ]

        admin_user = User.objects.filter(is_superuser=True).order_by('id').first()
        for pd in products_data:
            slug = slugify(pd['name'])
            product, created = Product.objects.get_or_create(
                slug=slug,
                defaults={
                    'name': pd['name'],
                    'description': pd['description'],
                    'category': categories[pd['category']],
                    'is_active': True,
                    'created_by': admin_user,
                }
            )
            if created:
                for vd in pd['variants']:
                    stock = vd.pop('stock')
                    variant = ProductVariant.objects.create(product=product, **vd)
                    inventory = Inventory.objects.create(variant=variant, quantity=stock, low_stock_threshold=10)
                    InventoryMovement.objects.create(
                        inventory=inventory,
                        movement_type='RESTOCK',
                        quantity_change=stock,
                        quantity_before=0,
                        quantity_after=stock,
                        reference='Initial seed',
                        created_by=admin_user,
                    )
                self.stdout.write(self.style.SUCCESS(f'  Created product: {product.name}'))

        self.stdout.write(self.style.SUCCESS('\nSeed complete! 🚀'))
