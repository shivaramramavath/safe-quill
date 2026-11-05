"""
Training Script for SafeQuill Spam/Phishing Classifier
Trains TF-IDF + Logistic Regression with model versioning on disk.
"""

import os
import json
from datetime import datetime, timezone
from pathlib import Path
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

try:
    from src.spam.dataset import get_training_data
    from src.core.config import SPAM_MODELS_DIR
    MODELS_DIR = str(SPAM_MODELS_DIR)
except ImportError:
    from dataset import get_training_data
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    MODELS_DIR = str(BASE_DIR / "models")

MODEL_VERSION = "v1.0.0"
VERSION_DIR = os.path.join(MODELS_DIR, MODEL_VERSION)

def train_and_export():
    print(f"=== Training SafeQuill Spam Classifier ({MODEL_VERSION}) ===")
    os.makedirs(VERSION_DIR, exist_ok=True)

    texts, labels = get_training_data()
    print(f"Loaded {len(texts)} samples ({sum(labels)} spam, {len(labels) - sum(labels)} ham).")

    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.25, random_state=42, stratify=labels
    )

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        sublinear_tf=True,
        lowercase=True,
        stop_words="english",
        max_features=5000,
    )

    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    classifier = LogisticRegression(
        C=1.5,
        max_iter=1000,
        random_state=42,
    )
    classifier.fit(X_train_vec, y_train)

    # Evaluate
    y_pred = classifier.predict(X_test_vec)
    accuracy = float(accuracy_score(y_test, y_pred))
    precision = float(precision_score(y_test, y_pred, zero_division=0))
    recall = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))

    print(f"Validation Metrics:\n  Accuracy:  {accuracy:.4f}\n  Precision: {precision:.4f}\n  Recall:    {recall:.4f}\n  F1 Score:  {f1:.4f}")

    # Export artifacts
    joblib.dump(classifier, os.path.join(VERSION_DIR, "classifier.joblib"))
    joblib.dump(vectorizer, os.path.join(VERSION_DIR, "vectorizer.joblib"))

    metadata = {
        "version": MODEL_VERSION,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": "TF-IDF + Logistic Regression",
        "vocabulary_size": len(vectorizer.vocabulary_),
        "metrics": {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1": f1,
        },
        "sample_count": len(texts),
    }

    with open(os.path.join(VERSION_DIR, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    with open(os.path.join(MODELS_DIR, "current.json"), "w") as f:
        json.dump({"active_version": MODEL_VERSION, "path": VERSION_DIR}, f, indent=2)

    print(f"Model successfully saved to: {VERSION_DIR}")
    return metadata

if __name__ == "__main__":
    train_and_export()
