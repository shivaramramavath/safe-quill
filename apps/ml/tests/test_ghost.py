import os
import sys
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.ghost.preprocess import tokenize_words, clean_and_normalize, strip_email_structural_cruft
from src.ghost.predictor import GhostPredictor

client = TestClient(app)

def test_tokenizer_and_placeholders():
    text = "Contact john.doe@example.com or visit https://safequill.dev regarding #4920 at 555-123-4567."
    cleaned = clean_and_normalize(text)
    assert "<email>" in cleaned
    assert "<url>" in cleaned
    assert "<phone>" in cleaned
    assert "<num>" in cleaned

    tokens = tokenize_words(cleaned)
    assert "<email>" in tokens
    assert "<url>" in tokens

def test_structural_cruft_stripping():
    email = """From: attacker@evil.com
Subject: Test
To: user@example.com

Hello team,

Please see the attached roadmap.

-- 
Best regards,
John Doe
VP of Operations

This email and any attachments are confidential.
"""
    stripped = strip_email_structural_cruft(email)
    assert "From:" not in stripped
    assert "Subject:" not in stripped
    assert "This email and any attachments are confidential" not in stripped
    assert "Please see the attached roadmap." in stripped

def test_predictor_spacing_and_prefix():
    predictor = GhostPredictor()
    assert predictor.load_model() is True

    # 1. Text ending in space should predict full next word with or without leading space
    suggestions_space = predictor.suggest("Please let me ", top_k=3)
    assert isinstance(suggestions_space, list)
    if suggestions_space:
        first = suggestions_space[0]["completion"]
        assert not first.startswith("  ") # No double space
        assert suggestions_space[0]["confidence"] >= 0.20

    # 2. Text ending mid-word (e.g. "regar") should complete the prefix
    suggestions_prefix = predictor.suggest("I am writing to regar", top_k=3)
    if suggestions_prefix:
        first_comp = suggestions_prefix[0]["completion"]
        # Prefix "regar" completed to "ding..."
        assert first_comp.startswith("ding")

def test_blocklist_enforcement():
    predictor = GhostPredictor()
    assert predictor.is_blocked("password") is True
    assert predictor.is_blocked("wire") is True
    assert predictor.is_blocked("otp") is True
    assert predictor.is_blocked("https://evil.com") is True
    assert predictor.is_blocked("12345") is True
    assert predictor.is_blocked("<email>") is True
    assert predictor.is_blocked("meeting") is False

def test_casing_map_application():
    predictor = GhostPredictor()
    # Sentence start capitalization
    cased = predictor.apply_casing("thank", is_sentence_start=True)
    assert cased == "Thank"

    # Match user's typed prefix casing
    cased_prefix = predictor.apply_casing("regarding", match_prefix_casing="Regar")
    assert cased_prefix == "Regarding"

def test_fastapi_suggest_endpoint():
    # Valid context
    res = client.post("/suggest", json={"context": "Please let me know if you ", "top_k": 3})
    assert res.status_code == 200
    data = res.json()
    assert "model" in data
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)

    # Context exceeds 600 chars limit -> Validation error (400/422)
    long_ctx = "word " * 150
    res_long = client.post("/suggest", json={"context": long_ctx, "top_k": 3})
    assert res_long.status_code in (400, 422)
