"""
Data Preparation & Cleaning for Ghost Text N-Gram Models
Exclusively processes legitimate (ham) business emails.
Placeholders: <email>, <phone>, <url>, <num>, <name>
"""

import os
import re
import csv
import random
from typing import List, Tuple, Dict, Any

URL_REGEX = re.compile(r'https?://[^\s]+|www\.[^\s]+', re.IGNORECASE)
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
PHONE_REGEX = re.compile(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}')
NUM_REGEX = re.compile(r'\b\d+(?:[.,]\d+)?\b')
NAME_GREETING_REGEX = re.compile(r'\b(?:Dear|Hi|Hello|Hey)\s+([A-Z][a-z]+)\b')

HEADER_PREFIX_REGEX = re.compile(
    r'^(?:From|To|Cc|Bcc|Subject|Date|Sent|Received|Message-ID|Return-Path|MIME-Version|Content-Type):',
    re.IGNORECASE,
)
FORWARD_DIVIDER_REGEX = re.compile(r'-{3,}\s*(?:Forwarded message|Original Message)\s*-{3,}', re.IGNORECASE)
DISCLAIMER_REGEX = re.compile(
    r'(?:This message and any attachments are confidential|The information contained in this communication is confidential|Privileged/Confidential Information may be contained).*$',
    re.IGNORECASE | re.DOTALL,
)

PLACEHOLDERS = {'<email>', '<phone>', '<url>', '<num>', '<name>'}

def strip_email_structural_cruft(text: str) -> str:
    # 1. Remove disclaimer boilerplates
    text = DISCLAIMER_REGEX.sub('', text)

    # 2. Split on forwarded/quoted chain dividers and keep only the top message
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
            # Keep the signoff word itself if desired, but stop processing below
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
    Tokenizes text into words and punctuation while keeping placeholders intact.
    """
    token_pattern = re.compile(r'<[a-z]+>|[a-zA-Z0-9]+(?:[\'-][a-zA-Z0-9]+)*|[.,!?;]')
    return token_pattern.findall(text)

def load_legitimate_corpus(
    env_corpus_path: str = None,
    enron_csv_path: str = None,
) -> Tuple[List[str], List[str]]:
    """
    Loads legitimate emails only (NEVER spam or phishing).
    Returns (own_emails, base_emails).
    """
    own_emails: List[str] = []
    base_emails: List[str] = []

    # 1. Load user's legitimate emails if path provided in environment
    target_env_path = env_corpus_path or os.environ.get('LEGITIMATE_EMAILS_PATH')
    if target_env_path and os.path.exists(target_env_path):
        if os.path.isdir(target_env_path):
            for fname in os.listdir(target_env_path):
                fpath = os.path.join(target_env_path, fname)
                if os.path.isfile(fpath):
                    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                        own_emails.append(f.read())
        elif os.path.isfile(target_env_path):
            with open(target_env_path, 'r', encoding='utf-8', errors='ignore') as f:
                own_emails.extend(f.read().split('\n\n---EMAIL---\n\n'))

    # 2. Load legitimate base emails (label == 0 only, Enron ham)
    base_path = enron_csv_path or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'src', 'data', 'spam_ham_dataset.csv'
    )
    if os.path.exists(base_path):
        with open(base_path, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            for row in reader:
                label = row.get('label_num', '').strip()
                # STRICT FILTER: strictly label_num == '0' (ham). NEVER spam/phishing.
                if label == '0':
                    text = row.get('text', '').strip()
                    if text:
                        base_emails.append(text)

    # If own_emails is empty (no local private folder supplied in env),
    # partition the clean ham emails: first 1500 as "own" (weighted 3x), remainder as "base".
    if not own_emails and len(base_emails) > 1500:
        own_emails = base_emails[:1500]
        base_emails = base_emails[1500:]
    elif not own_emails:
        own_emails = list(base_emails)

    return own_emails, base_emails

def preprocess_and_split(
    emails: List[str],
    train_ratio: float = 0.9,
    seed: int = 42,
) -> Tuple[List[str], List[str]]:
    """
    Deduplicates emails, cleans structural cruft, and splits BY EMAIL (90/10).
    """
    seen_hashes = set()
    cleaned_emails: List[str] = []

    for raw in emails:
        cleaned = clean_and_normalize(raw)
        if len(cleaned) < 20:
            continue
        # Deduplicate
        h = hash(cleaned)
        if h in seen_hashes:
            continue
        seen_hashes.add(h)
        cleaned_emails.append(cleaned)

    # Split BY EMAIL, never by sentence
    rng = random.Random(seed)
    rng.shuffle(cleaned_emails)

    split_idx = int(len(cleaned_emails) * train_ratio)
    train_emails = cleaned_emails[:split_idx]
    test_emails = cleaned_emails[split_idx:]

    return train_emails, test_emails
