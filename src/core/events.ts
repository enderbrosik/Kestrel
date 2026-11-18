// A minimal typed event emitter. Features publish state changes through these
// instead of importing each other directly.

export type Listener<T> = (value: T) => void;

export class Emitter<T> {
  private listeners = new Set<Listener<T>>();

  /** Subscribe. Returns a function that unsubscribes. */
  on(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  fire(value: T): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(value);
      } catch (err) {
        console.error('Listener failed', err);
      }
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}
