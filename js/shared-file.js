const DATABASE_NAME = "xian-stock-shared-files";
const STORE_NAME = "files";
const RECORD_KEY = "active";

export function supportsSharedFiles() {
  return typeof window.showOpenFilePicker === "function"
    || typeof window.showSaveFilePicker === "function";
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("無法開啟共用檔案設定。"));
  });
}

async function updateRecord(operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = operation(transaction.objectStore(STORE_NAME));
    let result;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error || new Error("無法更新共用檔案設定。"));
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("無法儲存共用檔案設定。"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("共用檔案設定更新已取消。"));
    };
  });
}

export async function getSharedFileRecord() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY);
    let result;
    request.onsuccess = () => { result = request.result || null; };
    request.onerror = () => reject(request.error || new Error("無法讀取共用檔案設定。"));
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("無法讀取共用檔案設定。"));
    };
  });
}

export async function saveSharedFileRecord(handle, fingerprint, displayPath) {
  const existing = await getSharedFileRecord();
  const record = { ...existing, handle, fingerprint };
  if (displayPath !== undefined) record.displayPath = displayPath;
  await updateRecord((store) => store.put(record, RECORD_KEY));
}

export async function saveSharedDirectoryRecord(directoryHandle) {
  const existing = await getSharedFileRecord();
  const record = { ...existing, directoryHandle };
  delete record.displayPath;
  await updateRecord((store) => store.put(record, RECORD_KEY));
  return record;
}

export async function getSharedFilePath(directoryHandle, handle) {
  const relativePath = await directoryHandle.resolve(handle);
  if (!relativePath) return null;
  return [directoryHandle.name, ...relativePath].join("/");
}

export async function removeSharedFileRecord() {
  await updateRecord((store) => store.delete(RECORD_KEY));
}

async function ensureReadWritePermission(handle) {
  const options = { mode: "readwrite" };
  if (await handle.queryPermission(options) === "granted") return;
  if (await handle.requestPermission(options) !== "granted") {
    throw new Error("瀏覽器未授權讀寫共用檔案。");
  }
}

async function fingerprint(content) {
  const bytes = new TextEncoder().encode(content);
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return `${bytes.length}:${hash >>> 0}`;
}

export async function readSharedFile(handle) {
  await ensureReadWritePermission(handle);
  const file = await handle.getFile();
  const text = await file.text();
  return { text, fingerprint: await fingerprint(text) };
}

export async function writeSharedFile(handle, text, expectedFingerprint) {
  await ensureReadWritePermission(handle);
  const before = await handle.getFile();
  const currentFingerprint = await fingerprint(await before.text());
  if (currentFingerprint !== expectedFingerprint) {
    return { conflict: true, fingerprint: currentFingerprint };
  }
  const writable = await handle.createWritable();
  try {
    await writable.write(text);
    await writable.close();
  } catch (error) {
    await writable.abort?.();
    throw error;
  }
  const after = await handle.getFile();
  return { conflict: false, fingerprint: await fingerprint(await after.text()) };
}

export async function writeNewSharedFile(handle, text) {
  await ensureReadWritePermission(handle);
  const writable = await handle.createWritable();
  try {
    await writable.write(text);
    await writable.close();
  } catch (error) {
    await writable.abort?.();
    throw error;
  }
  const file = await handle.getFile();
  return fingerprint(await file.text());
}
