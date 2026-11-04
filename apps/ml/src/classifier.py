"""
Inference Engine and Token Explainer for SafeQuill Classifier
"""

import os
import json
import joblib
from typing import Dict, List, Any, Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

class SpamClassifierService:
    def __init__(self):
        self.version = "unknown"
        self.classifier = None
        self.vectorizer = None
        self.feature_names = None
        self.load_active_model()

    def load_active_model(self) -> bool:
        current_path = os.path.join(MODELS_DIR, "current.json")
        if not os.path.exists(current_path):
            return False

        try:
            with open(current_path, "r") as f:
                current_meta = json.load(f)

            version_dir = current_meta["path"]
            self.version = current_meta["active_version"]
            self.classifier = joblib.load(os.path.join(version_dir, "classifier.joblib"))
            self.vectorizer = joblib.load(os.path.join(version_dir, "vectorizer.joblib"))
            self.feature_names = self.vectorizer.get_feature_names_out()
            return True
        except Exception as e:
            print(f"Error loading model: {e}")
            return False

    def list_available_versions(self) -> List[str]:
        if not os.path.exists(MODELS_DIR):
            return []
        versions = []
        for d in os.listdir(MODELS_DIR):
            if os.path.isdir(os.path.join(MODELS_DIR, d)) and d.startswith("v"):
                versions.append(d)
        versions.sort(reverse=True)
        return versions

    def rollback_to_version(self, target_version: str) -> bool:
        target_dir = os.path.join(MODELS_DIR, target_version)
        if not os.path.exists(target_dir):
            return False

        try:
            self.classifier = joblib.load(os.path.join(target_dir, "classifier.joblib"))
            self.vectorizer = joblib.load(os.path.join(target_dir, "vectorizer.joblib"))
            self.feature_names = self.vectorizer.get_feature_names_out()
            self.version = target_version

            current_meta_path = os.path.join(MODELS_DIR, "current.json")
            with open(current_meta_path, "w") as f:
                json.dump({
                    "active_version": target_version,
                    "path": target_dir,
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

        # Feature contribution analysis for explanation
        # For each token present in input, compute contribution = tfidf_value * coef
        coefficients = self.classifier.coef_[0]
        feature_indices = vec.indices
        tfidf_values = vec.data

        contributions: List[Dict[str, Any]] = []
        for idx, val in zip(feature_indices, tfidf_values):
            coef = coefficients[idx]
            token = str(self.feature_names[idx])
            contribution = float(val * coef)

            # We care about positive contributions towards spam classification
            if contribution > 0:
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
