// providers/tikfinity.js (ESM)
import WebSocket from "ws";

/**
 * Connect to TikFinity Developer API WebSocket and surface chat messages with avatar extraction.
 *
 * @param {Object} options
 * @param {string} options.wsUrl - TikFinity WebSocket URL (e.g., ws://localhost:21213/)
 * @param {string} [options.token] - Optional API token
 * @param {Function} options.onChat - Callback receiving ({ username, nickname, text, avatar, raw })
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
        // Ignored
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

        let parsed;
        try {
          parsed = JSON.parse(str);
        } catch {
          return;
        }

        // TikFinity may send an array of events or a single event
        const events = Array.isArray(parsed) ? parsed : [parsed];

        for (const evt of events) {
          if (!evt) continue;

          const lower = (v) => (typeof v === "string" ? v.toLowerCase() : v);
          const t = lower(evt.type || evt.event || evt.Event || evt.eventType || "");

          // Check if event is chat-related
          const isChatLike =
            !t || // if no explicit type, check fields
            t === "chat" ||
            t === "chatmessage" ||
            t === "message" ||
            t === "comment" ||
            typeof evt.message === "string" ||
            typeof evt.comment === "string" ||
            evt?.data?.message ||
            evt?.data?.comment ||
            evt?.Payload?.Message;

          if (!isChatLike) continue;

          const d = evt?.data || evt?.payload || evt?.Payload || evt;

          const text = String(
            d?.comment ||
            d?.message ||
            d?.text ||
            d?.msg ||
            d?.data?.comment ||
            d?.data?.message ||
            evt?.comment ||
            evt?.message ||
            evt?.text ||
            d?.Message ||
            ""
          ).trim();

          if (!text) continue;

          const username = String(
            d?.uniqueId ||
            d?.username ||
            d?.user?.uniqueId ||
            d?.user?.username ||
            evt?.uniqueId ||
            evt?.username ||
            evt?.user ||
            evt?.displayName ||
            d?.User?.Name ||
            d?.User?.DisplayName ||
            "viewer"
          ).trim();

          const nickname = String(
            d?.nickname ||
            d?.user?.nickname ||
            d?.nickName ||
            evt?.nickname ||
            d?.User?.NickName ||
            username
          ).trim();

          // Comprehensive avatar / profile picture extraction
          const avatar =
            d?.profilePictureUrl ||
            d?.profileImageUrl ||
            d?.avatarUrl ||
            d?.userPictureUrl ||
            d?.user?.profilePictureUrl ||
            d?.user?.avatarUrl ||
            d?.user?.profileImageUrl ||
            d?.user?.avatarThumb?.urlList?.[0] ||
            d?.user?.avatarMedium?.urlList?.[0] ||
            evt?.profilePictureUrl ||
            evt?.profileImageUrl ||
            evt?.avatarUrl ||
            d?.User?.ProfilePictureUrl ||
            d?.User?.AvatarUrl ||
            null;

          log(`[Chat Received] @${nickname}: "${text}"`);
          onChat?.({
            username,
            nickname,
            text,
            avatar: avatar ? String(avatar).trim() : null,
            raw: evt
          });
        }
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
