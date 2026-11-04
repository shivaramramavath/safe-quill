"""
Prefix-Aware Multi-Word Predictor (Hexagonal NextWordPort implementation)
Trigram + Stupid Backoff (0.4) merging Own and Base tables.
Threshold >= 0.20, Multi-word extension up to 3 words, Blocklist enforcement.
"""

import os
import sys
import json
import re
from abc import ABC, abstractmethod
from typing import List, Dict, Tuple, Optional, Any

try:
    from .preprocess import PLACEHOLDERS
except ImportError:
    try:
        from preprocess import PLACEHOLDERS
    except ImportError:
        from ghost.preprocess import PLACEHOLDERS

BLOCKLIST = {
    'password', 'otp', 'pin', 'cvv', 'account number', 'bank',
    'wire', 'transfer', 'gift card', 'click', 'verify', 'ssn',
    'routing', 'login', 'credentials', 'credit card', 'debit card',
}

class NextWordPort(ABC):
    @abstractmethod
    def suggest(self, context: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Predicts inline completions for the given text context."""
        pass

class GhostPredictor(NextWordPort):
    def __init__(self, model_path: Optional[str] = None):
        if model_path is None:
            model_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                "models",
                "ngram_model.json",
            )
        self.model_path = model_path
        self.version = "unknown"
        self.alpha = 0.4
        self.own_table: Dict[str, Any] = {"trigrams": {}, "bigrams": {}, "unigrams": []}
        self.base_table: Dict[str, Any] = {"trigrams": {}, "bigrams": {}, "unigrams": []}
        self.casing_map: Dict[str, str] = {}
        self.load_model()

    def load_model(self) -> bool:
        if not os.path.exists(self.model_path):
            return False
        try:
            with open(self.model_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.version = data.get("version", "ghost-ngram-v1.0.0")
            self.alpha = data.get("alpha", 0.4)
            self.own_table = data.get("own_table", {"trigrams": {}, "bigrams": {}, "unigrams": []})
            self.base_table = data.get("base_table", {"trigrams": {}, "bigrams": {}, "unigrams": []})
            self.casing_map = data.get("casing_map", {})
            return True
        except Exception as e:
            print(f"Error loading ghost model: {e}")
            return False

    def is_blocked(self, word: str) -> bool:
        lower = word.lower().strip()
        if lower in BLOCKLIST or lower in PLACEHOLDERS:
            return True
        # Block if contains digits or URL markers
        if any(char.isdigit() for char in lower) or 'http' in lower or '.com' in lower or '@' in lower:
            return True
        return False

    def apply_casing(self, word: str, is_sentence_start: bool = False, match_prefix_casing: Optional[str] = None) -> str:
        lower = word.lower()
        cased = self.casing_map.get(lower, word)

        if match_prefix_casing and match_prefix_casing[0].isupper():
            cased = cased.capitalize()
        elif is_sentence_start:
            cased = cased.capitalize()

        return cased

    def _query_candidates(self, prev2: str, prev1: str) -> List[Tuple[str, float]]:
        """
        Queries Own and Base tables using Stupid Backoff (alpha=0.4).
        Priority: Own Trigram -> Base Trigram -> Own Bigram -> Base Bigram -> Unigram
        """
        candidates: Dict[str, float] = {}

        # 1. Trigram in Own
        if prev2 in self.own_table["trigrams"]:
            for w, prob in self.own_table["trigrams"][prev2]:
                candidates[w] = max(candidates.get(w, 0.0), prob * 1.0)

        # 2. Trigram in Base
        if prev2 in self.base_table["trigrams"]:
            for w, prob in self.base_table["trigrams"][prev2]:
                candidates[w] = max(candidates.get(w, 0.0), prob * 0.95)

        # 3. Bigram Backoff (alpha = 0.4)
        if len(candidates) < 5 and prev1 in self.own_table["bigrams"]:
            for w, prob in self.own_table["bigrams"][prev1]:
                candidates[w] = max(candidates.get(w, 0.0), prob * self.alpha)

        if len(candidates) < 5 and prev1 in self.base_table["bigrams"]:
            for w, prob in self.base_table["bigrams"][prev1]:
                candidates[w] = max(candidates.get(w, 0.0), prob * self.alpha * 0.95)

        # 4. Unigram Backoff (alpha^2 = 0.16)
        if not candidates:
            for w, prob in self.own_table.get("unigrams", [])[:10]:
                candidates[w] = max(candidates.get(w, 0.0), prob * (self.alpha ** 2))

        # Filter out blocked words
        filtered = [
            (w, p) for w, p in candidates.items()
            if not self.is_blocked(w)
        ]
        return sorted(filtered, key=lambda x: x[1], reverse=True)

    def suggest(self, context: str, top_k: int = 3) -> List[Dict[str, Any]]:
        if not context or len(context) > 600:
            return []

        # Check if caret is mid-word or after whitespace
        ends_with_space = context.endswith(' ') or context.endswith('\t') or context.endswith('\n')
        
        # Tokenize context
        tokens = re.findall(r'[a-zA-Z0-9]+(?:[\'-][a-zA-Z0-9]+)*|[.,!?;]', context)
        
        if not tokens:
            return []

        if ends_with_space:
            prefix = ""
            prev1 = tokens[-1].lower() if len(tokens) >= 1 else ""
            prev2 = f"{tokens[-2].lower()} {tokens[-1].lower()}" if len(tokens) >= 2 else prev1
            is_sentence_start = tokens[-1] in ('.', '!', '?')
        else:
            # Caret is mid-word (prefix completion)
            prefix = tokens[-1].lower()
            prev1 = tokens[-2].lower() if len(tokens) >= 2 else ""
            prev2 = f"{tokens[-3].lower()} {tokens[-2].lower()}" if len(tokens) >= 3 else prev1
            is_sentence_start = (len(tokens) >= 2 and tokens[-2] in ('.', '!', '?'))

        initial_candidates = self._query_candidates(prev2, prev1)

        if prefix:
            # Filter to candidates starting with prefix
            matching = [
                (w, p) for w, p in initial_candidates
                if w.startswith(prefix) and len(w) > len(prefix)
            ]
        else:
            matching = initial_candidates

        # Must clear confidence threshold >= 0.20
        valid = [(w, p) for w, p in matching if p >= 0.20][:top_k]

        if not valid:
            return []

        suggestions: List[Dict[str, Any]] = []

        for candidate_word, base_prob in valid:
            # Complete the word if mid-word
            if prefix:
                remainder_first_word = candidate_word[len(prefix):]
                cased_first_word = self.apply_casing(candidate_word, is_sentence_start, prefix)[len(prefix):]
                words_chain = [cased_first_word]
                needs_leading_space = False
            else:
                cased_first_word = self.apply_casing(candidate_word, is_sentence_start)
                words_chain = [cased_first_word]
                needs_leading_space = not ends_with_space

            # Multi-word extension up to 3 words
            curr_w1 = candidate_word
            curr_prev1 = prev1
            chain_prob = base_prob

            for _ in range(2):
                next_prev2 = f"{curr_prev1} {curr_w1}".strip()
                next_candidates = self._query_candidates(next_prev2, curr_w1)
                
                # Stop if top next-word probability drops below 0.15 or blocked
                if not next_candidates or next_candidates[0][1] < 0.15:
                    break

                next_word, next_prob = next_candidates[0]
                if next_word in ('.', '!', '?', '\n') or self.is_blocked(next_word):
                    break

                words_chain.append(self.apply_casing(next_word))
                curr_prev1 = curr_w1
                curr_w1 = next_word
                chain_prob = min(chain_prob, next_prob)

            if prefix:
                completion_text = words_chain[0]
                if len(words_chain) > 1:
                    completion_text += " " + " ".join(words_chain[1:])
            else:
                completion_text = (" " if needs_leading_space else "") + " ".join(words_chain)

            suggestions.append({
                "completion": completion_text,
                "confidence": round(chain_prob, 3),
            })

        return suggestions
