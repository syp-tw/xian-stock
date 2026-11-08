// js/market-poller.js - 行情報價定時輪詢、全市場批次刷新、Render 喚醒與 Page Visibility 螢幕監聽排程模組
import { fetchQuote, getQuoteDataFromResponse, fetchOfficialMisQuote } from "./quotes.js";

function chunkArray(array, size = 20) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function mapWithConcurrency(items, concurrency, asyncFn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const promise = Promise.resolve().then(() => asyncFn(item));
    results.push(promise);
    executing.add(promise);
    const clean = () => executing.delete(promise);
    promise.then(clean, clean);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

export async function safeFetchQuoteUpdate(holding, settings) {
  try {
    const result = await fetchQuote(holding.symbol, undefined, settings);
    const price = result.price;
    const dailyChange = result.dailyChangePerShare;
    
    let prevClose = result.previousClose ?? null;
    if (prevClose === null && Number.isFinite(Number(dailyChange))) {
      prevClose = price - Number(dailyChange);
    }

    return {
      id: holding.id,
      success: true,
      price,
      dailyChangePerShare: dailyChange,
      previousClose: prevClose,
      name: result.name,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`更新 ${holding.symbol} 報價失敗：`, error);
    return { id: holding.id, success: false };
  }
}

export class MarketPoller {
  constructor({ getState, persist, render, usStream, toast }) {
    this.getState = getState;
    this.persist = persist;
    this.render = render;
    this.usStream = usStream;
    this.toast = toast;

    this.twPollTimer = null;
    this.isPolling = false;
    this.isRefreshingAll = false;
  }

  start() {
    this.startTwPolling();
    this.setupPageVisibilityListener();
    this.warmupBackend();
    this.refreshAllQuotes({ silent: true });
  }

  stop() {
    if (this.twPollTimer) {
      clearInterval(this.twPollTimer);
      this.twPollTimer = null;
    }
  }

  async warmupBackend() {
    try {
      const state = this.getState();
      const rawApiUrl = state.settings.quoteApiUrl || "https://my-stock-api-nhaj.onrender.com/api/realtime";
      const baseUrl = new URL(rawApiUrl).origin;
      fetch(`${baseUrl}/`, { mode: "cors" }).catch(() => {});
    } catch {}
  }

  setupPageVisibilityListener() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (this.usStream) {
          this.usStream.connect();
        }
        this.pollTaiwanStocks();
      }
    });
  }

  startTwPolling() {
    if (this.twPollTimer) clearInterval(this.twPollTimer);
    this.twPollTimer = setInterval(() => {
      this.pollTaiwanStocks();
    }, 10000);
  }

  async pollTaiwanStocks() {
    if (this.isPolling) return;
    const state = this.getState();
    const activeTwHoldings = state.holdings.filter((h) => h.market === "TW" && Number(h.shares) > 0);
    if (!activeTwHoldings.length) return;

    const allCodes = [...new Set(activeTwHoldings.map((h) => h.symbol.replace(/\.(TW|TWO)$/i, "")))];
    if (!allCodes.length) return;

    this.isPolling = true;
    try {
      const rawApiUrl = state.settings.quoteApiUrl || "https://my-stock-api-nhaj.onrender.com/api/realtime";
      const codeChunks = chunkArray(allCodes, 20);

      const chunkPromises = codeChunks.map(async (chunk) => {
        const parsedUrl = new URL(rawApiUrl);
        const expandedChunk = chunk.flatMap((c) => [c.toUpperCase(), c.toLowerCase()]);
        parsedUrl.searchParams.set("tw_codes", [...new Set(expandedChunk)].join(","));
        parsedUrl.searchParams.delete("us_symbols");
        const res = await fetch(parsedUrl.toString());
        if (!res.ok) return {};
        const json = await res.json();
        return json.tw || {};
      });

      const chunkResults = await Promise.all(chunkPromises);
      const mergedTwData = Object.assign({}, ...chunkResults);

      let hasChanged = false;
      const missingHoldings = [];

      for (const holding of activeTwHoldings) {
        const code = holding.symbol.replace(/\.(TW|TWO)$/i, "");
        const quote = getQuoteDataFromResponse(mergedTwData, code);

        if (quote && Number(quote.price) > 0) {
          holding.currentPrice = Number(quote.price);
          if (quote.name && (!holding.name || holding.name === holding.symbol)) {
            holding.name = quote.name;
          }
          if (quote.prev_close !== undefined && quote.prev_close !== null) {
            holding.previousClose = Number(quote.prev_close);
          }
          if (quote.d !== undefined && quote.d !== null) {
            holding.dailyChangePerShare = Number(quote.d);
          } else if (holding.previousClose) {
            holding.dailyChangePerShare = holding.currentPrice - holding.previousClose;
          }
          holding.updatedAt = new Date().toISOString();
          hasChanged = true;
        } else {
          // Render API 沒有這檔股票（如 00937B、00942B、00631L），列入補查名單
          missingHoldings.push(holding);
        }
      }

      // 自動為 Render API 缺漏的標的啟用官方通道進行個別補查
      if (missingHoldings.length > 0) {
        const rescueResults = await mapWithConcurrency(missingHoldings, 3, (h) => safeFetchQuoteUpdate(h, state.settings));
        for (const update of rescueResults) {
          if (update.success && update.price > 0) {
            const target = state.holdings.find((h) => h.id === update.id);
            if (target) {
              target.currentPrice = update.price;
              target.dailyChangePerShare = update.dailyChangePerShare;
              target.previousClose = update.previousClose ?? target.previousClose;
              target.updatedAt = update.updatedAt;
              if (update.name && (!target.name || target.name === target.symbol)) {
                target.name = update.name;
              }
              hasChanged = true;
            }
          }
        }
      }

      if (hasChanged) {
        this.persist();
        this.render();
      }
    } catch (err) {
      console.error("台股背景輪詢失敗:", err);
    } finally {
      this.isPolling = false;
    }
  }

  async refreshAllQuotes({ silent = false } = {}) {
    if (this.isRefreshingAll) return;
    const state = this.getState();
    const activeHoldings = state.holdings.filter((h) => Number(h.shares) > 0);
    if (!activeHoldings.length) {
      if (!silent) this.toast("目前沒有庫存可更新報價。");
      return;
    }

    this.isRefreshingAll = true;
    const button = document.querySelector("#refresh-quotes");
    if (button) {
      button.classList.add("loading");
      button.disabled = true;
    }

    try {
      const quoteResults = await mapWithConcurrency(activeHoldings, 3, (h) => safeFetchQuoteUpdate(h, state.settings));
      let successCount = 0;

      for (const update of quoteResults) {
        if (update.success) {
          const target = state.holdings.find((h) => h.id === update.id);
          if (target) {
            target.currentPrice = update.price;
            target.dailyChangePerShare = update.dailyChangePerShare;
            target.previousClose = update.previousClose ?? target.previousClose ?? (update.dailyChangePerShare !== null ? update.price - update.dailyChangePerShare : null);
            target.updatedAt = update.updatedAt;
            if (update.name && (!target.name || target.name === target.symbol)) {
              target.name = update.name;
            }
            successCount++;
          }
        }
      }

      if (successCount > 0) {
        this.persist();
        this.render();
      }

      if (!silent) {
        if (successCount >= activeHoldings.length) {
          this.toast(`已成功更新 ${activeHoldings.length} 檔股票最新行情。`);
        } else {
          this.toast(`${successCount} / ${activeHoldings.length} 檔行情更新成功。`, successCount === 0);
        }
      }
    } catch (err) {
      console.error("批次更新行情異常:", err);
      if (!silent) this.toast("行情更新失敗，請檢查網路或稍後再試。", true);
    } finally {
      this.isRefreshingAll = false;
      if (button) {
        button.classList.remove("loading");
        button.disabled = false;
      }
    }
  }
}