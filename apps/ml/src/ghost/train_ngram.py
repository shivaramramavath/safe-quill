"""
Trigram N-Gram Trainer with Stupid Backoff and Casing Map
Builds 'own' and optional 'base' prediction tables.
Saves strictly as JSON with content hash (NO pickle).
"""

import os
import sys
import json
import hashlib
import argparse
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict, Counter
from typing import List, Dict, Tuple, Any, Optional

try:
    from src.core.config import EMAIL_DATASET_PATH, GHOST_MODELS_DIR
    DEFAULT_DATA_PATH = str(EMAIL_DATASET_PATH)
    DEFAULT_OUT_DIR = str(GHOST_MODELS_DIR)
except ImportError:
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    DEFAULT_DATA_PATH = str(BASE_DIR / "src" / "data" / "email_dataset.csv")
    DEFAULT_OUT_DIR = str(BASE_DIR / "models" / "ghost")

try:
    from src.ghost.preprocess import (
        tokenize_words,
        preprocess_dataset,
        PLACEHOLDERS,
    )
except ImportError:
    from ghost.preprocess import (
        tokenize_words,
        preprocess_dataset,
        PLACEHOLDERS,
    )

MODEL_VERSION = "v1.0.0"

def extract_ngrams_and_casing(
    email_texts: List[str],
    weight: int = 1,
) -> Tuple[Dict[str, Counter], Dict[str, Counter], Counter, Dict[str, Counter], int]:
    """
    Extracts trigrams, bigrams, unigrams, token casing frequencies, and total token count.
    """
    trigram_counts: Dict[str, Counter] = defaultdict(Counter)
    bigram_counts: Dict[str, Counter] = defaultdict(Counter)
    unigram_counts: Counter = Counter()
    casing_counts: Dict[str, Counter] = defaultdict(Counter)
    total_tokens = 0

    for text in email_texts:
        tokens = tokenize_words(text)
        if not tokens:
            continue

        total_tokens += len(tokens)

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

    return trigram_counts, bigram_counts, unigram_counts, casing_counts, total_tokens

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

def train_ngram_model(
    data_path: str = DEFAULT_DATA_PATH,
    out_dir: str = DEFAULT_OUT_DIR,
    base_corpus_path: Optional[str] = None,
    version: str = MODEL_VERSION,
) -> Dict[str, Any]:
    print("\n" + "="*50)
    print(f" TRAINING GHOST TEXT N-GRAM MODEL ({version})")
    print("="*50)

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    splits_dir = out_path / "splits"

    train_jsonl = splits_dir / "train.jsonl"
    test_jsonl = splits_dir / "test.jsonl"

    if not train_jsonl.exists() or not test_jsonl.exists():
        print(f"Splits not found at {splits_dir}. Preprocessing dataset from {data_path}...")
        report = preprocess_dataset(
            csv_path=data_path,
            splits_dir=str(splits_dir),
            train_ratio=0.9,
            seed=42,
        )
        print(f"Preprocessed {report['rows_read']} rows into {report['train_rows']} train and {report['test_rows']} test emails.")

    # Read train records
    own_train_texts: List[str] = []
    with open(train_jsonl, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                record = json.loads(line)
                own_train_texts.append(record["text"])

    print(f"Loaded {len(own_train_texts)} training emails from {train_jsonl}.")

    # 1. Train Own Table (count weight x3)
    o_tri, o_bi, o_uni, o_case, own_tokens = extract_ngrams_and_casing(own_train_texts, weight=3)
    own_table = build_pruned_table(o_tri, o_bi, o_uni, min_count=2, top_k_per_context=6)

    total_corpus_tokens = own_tokens
    print(f"Total tokens in own training corpus: {own_tokens:,}")
    if total_corpus_tokens < 1_000_000:
        print(f"Note: Corpus is under ~1M tokens ({total_corpus_tokens:,} tokens).")

    # 2. Optional Base Table
    base_corpus = base_corpus_path or os.environ.get("BASE_CORPUS_PATH")
    base_table: Dict[str, Any] = {"trigrams": {}, "bigrams": {}, "unigrams": []}
    b_case: Dict[str, Counter] = defaultdict(Counter)

    if base_corpus and os.path.exists(base_corpus):
        print(f"Loading optional base corpus from {base_corpus}...")
        base_train_texts: List[str] = []
        with open(base_corpus, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if line.strip():
                    base_train_texts.append(line.strip())
        b_tri, b_bi, b_uni, b_case, b_tokens = extract_ngrams_and_casing(base_train_texts, weight=1)
        base_table = build_pruned_table(b_tri, b_bi, b_uni, min_count=2, top_k_per_context=6)
        total_corpus_tokens += b_tokens
        print(f"Base corpus added {b_tokens:,} tokens. Total corpus tokens: {total_corpus_tokens:,}")
    else:
        print("No secondary base corpus configured (using pure own dataset).")

    # 3. Build Unified Casing Map
    casing_map: Dict[str, str] = {}
    all_cased = {**b_case}
    for k, v in o_case.items():
        all_cased[k] = all_cased.get(k, Counter()) + v

    for lower_token, counter in all_cased.items():
        most_common_cased = counter.most_common(1)[0][0]
        if most_common_cased != lower_token:
            casing_map[lower_token] = most_common_cased

    # 4. Construct Payload and Hash
    payload = {
        "version": version,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "N": 3,
        "algorithm": "Trigram with Stupid Backoff (alpha=0.4)",
        "min_count": 2,
        "top_k_per_context": 6,
        "alpha": 0.4,
        "corpus_tokens": total_corpus_tokens,
        "own_table": own_table,
        "base_table": base_table,
        "casing_map": casing_map,
    }

    serialized = json.dumps(payload, sort_keys=True)
    content_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    payload["content_hash"] = content_hash

    # Save to versioned path: ngram-<version>.json
    versioned_file = out_path / f"ngram-{version}.json"
    with open(versioned_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    # Save pointer: latest.json
    latest_file = out_path / "latest.json"
    with open(latest_file, "w", encoding="utf-8") as f:
        json.dump({
            "active_version": version,
            "model_file": f"ngram-{version}.json",
            "model_path": str(versioned_file),
            "content_hash": content_hash,
            "created_at": payload["created_at"],
        }, f, indent=2)

    # Save backwards-compatible ngram_model.json
    compat_file = out_path / "ngram_model.json"
    with open(compat_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"\nModel artifacts saved successfully:")
    print(f"  - Versioned model: {versioned_file}")
    print(f"  - Latest pointer:  {latest_file}")
    print(f"  - SHA-256 Hash:    {content_hash}")
    print(f"  - Trigram contexts:{len(own_table['trigrams']):,}")
    print(f"  - Bigram contexts: {len(own_table['bigrams']):,}")
    print(f"  - Casing entries:  {len(casing_map):,}")
    print("="*50 + "\n")

    return payload

def main():
    parser = argparse.ArgumentParser(description="Train Ghost Text Trigram N-Gram model")
    parser.add_argument("--data", default=DEFAULT_DATA_PATH, help="Path to email dataset CSV")
    parser.add_argument("--out", default=DEFAULT_OUT_DIR, help="Output directory for trained models")
    parser.add_argument("--base-corpus", default=None, help="Optional larger cleaned corpus path")
    parser.add_argument("--version", default=MODEL_VERSION, help="Model version string")
    args = parser.parse_args()

    train_ngram_model(
        data_path=args.data,
        out_dir=args.out,
        base_corpus_path=args.base_corpus,
        version=args.version,
    )

if __name__ == "__main__":
    main()
