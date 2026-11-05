"""
Trigram N-Gram Trainer with Stupid Backoff and Casing Map
Builds 'own' and 'base' prediction tables.
Saves strictly as JSON with content hash (NO pickle).
"""

import os
import json
import hashlib
from datetime import datetime, timezone
from collections import defaultdict, Counter
from typing import List, Dict, Tuple, Any

try:
    from .preprocess import (
        load_legitimate_corpus,
        preprocess_and_split,
        tokenize_words,
        PLACEHOLDERS,
    )
except ImportError:
    try:
        from preprocess import (
            load_legitimate_corpus,
            preprocess_and_split,
            tokenize_words,
            PLACEHOLDERS,
        )
    except ImportError:
        from ghost.preprocess import (
            load_legitimate_corpus,
            preprocess_and_split,
            tokenize_words,
            PLACEHOLDERS,
        )

MODEL_VERSION = "ghost-ngram-v1.0.0"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
MODEL_FILE = os.path.join(OUTPUT_DIR, "ngram_model.json")

def extract_ngrams_and_casing(
    email_texts: List[str],
    weight: int = 1,
) -> Tuple[Dict[str, Counter], Dict[str, Counter], Counter, Dict[str, Counter]]:
    """
    Extracts trigrams, bigrams, unigrams, and token casing frequencies.
    """
    trigram_counts: Dict[str, Counter] = defaultdict(Counter)
    bigram_counts: Dict[str, Counter] = defaultdict(Counter)
    unigram_counts: Counter = Counter()
    casing_counts: Dict[str, Counter] = defaultdict(Counter)

    for text in email_texts:
        tokens = tokenize_words(text)
        if not tokens:
            continue

        for i, token in enumerate(tokens):
            lower_token = token.lower()

            # Record casing frequency
            casing_counts[lower_token][token] += weight

            # Never record placeholders as prediction targets
            if lower_token in PLACEHOLDERS:
                continue

            unigram_counts[lower_token] += weight

            # Bigram: w_{i-1} -> w_i
            if i >= 1:
                prev1 = tokens[i - 1].lower()
                bigram_counts[prev1][lower_token] += weight

            # Trigram: w_{i-2} w_{i-1} -> w_i
            if i >= 2:
                prev2 = f"{tokens[i - 2].lower()} {tokens[i - 1].lower()}"
                trigram_counts[prev2][lower_token] += weight

    return trigram_counts, bigram_counts, unigram_counts, casing_counts

def build_pruned_table(
    trigram_counts: Dict[str, Counter],
    bigram_counts: Dict[str, Counter],
    unigram_counts: Counter,
    min_count: int = 2,
    top_k_per_context: int = 6,
) -> Dict[str, Any]:
    """
    Prunes low-count predictions and keeps top_k candidates with normalized probabilities.
    """
    pruned_trigrams: Dict[str, List[Tuple[str, float]]] = {}
    for ctx, counter in trigram_counts.items():
        filtered = [(w, c) for w, c in counter.items() if c >= min_count]
        if not filtered:
            continue
        total = sum(c for _, c in filtered)
        top = sorted(filtered, key=lambda x: x[1], reverse=True)[:top_k_per_context]
        pruned_trigrams[ctx] = [[w, round(c / total, 4)] for w, c in top]

    pruned_bigrams: Dict[str, List[Tuple[str, float]]] = {}
    for ctx, counter in bigram_counts.items():
        filtered = [(w, c) for w, c in counter.items() if c >= min_count]
        if not filtered:
            continue
        total = sum(c for _, c in filtered)
        top = sorted(filtered, key=lambda x: x[1], reverse=True)[:top_k_per_context]
        pruned_bigrams[ctx] = [[w, round(c / total, 4)] for w, c in top]

    # Top unigrams
    total_uni = sum(unigram_counts.values()) or 1
    top_uni = [
        [w, round(c / total_uni, 6)]
        for w, c in unigram_counts.most_common(50)
        if c >= min_count
    ]

    return {
        "trigrams": pruned_trigrams,
        "bigrams": pruned_bigrams,
        "unigrams": top_uni,
    }

def train_and_save_model(
    env_corpus_path: str = None,
    enron_csv_path: str = None,
    output_path: str = MODEL_FILE,
) -> Dict[str, Any]:
    print("=== Training Ghost Text Trigram Engine ===")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    own_raw, base_raw = load_legitimate_corpus(env_corpus_path, enron_csv_path)
    print(f"Loaded {len(own_raw)} 'own' legitimate emails, {len(base_raw)} 'base' legitimate emails.")

    own_train, own_test = preprocess_and_split(own_raw, train_ratio=0.9, seed=42)
    base_train, base_test = preprocess_and_split(base_raw, train_ratio=0.9, seed=42)

    print(f"Training on {len(own_train)} own emails (weight x3) and {len(base_train)} base emails.")

    # 1. Train Own Table (count weight x3)
    o_tri, o_bi, o_uni, o_case = extract_ngrams_and_casing(own_train, weight=3)
    own_table = build_pruned_table(o_tri, o_bi, o_uni, min_count=2, top_k_per_context=6)

    # 2. Train Base Table
    b_tri, b_bi, b_uni, b_case = extract_ngrams_and_casing(base_train, weight=1)
    base_table = build_pruned_table(b_tri, b_bi, b_uni, min_count=2, top_k_per_context=6)

    # 3. Build Unified Casing Map
    casing_map: Dict[str, str] = {}
    all_cased = {**b_case}
    for k, v in o_case.items():
        all_cased[k] = all_cased.get(k, Counter()) + v

    for lower_token, counter in all_cased.items():
        most_common_cased = counter.most_common(1)[0][0]
        # Keep casing if it differs from pure lowercase (e.g. "I", "SafeQuill", "Monday")
        if most_common_cased != lower_token:
            casing_map[lower_token] = most_common_cased

    # 4. Construct Payload and Hash
    payload = {
        "version": MODEL_VERSION,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": "Trigram with Stupid Backoff (alpha=0.4)",
        "min_count": 2,
        "top_k_per_context": 6,
        "alpha": 0.4,
        "own_table": own_table,
        "base_table": base_table,
        "casing_map": casing_map,
    }

    serialized = json.dumps(payload, sort_keys=True)
    content_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    payload["content_hash"] = content_hash

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Model saved to: {output_path} (SHA-256: {content_hash[:12]}...)")
    print(f"Contexts learned: {len(own_table['trigrams'])} own trigrams, {len(base_table['trigrams'])} base trigrams.")

    # Save test sets for evaluation
    eval_dir = os.path.join(os.path.dirname(output_path), "eval_data")
    os.makedirs(eval_dir, exist_ok=True)
    with open(os.path.join(eval_dir, "test_emails.json"), "w", encoding="utf-8") as f:
        json.dump({"own_test": own_test, "base_test": base_test}, f)

    return payload

if __name__ == "__main__":
    train_and_save_model()
