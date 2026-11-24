"""
CloudMart Product Image Service
===============================
Provides safe, automated fetching, AI generation, validation, and storage
of product images for CloudMart catalog products.

Features:
- SSRF and network security verification.
- Content, format, and dimension validation using Pillow.
- Multi-provider support:
    * Local staging folder (vendor/supplier images)
    * Wikimedia Commons (Creative Commons / Public Domain)
    * Unsplash API / Pexels API (configured via environment keys)
    * AI illustrative image generator (Pollinations.ai / OpenAI)
- Automatic deduplication and attribution preservation.
- Integration with Django ORM and FileSystem / S3 storage.
"""

import os
import io
import re
import socket
import hashlib
import ipaddress
import logging
from dataclasses import dataclass
from typing import Optional, List, Tuple
from urllib.parse import urlparse, urlencode
import urllib.request

from PIL import Image
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from apps.products.models import Product, ProductImage

logger = logging.getLogger('cloudmart.image_service')

# Maximum download size: 10 MB
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
# Supported image formats
SUPPORTED_FORMATS = {'JPEG', 'PNG', 'WEBP'}
# Dimension constraints
MIN_DIMENSION = 200
MAX_DIMENSION = 4000
# Default HTTP request timeout
DEFAULT_TIMEOUT = 20
USER_AGENT = 'CloudMart-ProductImageService/1.0 (+http://localhost:3000; catalog-maintenance)'


@dataclass
class ImageCandidate:
    source_name: str
    source_url: str
    license_name: str
    attribution: str
    image_bytes: bytes
    format_name: str
    width: int
    height: int
    is_illustrative: bool = False


# ==============================================================================
# Security & URL Validation (SSRF Prevention)
# ==============================================================================

def is_safe_url(url: str) -> Tuple[bool, str]:
    """
    Validate that the URL uses HTTP/HTTPS, has a valid domain name,
    and does not resolve to private, loopback, or link-local IP addresses.
    """
    try:
        parsed = urlparse(url)
    except Exception as e:
        return False, f"Malformed URL: {e}"

    if parsed.scheme not in ('http', 'https'):
        return False, f"Unsupported scheme: {parsed.scheme}"

    hostname = parsed.hostname
    if not hostname:
        return False, "Missing hostname in URL"

    # Reject internal Docker aliases and common private hostnames
    blocked_hosts = {'localhost', '127.0.0.1', 'backend', 'db', 'frontend', 'redis', 'postgres'}
    if hostname.lower() in blocked_hosts:
        return False, f"Access to internal host '{hostname}' is blocked"

    # Resolve hostname to check for private or reserved IP ranges
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for family, socktype, proto, canonname, sockaddr in addr_info:
            ip_str = sockaddr[0]
            ip_obj = ipaddress.ip_address(ip_str)
            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_multicast
                or ip_obj.is_reserved
            ):
                return False, f"URL resolves to disallowed private/internal IP: {ip_str}"
    except socket.gaierror as e:
        return False, f"Failed to resolve hostname '{hostname}': {e}"
    except Exception as e:
        return False, f"DNS check error: {e}"

    return True, "URL is safe"


# ==============================================================================
# Image Download & Validation
# ==============================================================================

def download_and_validate_image(url: str, timeout: int = DEFAULT_TIMEOUT) -> Tuple[Optional[bytes], Optional[str], int, int, str]:
    """
    Safely download an image from a URL, enforcing size limits, format checks,
    and dimension validation using Pillow.

    Returns:
        (image_bytes, format_name, width, height, error_message)
    """
    safe, reason = is_safe_url(url)
    if not safe:
        return None, None, 0, 0, f"SSRF check rejected URL: {reason}"

    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status = getattr(response, 'status', 200)
            if status != 200:
                return None, None, 0, 0, f"HTTP {status} returned by server"

            # Check Content-Length header if present
            cl = response.headers.get('Content-Length')
            if cl and int(cl) > MAX_IMAGE_SIZE_BYTES:
                return None, None, 0, 0, f"Image size exceeds {MAX_IMAGE_SIZE_BYTES} bytes limit"

            # Read stream with strict size limit
            chunks = []
            total_read = 0
            while True:
                chunk = response.read(64 * 1024)
                if not chunk:
                    break
                total_read += len(chunk)
                if total_read > MAX_IMAGE_SIZE_BYTES:
                    return None, None, 0, 0, f"Image stream exceeded maximum size limit of {MAX_IMAGE_SIZE_BYTES} bytes"
                chunks.append(chunk)

            raw_bytes = b"".join(chunks)
            if not raw_bytes:
                return None, None, 0, 0, "Empty payload received"

    except Exception as e:
        return None, None, 0, 0, f"Network error downloading image: {e}"

    # Validate image using Pillow
    try:
        bio = io.BytesIO(raw_bytes)
        with Image.open(bio) as img:
            img_format = (img.format or '').upper()
            if img_format not in SUPPORTED_FORMATS:
                return None, None, 0, 0, f"Unsupported format '{img_format}'. Supported: {SUPPORTED_FORMATS}"

            width, height = img.size
            if width < MIN_DIMENSION or height < MIN_DIMENSION:
                return None, None, 0, 0, f"Dimensions ({width}x{height}) are smaller than minimum allowed ({MIN_DIMENSION}x{MIN_DIMENSION})"

            if width > MAX_DIMENSION or height > MAX_DIMENSION:
                return None, None, 0, 0, f"Dimensions ({width}x{height}) exceed maximum allowed ({MAX_DIMENSION}x{MAX_DIMENSION})"

            # Fully verify integrity by loading raster data
            img.load()

        return raw_bytes, img_format, width, height, ""
    except Exception as e:
        return None, None, 0, 0, f"Image validation failed (corrupt or invalid format): {e}"


# ==============================================================================
# Providers
# ==============================================================================

class BaseImageProvider:
    name: str = "base"

    def search_image(self, product: Product) -> Optional[ImageCandidate]:
        raise NotImplementedError


class LocalDirectoryProvider(BaseImageProvider):
    name = "local"

    def __init__(self, search_dir: str):
        self.search_dir = search_dir

    def search_image(self, product: Product) -> Optional[ImageCandidate]:
        if not self.search_dir or not os.path.isdir(self.search_dir):
            return None

        # Build list of matching target keys (slug, SKU, normalized name)
        targets = [product.slug.lower(), product.name.lower().replace(' ', '-')]
        for variant in product.variants.all():
            if variant.sku:
                targets.append(variant.sku.lower())

        for root, _, files in os.walk(self.search_dir):
            for fname in files:
                ext = os.path.splitext(fname)[1].lower().lstrip('.')
                if ext not in ('jpg', 'jpeg', 'png', 'webp'):
                    continue

                stem = os.path.splitext(fname)[0].lower()
                for target in targets:
                    if target in stem or stem in target:
                        fpath = os.path.join(root, fname)
                        try:
                            with open(fpath, 'rb') as f:
                                data = f.read()

                            with Image.open(io.BytesIO(data)) as img:
                                fmt = (img.format or '').upper()
                                w, h = img.size

                            return ImageCandidate(
                                source_name="Local Vendor Directory",
                                source_url=f"file://{fpath}",
                                license_name="Supplier / Internal Assets",
                                attribution=f"Supplier asset for {product.name}",
                                image_bytes=data,
                                format_name=fmt,
                                width=w,
                                height=h,
                                is_illustrative=False,
                            )
                        except Exception as e:
                            logger.warning(f"Failed to read local image {fpath}: {e}")
        return None


class WikimediaCommonsProvider(BaseImageProvider):
    name = "wikimedia"

    def search_image(self, product: Product) -> Optional[ImageCandidate]:
        clean_name = re.sub(r'[^a-zA-Z0-9\s]', ' ', product.name).strip()
        stop_words = {'complete', 'guide', 'premium', 'classic', 'super', 'best', 'item'}
        keywords = [w.lower() for w in clean_name.split() if len(w) >= 4 and w.lower() not in stop_words]

        # Candidate queries: specific quoted phrase first, then noun keywords
        queries = [f'"{clean_name}"', clean_name]
        if len(keywords) >= 2:
            queries.append(f'"{keywords[-2]} {keywords[-1]}"')
        elif len(keywords) == 1:
            queries.append(f'"{keywords[0]}"')

        if product.category and product.category.name and product.category.name.lower() not in clean_name.lower():
            queries.append(f"{product.category.name} {clean_name}")

        for q in queries:
            try:
                params = urllib.parse.urlencode({
                    'action': 'query',
                    'generator': 'search',
                    'gsrsearch': q,
                    'gsrnamespace': 6,  # File namespace
                    'gsrlimit': 5,
                    'prop': 'imageinfo',
                    'iiprop': 'url|size|mime|extmetadata',
                    'format': 'json',
                })
                api_url = f"https://commons.wikimedia.org/w/api.php?{params}"
                req = urllib.request.Request(api_url, headers={'User-Agent': USER_AGENT})

                with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
                    data = __import__('json').loads(resp.read().decode('utf-8'))

                pages = data.get('query', {}).get('pages', {})
                for pid, page in pages.items():
                    title = page.get('title', '').lower()
                    # Relevance check: ensure at least one significant product keyword is present in the file title
                    if keywords and not any(kw in title for kw in keywords):
                        continue

                    infos = page.get('imageinfo')
                    if not infos:
                        continue
                    info = infos[0]
                    mime = info.get('mime', '').lower()
                    if mime not in ('image/jpeg', 'image/png', 'image/webp'):
                        continue

                    img_url = info.get('url')
                    if not img_url:
                        continue

                    # Extract license metadata
                    extmeta = info.get('extmetadata', {})
                    lic_name = extmeta.get('LicenseShortName', {}).get('value', 'CC / Public Domain')
                    artist = extmeta.get('Artist', {}).get('value', 'Wikimedia Commons Contributor')
                    # Strip html tags from artist
                    artist_clean = re.sub(r'<[^>]+>', '', artist).strip() or "Wikimedia Contributor"

                    # Download and validate
                    raw_bytes, fmt, w, h, err = download_and_validate_image(img_url)
                    if not raw_bytes:
                        continue

                    attribution = f"Wikimedia Commons: {page.get('title', product.name)} by {artist_clean} ({lic_name})"

                    return ImageCandidate(
                        source_name="Wikimedia Commons",
                        source_url=img_url,
                        license_name=lic_name,
                        attribution=attribution[:200],
                        image_bytes=raw_bytes,
                        format_name=fmt,
                        width=w,
                        height=h,
                        is_illustrative=False,
                    )
            except Exception as e:
                logger.warning(f"Wikimedia search error for '{q}': {e}")

        return None


class UnsplashProvider(BaseImageProvider):
    name = "unsplash"

    def search_image(self, product: Product) -> Optional[ImageCandidate]:
        access_key = os.environ.get('UNSPLASH_ACCESS_KEY')
        if not access_key:
            return None

        clean_name = re.sub(r'[^a-zA-Z0-9\s]', ' ', product.name).strip()
        params = urllib.parse.urlencode({
            'query': clean_name,
            'per_page': 1,
            'orientation': 'squarish',
        })
        api_url = f"https://api.unsplash.com/search/photos?{params}"
        req = urllib.request.Request(api_url, headers={
            'Authorization': f"Client-ID {access_key}",
            'User-Agent': USER_AGENT,
        })

        try:
            with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
                data = __import__('json').loads(resp.read().decode('utf-8'))

            results = data.get('results', [])
            if not results:
                return None

            item = results[0]
            img_url = item.get('urls', {}).get('regular') or item.get('urls', {}).get('small')
            user_name = item.get('user', {}).get('name', 'Unsplash Contributor')
            if not img_url:
                return None

            raw_bytes, fmt, w, h, err = download_and_validate_image(img_url)
            if not raw_bytes:
                return None

            return ImageCandidate(
                source_name="Unsplash API",
                source_url=img_url,
                license_name="Unsplash Commercial License",
                attribution=f"Photo by {user_name} on Unsplash (Licensed for commercial use)"[:200],
                image_bytes=raw_bytes,
                format_name=fmt,
                width=w,
                height=h,
                is_illustrative=True,
            )
        except Exception as e:
            logger.warning(f"Unsplash error for '{clean_name}': {e}")
            return None


class PexelsProvider(BaseImageProvider):
    name = "pexels"

    def search_image(self, product: Product) -> Optional[ImageCandidate]:
        api_key = os.environ.get('PEXELS_API_KEY')
        if not api_key:
            return None

        clean_name = re.sub(r'[^a-zA-Z0-9\s]', ' ', product.name).strip()
        params = urllib.parse.urlencode({'query': clean_name, 'per_page': 1})
        api_url = f"https://api.pexels.com/v1/search?{params}"
        req = urllib.request.Request(api_url, headers={
            'Authorization': api_key,
            'User-Agent': USER_AGENT,
        })

        try:
            with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
                data = __import__('json').loads(resp.read().decode('utf-8'))

            photos = data.get('photos', [])
            if not photos:
                return None

            item = photos[0]
            img_url = item.get('src', {}).get('large') or item.get('src', {}).get('medium')
            photographer = item.get('photographer', 'Pexels Creator')
            if not img_url:
                return None

            raw_bytes, fmt, w, h, err = download_and_validate_image(img_url)
            if not raw_bytes:
                return None

            return ImageCandidate(
                source_name="Pexels API",
                source_url=img_url,
                license_name="Pexels Commercial License",
                attribution=f"Photo by {photographer} on Pexels (Free commercial use)"[:200],
                image_bytes=raw_bytes,
                format_name=fmt,
                width=w,
                height=h,
                is_illustrative=True,
            )
        except Exception as e:
            logger.warning(f"Pexels error for '{clean_name}': {e}")
            return None


class AIImageGeneratorProvider(BaseImageProvider):
    name = "ai"

    def search_image(self, product: Product) -> Optional[ImageCandidate]:
        """
        Generate a commercial, studio-lit illustrative product photo tailored to the product's
        name, category, and description on a clean studio background.
        """
        cat_name = product.category.name if product.category else "Product"
        desc_summary = (product.description or "").strip()
        if len(desc_summary) > 100:
            desc_summary = desc_summary[:100]

        # Construct prompt focusing on clean commercial product photography
        prompt_parts = [
            f"studio commercial product photography of {product.name}",
            f"category {cat_name}",
        ]
        if desc_summary:
            prompt_parts.append(desc_summary)
        prompt_parts.extend([
            "crisp clean neutral studio background",
            "commercial catalog lighting",
            "centered",
            "high resolution",
            "professional product shot",
        ])
        prompt = ", ".join(prompt_parts)

        # Encode for Pollinations AI
        encoded_prompt = urllib.parse.quote(prompt)
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=512&nologo=true"

        raw_bytes, fmt, w, h, err = download_and_validate_image(url, timeout=30)
        if not raw_bytes:
            logger.warning(f"AI image generation failed for {product.name}: {err}")
            return None

        return ImageCandidate(
            source_name="AI Illustrative Studio Generator",
            source_url=url,
            license_name="Royalty-Free AI Illustrative Model (Commercial Catalog Use)",
            attribution=f"Representative illustrative image for {product.name} (AI Generated)"[:200],
            image_bytes=raw_bytes,
            format_name=fmt,
            width=w,
            height=h,
            is_illustrative=True,
        )


# ==============================================================================
# Orchestration & Storage
# ==============================================================================

def get_providers(provider_name: str = 'auto', image_dir: Optional[str] = None) -> List[BaseImageProvider]:
    """Return ordered list of providers based on strategy."""
    providers: List[BaseImageProvider] = []

    if image_dir:
        providers.append(LocalDirectoryProvider(image_dir))

    if provider_name == 'local':
        return providers

    if provider_name == 'wikimedia':
        return [WikimediaCommonsProvider()]

    if provider_name == 'unsplash':
        return [UnsplashProvider()]

    if provider_name == 'pexels':
        return [PexelsProvider()]

    if provider_name == 'ai':
        return [AIImageGeneratorProvider()]

    # 'auto' strategy:
    # 1. Local vendor staging directory (if provided)
    # 2. Configured stock APIs (Unsplash / Pexels if API keys exist)
    if os.environ.get('UNSPLASH_ACCESS_KEY'):
        providers.append(UnsplashProvider())
    if os.environ.get('PEXELS_API_KEY'):
        providers.append(PexelsProvider())

    # 3. Wikimedia Commons (licensed open public domain / CC)
    providers.append(WikimediaCommonsProvider())

    # 4. AI Illustrative Generator as reliable fallback
    providers.append(AIImageGeneratorProvider())

    return providers


def product_needs_image(product: Product) -> bool:
    """Check if the product has zero images or all its image files are missing from storage."""
    images = list(product.images.all())
    if not images:
        return True

    for img in images:
        if img.image and default_storage.exists(img.image.name):
            return False

    return True


def save_candidate_to_product(
    product: Product,
    candidate: ImageCandidate,
    dry_run: bool = False
) -> Tuple[bool, str, Optional[ProductImage]]:
    """
    Save an ImageCandidate to a Product as a ProductImage record using Django's
    configured storage, preventing duplicates and ensuring correct primary status.
    """
    if dry_run:
        return True, f"[DRY-RUN] Would save {candidate.source_name} image ({candidate.width}x{candidate.height}, {len(candidate.image_bytes)} bytes) for {product.name}", None

    # Calculate content SHA-256 for duplicate detection
    content_hash = hashlib.sha256(candidate.image_bytes).hexdigest()

    # Determine extension
    ext_map = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp'}
    ext = ext_map.get(candidate.format_name.upper(), 'webp')
    filename = f"{product.slug}_{content_hash[:8]}.{ext}"

    # Check if this exact file is already saved for this product
    for existing in product.images.all():
        if existing.image and os.path.basename(existing.image.name) == filename:
            return False, f"Identical image already associated with {product.name}", existing

    # Set as primary only if product currently has no primary image
    has_primary = product.images.filter(is_primary=True).exists()
    is_primary = not has_primary

    # Create model instance and save image via Django storage
    content_file = ContentFile(candidate.image_bytes, name=filename)
    prod_image = ProductImage(
        product=product,
        alt_text=candidate.attribution,
        is_primary=is_primary,
        sort_order=product.images.count(),
    )
    prod_image.image.save(filename, content_file, save=True)

    return True, f"Successfully associated image from {candidate.source_name} to {product.name} (is_primary={is_primary})", prod_image
