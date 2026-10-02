export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function getScopedStorageKey(key: string, scope = "guest"): string {
  return scope === "guest" ? key : `${key}.user.${encodeURIComponent(scope)}`;
}

export function readStoredValue<T>(
  storage: StorageAdapter,
  key: string,
  initial: T,
): T {
  try {
    const stored = storage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : initial;
  } catch {
    return initial;
  }
}

export function writeStoredValue<T>(
  storage: StorageAdapter,
  key: string,
  value: T,
): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the in-memory value when browser storage is unavailable.
  }
}