from pydantic import BaseModel, Field


class NonceRequest(BaseModel):
    address: str = Field(..., description="Ethereum address (0x...)")


class NonceResponse(BaseModel):
    address: str
    nonce: str


class VerifyRequest(BaseModel):
    address: str
    nonce: str
    message: str
    signature: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
