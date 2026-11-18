// TODO(phase 3): AI features. NOT IMPLEMENTED.
//
// Sketch, once the decisions in PLAN.md are made:
//   - A provider interface (chat, inline completion) so Kestrel is not tied to one vendor,
//     including local models.
//   - Inline completions through Monaco's inline completions API (the feature is not in the
//     current curated bundle; add it in editor/monaco.ts when this starts).
//   - A chat/agent panel in the sidebar.
//   - API keys: store them with the OS keychain from src-tauri, never in settings.json.
//   - Privacy: nothing leaves the machine unless the user turns a provider on. Make that
//     explicit in the settings screen.
//   - Web build: calls would go through the browser, so keys need a different story.

export interface AiProvider {
  id: string;
  name: string;
  // TODO: complete(prompt: CompletionRequest): AsyncIterable<string>
}

// TODO: provider registry, settings entries (ai.provider, ai.enabled), commands (ai.openChat)
