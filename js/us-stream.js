// js/us-stream.js - 美股 Finnhub WebSocket 即時報價引擎（含後端安全交握連線與雙模式節流）

/**
 * 判斷當前是否落在美東常規開盤時間 (09:30 - 16:00 EST/EDT，週一至週五)
 * 原生 Intl.DateTimeFormat 自動適應夏令/冬令時區
 */
export function isUsRegularMarketHours(timestampMs = Date.now()) {
  const date = new Date(timestampMs);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
  });

  const parts = formatter.formatToParts(date);
  let weekday = "";
  let hour = 0;
  let minute = 0;

  for (const part of parts) {
    if (part.type === "weekday") weekday = part.value;
    else if (part.type === "hour") hour = parseInt(part.value, 10);
    else if (part.type === "minute") minute = parseInt(part.value, 10);
  }

  if (weekday === "Sat" || weekday === "Sun") return false;

  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 570 && totalMinutes < 960;
}

export class UsStockStreamManager {
  /**
   * @param {Object} options
   * @param {Function} [options.getWsUrl] 非同步取得後端授權 WebSocket 網址的函式
   * @param {string} [options.token] 備用手動 Token
   * @param {"standard"|"geek"} [options.mode="standard"]
   * @param {Function} options.onPriceUpdate
   * @param {Function} [options.onStatusChange]
   */
  constructor({ getWsUrl = null, token = "", mode = "standard", onPriceUpdate, onStatusChange }) {
    this.getWsUrl = getWsUrl;
    this.token = token || "";
    this.wsUrl = "";
    this.mode = mode; // "standard" | "geek"
    this.onPriceUpdate = onPriceUpdate || (() => {});
    this.onStatusChange = onStatusChange || (() => {});

    this.ws = null;
    this.subscribedSymbols = new Set();
    this.isManualClosed = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;

    // 5 秒節流緩衝區
    this.standardBuffer = new Map();
    this.throttleTimer = null;

    this.startThrottleLoop();
  }

  setToken(token) {
    this.token = token;
    this.wsUrl = ""; // 重設網址快取
    if (this.ws) {
      this.disconnect();
      this.connect();
    }
  }

  setMode(newMode) {
    if (newMode !== "standard" && newMode !== "geek") return;
    if (this.mode === newMode) return;

    this.mode = newMode;
    if (this.mode === "geek" && this.standardBuffer.size > 0) {
      this.flushStandardBuffer();
    }
  }

  startThrottleLoop() {
    if (this.throttleTimer) clearInterval(this.throttleTimer);
    this.throttleTimer = setInterval(() => {
      if (this.mode === "standard" && this.standardBuffer.size > 0) {
        this.flushStandardBuffer();
      }
    }, 5000);
  }

  flushStandardBuffer() {
    for (const [symbol, data] of this.standardBuffer.entries()) {
      this.onPriceUpdate({
        symbol,
        price: data.price,
        timestamp: data.timestamp,
        volume: data.volume,
        mode: "standard",
      });
    }
    this.standardBuffer.clear();
  }

  async connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isManualClosed = false;
    this.onStatusChange("connecting");

    try {
      // 優先透過後端安全交握取得含驗證 Token 的完整 WebSocket 網址
      let targetUrl = this.wsUrl;
      if (!targetUrl && typeof this.getWsUrl === "function") {
        try {
          targetUrl = await this.getWsUrl();
          this.wsUrl = targetUrl;
        } catch (fetchErr) {
          console.warn("[US-Stream] 後端安全交握失敗，嘗試備用方案:", fetchErr);
        }
      }

      // 備用：若後端交握失敗但設定中有手動 Token，則採用手動模式
      if (!targetUrl && this.token) {
        targetUrl = `wss://ws.finnhub.io?token=${encodeURIComponent(this.token)}`;
      }

      if (!targetUrl) {
        this.onStatusChange("missing_token");
        return;
      }

      this.ws = new WebSocket(targetUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.onStatusChange("connected");

        for (const symbol of this.subscribedSymbols) {
          this._sendSubscribe(symbol);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "trade" && Array.isArray(message.data)) {
            this._handleTradeMessage(message.data);
          }
        } catch (err) {
          console.error("[US-Stream] 解析 WebSocket 封包失敗:", err);
        }
      };

      this.ws.onerror = (err) => {
        console.error("[US-Stream] WebSocket 連線異常:", err);
        this.onStatusChange("error");
      };

      this.ws.onclose = () => {
        this.onStatusChange("disconnected");
        if (!this.isManualClosed) {
          this._scheduleReconnect();
        }
      };
    } catch (error) {
      console.error("[US-Stream] 建立連線失敗:", error);
      this.onStatusChange("error");
      this._scheduleReconnect();
    }
  }

  _handleTradeMessage(trades) {
    for (const trade of trades) {
      const symbol = trade.s;
      const price = Number(trade.p);
      const timestamp = trade.t;
      const volume = trade.v;

      if (!symbol || !Number.isFinite(price) || price <= 0) continue;

      if (this.mode === "geek") {
        this.onPriceUpdate({
          symbol,
          price,
          timestamp,
          volume,
          mode: "geek",
        });
      } else {
        if (!isUsRegularMarketHours(timestamp)) {
          continue;
        }

        this.standardBuffer.set(symbol, {
          price,
          timestamp,
          volume,
        });
      }
    }
  }

  _sendSubscribe(symbol) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "subscribe", symbol: symbol.toUpperCase() }));
    }
  }

  _sendUnsubscribe(symbol) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "unsubscribe", symbol: symbol.toUpperCase() }));
    }
  }

  subscribe(symbol) {
    if (!symbol) return;
    const cleanSym = symbol.trim().toUpperCase();
    if (!this.subscribedSymbols.has(cleanSym)) {
      this.subscribedSymbols.add(cleanSym);
      this._sendSubscribe(cleanSym);
    }
  }

  unsubscribe(symbol) {
    if (!symbol) return;
    const cleanSym = symbol.trim().toUpperCase();
    if (this.subscribedSymbols.has(cleanSym)) {
      this.subscribedSymbols.delete(cleanSym);
      this._sendUnsubscribe(cleanSym);
      this.standardBuffer.delete(cleanSym);
    }
  }

  setSymbols(symbolList) {
    const nextSet = new Set((symbolList || []).map((s) => s.trim().toUpperCase()).filter(Boolean));

    for (const sym of this.subscribedSymbols) {
      if (!nextSet.has(sym)) {
        this.unsubscribe(sym);
      }
    }

    for (const sym of nextSet) {
      if (!this.subscribedSymbols.has(sym)) {
        this.subscribe(sym);
      }
    }
  }

  _scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    this.isManualClosed = true;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.standardBuffer.clear();
  }

  destroy() {
    this.disconnect();
    if (this.throttleTimer) {
      clearInterval(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.subscribedSymbols.clear();
  }
}