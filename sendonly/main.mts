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
  options.audio.direction = "sendonly";
  options.video.direction = "sendonly";
  options.clientId = clientId;
  options.signalingKey = signalingKey;

  let localMediaStream: MediaStream | null = null;
  let conn: Connection | null = null;

  document.querySelector("#connect")?.addEventListener("click", async () => {
    localMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    const localVideoElement = document.getElementById(
      "local-video",
    ) as HTMLVideoElement;
    if (localVideoElement) {
      localVideoElement.srcObject = localMediaStream;
    }

    conn = createConnection(signalingUrl, roomId, options, debug);
    conn.connect(localMediaStream);
  });

  document.querySelector("#disconnect")?.addEventListener("click", async () => {
    if (!conn) {
      return;
    }
    await conn.disconnect();
    for (const track of localMediaStream?.getTracks() ?? []) {
      track.stop();
    }
    localMediaStream = null;
  });
});
