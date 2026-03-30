"""Save optional transfer receipt files under ``backend/uploads/pf_transfers``."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import UploadFile

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
ALLOWED_EXT = {'.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'}
MAX_BYTES = 5 * 1024 * 1024


def save_transfer_attachment(profile_id: int, upload: UploadFile | None) -> str | None:
    if upload is None:
        return None
    fn = (upload.filename or '').strip()
    if not fn:
        return None
    suf = Path(fn).suffix.lower()
    if suf not in ALLOWED_EXT:
        raise ValueError(f'Unsupported file type. Allowed: {", ".join(sorted(ALLOWED_EXT))}')
    raw = upload.file.read()
    if len(raw) > MAX_BYTES:
        raise ValueError('Attachment must be 5 MB or smaller')
    rel_dir = Path('uploads') / 'pf_transfers' / str(int(profile_id))
    dest_dir = BACKEND_ROOT / rel_dir
    dest_dir.mkdir(parents=True, exist_ok=True)
    name = f'{uuid.uuid4().hex}{suf}'
    dest = dest_dir / name
    dest.write_bytes(raw)
    return str(rel_dir / name).replace('\\', '/')
