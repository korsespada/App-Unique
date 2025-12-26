import argparse
import io
import os
import sys
import time
from typing import Iterable, Tuple
from urllib.parse import urlparse

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image
from PIL import ImageFile

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; YeezyThumbs/1.0)",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}


def _require_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing env var: {name}")
    return v


def _parse_size(size: str) -> Tuple[int, int]:
    s = size.strip().lower().replace("×", "x")
    if "x" not in s:
        raise ValueError(f"Invalid size '{size}', expected like 400x500")
    w_str, h_str = s.split("x", 1)
    w = int(w_str)
    h = int(h_str)
    if w <= 0 or h <= 0:
        raise ValueError(f"Invalid size '{size}', expected positive ints")
    return w, h


def _cover_resize_center_crop(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    img = img.convert("RGB")
    w, h = img.size
    scale = max(target_w / w, target_h / h)
    new_w = max(target_w, int(round(w * scale)))
    new_h = max(target_h, int(round(h * scale)))
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    left = max(0, (new_w - target_w) // 2)
    top = max(0, (new_h - target_h) // 2)
    right = left + target_w
    bottom = top + target_h
    return resized.crop((left, top, right, bottom))


def _is_vkcloud_object_url(url: str, endpoint: str, bucket: str) -> bool:
    try:
        u = urlparse(url)
    except Exception:
        return False

    ep = urlparse(endpoint)
    if (u.scheme, u.netloc) != (ep.scheme, ep.netloc):
        return False

    return u.path.startswith(f"/{bucket}/")


def _vkcloud_key_from_url(url: str, bucket: str) -> str:
    u = urlparse(url)
    if not u.path.startswith(f"/{bucket}/"):
        raise ValueError("URL path does not match bucket")
    return u.path[len(f"/{bucket}/") :].lstrip("/")


def _s3_get_object_bytes(s3, bucket: str, key: str) -> bytes:
    obj = s3.get_object(Bucket=bucket, Key=key)
    body = obj.get("Body")
    if not body:
        return b""
    return body.read()


def _try_s3_get_first_photo_by_template(s3, bucket: str, product_id: str) -> tuple[str, bytes] | None:
    product_id = str(product_id).strip()
    if not product_id:
        return None

    candidates = [
        f"products/{product_id}/0.jpg",
        f"products/{product_id}/0.jpeg",
        f"products/{product_id}/0.png",
        f"products/{product_id}/0.webp",
    ]

    for key in candidates:
        try:
            content = _s3_get_object_bytes(s3, bucket, key)
            if content:
                return key, content
        except ClientError as e:
            code = str(e.response.get("Error", {}).get("Code", ""))
            if code in {"NoSuchKey", "404", "NotFound"}:
                continue
            raise

    return None


def _s3_list_product_ids(orig_s3, bucket: str, prefix: str = "products/") -> list[str]:
    product_ids: list[str] = []

    token: str | None = None
    while True:
        kwargs = {
            "Bucket": bucket,
            "Prefix": prefix,
            "Delimiter": "/",
            "MaxKeys": 1000,
        }
        if token:
            kwargs["ContinuationToken"] = token

        resp = orig_s3.list_objects_v2(**kwargs)
        for cp in resp.get("CommonPrefixes") or []:
            p = str(cp.get("Prefix") or "")
            if not p.startswith(prefix):
                continue
            rest = p[len(prefix) :].strip("/")
            if rest:
                product_ids.append(rest)

        if resp.get("IsTruncated"):
            token = resp.get("NextContinuationToken")
            if not token:
                break
        else:
            break

    # уникализируем, на всякий
    return list(dict.fromkeys(product_ids))


def _pb_iter_products(pb_url: str, pb_token: str, collection: str, photos_field: str, per_page: int, brand_id: str = "", category_id: str = "") -> Iterable[tuple[str, list[str]]]:
    s = requests.Session()
    s.headers.update({"Authorization": pb_token, "Content-Type": "application/json"})

    page = 1
    while True:
        fields = ["id", photos_field]
        if brand_id:
            fields.append("brand")
        if category_id:
            fields.append("category")
        url = (
            f"{pb_url.rstrip('/')}/api/collections/{collection}/records"
            f"?page={page}&perPage={per_page}&fields={','.join(fields)}"
        )
        filters = []
        if brand_id:
            filters.append(f"(brand='{brand_id}')")
        if category_id:
            filters.append(f"(category='{category_id}')")
        if filters:
            url += f"&filter={' && '.join(filters)}"
        r = s.get(url, timeout=30)
        r.raise_for_status()
        data = r.json()
        items = data.get("items", [])
        if not items:
            return

        for rec in items:
            rec_id = str(rec.get("id") or "").strip()
            photos = rec.get(photos_field) or []
            if not rec_id or not isinstance(photos, list):
                continue
            photos = [str(x) for x in photos if isinstance(x, str) and x.strip()]
            yield rec_id, photos

        page += 1


def _try_download_first_photo_by_template(
    endpoint: str, bucket: str, product_id: str
) -> tuple[str, bytes, str] | None:
    product_id = str(product_id).strip()
    if not product_id:
        return None

    base = endpoint.rstrip("/")
    candidates = [
        f"{base}/{bucket}/products/{product_id}/0.jpg",
        f"{base}/{bucket}/products/{product_id}/0.jpeg",
        f"{base}/{bucket}/products/{product_id}/0.png",
        f"{base}/{bucket}/products/{product_id}/0.webp",
    ]

    for url in candidates:
        try:
            r = requests.get(url, timeout=45, headers=DEFAULT_HEADERS)
            if r.status_code == 404:
                continue
            r.raise_for_status()
            content_type = str(r.headers.get("Content-Type") or "").lower()

            # иногда вместо картинки возвращается html/xml (access denied, ошибки бакета и т.п.)
            if content_type and not content_type.startswith("image/"):
                continue

            return url, r.content, content_type
        except Exception:
            continue

    return None


def _s3_head_exists(s3, bucket: str, key: str) -> bool:
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        code = str(e.response.get("Error", {}).get("Code", ""))
        if code in {"404", "NoSuchKey", "NotFound"}:
            return False
        raise


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--thumb", default="400x500")
    parser.add_argument("--collection", default="products")
    parser.add_argument("--photos-field", default="photos")
    parser.add_argument("--pb-per-page", type=int, default=200)
    parser.add_argument("--only-first", action="store_true")
    parser.add_argument("--product-id", default="")
    parser.add_argument("--max-products", type=int, default=0)
    parser.add_argument("--no-pb", action="store_true")
    parser.add_argument("--from-s3-list", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.0)
    parser.add_argument("--brand-id", default="")
    parser.add_argument("--category-id", default="")
    args = parser.parse_args()

    s3_endpoint = _require_env("S3_ENDPOINT")
    orig_bucket = _require_env("S3_ORIG_BUCKET")
    thumbs_bucket = _require_env("S3_THUMBS_BUCKET")
    orig_access_key = _require_env("S3_ORIG_ACCESS_KEY")
    orig_secret_key = _require_env("S3_ORIG_SECRET_KEY")
    thumbs_access_key = _require_env("S3_THUMBS_ACCESS_KEY")
    thumbs_secret_key = _require_env("S3_THUMBS_SECRET_KEY")

    pb_url = os.getenv("PB_URL")
    pb_token = os.getenv("PB_TOKEN")
    if not args.no_pb and (not pb_url or not pb_token):
        raise RuntimeError("PB_URL/PB_TOKEN are required in env (or pass --no-pb)")

    tw, th = _parse_size(args.thumb)

    # иногда CDN отдает обрезанные/частично скачанные jpg, Pillow может ругаться
    ImageFile.LOAD_TRUNCATED_IMAGES = True

    s3_cfg = Config(signature_version="s3v4", s3={"addressing_style": "path"})

    orig_s3 = boto3.client(
        "s3",
        endpoint_url=s3_endpoint,
        aws_access_key_id=orig_access_key,
        aws_secret_access_key=orig_secret_key,
        config=s3_cfg,
    )

    thumbs_s3 = boto3.client(
        "s3",
        endpoint_url=s3_endpoint,
        aws_access_key_id=thumbs_access_key,
        aws_secret_access_key=thumbs_secret_key,
        config=s3_cfg,
    )

    total = 0
    uploaded = 0
    skipped = 0
    errors = 0

    product_id_filter = str(args.product_id or "").strip()
    max_products = int(args.max_products or 0)
    processed_products = 0

    if args.from_s3_list:
        if not args.only_first:
            raise RuntimeError("--from-s3-list supports only --only-first (первые фото)")

        product_ids = _s3_list_product_ids(orig_s3, orig_bucket, prefix="products/")
        if product_id_filter:
            product_ids = [pid for pid in product_ids if pid == product_id_filter]

        if max_products > 0:
            product_ids = product_ids[:max_products]

        for pid in product_ids:
            processed_products += 1

            dl = _try_s3_get_first_photo_by_template(orig_s3, orig_bucket, pid)
            if not dl:
                continue

            orig_key, content = dl
            thumb_key = f"{args.thumb}/{orig_key}"
            total += 1

            try:
                if _s3_head_exists(thumbs_s3, thumbs_bucket, thumb_key):
                    skipped += 1
                    continue

                img = Image.open(io.BytesIO(content))
                img.load()
                thumb_img = _cover_resize_center_crop(img, tw, th)
                out = io.BytesIO()
                thumb_img.save(out, format="JPEG", quality=78, optimize=True, progressive=True)
                body = out.getvalue()

                thumbs_s3.put_object(
                    Bucket=thumbs_bucket,
                    Key=thumb_key,
                    Body=body,
                    ContentType="image/jpeg",
                    CacheControl="public, max-age=31536000, immutable",
                )

                uploaded += 1
                if uploaded % 50 == 0:
                    print(
                        f"progress products={processed_products} total={total} uploaded={uploaded} skipped={skipped} errors={errors}"
                    )
                if args.sleep > 0:
                    time.sleep(args.sleep)
            except Exception:
                errors += 1

        print(f"total_candidates={total} uploaded={uploaded} skipped={skipped} errors={errors}")
        return 0 if errors == 0 else 2

    if args.no_pb and product_id_filter:
        if not args.only_first:
            raise RuntimeError("--no-pb currently supports only --only-first")

        dl = _try_s3_get_first_photo_by_template(orig_s3, orig_bucket, product_id_filter)
        if not dl:
            raise RuntimeError("Could not read first photo from S3 for this product")

        orig_key, content = dl
        thumb_key = f"{args.thumb}/{orig_key}"
        total = 1

        try:
            img = Image.open(io.BytesIO(content))
            img.load()
        except Exception as e:
            head = content[:200]
            raise RuntimeError(
                f"S3 object is not a readable image. key={orig_key} bytes={len(content)} head={head!r} err={e}"
            )
        thumb_img = _cover_resize_center_crop(img, tw, th)
        out = io.BytesIO()
        thumb_img.save(out, format="JPEG", quality=78, optimize=True, progressive=True)
        body = out.getvalue()

        thumbs_s3.put_object(
            Bucket=thumbs_bucket,
            Key=thumb_key,
            Body=body,
            ContentType="image/jpeg",
            CacheControl="public, max-age=31536000, immutable",
        )
        uploaded = 1
        print(f"uploaded {thumb_key}")
        print(f"total_candidates={total} uploaded={uploaded} skipped={skipped} errors={errors}")
        return 0

    for rec_id, photos in _pb_iter_products(
        pb_url=pb_url or "",
        pb_token=pb_token or "",
        collection=args.collection,
        photos_field=args.photos_field,
        per_page=max(1, min(500, args.pb_per_page)),
        brand_id=args.brand_id,
        category_id=args.category_id,
    ):
        if product_id_filter and str(rec_id) != product_id_filter:
            continue

        processed_products += 1
        if max_products > 0 and processed_products > max_products:
            break

        for idx, url in enumerate(photos):
            if args.only_first and idx != 0:
                continue

            if not _is_vkcloud_object_url(url, s3_endpoint, orig_bucket):
                continue

            try:
                orig_key = _vkcloud_key_from_url(url, orig_bucket)
            except Exception:
                errors += 1
                continue

            thumb_key = f"{args.thumb}/{orig_key}"

            total += 1

            try:
                if _s3_head_exists(thumbs_s3, thumbs_bucket, thumb_key):
                    skipped += 1
                    continue

                original = _s3_get_object_bytes(orig_s3, orig_bucket, orig_key)
                if not original:
                    errors += 1
                    continue

                img = Image.open(io.BytesIO(original))
                thumb_img = _cover_resize_center_crop(img, tw, th)

                out = io.BytesIO()
                thumb_img.save(out, format="JPEG", quality=78, optimize=True, progressive=True)
                body = out.getvalue()

                thumbs_s3.put_object(
                    Bucket=thumbs_bucket,
                    Key=thumb_key,
                    Body=body,
                    ContentType="image/jpeg",
                    CacheControl="public, max-age=31536000, immutable",
                )

                uploaded += 1
                if uploaded % 50 == 0:
                    print(
                        f"progress products={processed_products} total={total} uploaded={uploaded} skipped={skipped} errors={errors}"
                    )
                if args.sleep > 0:
                    time.sleep(args.sleep)
            except Exception:
                errors += 1

    print(f"total_candidates={total} uploaded={uploaded} skipped={skipped} errors={errors}")
    return 0 if errors == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
