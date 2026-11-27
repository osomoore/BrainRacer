import type { WorldBus } from '../core/runtime';

export function createWorldBus(): WorldBus {
  const events = new EventTarget();
  return {
    on(event, fn) {
      const listener = (message: Event) => fn((message as CustomEvent<Parameters<typeof fn>[0]>).detail);
      events.addEventListener(event, listener);
      return () => events.removeEventListener(event, listener);
    },
    emit(event, data) { events.dispatchEvent(new CustomEvent(event, { detail: data })); },
  };
}
