# SafeQuill ML (`apps/ml`)

FastAPI microservice for spam and phishing ML classification.

## Overview
- Scikit-learn based text classification (TF-IDF + Logistic Regression).
- Private network access only (isolated from direct client access, communicated via NestJS adapter).
- Versioned model artifacts on disk.
