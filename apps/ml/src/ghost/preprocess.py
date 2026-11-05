"""
Data Preparation & Cleaning for Ghost Text N-Gram Models
Exclusively processes legitimate (ham) business emails.
Placeholders: <email>, <phone>, <url>, <num>, <name>
"""

import os
import sys
import re
import csv
import json
import random
import argparse
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

try:
    from src.core.config import EMAIL_DATASET_PATH, MODELS_DIR
    DEFAULT_CSV_PATH = str(EMAIL_DATASET_PATH)
    DEFAULT_SPLITS_DIR = str(MODELS_DIR / "ghost" / "splits")
except ImportError:
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    DEFAULT_CSV_PATH = str(BASE_DIR / "src" / "data" / "email_dataset.csv")
    DEFAULT_SPLITS_DIR = str(BASE_DIR / "models" / "ghost" / "splits")

URL_REGEX = re.compile(r'https?://[^\s]+|www\.[^\s]+', re.IGNORECASE)
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
PHONE_REGEX = re.compile(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}')
NUM_REGEX = re.compile(r'\b\d+(?:[.,]\d+)?\b')
NAME_GREETING_REGEX = re.compile(r'\b(?:Dear|Hi|Hello|Hey)\s+([A-Z][a-z]+)\b')
NAME_SIGNOFF_REGEX = re.compile(r'\b(?:Thanks|Thank you|Regards|Best regards|Kind regards|Sincerely|Cheers),\s*\n+\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b', re.IGNORECASE)
HTML_TAG_REGEX = re.compile(r'<[^>]+>')

HEADER_PREFIX_REGEX = re.compile(
    r'^(?:From|To|Cc|Bcc|Subject|Date|Sent|Received|Message-ID|Return-Path|MIME-Version|Content-Type|Authentication-Results):',
    re.IGNORECASE,
)
FORWARD_DIVIDER_REGEX = re.compile(r'-{3,}\s*(?:Forwarded message|Original Message)\s*-{3,}', re.IGNORECASE)
DISCLAIMER_REGEX = re.compile(
    r'(?:This message and any attachments are confidential|The information contained in this communication is confidential|Privileged/Confidential Information may be contained).*$',
    re.IGNORECASE | re.DOTALL,
)

PLACEHOLDERS = {'<email>', '<phone>', '<url>', '<num>', '<name>'}

def strip_email_structural_cruft(text: str) -> str:
    # 1. Remove HTML tags
    text = HTML_TAG_REGEX.sub(' ', text)

    # 2. Remove disclaimer boilerplates
    text = DISCLAIMER_REGEX.sub('', text)

    # 3. Split on forwarded/quoted chain dividers and keep only the top message
    text = FORWARD_DIVIDER_REGEX.split(text)[0]

    lines = text.splitlines()
    cleaned_lines = []
    in_signature = False

    for line in lines:
        stripped = line.strip()

        # Skip RFC email headers
        if HEADER_PREFIX_REGEX.match(stripped):
            continue

        # Skip quoted reply lines
        if stripped.startswith('>') or stripped.startswith('|'):
            continue

        # Detect start of quoted replies
        if re.match(r'^On\s.+wrote:\s*$', stripped, re.IGNORECASE):
            break

        # Detect signatures
        if stripped in ('--', '---', 'Best,', 'Best regards,', 'Regards,', 'Thanks,', 'Sincerely,', 'Cheers,'):
            cleaned_lines.append(stripped)
            in_signature = True
            break

        if not in_signature:
            cleaned_lines.append(line)

    return '\n'.join(cleaned_lines)

def apply_placeholders(text: str) -> str:
    # Replace URLs
    text = URL_REGEX.sub('<url>', text)
    # Replace Emails
    text = EMAIL_REGEX.sub('<email>', text)
    # Replace Phone numbers
    text = PHONE_REGEX.sub('<phone>', text)
    # Replace Name greetings (e.g., "Dear John" -> "Dear <name>")
    text = NAME_GREETING_REGEX.sub(lambda m: m.group(0).split()[0] + ' <name>', text)
    # Replace Name in sign-offs
    text = NAME_SIGNOFF_REGEX.sub(lambda m: m.group(0).split(',')[0] + ',\n<name>', text)
    # Replace standalone numbers
    text = NUM_REGEX.sub('<num>', text)
    return text

def clean_and_normalize(raw_email: str) -> str:
    cruft_removed = strip_email_structural_cruft(raw_email)
    placeholders_applied = apply_placeholders(cruft_removed)
    # Normalize whitespaces: collapse multiple spaces, preserve single newlines
    lines = [re.sub(r'[ \t]+', ' ', l).strip() for l in placeholders_applied.splitlines()]
    clean_text = '\n'.join(l for l in lines if l)
    return clean_text

def tokenize_words(text: str) -> List[str]:
    """
    Tokenizes text into words, punctuation, and placeholders.
    """
    token_pattern = re.compile(r'<[a-z]+>|[a-zA-Z0-9]+(?:[\'-][a-zA-Z0-9]+)*|[.,!?;]')
    return token_pattern.findall(text)

def auto_detect_text_column(sample_rows: List[Dict[str, str]]) -> str:
    """
    Automatically selects the text column with the longest average length.
    """
    if not sample_rows:
        return 'body'
    
    col_lengths: Dict[str, List[int]] = {}
    for row in sample_rows:
        for k, v in row.items():
            if k.lower() in ('id', 'label', 'label_num', 'category', 'date'):
                continue
            col_lengths.setdefault(k, []).append(len(str(v)))

    best_col = 'body'
    max_avg = -1.0
    for col, lengths in col_lengths.items():
        avg = sum(lengths) / len(lengths) if lengths else 0
        if avg > max_avg:
            max_avg = avg
            best_col = col

    return best_col

def preprocess_dataset(
    csv_path: str,
    text_col: Optional[str] = None,
    splits_dir: Optional[str] = None,
    train_ratio: float = 0.9,
    seed: int = 42,
) -> Dict[str, Any]:
    """
    Preprocesses the dataset:
    - Filters ham only (never spam/phishing)
    - Drops empty rows
    - Deduplicates
    - Strips cruft and applies placeholders
    - Splits train/test BY EMAIL (90/10)
    - Saves JSONL splits and returns a report
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset CSV not found at {csv_path}")

    with open(csv_path, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        all_rows = list(reader)

    rows_read = len(all_rows)

    # 1. Determine text column
    if not text_col:
        text_col = auto_detect_text_column(all_rows[:100])

    # Tracking drop reasons
    dropped_empty = 0
    dropped_spam = 0
    dropped_duplicate = 0
    dropped_too_short = 0

    seen_exact = set()
    cleaned_records: List[Dict[str, Any]] = []

    for idx, row in enumerate(all_rows):
        # Ham / Spam filtering if label column exists
        label_num = row.get('label_num', '').strip()
        label = row.get('label', '').strip().lower()

        if label_num == '1' or label in ('spam', 'phishing'):
            dropped_spam += 1
            continue

        raw_text = row.get(text_col, '').strip()
        if not raw_text:
            dropped_empty += 1
            continue

        # Exact deduplication
        if raw_text in seen_exact:
            dropped_duplicate += 1
            continue
        seen_exact.add(raw_text)

        # Clean & apply placeholders
        cleaned = clean_and_normalize(raw_text)
        if len(cleaned) < 20:
            dropped_too_short += 1
            continue

        tokens = tokenize_words(cleaned)
        cleaned_records.append({
            "id": row.get("id", f"email_{idx}"),
            "text": cleaned,
            "tokens": tokens,
            "token_count": len(tokens),
        })

    rows_kept = len(cleaned_records)

    # Split BY EMAIL with fixed seed
    rng = random.Random(seed)
    rng.shuffle(cleaned_records)

    split_idx = int(rows_kept * train_ratio)
    train_split = cleaned_records[:split_idx]
    test_split = cleaned_records[split_idx:]

    train_tokens = sum(r["token_count"] for r in train_split)
    test_tokens = sum(r["token_count"] for r in test_split)

    # Save JSONL splits
    out_dir = Path(splits_dir or DEFAULT_SPLITS_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    train_path = out_dir / "train.jsonl"
    test_path = out_dir / "test.jsonl"

    with open(train_path, "w", encoding="utf-8") as f:
        for r in train_split:
            f.write(json.dumps(r) + "\n")

    with open(test_path, "w", encoding="utf-8") as f:
        for r in test_split:
            f.write(json.dumps(r) + "\n")

    report = {
        "dataset_path": csv_path,
        "text_column": text_col,
        "rows_read": rows_read,
        "rows_kept": rows_kept,
        "dropped_reasons": {
            "empty": dropped_empty,
            "spam_or_phishing": dropped_spam,
            "duplicate": dropped_duplicate,
            "too_short": dropped_too_short,
        },
        "train_rows": len(train_split),
        "test_rows": len(test_split),
        "train_tokens": train_tokens,
        "test_tokens": test_tokens,
        "splits_dir": str(out_dir),
    }

    return report

def main():
    parser = argparse.ArgumentParser(description="Preprocess email corpus for Ghost Text N-Gram model")
    parser.add_argument("--csv", default=DEFAULT_CSV_PATH, help="Path to input email CSV")
    parser.add_argument("--text-col", default=None, help="Name of text column (auto-detected if omitted)")
    parser.add_argument("--splits-dir", default=DEFAULT_SPLITS_DIR, help="Directory to save train.jsonl and test.jsonl")
    parser.add_argument("--seed", type=int, default=42, help="Fixed random seed for email split")
    args = parser.parse_args()

    report = preprocess_dataset(
        csv_path=args.csv,
        text_col=args.text_col,
        splits_dir=args.splits_dir,
        seed=args.seed,
    )

    print("\n" + "="*50)
    print(" GHOST TEXT PREPROCESSING REPORT")
    print("="*50)
    print(f"Dataset path:       {report['dataset_path']}")
    print(f"Selected column:    {report['text_column']}")
    print(f"Rows read:          {report['rows_read']}")
    print(f"Rows kept:          {report['rows_kept']}")
    print(f"Dropped (empty):    {report['dropped_reasons']['empty']}")
    print(f"Dropped (spam/phi): {report['dropped_reasons']['spam_or_phishing']}")
    print(f"Dropped (duplicate):{report['dropped_reasons']['duplicate']}")
    print(f"Dropped (too short):{report['dropped_reasons']['too_short']}")
    print(f"Train rows (90%):   {report['train_rows']}")
    print(f"Test rows (10%):    {report['test_rows']}")
    print(f"Tokens in train:    {report['train_tokens']:,}")
    print(f"Tokens in test:     {report['test_tokens']:,}")
    print(f"Splits saved to:    {report['splits_dir']}")
    print("="*50 + "\n")

if __name__ == "__main__":
    main()
