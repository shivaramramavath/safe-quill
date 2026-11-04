import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src'))

import pytest
from fastapi.testclient import TestClient

from main import app
from classifier import classifier_instance

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "version" in data

def test_predict_spam_sample():
    payload = {
        "text": "URGENT: Your bank account has been suspended due to suspicious activity. Verify immediately at http://secure-login.xyz"
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["label"] == "spam"
    assert data["score"] >= 50
    assert len(data["top_tokens"]) > 0
    # Verify that suspicious tokens like "urgent" or "account" or "suspended" are present
    tokens = [t["token"] for t in data["top_tokens"]]
    assert any("urgent" in t or "account" in t or "suspended" in t for t in tokens)

def test_predict_ham_sample():
    payload = {
        "text": "Hey team, please find attached the meeting minutes and action items from today's sprint planning."
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["label"] == "ham"
    assert data["score"] < 50
    assert data["level"] == "LOW"

def test_empty_text():
    response = client.post("/predict", json={"text": ""})
    assert response.status_code == 200
    data = response.json()
    assert data["score"] == 0
    assert data["label"] == "ham"
