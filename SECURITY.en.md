# Security Policy

[中文](SECURITY.md)

## Supported Versions

The `main` branch is the currently supported development line. Security fixes are prioritized there.

## Reporting a Vulnerability

If you find a security issue, contact the repository maintainer privately first. Do not disclose exploitable details in a public issue.

Helpful reports include:

- Browser and operating system versions.
- Extension version or commit SHA.
- Reproduction steps.
- Whether API Keys, saved reading memories, or page content may be affected.

## Security Notes

- API Keys are stored in `chrome.storage.local`.
- The extension only sends selected text, user questions, and optional page context to the model endpoint configured by the user.
- The extension includes no telemetry and does not use a project-operated backend service.
- Annotation quotes, context, comments, and history stay in local browser storage and are not sent to project-operated servers.
- The extension writes to the clipboard only after failed drag insertion or an explicit copy action. It does not read the clipboard or send messages automatically; the destination AI site processes content placed in its editor.
- Local endpoints such as Ollama and LM Studio can be used without an API Key.
