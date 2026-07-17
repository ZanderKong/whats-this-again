# Changelog

## 0.4.0

- Added multi-point annotation collection, direct inline editing, deletion, persisted text anchors, and Shadow DOM overlay highlights.
- Added a concise contextual quote layout and a unified question-oriented payload format.
- Added a draggable annotation basket with verified textarea/contenteditable insertion, preserved rich-editor line breaks, ChatGPT/Grok adapters, clipboard fallback, and paste completion detection.
- Added annotation history, settings and popup counts, Schema 2 migration, bilingual copy, fixture playground, and Node built-in tests.
- Added the `clipboardWrite` permission. The extension never reads the clipboard or automatically sends messages.

## 0.3.0

- Added Chinese/English language support with Auto, 中文, and English modes.
- Added localized runtime copy for popup, settings, history, content panels, and background errors.
- Updated the default prompts and answer-card title for the default explanation flow.
- Added Chrome manifest locale files for Chinese and English.
- Added English README, docs, contributing, and security pages.

## 0.2.1

- Added 24px and 32px action icons to improve toolbar rendering across display densities.
- Removed the popup icon background so the transparent icon renders correctly.
- Refined the inline explanation panel and popup visual system for more consistent typography, spacing, and controls.
- Added a GitHub Pages-ready landing page under `docs/`.
- Updated README copy for the current feature set, privacy model, installation flow, and project structure.
- Extended validation to check action icon files and declared dimensions.

## 0.2.0

- Renamed the public extension to “这是啥来着”.
- Added contextual explanation for selected text.
- Added temporary answer panels with follow-up questions.
- Added explicit save and excerpt-save flows.
- Added local history reminders shown as low-interruption hover capsules.
- Added model provider settings for multiple OpenAI-compatible services.
- Added options, popup, and history pages.
- Added validation and packaging scripts for open-source maintenance.
