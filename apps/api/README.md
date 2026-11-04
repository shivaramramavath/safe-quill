# SafeQuill API (`apps/api`)

NestJS backend built using strict Hexagonal Architecture (Ports and Adapters).

## Architecture
- `src/domain/`: Core entity models, ports (`SessionStorePort`), and domain events. Independent of framework and third-party libraries.
- `src/application/`: Orchestration services (`SessionService`) and DTOs with validation rules.
- `src/infrastructure/`: Redis adapter (`RedisSessionAdapter`), redacting logger (`RedactingLogger`), and rate limiting.
- `src/interfaces/`: HTTP controllers and cookie interceptors (`SessionController`, `GuestSessionInterceptor`).

## Security & Privacy
- **Zero Logging of Content**: The `RedactingLogger` automatically scrubs subject, body, and header fields from logs.
- **Guest TTL**: Sessions expire after 24 hours in Redis.
- **Rate Limiting**: Throttler limits requests per guest IP/session.
