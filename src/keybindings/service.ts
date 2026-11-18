// Listens for key presses and runs the command bound to them.

import { eventToChord, type KeyEventLike, type Platform } from './keys';
import { matchBinding, type Binding } from './loader';

export interface KeyboardEventLike extends KeyEventLike {
  isComposing?: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface KeybindingServiceDeps {
  platform: Platform;
  /** Where focus is right now: "explorer", "editor", "input". */
  contexts(): ReadonlySet<string>;
  run(command: string): void;
}

export class KeybindingService {
  private bindings: Binding[] = [];

  constructor(private readonly deps: KeybindingServiceDeps) {}

  setBindings(bindings: Binding[]): void {
    this.bindings = bindings;
  }

  /** Returns true if the key press was handled. */
  handleKeydown(e: KeyboardEventLike): boolean {
    if (e.isComposing) return false; // let input methods finish composing
    const chord = eventToChord(e);
    if (!chord) return false;
    const binding = matchBinding(this.bindings, chord, this.deps.contexts());
    if (!binding) return false;
    e.preventDefault();
    e.stopPropagation();
    this.deps.run(binding.command);
    return true;
  }

  /** Start listening. Capture phase, so user bindings win over editor defaults. Returns a disposer. */
  attach(target: EventTarget = document): () => void {
    const listener = (e: Event) => this.handleKeydown(e as KeyboardEvent);
    target.addEventListener('keydown', listener, true);
    return () => target.removeEventListener('keydown', listener, true);
  }
}
