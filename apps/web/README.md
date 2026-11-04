# SafeQuill Web (`apps/web`)

Next.js frontend with App Router, Tailwind CSS, Zustand, and TanStack Query.

## Features
- **Strict B&W Theme**: CSS variable theme system swapping values between light and dark modes with WCAG AA compliance.
- **Autosaving Draft**: Real-time debounced synchronization to Redis guest session with status indicators.
- **Undo / Redo Stack**: Custom keyboard-accessible history stack (`Ctrl+Z`, `Ctrl+Y`).
- **Score Meter**: Accessible 0-100 risk score meter with numeric readout and qualitative categories (LOW / MEDIUM / HIGH).
- **Zero Chat**: Purpose-built email inspection interface.
