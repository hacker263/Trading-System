import { describe, expect, it } from "vitest";
import {
  getScopedStorageKey,
  readStoredValue,
  writeStoredValue,
  type StorageAdapter,
} from "../src/lib/scopedStorage";

function createStorage(): StorageAdapter {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("scoped workspace storage", () => {
  it("preserves the guest key and gives each account a separate namespace", () => {
    expect(getScopedStorageKey("aperture.trades")).toBe("aperture.trades");
    expect(getScopedStorageKey("aperture.trades", "guest")).toBe("aperture.trades");
    expect(getScopedStorageKey("aperture.trades", "user-a")).not.toBe(
      getScopedStorageKey("aperture.trades", "user-b"),
    );
  });

  it("keeps guest data isolated from two individual accounts", () => {
    const storage = createStorage();
    const guestKey = getScopedStorageKey("aperture.trades");
    const firstUserKey = getScopedStorageKey("aperture.trades", "user-a");
    const secondUserKey = getScopedStorageKey("aperture.trades", "user-b");

    writeStoredValue(storage, guestKey, [{ id: "demo-trade" }]);
    writeStoredValue(storage, firstUserKey, [{ id: "private-a" }]);
    writeStoredValue(storage, secondUserKey, [{ id: "private-b" }]);

    expect(readStoredValue(storage, guestKey, [])).toEqual([{ id: "demo-trade" }]);
    expect(readStoredValue(storage, firstUserKey, [])).toEqual([{ id: "private-a" }]);
    expect(readStoredValue(storage, secondUserKey, [])).toEqual([{ id: "private-b" }]);
  });

  it("keeps research module records in the owning account namespace", () => {
    const storage = createStorage();
    const key = getScopedStorageKey("aperture.localModules", "user-a");
    const extensionData = {
      setups: [{ id: "setup-a", name: "London reversal" }],
      studyItems: [{ id: "study-a", title: "Risk review" }],
    };

    writeStoredValue(storage, key, extensionData);

    expect(readStoredValue(storage, key, {})).toEqual(extensionData);
    expect(readStoredValue(storage, getScopedStorageKey("aperture.localModules", "user-b"), {})).toEqual({});
    expect(readStoredValue(storage, "aperture.localModules", {})).toEqual({});
  });

  it("uses account defaults for missing or malformed data", () => {
    const storage = createStorage();
    const key = getScopedStorageKey("aperture.goals", "user-a");
    const defaults = [{ id: "starter-goal" }];

    expect(readStoredValue(storage, key, defaults)).toBe(defaults);
    storage.setItem(key, "not-json");
    expect(readStoredValue(storage, key, defaults)).toBe(defaults);
  });
});