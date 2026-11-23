"""Ed25519 credential signing.

Token format (the text stored inside the QR code):

    SID1.<base64url(payload_json)>.<base64url(signature)>

The signature covers the exact payload bytes, so a verifier never has to
re-serialise JSON in the same key order as the signer did.
"""
import base64
import hashlib
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from .config import get_settings

PREFIX = "SID1"
log = logging.getLogger(__name__)
_DEV_KEY_FILE = Path(__file__).resolve().parent.parent / ".keys" / "signing.key"


def b64u_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def b64u_decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def generate_seed() -> str:
    key = Ed25519PrivateKey.generate()
    raw = key.private_bytes(
        serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption()
    )
    return b64u_encode(raw)


class TokenError(ValueError):
    def __init__(self, kind: str):
        super().__init__(kind)
        self.kind = kind  # "malformed" | "tampered"


@dataclass(frozen=True)
class Signer:
    private_key: Ed25519PrivateKey

    @property
    def public_key(self) -> Ed25519PublicKey:
        return self.private_key.public_key()

    @property
    def public_raw(self) -> bytes:
        return self.public_key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)

    @property
    def kid(self) -> str:
        return hashlib.sha256(self.public_raw).hexdigest()[:8]

    def sign(self, claims: dict) -> str:
        body = {**claims, "kid": self.kid, "iat": int(time.time())}
        payload = json.dumps(body, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode()
        sig = self.private_key.sign(payload)
        return f"{PREFIX}.{b64u_encode(payload)}.{b64u_encode(sig)}"

    def verify(self, token: str) -> dict:
        """Return the claims if the signature is good, otherwise raise TokenError."""
        parts = token.strip().split(".")
        if len(parts) != 3 or parts[0] != PREFIX:
            raise TokenError("malformed")
        try:
            payload, sig = b64u_decode(parts[1]), b64u_decode(parts[2])
        except Exception as exc:  # noqa: BLE001
            raise TokenError("malformed") from exc
        try:
            self.public_key.verify(sig, payload)
        except InvalidSignature as exc:
            raise TokenError("tampered") from exc
        try:
            claims = json.loads(payload)
        except ValueError as exc:
            raise TokenError("malformed") from exc
        if not isinstance(claims, dict):
            raise TokenError("malformed")
        return claims


def _load_seed() -> bytes:
    configured = get_settings().signing_key.strip()
    if configured:
        return b64u_decode(configured)
    # Local development convenience: persist a generated key outside git.
    if _DEV_KEY_FILE.exists():
        return b64u_decode(_DEV_KEY_FILE.read_text().strip())
    log.warning("SIGNING_KEY not set - generating a development key at %s", _DEV_KEY_FILE)
    _DEV_KEY_FILE.parent.mkdir(exist_ok=True)
    seed = generate_seed()
    _DEV_KEY_FILE.write_text(seed)
    return b64u_decode(seed)


_signer: Signer | None = None


def get_signer() -> Signer:
    global _signer
    if _signer is None:
        _signer = Signer(Ed25519PrivateKey.from_private_bytes(_load_seed()))
    return _signer
