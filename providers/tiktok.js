// providers/tiktok.js (ESM)
import { TikTokLiveConnection } from "tiktok-live-connector";

/**
 * Connect to a TikTok LIVE stream directly using TikTokLiveConnection.
 *
 * @param {Object} options
 * @param {string} options.username - TikTok username (without @ or with @)
 * @param {Function} options.onChat - Callback receiving ({ username, nickname, text, avatar, isSubscriber, msgId, raw })
 * @param {Function} [options.onLog] - Callback for logging messages
 * @param {Function} [options.onStatusChange] - Callback receiving ({ connected, connecting, nickname, avatar, username })
 * @returns {Object} Control handle with disconnect(), reconnect(), getStreamerInfo()
 */
export function connectTikTokLive({ username, onChat, onLog, onStatusChange }) {
  const cleanUsername = String(username || "").replace(/^@/, "").trim();
  let tiktokConn = null;
  let isClosedExplicitly = false;
  let reconnectTimer = null;
  const processedMessageIds = new Set();

  let streamerNickname = "";
  let streamerAvatar = "";

  const log = (msg) => {
    if (onLog) onLog(msg);
    else console.log(`[TikTok] ${msg}`);
  };

  const notifyStatus = (connected, connecting = false) => {
    onStatusChange?.({
      connected,
      connecting,
      nickname: connected ? (streamerNickname || cleanUsername) : "",
      avatar: connected ? streamerAvatar : "",
      username: connected ? cleanUsername : ""
    });
  };

  const connect = async () => {
    if (isClosedExplicitly || !cleanUsername) return;

    if (tiktokConn) {
      try {
        tiktokConn.disconnect();
      } catch {}
      tiktokConn = null;
    }

    notifyStatus(false, true);
    log(`Connecting directly to @${cleanUsername}...`);

    try {
      tiktokConn = new TikTokLiveConnection(cleanUsername, {
        processInitialData: true,
        fetchRoomInfoOnConnect: true,
        enableExtendedGiftInfo: false
      });

      const state = await tiktokConn.connect();
      log(`Connected to room ID: ${state?.roomId || "unknown"}`);

      // Extract streamer information
      const rawRoomInfo = state?.roomInfo || tiktokConn.roomInfo;
      const owner = rawRoomInfo ? (rawRoomInfo.owner || (rawRoomInfo.data && rawRoomInfo.data.owner)) : null;

      if (owner) {
        streamerNickname = owner.nickname || owner.display_id || cleanUsername;
        streamerAvatar =
          owner.profilePictureUrl ||
          owner.avatarUrl ||
          (owner.avatar_thumb && owner.avatar_thumb.url_list && owner.avatar_thumb.url_list[0]) ||
          (owner.avatar_medium && owner.avatar_medium.url_list && owner.avatar_medium.url_list[0]) ||
          (owner.avatar_large && owner.avatar_large.url_list && owner.avatar_large.url_list[0]) ||
          "";
      } else {
        streamerNickname = cleanUsername;
        streamerAvatar = "";
      }

      notifyStatus(true, false);

      // Listen for chat messages
      tiktokConn.on("chat", (data) => {
        if (!data) return;

        // Deduplicate messages
        const msgId = data.msgId || data.createTime;
        if (msgId) {
          if (processedMessageIds.has(msgId)) return;
          processedMessageIds.add(msgId);
          if (processedMessageIds.size > 500) {
            const firstKey = processedMessageIds.values().next().value;
            processedMessageIds.delete(firstKey);
          }
        }

        const user = data.user || {};
        const chatText = String(data.comment || data.content || data.text || "").trim();
        if (!chatText) return;

        const avatarUrl =
          user.profilePictureUrl ||
          user.avatarUrl ||
          (user.avatarThumb && user.avatarThumb.urlList && user.avatarThumb.urlList[0]) ||
          (user.avatarMedium && user.avatarMedium.urlList && user.avatarMedium.urlList[0]) ||
          (user.avatarLarge && user.avatarLarge.urlList && user.avatarLarge.urlList[0]) ||
          (data.avatarThumb && data.avatarThumb.urlList && data.avatarThumb.urlList[0]) ||
          "";

        const chatPayload = {
          username: String(user.uniqueId || data.uniqueId || "viewer").trim(),
          nickname: String(user.nickname || data.nickname || user.uniqueId || data.uniqueId || "Viewer").trim(),
          text: chatText,
          avatar: avatarUrl || null,
          isSubscriber: !!(data.isSubscriber || user.isSubscriber),
          msgId,
          raw: data
        };

        log(`[Chat Received] @${chatPayload.nickname}: "${chatPayload.text}"`);
        onChat?.(chatPayload);
      });

      // Handle stream disconnection
      tiktokConn.on("disconnected", () => {
        log("Stream disconnected.");
        tiktokConn = null;
        streamerNickname = "";
        streamerAvatar = "";
        notifyStatus(false, false);

        if (!isClosedExplicitly && cleanUsername) {
          log("Will attempt auto-reconnect in 5s...");
          scheduleReconnect(5000);
        }
      });

      // Handle stream errors
      tiktokConn.on("error", (err) => {
        log(`Connection error: ${err?.message || err}`);
      });

    } catch (err) {
      log(`Failed to connect to @${cleanUsername}: ${err.message || err}`);
      tiktokConn = null;
      streamerNickname = "";
      streamerAvatar = "";
      notifyStatus(false, false);

      if (!isClosedExplicitly && cleanUsername) {
        log("Retrying connection in 5s...");
        scheduleReconnect(5000);
      }
    }
  };

  const scheduleReconnect = (delayMs = 5000) => {
    if (isClosedExplicitly) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, delayMs);
  };

  // Start initial connection
  connect();

  return {
    disconnect: () => {
      isClosedExplicitly = true;
      clearTimeout(reconnectTimer);
      if (tiktokConn) {
        try {
          tiktokConn.disconnect();
        } catch {}
        tiktokConn = null;
      }
      streamerNickname = "";
      streamerAvatar = "";
      notifyStatus(false, false);
    },
    reconnect: () => {
      isClosedExplicitly = false;
      clearTimeout(reconnectTimer);
      connect();
    },
    getStreamerInfo: () => ({
      username: cleanUsername,
      nickname: streamerNickname,
      avatar: streamerAvatar
    })
  };
}

/**
 * Fetch streamer avatar preview for a username without opening an ongoing stream.
 */
export async function fetchTikTokAvatar(username) {
  const cleanUsername = String(username || "").replace(/^@/, "").trim();
  if (!cleanUsername) return "";

  let conn = null;
  try {
    conn = new TikTokLiveConnection(cleanUsername, {
      processInitialData: false,
      fetchRoomInfoOnConnect: true,
      enableExtendedGiftInfo: false
    });

    await conn.connect();
    const rawRoomInfo = conn.roomInfo || (conn.getState && conn.getState() ? conn.getState().roomInfo : null);
    const owner = rawRoomInfo ? (rawRoomInfo.owner || (rawRoomInfo.data && rawRoomInfo.data.owner)) : null;

    let avatarUrl = "";
    if (owner) {
      avatarUrl =
        owner.profilePictureUrl ||
        owner.avatarUrl ||
        (owner.avatar_thumb && owner.avatar_thumb.url_list && owner.avatar_thumb.url_list[0]) ||
        (owner.avatar_medium && owner.avatar_medium.url_list && owner.avatar_medium.url_list[0]) ||
        (owner.avatar_large && owner.avatar_large.url_list && owner.avatar_large.url_list[0]) ||
        "";
    }

    try {
      conn.disconnect();
    } catch {}
    return avatarUrl;
  } catch {
    if (conn) {
      try {
        conn.disconnect();
      } catch {}
    }
    return "";
  }
}
