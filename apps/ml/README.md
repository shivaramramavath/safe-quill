# SafeQuill ML Microservice (`apps/ml`)

FastAPI microservice for email risk classification (TF-IDF + Logistic Regression) and next-word inline suggestions (Trigram + Stupid Backoff).

## Architecture & Principles
- **Private Network Only**: Accessible only by NestJS `FastApiNextWordAdapter` and `FastApiSpamClassifierAdapter`.
- **Zero Raw Logging**: Email text is untrusted and never logged.
- **Port & Adapters**: Exposes `SpamClassifierPort` and `NextWordPort` domain ports.

---

## Service Layout

```text
apps/ml/
├── src/
│   ├── api/
│   │   ├── main.py             # FastAPI entrypoint (/predict, /suggest, /health, /metrics)
│   │   └── schemas.py          # Pydantic request and response DTOs
│   ├── core/
│   │   ├── config.py           # Environment and path configurations
│   │   └── ports.py            # NextWordPort & SpamClassifierPort interfaces
│   ├── data/
│   │   ├── email_dataset.csv   # Legitimate ham emails (5,000 rows)
│   │   └── spam_ham_dataset.csv# Spam vs Ham training dataset
│   ├── ghost/
│   │   ├── preprocess.py       # Cleaning, PII placeholder masking, 90/10 split by email
│   │   ├── train_ngram.py      # Trigram training with stupid backoff & casing map
│   │   ├── predictor.py        # Prefix-aware multi-word completion with blocklist
│   │   └── eval.py             # Accuracy, keystroke savings, coverage & latency eval
│   └── spam/
│       ├── classifier.py       # SpamClassifierService inference engine
│       ├── dataset.py          # Training dataset loader
│       ├── evaluate.py         # Spam model evaluation
│       └── train.py            # TF-IDF + Logistic Regression training
├── models/                     # Trained model artifacts and JSONL splits (gitignored)
│   ├── current.json            # Active spam model pointer
│   ├── v1.0.0/                 # Versioned classifier joblib artifacts
│   └── ghost/                  # Ghost text n-gram models, splits & latest.json
├── tests/
│   ├── test_ghost.py           # 10 test suites for preprocessing, predictor & suggest API
│   └── test_ml.py              # 6 test suites for classifier, health & rollback
├── pyproject.toml
├── requirements.txt
└── Dockerfile
```

---

## Quickstart & CLI Commands

### 1. Run the API Server
```bash
# From apps/ml
uvicorn src.api.main:app --host 0.0.0.0 --port 8000

# Or from workspace root
python -m uvicorn src.api.main:app --app-dir apps/ml --host 0.0.0.0 --port 8000
```

### 2. Preprocess the Dataset
Cleans headers, replies, HTML, applies placeholders (`<email>`, `<phone>`, `<url>`, `<num>`, `<name>`), and creates a 90/10 split by email:
```bash
python -m src.ghost.preprocess --csv src/data/email_dataset.csv --splits-dir models/ghost/splits
```

### 3. Train the Ghost Text N-Gram Model
Trains Trigram ($N=3$, $\alpha=0.4$, $min\_count=2$, $top\_k=6$) and saves JSON artifacts:
```bash
python -m src.ghost.train_ngram --data src/data/email_dataset.csv --out models/ghost
```

### 4. Evaluate Ghost Text Performance
Evaluates Top-1, Top-3, Keystroke savings, Coverage, and p95 latency on held-out test emails:
```bash
python -m src.ghost.eval --models-dir models/ghost --samples 200
```

### 5. Run Tests
```bash
python -m pytest apps/ml/tests -v
```
