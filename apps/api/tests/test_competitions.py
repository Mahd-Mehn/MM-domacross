import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_competitions():
    response = client.get("/api/v1/competitions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_create_competition():
    response = client.post("/api/v1/competitions", json={
        "contract_address": "0x123",
        "chain_id": 1,
        "name": "Test Comp",
        "start_time": "2025-09-03T00:00:00Z",
        "end_time": "2025-09-10T00:00:00Z"
    })
    assert response.status_code == 200
