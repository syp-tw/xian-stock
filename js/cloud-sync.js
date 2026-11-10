// js/cloud-sync.js - 雲端共用檔案同步器（完整封裝 File System Access API 與狀態佇列）
import { serializeBackup, parseBackup } from "./backup.js";
import {
  getSharedFilePath,
  getSharedFileRecord,
  readSharedFile,
  removeSharedFileRecord,
  saveSharedDirectoryRecord,
  saveSharedFileRecord,
  supportsSharedFiles,
  writeNewSharedFile,
  writeSharedFile,
} from "./shared-file.js";
import { hasSavedState, loadState, saveState, saveStorageMode } from "./storage.js";
import { translateText } from "./i18n.js";

export class CloudSyncManager {
  constructor({ getState, onStateReplace, render, toast }) {
    this.getState = getState;
    this.onStateReplace = onStateReplace;
    this.render = render;
    this.toast = toast;

    this.sharedFileRecord = null;
    this.sharedActionInProgress = false;
    this.sharedStatusMessage = null;
    this.cloudSaveBlocked = false;
    this.cloudFileReady = false;
    this.cloudSaveQueue = Promise.resolve();
  }

  updateControls(statusMessage, storageMode) {
    if (statusMessage !== undefined) this.sharedStatusMessage = statusMessage;
    const state = this.getState();
    const supported = supportsSharedFiles() && "indexedDB" in window;
    const linked = Boolean(this.sharedFileRecord?.handle);
    const directorySelected = Boolean(this.sharedFileRecord?.directoryHandle);
    
    const cloudOption = document.querySelector("#storage-mode option[value='cloud']");
    if (cloudOption) cloudOption.disabled = (!supported || !this.cloudFileReady) && storageMode !== "cloud";

    const folderButton = document.querySelector("#shared-folder-select");
    if (folderButton) {
      folderButton.disabled = typeof window.showDirectoryPicker !== "function" || !("indexedDB" in window) || this.sharedActionInProgress;
      folderButton.textContent = translateText(this.sharedActionInProgress ? "處理中…" : "選取同步資料夾", state.settings.language);
    }

    const openBtn = document.querySelector("#shared-file-open");
    if (openBtn) openBtn.disabled = typeof window.showOpenFilePicker !== "function" || !("indexedDB" in window) || this.sharedActionInProgress;

    const createBtn = document.querySelector("#shared-file-create");
    if (createBtn) createBtn.disabled = typeof window.showDirectoryPicker !== "function" || !("indexedDB" in window) || this.sharedActionInProgress;

    const loadBtn = document.querySelector("#shared-file-load");
    if (loadBtn) loadBtn.disabled = !supported || !linked || this.sharedActionInProgress;

    const saveBtn = document.querySelector("#shared-file-save");
    if (saveBtn) saveBtn.disabled = !supported || !linked || this.sharedActionInProgress;

    const disconnectBtn = document.querySelector("#shared-file-disconnect");
    if (disconnectBtn) disconnectBtn.disabled = !linked || this.sharedActionInProgress;

    const filePath = this.sharedFileRecord?.displayPath || (directorySelected
      ? this.sharedFileRecord.handle
        ? `${this.sharedFileRecord.directoryHandle.name}/`
        : `${this.sharedFileRecord.directoryHandle.name}/（尚未選擇共用檔案）`
      : this.sharedFileRecord?.handle?.name || "");

    const pathElem = document.querySelector("#shared-file-path");
    if (pathElem) {
      pathElem.textContent = filePath || translateText("尚未選取同步資料夾。", state.settings.language);
    }

    const statusElem = document.querySelector("#shared-file-status");
    if (statusElem) {
      statusElem.textContent = translateText(
        this.sharedActionInProgress
          ? "正在處理共用檔案操作，請稍候。"
          : this.sharedStatusMessage ||
            (this.cloudSaveBlocked
              ? "雲端自動同步已暫停；請先載入最新版本或重新授權。"
              : linked && !this.cloudFileReady
              ? "共用檔案尚未啟用；請載入檔案並授予讀寫權限。"
              : linked
              ? "共用檔案已連結並啟用。"
              : directorySelected
              ? `同步資料夾「${this.sharedFileRecord.directoryHandle.name}」已選取；可直接連結既有檔案，或建立新的共用檔。`
              : supported
              ? "可直接連結既有 JSON；按「建立／另存共用檔」選擇資料夾並自動建立新檔。"
              : "此瀏覽器不支援共用檔案存取，仍可使用 JSON／CSV 匯出與 JSON 還原。"),
        state.settings.language
      );
    }

    const storageSelect = document.querySelector("#storage-mode");
    if (storageSelect) storageSelect.value = storageMode;

    const locLabel = document.querySelector("#storage-location-label");
    if (locLabel) {
      locLabel.textContent = translateText(
        storageMode === "cloud" ? "資料同步至已連結的雲端檔案" : "資料僅儲存於此裝置",
        state.settings.language
      );
    }

    const modeStatus = document.querySelector("#storage-mode-status");
    if (modeStatus) {
      modeStatus.textContent = translateText(
        storageMode === "cloud"
          ? linked && this.cloudFileReady
            ? "目前使用雲端檔案；變更會自動同步。"
            : "雲端模式尚未連結檔案；請連結檔案或切回本機模式。"
          : this.cloudFileReady
          ? "目前使用本機儲存；資料僅保存在此瀏覽器。"
          : directorySelected
          ? `同步資料夾「${this.sharedFileRecord.directoryHandle.name}」已選取；可直接選取或建立共用 JSON 檔。`
          : "連結既有 JSON 不需先選資料夾；建立新檔時，按鈕會請你選擇資料夾並自動建立。",
        state.settings.language
      );
    }
  }

  scheduleSave(storageMode) {
    if (this.cloudSaveBlocked || storageMode !== "cloud") return;

    this.cloudSaveQueue = this.cloudSaveQueue
      .then(async () => {
        if (!this.sharedFileRecord?.handle) throw new Error("雲端模式尚未連結共用檔案；請先連結檔案或切回本機模式。");
        const state = this.getState();
        const latestContent = serializeBackup(state);
        const result = await writeSharedFile(
          this.sharedFileRecord.handle,
          latestContent,
          this.sharedFileRecord.fingerprint
        );

        if (result.conflict) {
          this.cloudSaveBlocked = true;
          this.updateControls("共用檔案已在其他位置變更；為避免覆蓋，請先載入最新版本。", storageMode);
          this.toast("共用檔案已在其他位置變更；雲端自動同步已暫停，請先載入最新版本。", true);
          return;
        }
        this.sharedFileRecord.fingerprint = result.fingerprint;
        await saveSharedFileRecord(this.sharedFileRecord.handle, result.fingerprint, this.sharedFileRecord.displayPath);
        this.updateControls("雲端資料已自動同步。", storageMode);
      })
      .catch((error) => {
        this.cloudSaveBlocked = true;
        this.updateControls("雲端自動同步失敗；請重新授權或切回本機模式。", storageMode);
        this.toast(translateText(error.message || "共用檔案操作失敗。", this.getState().settings.language), true);
      });
  }

  // 🌟 交易前無感快速載入最新檔案
  async silentLoad(storageMode) {
    if (!this.sharedFileRecord?.handle || !this.cloudFileReady || storageMode !== "cloud") return;
    try {
      const file = await readSharedFile(this.sharedFileRecord.handle);
      if (file.fingerprint === this.sharedFileRecord.fingerprint) return;
      const imported = parseBackup(file.text);
      this.onStateReplace(imported, { syncCloud: false });
      this.sharedFileRecord.fingerprint = file.fingerprint;
      await saveSharedFileRecord(this.sharedFileRecord.handle, file.fingerprint, this.sharedFileRecord.displayPath);
    } catch (err) {
      console.warn("[CloudSync] silentLoad 失敗:", err);
    }
  }

  // 🌟 交易後立即無感推送存檔
  async silentSave(storageMode) {
    if (!this.sharedFileRecord?.handle || !this.cloudFileReady || storageMode !== "cloud") return;
    try {
      const state = this.getState();
      const latestContent = serializeBackup(state);
      const result = await writeSharedFile(
        this.sharedFileRecord.handle,
        latestContent,
        this.sharedFileRecord.fingerprint
      );
      if (!result.conflict) {
        this.sharedFileRecord.fingerprint = result.fingerprint;
        await saveSharedFileRecord(this.sharedFileRecord.handle, result.fingerprint, this.sharedFileRecord.displayPath);
      }
    } catch (err) {
      console.warn("[CloudSync] silentSave 失敗:", err);
    }
  }

  async init(storageMode) {
    if (!supportsSharedFiles() || !("indexedDB" in window)) {
      this.updateControls(undefined, storageMode);
      return;
    }
    const state = this.getState();
    try {
      this.sharedFileRecord = await getSharedFileRecord();
      const handle = this.sharedFileRecord?.handle;
      let startupStatus;
      if (handle && (await handle.queryPermission({ mode: "readwrite" })) === "granted") {
        const file = await readSharedFile(handle);
        parseBackup(file.text);
        this.cloudFileReady = true;
        if (storageMode === "cloud") {
          if (hasSavedState("cloud") && !state.storageError) {
            if (file.fingerprint !== this.sharedFileRecord.fingerprint) {
              this.cloudSaveBlocked = true;
              startupStatus = "共用檔案已在其他位置變更；為避免覆蓋，請先載入最新版本。";
            } else {
              this.cloudSaveBlocked = false;
              this.scheduleSave(storageMode);
            }
          } else {
            const imported = parseBackup(file.text);
            Object.assign(state, imported);
            delete state.storageError;
            if (!saveState(state, "cloud")) throw new Error("無法儲存雲端資料的本機快取。");
            this.sharedFileRecord.fingerprint = file.fingerprint;
            await saveSharedFileRecord(handle, file.fingerprint, this.sharedFileRecord.displayPath);
            this.cloudSaveBlocked = false;
            this.render();
          }
        }
      }
      if (handle && (await handle.queryPermission({ mode: "readwrite" })) !== "granted") {
        this.cloudFileReady = false;
        if (storageMode === "cloud") this.cloudSaveBlocked = true;
        this.updateControls(
          storageMode === "cloud"
            ? "雲端模式需要重新授權；請按「載入共用檔」同步，或切回本機模式。"
            : "共用檔案已連結；操作時需重新授權。",
          storageMode
        );
      } else {
        this.updateControls(startupStatus, storageMode);
      }
    } catch (error) {
      this.cloudFileReady = false;
      if (storageMode === "cloud") this.cloudSaveBlocked = true;
      this.updateControls("無法讀取共用檔案設定，請重新連結檔案。", storageMode);
      this.toast(translateText(error.message || "共用檔案操作失敗。", state.settings.language), true);
    }
  }

  runAction(action, storageMode) {
    if (this.sharedActionInProgress) return;
    this.sharedActionInProgress = true;
    this.updateControls(undefined, storageMode);
    let res;
    try {
      res = action();
    } catch (err) {
      res = Promise.reject(err);
    }
    Promise.resolve(res)
      .catch((error) => {
        if (error.name === "AbortError") {
          this.updateControls("已取消選取；同步資料夾位置未變更。", storageMode);
        } else {
          this.updateControls(error.message || "共用檔案操作失敗。", storageMode);
          this.toast(translateText(error.message || "共用檔案操作失敗。", this.getState().settings.language), true);
        }
      })
      .finally(() => {
        this.sharedActionInProgress = false;
        this.updateControls(this.sharedStatusMessage, storageMode);
      });
  }

  async selectDirectory(pickerPromise, storageMode) {
    const directoryHandle = await pickerPromise;
    this.sharedFileRecord = await saveSharedDirectoryRecord(directoryHandle);
    if (this.sharedFileRecord.handle) {
      const displayPath = await getSharedFilePath(directoryHandle, this.sharedFileRecord.handle);
      if (displayPath) {
        this.sharedFileRecord.displayPath = displayPath;
        await saveSharedFileRecord(this.sharedFileRecord.handle, this.sharedFileRecord.fingerprint, displayPath);
        this.updateControls("同步資料夾路徑已更新。", storageMode);
        return;
      }
      this.updateControls("目前連結的檔案不在所選同步資料夾內；請重新連結共用檔案。", storageMode);
      return;
    }
    this.updateControls(`同步資料夾「${directoryHandle.name}」已選取；可直接連結既有檔案，或建立新的共用檔。`, storageMode);
  }

  async selectAndLoadFile(storageMode) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      ...(this.sharedFileRecord?.directoryHandle ? { startIn: this.sharedFileRecord.directoryHandle } : {}),
      types: [{ description: "鮮存股 JSON 備份", accept: { "application/json": [".json"] } }],
    });
    const file = await readSharedFile(handle);
    const resolvedPath = this.sharedFileRecord?.directoryHandle
      ? await getSharedFilePath(this.sharedFileRecord.directoryHandle, handle)
      : null;
    const displayPath = resolvedPath || handle.name;
    const imported = parseBackup(file.text);
    const state = this.getState();
    if (!window.confirm(translateText("連結共用檔會更新雲端資料快取；本機資料會保留。是否繼續？", state.settings.language))) return;
    if (storageMode === "cloud") this.onStateReplace(imported, { syncCloud: false });
    else if (!saveState(imported, "cloud")) throw new Error("無法儲存雲端資料的本機快取。");
    
    this.sharedFileRecord = { ...this.sharedFileRecord, handle, fingerprint: file.fingerprint, displayPath };
    await saveSharedFileRecord(handle, file.fingerprint, displayPath);
    this.cloudFileReady = true;
    this.cloudSaveBlocked = false;
    this.updateControls(resolvedPath ? undefined : "相對路徑無法取得；目前僅顯示檔名。", storageMode);
    this.toast(storageMode === "cloud" ? "已載入雲端資料並啟用自動同步。" : "已連結雲端檔案；本機資料未變更，可切換至雲端模式。");
  }

  async createFile(storageMode) {
    let directoryHandle = this.sharedFileRecord?.directoryHandle;
    if (!directoryHandle) directoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    const permission = await directoryHandle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") throw new Error("瀏覽器未授權同步資料夾讀寫權限，尚未建立共用檔。");
    this.toast("同步資料夾已選取，正在建立共用 JSON 檔…");
    const fileName = `xian-stock-shared-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}.json`;
    const handle = await directoryHandle.getFileHandle(fileName, { create: true });
    const content = serializeBackup(this.getState());
    const fileFingerprint = await writeNewSharedFile(handle, content);
    const resolvedPath = await getSharedFilePath(directoryHandle, handle);
    const displayPath = resolvedPath || handle.name;
    await saveSharedDirectoryRecord(directoryHandle);
    await saveSharedFileRecord(handle, fileFingerprint, displayPath);
    this.sharedFileRecord = { ...(this.sharedFileRecord || {}), directoryHandle, handle, fingerprint: fileFingerprint, displayPath };
    this.cloudFileReady = true;
    this.cloudSaveBlocked = false;
    this.updateControls(resolvedPath ? undefined : "相對路徑無法取得；目前僅顯示檔名。", storageMode);
    this.toast("已建立並連結共用檔案。");
  }

  async loadFile(storageMode) {
    if (!this.sharedFileRecord?.handle) return;
    const file = await readSharedFile(this.sharedFileRecord.handle);
    const imported = parseBackup(file.text);
    const state = this.getState();
    if (!window.confirm(translateText("載入共用檔會更新雲端資料；本機資料會保留。是否繼續？", state.settings.language))) return;
    if (storageMode === "cloud") this.onStateReplace(imported, { syncCloud: false });
    else if (!saveState(imported, "cloud")) throw new Error("無法儲存雲端資料的本機快取。");
    this.sharedFileRecord.fingerprint = file.fingerprint;
    await saveSharedFileRecord(this.sharedFileRecord.handle, file.fingerprint, this.sharedFileRecord.displayPath);
    this.cloudFileReady = true;
    this.cloudSaveBlocked = false;
    this.updateControls(undefined, storageMode);
    this.toast(storageMode === "cloud" ? "已載入最新雲端資料。" : "已更新雲端資料快取；本機資料未變更。");
  }

  async saveToFile(storageMode) {
    if (!this.sharedFileRecord?.handle) return;
    const currentFile = await readSharedFile(this.sharedFileRecord.handle);
    const state = this.getState();
    if (
      currentFile.fingerprint !== this.sharedFileRecord.fingerprint &&
      !window.confirm(translateText("共用檔在上次載入後已被修改。若繼續儲存，將以此瀏覽器資料覆寫最新版本。是否仍要覆寫？", state.settings.language))
    ) {
      return;
    }
    const result = await writeSharedFile(this.sharedFileRecord.handle, serializeBackup(state), currentFile.fingerprint);
    if (result.conflict) {
      this.cloudSaveBlocked = true;
      this.toast("共用檔再次被修改，為避免覆蓋他人資料，請先重新載入。", true);
      return;
    }
    this.sharedFileRecord.fingerprint = result.fingerprint;
    await saveSharedFileRecord(this.sharedFileRecord.handle, result.fingerprint, this.sharedFileRecord.displayPath);
    this.cloudFileReady = true;
    this.cloudSaveBlocked = false;
    this.updateControls(undefined, storageMode);
    this.toast("已儲存至共用檔案。");
  }

  async disconnect(storageMode) {
    if (storageMode === "cloud") throw new Error("請先切回本機模式，再解除雲端檔案連結。");
    await removeSharedFileRecord();
    this.sharedFileRecord = null;
    this.cloudFileReady = false;
    this.cloudSaveBlocked = false;
    this.updateControls("已解除共用檔案連結；本機資料不受影響。", storageMode);
  }
}