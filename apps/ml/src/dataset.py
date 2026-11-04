"""
Dataset Loader for SafeQuill Spam/Phishing Model
Loads the full spam_ham_dataset.csv (5,172 samples)
with fallback to curated phishing samples.
"""

import os
import csv
from typing import List, Tuple

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "spam_ham_dataset.csv")

CURATED_PHISHING: List[Tuple[str, int]] = [
    ("URGENT: Your bank account has been suspended due to suspicious activity. Verify immediately at http://secure-login.xyz", 1),
    ("Congratulations! You won a $1,000 Walmart gift card. Click here to claim your prize now: http://free-prizes.cc", 1),
    ("Final notice: Unpaid invoice #INV-9281. Open the attached document or your service will be terminated immediately.", 1),
    ("Your Netflix membership is on hold. Update your credit card details immediately to continue watching.", 1),
    ("Dear customer, our records show an unauthorized login from Russia. Click here to secure your password immediately.", 1),
    ("Earn $5,000 per week working from home! No experience required. Send your deposit today to get started.", 1),
    ("Wire transfer confirmation needed. Transfer funds to offshore account before 5 PM to finalize company acquisition.", 1),
    ("Security Alert: We detected an unknown device accessing your account. Reset your credentials now at http://bit.ly/fake-auth", 1),
    ("Immediate attention: CEO requests wire payment to vendor immediately. Do not call, I am in a board meeting.", 1),
    ("Action Required: Your Microsoft 365 password expires today. Keep your same password by validating here.", 1),
]

def get_training_data() -> Tuple[List[str], List[int]]:
    texts: List[str] = []
    labels: List[int] = []

    if os.path.exists(CSV_PATH):
        try:
            with open(CSV_PATH, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    text = row.get("text", "").strip()
                    label_str = row.get("label_num", "")
                    if text and label_str in ("0", "1"):
                        texts.append(text)
                        labels.append(int(label_str))

            if len(texts) > 0:
                # Augment with curated targeted phishing vectors
                for sample, label in CURATED_PHISHING:
                    texts.append(sample)
                    labels.append(label)

                print(f"Loaded {len(texts)} total samples ({sum(labels)} spam, {len(labels) - sum(labels)} ham).")
                return texts, labels
        except Exception as e:
            print(f"Notice: Failed to parse {CSV_PATH} ({e}), using curated samples.")

    texts = [sample[0] for sample in CURATED_PHISHING]
    labels = [sample[1] for sample in CURATED_PHISHING]
    return texts, labels
