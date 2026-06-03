# Architecture

| Setting | Value |
| --- | --- |
| Mode | `redesign` |
| Level | `complex` |
| Fidelity | `describe` |
| Generated with | `reconstruct@0.7.0` |

## Detected stack

Next.js, React · TypeScript

**Libraries:** Tailwind CSS, Zod, Playwright

## Top-level layout

- `app/`
- `components/`
- `lib/`
- `messages/`
- `prisma/`
- root files: `.env.example`, `README.md`, `next.config.js`, `package.json`

## Dependencies

- **npm** (`package.json`): 5 runtime, 3 dev

## Data & schema

- `prisma/schema.prisma`

## Internationalization

Locales: en, fr — files copied to `data/translations/`.

## External services & integrations

> 🧠 **For the AI agent:** List **every** external service the project calls (payment, email, geocoding, storage, analytics, queues, third-party APIs). For each: provider, the exact request/response shape, timeout, and what happens on failure (best-effort? hard error?). Naming the service is not enough — capture the contract.


## Cross-cutting policies

> 🧠 **For the AI agent:** Capture every cross-cutting rule that is otherwise left vague: rate limits (exact thresholds, window, key, store), format validations (e.g. national registry numbers — give the regex/checksum/length), and security policies. Each rule must be concrete enough to write a test against.


## Proposed architecture (redesign)

> 🧠 **For the AI agent:** Design a fresh architecture that delivers the SAME features and logic. Decide module boundaries, data flow, and folder structure. Justify changes against the detected stack above. Keep behavior identical; improve structure, testability, and clarity.


Document the proposed structure here as a directory tree plus a short rationale per module.
