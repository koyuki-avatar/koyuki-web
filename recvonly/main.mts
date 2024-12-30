import type { Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";

document.addEventListener("DOMContentLoaded", () => {
  const signalingUrl = import.meta.env.VITE_AYAME_SIGNALING_URL;
  const roomId = import.meta.env.VITE_AYAME_ROOM_ID;
  const signalingKey = import.meta.env.VITE_AYAME_SIGNALING_KEY;

  const clientId = crypto.randomUUID();

  const roomIdInputElement = document.querySelector(
    "#roomIdInput",
  ) as HTMLInputElement;
  if (roomIdInputElement) {
    roomIdInputElement.value = roomId;
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
    conn = createConnection(signalingUrl, roomId, options, debug);

    conn.on("addstream", (event: any) => {
      const remoteVideoElement = document.getElementById(
        "remote-video",
      ) as HTMLVideoElement;
      if (remoteVideoElement) {
        remoteVideoElement.srcObject = event.stream;
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
