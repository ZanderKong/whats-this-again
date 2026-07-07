# Contributing

[中文](CONTRIBUTING.md)

Thanks for your interest in 这是啥来着. Issues, feature ideas, and code improvements are welcome.

## Development Principles

- Keep the reading experience low-interruption; do not cover or rewrite page content unexpectedly.
- Do not persist temporary answers without explicit user action.
- Prefer browser-local storage and avoid unnecessary external services.
- Keep model calls OpenAI-compatible so different providers remain easy to integrate.
- Clearly describe permission, storage, or privacy impact in pull requests.

## Local Checks

Run before committing:

```bash
npm run validate
```

There is no build step. During development, load the repository root as an unpacked Chrome extension.

## Pull Requests

PR descriptions should include:

- User-visible changes.
- Main implementation approach.
- Manual verification steps and browser version.
- Permission, storage, or privacy impact.

For UI changes, screenshots or short recordings are helpful for review.
