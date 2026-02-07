# AI Code Review Assistant (VS Code Extension)

AI Code Review Assistant helps you catch issues, security risks, and maintainability concerns directly inside VS Code. Run quick reviews on the current file, a selection, or your Git changes and see feedback in the Problems panel and the extension views.

## Features

- **Review current file or selection** with a single command.
- **Review Git changes** to spot issues before committing.
- **Problem diagnostics** powered by AI or local heuristics.
- **Review history** to keep a lightweight audit trail.
- **Configurable settings** for API key, model, and exclusions.

## Getting started

1. Install dependencies and build the extension:
   ```bash
   npm install
   npm run build
   ```
2. Launch the extension in VS Code:
   - Open the repo in VS Code
   - Press `F5` to open a new Extension Development Host

## Commands

| Command | Description |
| --- | --- |
| **AI Code Review: Review Current File** | Review the active file. |
| **AI Code Review: Review Selection** | Review the selected text. |
| **AI Code Review: Review Git Changes** | Review all unstaged changes. |
| **AI Code Review: Clear Reviews** | Clear diagnostics and review history. |
| **AI Code Review: Configure** | Open settings or prompt for API key. |

## Configuration

Open **Settings → Extensions → AI Code Reviewer** or run **AI Code Review: Configure**.

| Setting | Description | Default |
| --- | --- | --- |
| `aiCodeReviewer.apiKey` | Anthropic API key used for AI reviews. | `""` |
| `aiCodeReviewer.model` | Anthropic model to use. | `claude-3-5-sonnet-20240620` |
| `aiCodeReviewer.maxIssues` | Maximum issues per review. | `25` |
| `aiCodeReviewer.reviewOnSave` | Automatically review on save. | `false` |
| `aiCodeReviewer.excludePatterns` | Glob patterns to skip. | `**/node_modules/**`, `**/dist/**` |
| `aiCodeReviewer.useLocalFallback` | Use local checks if AI fails. | `true` |

## Notes

- If no API key is set, the extension runs lightweight local checks.
- AI review results appear in the **Problems** panel and the **Review Results** view.

## License

MIT
