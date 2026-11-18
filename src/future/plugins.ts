// TODO(phase 2): plugin system. NOT IMPLEMENTED.
//
// What already exists that plugins will build on:
//   - core/commands.ts: a plugin contributes commands with registerCommand().
//   - keybindings: a plugin ships default bindings in the same { keys, run, when } format.
//   - themes: a plugin ships theme JSON files in the same format as themes/*.json.
//   - settings/schema.ts: a plugin contributes settings entries (needs the schema to become extendable).
//   - languages: a plugin registers a Monaco language (see languages/index.ts).
//
// Decisions needed first (see PLAN.md, open questions):
//   - Where plugins run: in the webview in a sandboxed iframe or worker, or as separate processes.
//   - The manifest format and activation events.
//   - Permissions: file system, network, process spawning.
//   - Distribution: a registry, or plain git/URL installs.

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  // TODO: contributes: { commands, keybindings, themes, languages, settings }
}

// TODO: loadPlugins(store: ConfigStore): Promise<void>
