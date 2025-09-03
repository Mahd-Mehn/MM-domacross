import base64
from typing import Tuple


def decode_b64_pem(b64_data: str) -> str:
    """Decode base64-encoded PEM content to a UTF-8 string."""
    return base64.b64decode(b64_data.encode("utf-8")).decode("utf-8")


def load_keys_from_b64(private_b64: str, public_b64: str) -> Tuple[str, str]:
    """Return PEM strings for private/public keys decoded from base64."""
    priv_pem = decode_b64_pem(private_b64)
    pub_pem = decode_b64_pem(public_b64)
    return priv_pem, pub_pem
