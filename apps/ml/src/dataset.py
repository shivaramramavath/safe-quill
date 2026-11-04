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

CURATED_HAM: List[Tuple[str, int]] = [
    ("Subject: Formal complaint regarding delayed shipment. Dear Support Team, I am writing to submit a complaint regarding order #8921. It has been two weeks since the purchase date and the package has not arrived. Please check the tracking status and advise on when I can expect delivery. Sincerely, David Miller.", 0),
    ("Subject: Complaint regarding defective monitor. Hi Customer Service, the monitor delivered yesterday does not power on even after testing multiple outlets. I would like to request an exchange under the standard 1-year product warranty. Thank you.", 0),
    ("Subject: Service interruption complaint. Dear Account Manager, our office experienced unexpected downtime this morning affecting our team operations. We request a detailed post-incident review and confirmation of SLA credit.", 0),
    ("Subject: Discrepancy on monthly invoice. Hello billing department, I noticed an unexpected charge of $12 on our latest statement. Could you please review and issue an adjusted invoice? Regards, Lisa.", 0),
    ("Subject: Meeting reschedule. Hi Team, due to a calendar conflict with our executive review, could we move our sync from Tuesday morning to Wednesday at 2 PM? Let me know if that works for everyone.", 0),
    ("Subject: Customer feedback. Dear store manager, I visited your branch today and experienced poor service at the customer service desk. I am sharing this feedback so the team can address staffing during peak hours.", 0),
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

                # Augment with curated formal complaint & business ham samples
                for sample, label in CURATED_HAM:
                    texts.append(sample)
                    labels.append(label)

                print(f"Loaded {len(texts)} total samples ({sum(labels)} spam, {len(labels) - sum(labels)} ham).")
                return texts, labels
        except Exception as e:
            print(f"Notice: Failed to parse {CSV_PATH} ({e}), using curated samples.")

    combined = CURATED_PHISHING + CURATED_HAM
    texts = [sample[0] for sample in combined]
    labels = [sample[1] for sample in combined]
    return texts, labels
