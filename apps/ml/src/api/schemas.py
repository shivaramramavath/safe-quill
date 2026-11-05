from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class TokenContribution(BaseModel):
    token: str
    weight: float

class PredictRequest(BaseModel):
    text: str

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

class RollbackRequest(BaseModel):
    version: str

class HealthResponse(BaseModel):
    status: str
    version: str
    model_loaded: bool
