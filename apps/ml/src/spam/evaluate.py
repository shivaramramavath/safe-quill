"""
Evaluation Script for SafeQuill Spam/Phishing Model
Calculates accuracy, precision, recall, F1, and Confusion Matrix.
"""

import os
import json
from pathlib import Path
import joblib
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

try:
    from src.spam.dataset import get_training_data
    from src.core.config import SPAM_MODELS_DIR
    MODELS_DIR = str(SPAM_MODELS_DIR)
except ImportError:
    from dataset import get_training_data
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    MODELS_DIR = str(BASE_DIR / "models")

def evaluate_model():
    current_meta_path = os.path.join(MODELS_DIR, "current.json")
    if not os.path.exists(current_meta_path):
        raise FileNotFoundError("Active model not found. Run train.py first.")

    with open(current_meta_path, "r") as f:
        meta = json.load(f)

    version_dir = meta["path"]
    version = meta["active_version"]
    print(f"=== Evaluating SafeQuill Model: {version} ===")

    classifier = joblib.load(os.path.join(version_dir, "classifier.joblib"))
    vectorizer = joblib.load(os.path.join(version_dir, "vectorizer.joblib"))

    texts, labels = get_training_data()
    X_vec = vectorizer.transform(texts)
    y_pred = classifier.predict(X_vec)

    acc = accuracy_score(labels, y_pred)
    cm = confusion_matrix(labels, y_pred).tolist()
    report = classification_report(labels, y_pred, target_names=["Ham (0)", "Spam (1)"], output_dict=True)

    summary = {
        "model_version": version,
        "accuracy": acc,
        "confusion_matrix": {
            "true_negative": cm[0][0],
            "false_positive": cm[0][1],
            "false_negative": cm[1][0],
            "true_positive": cm[1][1],
        },
        "classification_report": report,
    }

    eval_output_path = os.path.join(version_dir, "evaluation.json")
    with open(eval_output_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"Accuracy: {acc:.4f}")
    print(f"Confusion Matrix:\n  TN: {cm[0][0]} | FP: {cm[0][1]}\n  FN: {cm[1][0]} | TP: {cm[1][1]}")
    print(f"Evaluation results exported to: {eval_output_path}")
    return summary

if __name__ == "__main__":
    evaluate_model()
