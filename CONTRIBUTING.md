# Contributing

Thank you for considering a contribution to 这是啥来着.

## Development Principles

- Keep the reading experience quiet and low-interruption.
- Do not persist user data unless the user explicitly saves it.
- Prefer local browser storage over external services.
- Keep model provider integrations OpenAI-compatible where possible.
- Avoid page DOM rewrites for history reminders; use lightweight overlays instead.

## Local Checks

Run the validation script before opening a pull request:

```bash
npm run validate
```

The project has no build step. Load the repository root as an unpacked Chrome extension during development.

## Pull Requests

Please include:

- A concise description of the user-facing change.
- Manual test notes, including the browser used.
- Any permission, storage, or privacy impact.

UI changes should include screenshots or a short recording when possible.
