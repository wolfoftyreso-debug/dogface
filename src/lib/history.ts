import { type HistoryItem, MAX_HISTORY } from "./types.ts";

export function nextHistory(
  items: HistoryItem[],
  incoming: HistoryItem,
  max = MAX_HISTORY,
): HistoryItem[] {
  return [incoming, ...items.filter((item) => item.id !== incoming.id)].slice(
    0,
    max,
  );
}

export function isHistoryItem(value: unknown): value is HistoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.createdAt === "number" &&
    typeof item.breed === "string" &&
    typeof item.reason === "string" &&
    typeof item.imageDataUrl === "string" &&
    item.imageDataUrl.startsWith("data:image/") &&
    (item.sourceDataUrl === undefined ||
      (typeof item.sourceDataUrl === "string" && item.sourceDataUrl.startsWith("data:image/"))) &&
    (item.splitDataUrl === undefined ||
      (typeof item.splitDataUrl === "string" && item.splitDataUrl.startsWith("data:image/")))
  );
}

const DB_NAME = "hundtvilling";
const STORE = "twins";
const DRAFT = "draft";
const VERSION = 2;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(DRAFT)) {
        db.createObjectStore(DRAFT);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb"));
  });
}

export async function listHistory(): Promise<HistoryItem[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const rows = await reqToPromise(store.getAll());
    return rows
      .filter(isHistoryItem)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_HISTORY);
  } finally {
    db.close();
  }
}

export async function saveHistoryItem(item: HistoryItem): Promise<HistoryItem[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    await reqToPromise(store.put(item));
    const rows = (await reqToPromise(store.getAll())).filter(isHistoryItem);
    const kept = rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_HISTORY);
    const keepIds = new Set(kept.map((row) => row.id));
    for (const row of rows) {
      if (!keepIds.has(row.id)) {
        await reqToPromise(store.delete(row.id));
      }
    }
    return kept;
  } finally {
    db.close();
  }
}

export function filenameForBreed(breed: string): string {
  const slug = breed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `doggystyle-${slug || "hund"}.jpg`;
}

export async function saveDraft(imageDataUrl: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(DRAFT, "readwrite");
    await reqToPromise(
      tx.objectStore(DRAFT).put({ imageDataUrl, createdAt: Date.now() }, "photo"),
    );
  } finally {
    db.close();
  }
}

export async function loadDraft(): Promise<string | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(DRAFT, "readonly");
    const row = await reqToPromise(tx.objectStore(DRAFT).get("photo"));
    if (!row || typeof row !== "object") return null;
    const data = row as { imageDataUrl?: unknown; createdAt?: unknown };
    if (typeof data.imageDataUrl !== "string") return null;
    if (typeof data.createdAt === "number" && Date.now() - data.createdAt > DRAFT_MAX_AGE_MS) {
      await clearDraft();
      return null;
    }
    return data.imageDataUrl;
  } finally {
    db.close();
  }
}

export async function clearDraft(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(DRAFT, "readwrite");
    await reqToPromise(tx.objectStore(DRAFT).delete("photo"));
  } finally {
    db.close();
  }
}
