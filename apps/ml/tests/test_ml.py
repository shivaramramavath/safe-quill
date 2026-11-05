import os
import sys
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.spam.classifier import classifier_instance

client = TestClient(app)

def test_health_endpoint():
    for path in ["/health", "/api/health", "/api/v1/health"]:
        response = client.get(path)
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

def test_ml_metrics_endpoint():
    response = client.get("/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "accuracy" in data
    assert "precision" in data
    assert "recall" in data
    assert "confusionMatrix" in data
    assert data["accuracy"] > 0.90
    assert data["activeModelVersion"] == "v1.0.0"

def test_ml_models_and_rollback():
    response = client.get("/models")
    assert response.status_code == 200
    data = response.json()
    assert "v1.0.0" in data["available_versions"]

    # Test rollback to existing version
    rollback_res = client.post("/models/rollback", json={"version": "v1.0.0"})
    assert rollback_res.status_code == 200
    assert rollback_res.json()["success"] is True

    # Test rollback to non-existent version returns 400
    err_res = client.post("/models/rollback", json={"version": "v999.0.0"})
    assert err_res.status_code == 400
