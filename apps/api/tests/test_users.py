import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_user():
    response = client.post("/api/v1/users", json={"wallet_address": "0x123", "username": "testuser"})
    assert response.status_code == 200
    data = response.json()
    assert data["wallet_address"] == "0x123"
    assert data["username"] == "testuser"

def test_get_user():
    # First create user
    client.post("/api/v1/users", json={"wallet_address": "0x456", "username": "testuser2"})
    response = client.get("/api/v1/users/0x456")
    assert response.status_code == 200
    data = response.json()
    assert data["wallet_address"] == "0x456"
