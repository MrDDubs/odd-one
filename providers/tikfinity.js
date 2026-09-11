// providers/tikfinity.js (ESM)
import WebSocket from "ws";

/**
 * Connect to TikFinity Developer API WebSocket and surface chat messages.
 * Handles multiple known payload shapes across TikFinity versions.
 *
 * @param {Object} options
 * @param {string} options.wsUrl - TikFinity WebSocket URL (e.g., ws://localhost:21213/)
 * @param {string} [options.token] - Optional API token
 * @param {Function} options.onChat - Callback receiving ({ username, nickname, text, raw })
 * @param {Function} [options.onLog] - Callback for logging status messages
 * @param {Function} [options.onStatusChange] - Callback receiving boolean isConnected
 */
export function connectTikFinity({ wsUrl, token, onChat, onLog, onStatusChange }) {
  let ws = null;
  let retryTimer = null;
  let isClosedExplicitly = false;

  const log = (m) => {
    if (onLog) onLog(m);
    else console.log(`[TikFinity] ${m}`);
  };

  const connect = () => {
    if (isClosedExplicitly) return;

    let targetUrl = wsUrl || "ws://localhost:21213/";
    if (token) {
      try {
        const u = new URL(targetUrl);
        if (!u.searchParams.has("token")) {
          u.searchParams.set("token", token);
          targetUrl = u.toString();
        }
      } catch (e) {
        // Ignored if relative/invalid URL
      }
    }

    log(`Connecting to ${targetUrl}...`);

    try {
      ws = new WebSocket(targetUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        handshakeTimeout: 5000
      });
    } catch (e) {
      log(`WebSocket init error: ${e.message}`);
      onStatusChange?.(false);
      scheduleRetry();
      return;
    }

    ws.on("open", () => {
      log("Connected to TikFinity live stream!");
      onStatusChange?.(true);
    });

    ws.on("message", (data) => {
      try {
        let str = data;
        if (data instanceof Buffer) str = data.toString("utf8");
        if (typeof str !== "string") return;

        let evt;
        try {
          evt = JSON.parse(str);
        } catch {
          return;
        }

        const lower = (v) => (typeof v === "string" ? v.toLowerCase() : v);
        const t = lower(evt.type || evt.event || evt.Event || evt.eventType);

        // Check if event looks like a chat message
        const isChatLike =
          t === "chat" ||
          t === "chatmessage" ||
          t === "message" ||
          t === "comment" ||
          typeof evt.message === "string" ||
          typeof evt.comment === "string" ||
          evt?.data?.message ||
          evt?.data?.comment ||
          evt?.Payload?.Message;

        if (!isChatLike) return;

        const username =
          evt?.data?.uniqueId ||
          evt?.data?.username ||
          evt?.data?.user?.uniqueId ||
          evt?.data?.user?.username ||
          evt?.username ||
          evt?.user ||
          evt?.displayName ||
          evt?.Payload?.User?.Name ||
          evt?.Payload?.User?.DisplayName ||
          "viewer";

        const nickname =
          evt?.data?.nickname ||
          evt?.data?.user?.nickname ||
          evt?.nickname ||
          username;

        const text =
          evt?.data?.comment ||
          evt?.data?.message ||
          evt?.data?.text ||
          evt?.comment ||
          evt?.message ||
          evt?.text ||
          evt?.Payload?.Message ||
          "";

        if (!text) return;

        onChat?.({ username, nickname, text: String(text).trim(), raw: evt });
      } catch (err) {
        log(`Error parsing message: ${err.message}`);
      }
    });

    ws.on("close", () => {
      log("Disconnected from TikFinity. Will retry in 3s...");
      onStatusChange?.(false);
      scheduleRetry();
    });

    ws.on("error", (err) => {
      log(`Connection error: ${err.message}`);
      onStatusChange?.(false);
    });
  };

  const scheduleRetry = () => {
    if (isClosedExplicitly) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, 3000);
  };

  connect();

  return {
    reconnect: () => {
      clearTimeout(retryTimer);
      try {
        if (ws) ws.terminate();
      } catch {}
      connect();
    },
    close: () => {
      isClosedExplicitly = true;
      clearTimeout(retryTimer);
      try {
        if (ws) ws.close();
      } catch {}
    }
  };
}
