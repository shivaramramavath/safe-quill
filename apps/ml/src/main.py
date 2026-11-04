import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

from classifier import classifier_instance

app = FastAPI(title="SafeQuill ML Classifier Service", version="1.0.0")

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

@app.post("/predict", response_model=PredictResponse)
def predict_spam(payload: PredictRequest):
    try:
        return classifier_instance.predict(payload.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
