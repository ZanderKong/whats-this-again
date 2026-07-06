# Security Policy

## Supported Versions

The `main` branch is the supported development line.

## Reporting a Vulnerability

Please report security issues privately to the repository owner. Do not disclose exploitable issues publicly before a fix is available.

Useful details include:

- Browser and operating system version.
- Extension version or commit SHA.
- Steps to reproduce.
- Whether API keys, saved memories, or page content may be exposed.

## Security Notes

- API keys are stored in `chrome.storage.local`.
- The extension sends selected text, user questions, and optional nearby context only to the model endpoint configured by the user.
- The extension does not include telemetry or a project-operated backend.
- Local model endpoints such as Ollama and LM Studio can be used without an API key.
