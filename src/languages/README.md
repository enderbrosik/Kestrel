# languages

Syntax highlighting and basic language support for **Python, TypeScript, JavaScript, C, C#, and JSON**.

- `index.ts`: registers the languages and exposes `applyLanguage(monaco, model, path)`, which sets a model's language from its file name and applies that language's indentation (Python/C/C# 4 spaces, TS/JS/JSON 2).
- `detect.ts`: pure file-name to language-id matching (exact file names first, then the longest extension). No Monaco dependency.
- `json.ts`: a small JSON/JSONC tokenizer and bracket rules, used instead of Monaco's heavy JSON language service.

"Basic" means highlighting, bracket matching and auto-closing, comment toggling, indentation, and word-based completion. It does not include language servers, type-aware completion, or diagnostics. See the TODO in `index.ts`.

Tokenizers for Python, TypeScript, JavaScript, C, and C# are loaded lazily the first time a file of that language opens, so they cost nothing at startup.
