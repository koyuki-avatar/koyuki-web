import type { AyameAddStreamEvent, Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";
import { ControlSender } from "../lib/ControlSender.ts";

// --------------------------------------------------------------------------
//  DOM READY
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoomId = urlParams.get("roomId");

  // ------------------------------------------------------------------------
  //  Environment
  // ------------------------------------------------------------------------
  const signalingUrl = import.meta.env.VITE_AYAME_SIGNALING_URL;
  const roomIdPrefix = import.meta.env.VITE_AYAME_ROOM_ID_PREFIX;
  const signalingKey = import.meta.env.VITE_AYAME_SIGNALING_KEY;

  let roomName = urlRoomId || import.meta.env.VITE_AYAME_ROOM_NAME || "default-room";
  const clientId = crypto.randomUUID();
  const options = { ...defaultOptions, signalingKey, clientId };

  // ------------------------------------------------------------------------
  //  Connection state
  // ------------------------------------------------------------------------
  let connC: Connection | null = null;
  let dataChannelC: RTCDataChannel | null = null;

  // ------------------------------------------------------------------------
  //  File-transfer state
  // ------------------------------------------------------------------------
  let fileMetadata: { fileName: string; fileSize: number } | null = null;
  let receivedFileChunks: ArrayBuffer[] = [];

  // ------------------------------------------------------------------------
  //  View-mode state
  // ------------------------------------------------------------------------
  let mode: "SHOW_VIDEO" | "SHOW_QR" | "SHOW_BOTH" | null = null;

  // ------------------------------------------------------------------------
  //  Reconnect helper (after first manual connect)
  // ------------------------------------------------------------------------
  let autoReconnect = false; // becomes true after first open
  let reconnectTimer: number | null = null;
  const RECONNECT_DELAY = 2000; // ms

  const scheduleReconnect = () => {
    if (!autoReconnect) return;
    if (reconnectTimer !== null) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      console.log("Auto-reconnect…");
      connectC();
    }, RECONNECT_DELAY);
  };

  // ------------------------------------------------------------------------
  //  UI: room name
  // ------------------------------------------------------------------------
  const roomNameInput = document.getElementById("room-name") as HTMLInputElement;
  const roomIdPrefixLabel = document.getElementById("room-id-prefix") as HTMLLabelElement;
  if (roomIdPrefixLabel) roomIdPrefixLabel.textContent = roomIdPrefix;
  roomNameInput.value = roomName;
  document.getElementById("update-id")?.addEventListener("click", () => {
    roomName = roomNameInput.value;
    console.log("Room name updated to:", roomName);
  });

  // ------------------------------------------------------------------------
  //  View-mode handler
  // ------------------------------------------------------------------------
  const handleViewMode = (m: "SHOW_VIDEO" | "SHOW_QR" | "SHOW_BOTH") => {
    mode = m;
    const video = document.getElementById("remote-video-C") as HTMLVideoElement;
    const qr = document.getElementById("received-images") as HTMLDivElement;

    // helper to clear layout-related inline styles (position / size)
    const resetStyles = () => {
      [video, qr].forEach((el) => {
        el.style.position = "";
        el.style.top = "";
        el.style.left = "";
        el.style.right = "";
        el.style.bottom = "";
        el.style.width = "";
        el.style.height = "";
        el.style.background = "";
        el.style.display = "";
        el.style.justifyContent = "";
        el.style.alignItems = "";
        el.style.marginTop = "";
      });
    };

    resetStyles();

    switch (m) {
      // --------------------------------------------------------------------
      case "SHOW_VIDEO": {
        video.style.display = "block";
        video.style.position = "fixed";
        video.style.top = "0";
        video.style.left = "0";
        video.style.width = "100vw";
        video.style.height = "100vh";
        video.style.objectFit = "cover";
        video.style.background = "black";
        qr.style.display = "none";
        break;
      }
      // --------------------------------------------------------------------
      case "SHOW_QR": {
        qr.style.display = "flex";
        qr.style.position = "fixed";
        qr.style.top = "0";
        qr.style.left = "0";
        qr.style.width = "100vw";
        qr.style.height = "100vh";
        qr.style.background = "white";
        qr.style.justifyContent = "center";
        qr.style.alignItems = "center";

        if (qr.children.length === 0) {
          qr.innerHTML = "<span style=\"font-size:2rem;color:#444;\">Waiting for QR…</span>";
        }
        video.style.display = "none";
        break;
      }
      // --------------------------------------------------------------------
      case "SHOW_BOTH": {
        // keep original layout flow
        video.style.display = "block";
        video.style.width = "600px";
        video.style.height = "450px";
        video.style.objectFit = "contain";

        qr.style.display = "block";
        qr.style.background = "white";
        qr.style.marginTop = "10px"; // keep below video as in original HTML
        // do NOT position fixed so it stays under heading
        break;
      }
    }
    console.log("画面モード変更:", m);
  };

  // ------------------------------------------------------------------------
  //  DataChannel message handler
  // ------------------------------------------------------------------------
  const handleDataChannelMessage = (ev: MessageEvent) => {
    // commands --------------------------------------------------------------
    if (typeof ev.data === "string") {
      if (ev.data === "SHOW_VIDEO" || ev.data === "SHOW_QR" || ev.data === "SHOW_BOTH") {
        handleViewMode(ev.data);
        return;
      }
      try {
        const json = JSON.parse(ev.data);
        processControlMessage(json);
      } catch (e) {
        console.error("JSON parse error:", e);
      }
      return;
    }

    // file chunk -----------------------------------------------------------
    if (ev.data instanceof ArrayBuffer) {
      receivedFileChunks.push(ev.data);
      return;
    }

    // object message -------------------------------------------------------
    if (typeof ev.data === "object" && ev.data !== null && "type" in ev.data) {
      processControlMessage(ev.data);
    }
  };

  // ------------------------------------------------------------------------
  const processControlMessage = (data: any) => {
    if (data.type === "fileHeader") {
      fileMetadata = { fileName: data.fileName, fileSize: data.fileSize };
      receivedFileChunks = [];
      return;
    }

    if (data.type === "fileDone") {
      const blob = new Blob(receivedFileChunks, { type: "image/png" });
      const url = URL.createObjectURL(blob);

      let qr = document.querySelector("#received-images") as HTMLDivElement;
      if (!qr) {
        qr = document.createElement("div");
        qr.id = "received-images";
        document.body.appendChild(qr);
      }

      qr.innerHTML = ""; // clear previous content

      const img = document.createElement("img");
      img.src = url;
      img.alt = fileMetadata?.fileName || "Received Image";
      img.style.objectFit = "contain";

      img.style.maxHeight = "90vh"; // keep some margin
      img.style.maxWidth = "90vw";

      qr.appendChild(img);
      qr.style.background = "white";

      fileMetadata = null;
      receivedFileChunks = [];
    }
  };

  // ------------------------------------------------------------------------
  //  Connection routine
  // ------------------------------------------------------------------------
  const connectC = async () => {
    if (connC) {
      console.log("connectC skipped: connection already exists.");
      return;
    }

    connC = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-C`, options);

    connC.on("open", async () => {
      console.log("Connection C opened.");
      autoReconnect = true;
      dataChannelC = await connC!.createDataChannel("channelC", {});
      if (dataChannelC) {
        dataChannelC.onopen    = () => console.log("DataChannel C opened (local).");
        dataChannelC.onmessage = handleDataChannelMessage;
      }
    });

    connC.on("addstream", (ev: AyameAddStreamEvent) => {
      (document.getElementById("remote-video-C") as HTMLVideoElement).srcObject = ev.stream;
    });

    connC.on("datachannel", (dc: RTCDataChannel) => {
      dataChannelC = dc;
      dataChannelC.onopen    = () => console.log("DataChannel C opened (remote).");
      dataChannelC.onmessage = handleDataChannelMessage;
    });

    connC.on("disconnect", () => {
      console.log("Connection C disconnected.");
      connC = null;
      (document.getElementById("remote-video-C") as HTMLVideoElement).srcObject = null;
      scheduleReconnect();
    });

    connC.connect();
  };

  // ------------------------------------------------------------------------
  //  UI buttons (no auto‑connect at start)
  // ------------------------------------------------------------------------
  document.querySelector("#connect")?.addEventListener("click", async () => {
    await connectC();
  });

  document.querySelector("#disconnect")?.addEventListener("click", async () => {
    if (connC) await connC.disconnect();
    connC = null;
    (document.getElementById("remote-video-C") as HTMLVideoElement).srcObject = null;
    scheduleReconnect();
  });
});
