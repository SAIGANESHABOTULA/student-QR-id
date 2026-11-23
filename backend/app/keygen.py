"""Generate a fresh Ed25519 signing key for the SIGNING_KEY env var.

    python -m app.keygen
"""
from .signing import generate_seed

if __name__ == "__main__":
    print(generate_seed())
