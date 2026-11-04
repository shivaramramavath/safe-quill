# SafeQuill

SafeQuill is a production-grade email security analysis suite and AI-assisted rewriting engine with real-time risk scoring, explainable threat detection, and guest-first privacy.

---

## Key Capabilities & Architecture

- **Hexagonal Architecture (Ports & Adapters)**: Pure domain models, detector pipeline, and scoring logic completely decoupled from MongoDB Atlas, Redis, Brevo, and Groq.
- **Privacy & Redacting Logger**: Guest drafts and raw email bodies are **never** logged to disk or console. Loggers hash and redact all sensitive payload tokens.
- **Hybrid Storage Strategy**:
  - **Redis**: Ephemeral guest sessions (24-hour TTL in `sq_guest_session` `httpOnly` cookie), SHA-256 analysis cache, and distributed rate limiting.
  - **MongoDB Atlas Cloud**: Persistent storage for authenticated users, claimed drafts, feedback review queue, audit logs, and dynamic threat configurations.
- **Multi-Layer Threat Detectors**:
  - `PromptInjectionDetector`: Pre-flight defense against LLM jailbreaks and system prompt extraction.
  - `UrlAnalysisDetector`: SSRF-protected link evaluation guarding against RFC 1918 / AWS link spoofing.
  - `SenderLookalikeDetector`: Typo-squatting, zero-width characters, and Cyrillic homoglyph visual spoofing.
  - `HeaderAnalysisDetector`: SPF, DKIM, and DMARC alignment and Reply-To discrepancies.
  - `UrgencySocialEngineeringDetector`: Coercive pressure, artificial deadlines, and account suspension threats.
  - `SensitiveDataDetector`: PCI-DSS Luhn check for payment cards, SSNs, credentials, and API keys.
  - `BecPatternDetector`: Business Email Compromise targeting wire transfers, gift cards, and payroll diversion.
  - `AttachmentRiskDetector`: Executable payloads (`.exe`, `.scr`), double extensions (`invoice.pdf.exe`), macro-enabled office docs (`.xlsm`), and weaponized malware hashes.
  - `QrPhishingDetector`: "Quishing" detection across image attachments and mobile scanning lures.
  - `MultilingualDetector`: Multilingual coercion patterns (Spanish, German, French, Russian).
- **ML & AI Synergy**:
  - **Scikit-Learn ML**: High-throughput spam/phishing classification (98.67% accuracy, 99.87% recall) running in Python FastAPI.
  - **LangChain & LangGraph**: Guardrailed AI rewriting engine streaming tone adjustments and safe drafts.
- **Universal Export Engine**: Instant export to Plain Text (`.txt`), RFC 822 Email (`.eml`), or JSON Audit Record (`.json`).
- **Voice Dictation**: Built-in speech-to-text dictation using the Web Speech API with real-time visual pulse.
- **Accessibility & Strict Design Tokens**: High-contrast black & white WCAG AA interface, non-color-reliant indicators, and semantic underline styles (solid, dashed, wavy).

---

## Project Structure

```text
├── apps/
│   ├── web/        # Next.js 14 (App Router, Tailwind, Zustand, Lucide)
│   ├── api/        # NestJS (Hexagonal, MongoDB Atlas, Redis, Helmet, Throttler)
│   └── ml/         # FastAPI (Scikit-Learn TF-IDF + Logistic Regression, MLOps metrics)
├── packages/
│   └── shared/     # Shared contracts, DTOs, interfaces, and detector types
├── docker-compose.yml
└── .env.example
```

---

## Environment Variables (`.env`)

Create a `.env` file in the root directory:

```env
# Server & Network Configuration
NODE_ENV=production
PORT=4000
WEB_PORT=3000
API_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000

# Redis (Guest session store, Rate Limiting & Analysis cache)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# MongoDB Atlas Cloud Database
# Obtain from MongoDB Atlas Cloud Console -> Connect -> Connect your application (Drivers)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxxx.mongodb.net/safequill?retryWrites=true&w=majority

# Machine Learning Service (FastAPI)
ML_SERVICE_URL=http://ml:8000

# Groq Cloud LLM (for LangGraph AI Rewriting & Tone Analysis)
GROQ_API_KEY=gsk_your_groq_api_key_here

# Brevo (Sendinblue) Transactional Mailer & Security Alerts
BREVO_API_KEY=xkeysib_your_brevo_api_key_here
BREVO_SENDER_EMAIL=noreply@safequill.local

# JWT Secret for User Authentication
JWT_SECRET=super_secret_safequill_session_key_production
```

---

## Quick Start with Docker Compose

To start SafeQuill in production mode with Redis, NestJS API, Python ML, and Next.js Web:

```bash
docker compose up --build
```

- **Web Frontend**: [http://localhost:3000](http://localhost:3000)
- **API Server & Health**: [http://localhost:4000/health](http://localhost:4000/health)
- **ML Microservice**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Running Locally for Development

```bash
# 1. Install all monorepo dependencies
pnpm install

# 2. Build the shared types package
pnpm --filter @safe-quill/shared build

# 3. Start services in parallel
# Terminal 1: NestJS API (port 4000)
pnpm --filter @safe-quill/api start:dev

# Terminal 2: Next.js Frontend (port 3000)
pnpm --filter @safe-quill/web dev

# Terminal 3: FastAPI ML Service (port 8000)
cd apps/ml && python -m uvicorn src.main:app --port 8000 --reload
```

---

## Running Verification Tests

```bash
# API Unit Tests (19 test suites, 67 tests)
pnpm --filter @safe-quill/api test

# Full 8-Phase E2E Acceptance Tests
pnpm --filter @safe-quill/api test:e2e

# ML Service Pytest Suite
python -m pytest apps/ml/tests

# Web Production Build
pnpm --filter @safe-quill/web build
```
