"""
Management Command: populate_product_images
==========================================
Safely fetch, validate, and associate missing product images for CloudMart products.

Usage:
    # Dry-run preview
    python manage.py populate_product_images --dry-run

    # Execute with explicit confirmation
    python manage.py populate_product_images --confirm

    # Target specific provider or product
    python manage.py populate_product_images --provider=ai --product-id=2 --confirm
"""

import sys
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.products.models import Product, ProductImage
from apps.products.image_service import (
    get_providers,
    product_needs_image,
    save_candidate_to_product,
)


class Command(BaseCommand):
    help = "Safely discover, download, validate, and associate missing product images using licensed sources or AI generation."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate the process without saving images or modifying the database.',
        )
        parser.add_argument(
            '--provider',
            type=str,
            default='auto',
            choices=['auto', 'ai', 'wikimedia', 'unsplash', 'pexels', 'local'],
            help='Image source provider strategy (default: auto).',
        )
        parser.add_argument(
            '--image-dir',
            type=str,
            default=None,
            help='Local directory containing vendor/supplier images for matching.',
        )
        parser.add_argument(
            '--product-id',
            type=int,
            default=None,
            help='Process a single specific product by its ID.',
        )
        parser.add_argument(
            '--missing-only',
            action='store_true',
            default=True,
            help='Only process products that currently have no valid image (default: True).',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Process all products regardless of whether they already have images.',
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Explicitly confirm saving changes to media storage and database.',
        )
        parser.add_argument(
            '-y', '--yes',
            action='store_true',
            help='Non-interactive confirmation (equivalent to --confirm).',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Maximum number of products to process.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        provider_name = options['provider']
        image_dir = options.get('image_dir')
        product_id = options.get('product_id')
        process_all = options.get('all', False)
        confirmed = options['confirm'] or options['yes']
        limit = options.get('limit')

        # Safety Check: If not dry-run and not explicitly confirmed, ask interactively or enforce dry-run
        if not dry_run and not confirmed:
            if sys.stdin.isatty():
                confirm_input = input("Apply changes to database and media storage? [y/N]: ").strip().lower()
                if confirm_input not in ('y', 'yes'):
                    self.stdout.write(self.style.WARNING("Operation cancelled or defaulted to --dry-run."))
                    dry_run = True
            else:
                self.stdout.write(self.style.WARNING("Non-interactive run without --confirm/-y. Defaulting to --dry-run mode."))
                dry_run = True

        mode_str = self.style.WARNING("[DRY RUN MODE - NO CHANGES WILL BE WRITTEN]") if dry_run else self.style.SUCCESS("[LIVE EXECUTION]")
        self.stdout.write(f"\n=======================================================")
        self.stdout.write(f" CLOUDMART PRODUCT IMAGE AUTO-POPULATION")
        self.stdout.write(f" {mode_str}")
        self.stdout.write(f" Strategy: {provider_name}")
        self.stdout.write(f"=======================================================\n")

        # Query products
        qs = Product.objects.all().prefetch_related('images', 'variants', 'category').order_by('id')
        if product_id:
            qs = qs.filter(pk=product_id)

        all_products = list(qs)
        total_inspected = len(all_products)

        if not all_products:
            self.stdout.write(self.style.WARNING("No products found matching criteria."))
            return

        self.stdout.write(f"Inspecting {total_inspected} product(s) from database...")

        # Filter candidates
        targets = []
        for p in all_products:
            if process_all or product_needs_image(p):
                targets.append(p)
            else:
                self.stdout.write(self.style.SUCCESS(f"  [OK] Product #{p.id} '{p.name}' already has valid image."))

        if limit and len(targets) > limit:
            targets = targets[:limit]

        self.stdout.write(f"\nFound {len(targets)} product(s) requiring images.\n")

        providers = get_providers(provider_name=provider_name, image_dir=image_dir)
        provider_names = [p.name for p in providers]
        self.stdout.write(f"Active provider chain: {' -> '.join(provider_names)}\n")

        # Stats
        images_found = 0
        images_saved = 0
        products_updated = 0
        manual_review_needed = []

        for p in targets:
            self.stdout.write(f"\n-------------------------------------------------------")
            self.stdout.write(f"Processing #{p.id}: {p.name}")
            self.stdout.write(f"  Category: {p.category.name if p.category else 'None'}")
            desc_short = (p.description[:80] + '...') if len(p.description) > 80 else p.description
            if desc_short:
                self.stdout.write(f"  Description: {desc_short}")

            candidate = None
            for provider in providers:
                self.stdout.write(f"  -> Searching via provider: {provider.name}...")
                candidate = provider.search_image(p)
                if candidate:
                    self.stdout.write(self.style.SUCCESS(
                        f"     Found match from {candidate.source_name}!"
                    ))
                    self.stdout.write(f"     Dimensions: {candidate.width}x{candidate.height} | Format: {candidate.format_name} | Size: {len(candidate.image_bytes):,} bytes")
                    self.stdout.write(f"     License: {candidate.license_name}")
                    self.stdout.write(f"     Attribution: {candidate.attribution}")
                    images_found += 1
                    break
                else:
                    self.stdout.write(f"     No match from {provider.name}.")

            if not candidate:
                self.stdout.write(self.style.WARNING(f"  [!] No valid image found for '{p.name}'. Flagged for manual review."))
                manual_review_needed.append(p)
                continue

            # Save to product
            try:
                with transaction.atomic():
                    success, msg, img_obj = save_candidate_to_product(p, candidate, dry_run=dry_run)
                    if success:
                        images_saved += 1
                        products_updated += 1
                        self.stdout.write(self.style.SUCCESS(f"  [+] {msg}"))
                    else:
                        self.stdout.write(self.style.WARNING(f"  [-] Skipped: {msg}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  [ERROR] Failed to save image for #{p.id}: {e}"))
                manual_review_needed.append(p)

        # Final Report
        self.stdout.write(f"\n=======================================================")
        self.stdout.write(f" SUMMARY REPORT")
        self.stdout.write(f"=======================================================")
        self.stdout.write(f" Total products inspected:      {total_inspected}")
        self.stdout.write(f" Products requiring images:     {len(targets)}")
        self.stdout.write(f" Images discovered:             {images_found}")
        self.stdout.write(f" Images successfully validated: {images_saved}")
        self.stdout.write(f" Products updated:              {products_updated}")
        self.stdout.write(f" Products needing manual review:{len(manual_review_needed)}")
        if manual_review_needed:
            for mp in manual_review_needed:
                self.stdout.write(self.style.WARNING(f"   - #{mp.id}: {mp.name}"))
        self.stdout.write(f" Execution Mode:                {'DRY RUN' if dry_run else 'LIVE'}")
        self.stdout.write(f"=======================================================\n")
