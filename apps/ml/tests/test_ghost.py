import os
import sys
import json
import tempfile
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.ghost.preprocess import (
    tokenize_words,
    clean_and_normalize,
    strip_email_structural_cruft,
    apply_placeholders,
    preprocess_dataset,
    PLACEHOLDERS,
)
from src.ghost.predictor import GhostPredictor
from src.ghost.train_ngram import extract_ngrams_and_casing, build_pruned_table

client = TestClient(app)

def test_tokenizer_words_and_placeholders():
    text = "Hello team, email me at test@example.com or visit https://secure.com on 12/05/2026."
    tokens = tokenize_words(apply_placeholders(text))
    assert "<email>" in tokens
    assert "<url>" in tokens
    assert "<num>" in tokens
    assert "Hello" in tokens or "hello" in [t.lower() for t in tokens]
    assert "," in tokens
    assert "." in tokens

def test_preprocess_cleaning_and_placeholders():
    email = """<html><body>
From: alerts@notification.com
Subject: Notice of update
To: user@example.com
Date: Mon, 4 Nov 2026 12:00:00

Hi Alice,

Please check the document at https://portal.safequill.dev/doc/9281.
Call our hotline at 800-555-0199 for account 49201.

> On Sunday, previous admin wrote:
> Previous message here...

Thanks,
Bob Smith

This message and any attachments are confidential.
</body></html>"""
    cleaned = clean_and_normalize(email)
    assert "From:" not in cleaned
    assert "Subject:" not in cleaned
    assert "<html>" not in cleaned
    assert "Previous message here" not in cleaned
    assert "confidential" not in cleaned
    assert "<url>" in cleaned
    assert "<phone>" in cleaned
    assert "<num>" in cleaned
    assert "<name>" in cleaned

def test_ham_only_filtering():
    # Create temporary CSV with mixed spam and ham rows
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8") as f:
        f.write("id,label_num,subject,body\n")
        f.write("1,0,Meeting,Let us schedule the weekly sync for Monday morning.\n")
        f.write("2,1,Urgent,Click http://phishing.xyz to verify your bank password immediately.\n")
        f.write("3,0,Project,The sprint review has been completed successfully.\n")
        f.write("4,1,Win,You won one million dollars call now.\n")
        temp_csv = f.name

    with tempfile.TemporaryDirectory() as temp_dir:
        report = preprocess_dataset(
            csv_path=temp_csv,
            splits_dir=temp_dir,
            train_ratio=0.5,
            seed=42,
        )
        assert report["rows_read"] == 4
        assert report["rows_kept"] == 2
        assert report["dropped_reasons"]["spam_or_phishing"] == 2

    os.remove(temp_csv)

def test_split_by_email_no_leakage():
    # Verify no email id appears in both train and test sets
    from src.core.config import MODELS_DIR
    splits_dir = Path(MODELS_DIR) / "ghost" / "splits"
    train_file = splits_dir / "train.jsonl"
    test_file = splits_dir / "test.jsonl"

    assert train_file.exists()
    assert test_file.exists()

    train_ids = set()
    with open(train_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                train_ids.add(json.loads(line)["id"])

    test_ids = set()
    with open(test_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                test_ids.add(json.loads(line)["id"])

    # Strict assertion: ZERO leakage between train and test
    overlap = train_ids.intersection(test_ids)
    assert len(overlap) == 0, f"Leakage detected between train and test: {overlap}"
    assert len(train_ids) > 0
    assert len(test_ids) > 0

def test_prefix_and_mid_word_handling():
    predictor = GhostPredictor()
    assert predictor.load_model() is True

    # 1. Text ending in space predicts next word
    res_space = predictor.suggest("Please let me ", top_k=3)
    assert isinstance(res_space, list)
    if res_space:
        first = res_space[0]["completion"]
        assert not first.startswith("  ")  # No double space
        assert res_space[0]["confidence"] >= 0.20

    # 2. Text ending in mid-word prefix completes only untyped part
    res_prefix = predictor.suggest("I am writing to regar", top_k=3)
    if res_prefix:
        first_comp = res_prefix[0]["completion"]
        assert first_comp.startswith("ding")  # "regar" -> "ding..."

def test_spacing_and_casing():
    predictor = GhostPredictor()
    assert predictor.load_model() is True

    # Check sentence start casing
    cased_start = predictor.apply_casing("thank", is_sentence_start=True)
    assert cased_start == "Thank"

    # Match user's typed prefix casing
    cased_prefix = predictor.apply_casing("regarding", match_prefix_casing="Regar")
    assert cased_prefix == "Regarding"

def test_blocklist_enforcement():
    predictor = GhostPredictor()
    assert predictor.is_blocked("password") is True
    assert predictor.is_blocked("wire") is True
    assert predictor.is_blocked("otp") is True
    assert predictor.is_blocked("pin") is True
    assert predictor.is_blocked("cvv") is True
    assert predictor.is_blocked("bank") is True
    assert predictor.is_blocked("gift card") is True
    assert predictor.is_blocked("https://secure.com") is True
    assert predictor.is_blocked("98765") is True
    assert predictor.is_blocked("<email>") is True
    assert predictor.is_blocked("<url>") is True
    assert predictor.is_blocked("update") is False
    assert predictor.is_blocked("meeting") is False

def test_confidence_threshold():
    predictor = GhostPredictor()
    # Any returned suggestions must clear the threshold >= 0.20
    suggestions = predictor.suggest("Hello there ", top_k=5)
    for s in suggestions:
        assert s["confidence"] >= predictor.confidence_threshold
        assert s["confidence"] >= 0.20

def test_json_model_round_trip():
    texts = [
        "Please let me know if you have questions.",
        "Thank you for reaching out to us today.",
        "We are pleased to inform you about the update.",
    ]
    tri, bi, uni, case, _ = extract_ngrams_and_casing(texts, weight=1)
    table = build_pruned_table(tri, bi, uni, min_count=1, top_k_per_context=6)

    payload = {
        "version": "test-v1",
        "N": 3,
        "own_table": table,
        "base_table": {"trigrams": {}, "bigrams": {}, "unigrams": []},
        "casing_map": {"thank": "Thank"},
        "alpha": 0.4,
    }

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(payload, f)
        temp_model = f.name

    predictor = GhostPredictor(model_path=temp_model)
    assert predictor.load_model() is True
    assert predictor.version == "test-v1"
    assert "thank" in predictor.casing_map
    assert predictor.casing_map["thank"] == "Thank"

    os.remove(temp_model)

def test_fastapi_suggest_endpoint_cases():
    # 1. Valid input
    res = client.post("/suggest", json={"context": "Please let me know if you ", "top_k": 3})
    assert res.status_code == 200
    data = res.json()
    assert "model" in data
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)

    # 2. Too-long input (>600 chars) -> 400
    long_ctx = "a " * 301
    res_long = client.post("/suggest", json={"context": long_ctx, "top_k": 3})
    assert res_long.status_code in (400, 422)

    # 3. Empty input -> returns 200 with empty suggestions
    res_empty = client.post("/suggest", json={"context": "", "top_k": 3})
    assert res_empty.status_code == 200
    assert res_empty.json()["suggestions"] == []
