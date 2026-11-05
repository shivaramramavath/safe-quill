"""
Inference Engine and Token Explainer for SafeQuill Classifier
"""

import os
import json
import joblib
from typing import Dict, List, Any, Optional
from pathlib import Path

try:
    from src.core.config import SPAM_MODELS_DIR, MODELS_DIR
    from src.core.ports import SpamClassifierPort
except ImportError:
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    MODELS_DIR = BASE_DIR / "models"
    SPAM_MODELS_DIR = MODELS_DIR
    SpamClassifierPort = object

class SpamClassifierService(SpamClassifierPort):
    def __init__(self, models_dir: Optional[Path] = None):
        self.models_dir = str(models_dir or SPAM_MODELS_DIR)
        self.version = "unknown"
        self.classifier = None
        self.vectorizer = None
        self.feature_names = None
        self.load_active_model()

    def load_active_model(self) -> bool:
        current_path = os.path.join(self.models_dir, "current.json")
        if not os.path.exists(current_path):
            return False

        try:
            with open(current_path, "r", encoding="utf-8") as f:
                current_meta = json.load(f)

            self.version = current_meta.get("active_version", "unknown")
            stored_path = current_meta.get("path", self.version)

            if os.path.isabs(stored_path) and os.path.exists(stored_path):
                version_dir = stored_path
            else:
                version_dir = os.path.join(self.models_dir, self.version)

            if not os.path.exists(version_dir):
                return False

            self.classifier = joblib.load(os.path.join(version_dir, "classifier.joblib"))
            self.vectorizer = joblib.load(os.path.join(version_dir, "vectorizer.joblib"))
            self.feature_names = self.vectorizer.get_feature_names_out()
            return True
        except Exception as e:
            print(f"Error loading model: {e}")
            return False

    def list_available_versions(self) -> List[str]:
        if not os.path.exists(self.models_dir):
            return []
        versions = []
        for d in os.listdir(self.models_dir):
            if os.path.isdir(os.path.join(self.models_dir, d)) and d.startswith("v"):
                versions.append(d)
        versions.sort(reverse=True)
        return versions

    def rollback_to_version(self, target_version: str) -> bool:
        target_dir = os.path.join(self.models_dir, target_version)
        if not os.path.exists(target_dir):
            return False

        try:
            self.classifier = joblib.load(os.path.join(target_dir, "classifier.joblib"))
            self.vectorizer = joblib.load(os.path.join(target_dir, "vectorizer.joblib"))
            self.feature_names = self.vectorizer.get_feature_names_out()
            self.version = target_version

            current_meta_path = os.path.join(self.models_dir, "current.json")
            with open(current_meta_path, "w", encoding="utf-8") as f:
                json.dump({
                    "active_version": target_version,
                    "path": target_version,
                }, f, indent=2)

            return True
        except Exception as e:
            print(f"Rollback error: {e}")
            return False

    def predict(self, text: str) -> Dict[str, Any]:
        if not self.classifier or not self.vectorizer:
            if not self.load_active_model():
                raise RuntimeError("No trained model available.")

        if not text or not text.strip():
            return {
                "label": "ham",
                "confidence": 0.0,
                "score": 0,
                "level": "LOW",
                "top_tokens": [],
                "model_version": self.version,
            }

        vec = self.vectorizer.transform([text])
        probabilities = self.classifier.predict_proba(vec)[0]
        prob_spam = float(probabilities[1])

        # Score on 0 - 100 scale
        score = int(round(prob_spam * 100))
        label = "spam" if score >= 50 else "ham"

        if score >= 70:
            level = "HIGH"
        elif score >= 40:
            level = "MEDIUM"
        else:
            level = "LOW"

        # Common neutral and stop words that should not be flagged as risky tokens
        COMMON_STOPWORDS = {
            "your", "dear", "with", "report", "the", "and", "to", "of", "a", "in", "is", "it",
            "you", "that", "he", "was", "for", "on", "are", "as", "at", "be", "this", "have",
            "from", "or", "one", "had", "by", "word", "but", "not", "what", "all", "were", "we",
            "when", "can", "said", "there", "use", "an", "each", "which", "she", "do", "how",
            "their", "if", "will", "up", "other", "about", "out", "many", "then", "them", "these",
            "so", "some", "her", "would", "make", "like", "him", "into", "time", "has", "look",
            "two", "more", "write", "go", "see", "number", "no", "way", "could", "people", "my",
            "than", "first", "water", "been", "call", "who", "oil", "its", "now", "find", "long",
            "down", "day", "did", "get", "come", "made", "may", "part", "please", "thanks", "hello",
            "hi", "regards", "sincerely", "team", "support", "service", "customer"
        }

        # Feature contribution analysis for explanation
        # Per requirement: only list tokens that push the score toward spam (positive contribution
        # above a threshold), and hide the list when the verdict is LOW.
        contributions: List[Dict[str, Any]] = []
        if level != "LOW":
            coefficients = self.classifier.coef_[0]
            feature_indices = vec.indices
            tfidf_values = vec.data

            for idx, val in zip(feature_indices, tfidf_values):
                coef = coefficients[idx]
                token = str(self.feature_names[idx]).lower()
                contribution = float(val * coef)

                # Positive contribution threshold (>= 0.15) and exclude common stop words
                if contribution >= 0.15 and token not in COMMON_STOPWORDS:
                    contributions.append({
                        "token": token,
                        "weight": round(contribution, 4),
                    })

            # Sort top positive contributing tokens descending
            contributions.sort(key=lambda x: x["weight"], reverse=True)

        top_tokens = contributions[:10]

        return {
            "label": label,
            "confidence": round(prob_spam if label == "spam" else float(probabilities[0]), 4),
            "score": score,
            "level": level,
            "top_tokens": top_tokens,
            "model_version": self.version,
        }

classifier_instance = SpamClassifierService()
