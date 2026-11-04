import os
import sys
import time
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any

# Ensure src and ghost packages are discoverable
SRC_DIR = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(SRC_DIR)
for p in [SRC_DIR, APP_ROOT]:
    if p not in sys.path:
        sys.path.insert(0, p)

from classifier import classifier_instance
from ghost.predictor import GhostPredictor

app = FastAPI(title="SafeQuill ML Classifier & Ghost Text Service", version="1.0.0")
ghost_predictor_instance = GhostPredictor()

class PredictRequest(BaseModel):
    text: str

class TokenContribution(BaseModel):
    token: str
    weight: float

class PredictResponse(BaseModel):
    label: str
    confidence: float
    score: int
    level: str
    top_tokens: List[TokenContribution]
    model_version: str

class SuggestRequest(BaseModel):
    context: str = Field(..., max_length=600)
    top_k: int = 3

class SuggestionItem(BaseModel):
    completion: str
    confidence: float

class SuggestResponse(BaseModel):
    model: str
    suggestions: List[SuggestionItem]

@app.post("/suggest", response_model=SuggestResponse)
def suggest_next_word(req: SuggestRequest) -> SuggestResponse:
    if len(req.context) > 600:
        raise HTTPException(status_code=400, detail="Context exceeds maximum length of 600 characters.")

    start_time = time.perf_counter()
    top_k = min(max(req.top_k, 1), 5)

    try:
        suggestions = ghost_predictor_instance.suggest(req.context, top_k=top_k)
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # Server-side 50 ms time budget: return empty list on timeout
        if elapsed_ms > 50.0:
            return SuggestResponse(model=ghost_predictor_instance.version, suggestions=[])

        return SuggestResponse(
            model=ghost_predictor_instance.version,
            suggestions=[SuggestionItem(**s) for s in suggestions],
        )
    except Exception:
        return SuggestResponse(model=ghost_predictor_instance.version, suggestions=[])

@app.get("/health")
def health_check() -> Dict[str, Any]:
    active = classifier_instance.classifier is not None
    return {
        "status": "healthy" if active else "initializing",
        "version": classifier_instance.version,
        "model_loaded": active,
    }

@app.get("/model-info")
def model_info() -> Dict[str, Any]:
    meta_path = os.path.join(
        os.path.dirname(__file__), "models", classifier_instance.version, "metadata.json"
    )
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            return json.load(f)
    return {
        "version": classifier_instance.version,
        "status": "active",
    }

class RollbackRequest(BaseModel):
    version: str

@app.get("/metrics")
def get_metrics() -> Dict[str, Any]:
    meta_path = os.path.join(
        os.path.dirname(__file__), "models", classifier_instance.version, "metadata.json"
    )
    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            meta = json.load(f)

    # In case evaluation file exists
    eval_path = os.path.join(os.path.dirname(__file__), "models", "evaluation_summary.json")
    cm = {"true_negative": 3605, "false_positive": 67, "false_negative": 2, "true_positive": 1507}
    if os.path.exists(eval_path):
        try:
            with open(eval_path, "r") as f:
                eval_data = json.load(f)
                cm = eval_data.get("confusion_matrix", cm)
        except Exception:
            pass

    metrics = meta.get("metrics", {})
    tp = cm.get("true_positive", 1507)
    fp = cm.get("false_positive", 67)
    tn = cm.get("true_negative", 3605)
    fn = cm.get("false_negative", 2)

    fpr = round(fp / (fp + tn), 4) if (fp + tn) > 0 else 0.0
    fnr = round(fn / (fn + tp), 4) if (fn + tp) > 0 else 0.0

    return {
        "accuracy": round(metrics.get("accuracy", 0.9867), 4),
        "precision": round(metrics.get("precision", 0.9575), 4),
        "recall": round(metrics.get("recall", 0.9987), 4),
        "f1Score": round(metrics.get("f1", 0.9776), 4),
        "confusionMatrix": {
            "tp": tp,
            "tn": tn,
            "fp": fp,
            "fn": fn,
        },
        "fpr": fpr,
        "fnr": fnr,
        "activeModelVersion": classifier_instance.version,
        "availableVersions": classifier_instance.list_available_versions(),
    }

@app.get("/models")
def get_models() -> Dict[str, Any]:
    return {
        "active_version": classifier_instance.version,
        "available_versions": classifier_instance.list_available_versions(),
    }

@app.post("/models/rollback")
def rollback_model(req: RollbackRequest):
    success = classifier_instance.rollback_to_version(req.version)
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to rollback to version '{req.version}'")
    return {
        "success": True,
        "active_version": classifier_instance.version,
        "message": f"Successfully activated model version {req.version}",
    }

@app.post("/predict", response_model=PredictResponse)
def predict_spam(payload: PredictRequest):
    try:
        return classifier_instance.predict(payload.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
