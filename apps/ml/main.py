from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any

app = FastAPI(title="SafeQuill ML Classifier Service", version="0.1.0")

class HealthResponse(BaseModel):
    status: str
    version: str
    models_available: List[str]

@app.get("/health", response_model=HealthResponse)
def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "version": "0.1.0",
        "models_available": []
    }
