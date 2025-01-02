import type {
  AyameAddStreamEvent,
  Connection,
} from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";

document.addEventListener("DOMContentLoaded", () => {
  const signalingUrl = import.meta.env.VITE_AYAME_SIGNALING_URL;
  const roomIdPrefix = import.meta.env.VITE_AYAME_ROOM_ID_PREFIX;
  const roomName = import.meta.env.VITE_AYAME_ROOM_NAME;
  const signalingKey = import.meta.env.VITE_AYAME_SIGNALING_KEY;

  const clientId = crypto.randomUUID();

  const roomIdPrefixElement = document.querySelector(
    "#room-id-prefix",
  ) as HTMLLabelElement;
  if (roomIdPrefixElement) {
    roomIdPrefixElement.textContent = roomIdPrefix;
  }

  const roomNameInputElement = document.querySelector(
    "#room-name",
  ) as HTMLInputElement;
  if (roomNameInputElement) {
    roomNameInputElement.value = roomName;
  }

  const clientIdInputElement = document.querySelector(
    "#clientIdInput",
  ) as HTMLInputElement;
  if (clientIdInputElement) {
    clientIdInputElement.value = clientId;
  }

  const debug = true;

  const options = defaultOptions;
  options.clientId = clientId;
  options.signalingKey = signalingKey;

  let conn: Connection | null = null;

  document.querySelector("#connect")?.addEventListener("click", async () => {
    const roomId = `${roomIdPrefix}${roomName}`;
    conn = createConnection(signalingUrl, roomId, options, debug);

    conn.on("addstream", (event: AyameAddStreamEvent) => {
      const remoteVideoElement = document.getElementById(
        "remote-video",
      ) as HTMLVideoElement;
      if (remoteVideoElement) {
        remoteVideoElement.srcObject = event.stream;
      }
    });

    // WebRTC が確立したら connection-state に pc.connectionState 反映する
    conn.on("open", (event: Event) => {
      if (!conn) {
        return;
      }
      const pc = conn.peerConnection;
      if (pc) {
        pc.onconnectionstatechange = (event: Event) => {
          const connectionStateElement = document.getElementById(
            "connection-state",
          ) as HTMLSpanElement;
          if (connectionStateElement) {
            // data- に connectionState を追加する
            connectionStateElement.dataset.connectionState = pc.connectionState;
          }
        };
      }
    });

    conn.connect(null);
  });

  document.querySelector("#disconnect")?.addEventListener("click", async () => {
    if (!conn) {
      return;
    }
    await conn.disconnect();
  });
});
