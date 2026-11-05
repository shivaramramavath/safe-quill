import os
from pathlib import Path

# Resolve base directories relative to package location
# __file__ is in apps/ml/src/core/config.py -> parent.parent.parent is apps/ml
BASE_DIR = Path(__file__).resolve().parent.parent.parent
SRC_DIR = BASE_DIR / "src"

DATA_DIR = Path(os.getenv("ML_DATA_DIR", str(SRC_DIR / "data")))
MODELS_DIR = Path(os.getenv("ML_MODELS_DIR", str(BASE_DIR / "models")))

# Spam model directory: support either models/ or models/spam/
if (MODELS_DIR / "spam").exists():
    DEFAULT_SPAM_MODELS_DIR = MODELS_DIR / "spam"
else:
    DEFAULT_SPAM_MODELS_DIR = MODELS_DIR

SPAM_MODELS_DIR = Path(os.getenv("SPAM_MODELS_DIR", str(DEFAULT_SPAM_MODELS_DIR)))
GHOST_MODELS_DIR = Path(os.getenv("GHOST_MODELS_DIR", str(MODELS_DIR / "ghost")))

# Datasets
if (DATA_DIR / "email_dataset.csv").exists():
    DEFAULT_EMAIL_DATASET = DATA_DIR / "email_dataset.csv"
else:
    DEFAULT_EMAIL_DATASET = DATA_DIR / "emails_dataset.csv"

EMAIL_DATASET_PATH = Path(os.getenv("EMAIL_DATASET_PATH", str(DEFAULT_EMAIL_DATASET)))
SPAM_DATASET_PATH = Path(os.getenv("SPAM_DATASET_PATH", str(DATA_DIR / "spam_ham_dataset.csv")))

# Server & Thresholds
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

GHOST_SUGGEST_TIMEOUT_MS = int(os.getenv("GHOST_SUGGEST_TIMEOUT_MS", "50"))
GHOST_MAX_CONTEXT_CHARS = int(os.getenv("GHOST_MAX_CONTEXT_CHARS", "600"))
GHOST_CONFIDENCE_THRESHOLD = float(os.getenv("GHOST_CONFIDENCE_THRESHOLD", "0.20"))
GHOST_MIN_NEXT_WORD_PROB = float(os.getenv("GHOST_MIN_NEXT_WORD_PROB", "0.15"))
