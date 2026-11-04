# SafeQuill

SafeQuill is an intelligent email phishing and spam detection suite with real-time risk scoring and AI assistance.

## Architecture & Product Principles
- **Hexagonal Architecture (Ports & Adapters)**: Domain logic is isolated from database, Redis, Groq, and Brevo infrastructure.
- **Zero Raw Logging**: Guest draft contents and raw email texts are strictly redacted and never logged.
- **Ephemeral Sessions**: Guest sessions use a secure, `httpOnly` cookie (`sq_guest_session`) and live exclusively in Redis with a 24-hour TTL. Nothing is persisted to disk/DB for guests.
- **WCAG AA Compliance**: High-contrast black and white design system with accessible numeric meter (0-100), LOW/MEDIUM/HIGH risk levels, and differentiated underlines.

## Project Structure
```text
├── apps/
│   ├── web/        # Next.js 14 (App Router, Tailwind, Zustand, TanStack Query)
│   ├── api/        # NestJS (Hexagonal, Redis, Throttler, RedactingLogger)
│   └── ml/         # FastAPI (TF-IDF + Logistic Regression spam classifier)
├── packages/
│   └── shared/     # Shared DTOs, contracts, and type definitions
├── docker-compose.yml
└── .env.example
```

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Build Shared Types
```bash
pnpm --filter @safe-quill/shared build
```

### 3. Run Locally
```bash
# Terminal 1: Start API server (port 4000)
pnpm --filter @safe-quill/api start:dev

# Terminal 2: Start Web frontend (port 3000)
pnpm --filter @safe-quill/web dev
```

### 4. Running with Docker Compose
```bash
docker-compose up --build
```
