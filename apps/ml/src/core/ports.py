from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class NextWordPort(ABC):
    """Domain interface for next-word prediction and ghost text."""
    @abstractmethod
    def suggest(self, context: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Return a list of suggestions matching {'completion': str, 'confidence': float}."""
        pass

class SpamClassifierPort(ABC):
    """Domain interface for spam and phishing risk classification."""
    @abstractmethod
    def predict(self, text: str) -> Dict[str, Any]:
        """Return classification result with probability, score, verdict, and risky tokens."""
        pass
