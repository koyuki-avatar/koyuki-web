import type { AyameAddStreamEvent, Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";
import "../lib/joy.js";
import { ControlSender } from "../lib/ControlSender.ts";

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoomId = urlParams.get("roomId");

  // Environment variables
  const signalingUrl = import.meta.env.VITE_AYAME_SIGNALING_URL;
  const roomIdPrefix = import.meta.env.VITE_AYAME_ROOM_ID_PREFIX;
  const signalingKey = import.meta.env.VITE_AYAME_SIGNALING_KEY;

  let roomName = urlRoomId || import.meta.env.VITE_AYAME_ROOM_NAME || "default-room";
  const clientId = crypto.randomUUID();
  const options = defaultOptions;
  options.signalingKey = signalingKey;
  options.clientId = clientId;

  let connA: Connection | null = null;
  let connB: Connection | null = null;
  let connC: Connection | null = null;
  let dataChannelA: RTCDataChannel | null = null;
  let dataChannelC: RTCDataChannel | null = null;

  let fileMetadata: { fileName: string; fileSize: number } | null = null;
  let receivedFileChunks: ArrayBuffer[] = [];


  // Default video resolution
  let videoResolution = { width: 640, height: 480 };
  const resolutionSelector = document.querySelector("#resolution-selector");
  resolutionSelector.addEventListener("change", () => {
    const selected = resolutionSelector.value.split("x");
    videoResolution = { width: parseInt(selected[0], 10), height: parseInt(selected[1], 10) };
    console.log("Video resolution set to:", videoResolution);
  });

  // Update room name
  const roomNameInput = document.getElementById("room-name") as HTMLInputElement;
  const roomIdPrefixLabel = document.getElementById("room-id-prefix") as HTMLLabelElement;
  if (roomIdPrefixLabel) {
    roomIdPrefixLabel.textContent = roomIdPrefix;
  }
  roomNameInput.value = roomName;

  document.getElementById("update-id")?.addEventListener("click", () => {
    roomName = roomNameInput.value;
    console.log("Room name updated to:", roomName);
  });

  // Helper function to get media stream with video and audio
  const getMediaStream = async (): Promise<MediaStream> => {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        width: videoResolution.width,
        height: videoResolution.height,
      },
      audio: true, // Ensure audio is included
    });
  };

  const handleDataChannelMessage = (messageEvent: MessageEvent) => {
    let data: any;
  
    if (typeof messageEvent.data === "string") {
      try {
        data = JSON.parse(messageEvent.data);
      } catch (e) {
        console.error("JSON のパースに失敗:", e);
        return;
      }
    } else if (typeof messageEvent.data === "object" && messageEvent.data !== null && "type" in messageEvent.data) {
      data = messageEvent.data;
    } else if (messageEvent.data instanceof ArrayBuffer) {
      receivedFileChunks.push(messageEvent.data);
      console.log("チャンク受信: サイズ", messageEvent.data.byteLength);
      return; 
    } else {
      console.error("Unsupported message type:", messageEvent.data);
      return;
    }
  
    if (data.type === "fileHeader") {
      fileMetadata = { fileName: data.fileName, fileSize: data.fileSize };
      receivedFileChunks = [];
      console.log("ファイルヘッダーを受信:", fileMetadata);
    } else if (data.type === "fileDone") {
      const blob = new Blob(receivedFileChunks, { type: "image/png" });
      const url = URL.createObjectURL(blob);
  
      let receivedImages = document.querySelector("#received-images") as HTMLDivElement;
      if (!receivedImages) {
        console.error("受信用の #received-images 要素が見つかりません。動的に生成します。");
        receivedImages = document.createElement("div");
        receivedImages.id = "received-images";
        document.body.appendChild(receivedImages);
      }
      const img = document.createElement("img");
      img.src = url;
      img.style.maxWidth = "300px";
      img.alt = fileMetadata?.fileName || "Received Image";
      receivedImages.appendChild(img);
      console.log("画像が正常に表示されました。");
  
      fileMetadata = null;
      receivedFileChunks = [];
    }
  };
  
  // Connection A (前方カメラ with audio and video in send-only mode)
  const connectA = async () => {
    try {
      console.log("[Room A] Starting connection in send-only mode...");

      const localMediaStreamA = await getMediaStream();
      console.log("[Room A] Obtained local media stream:", localMediaStreamA);

      const localVideoA = document.getElementById("local-video-A") as HTMLVideoElement;
      if (localVideoA) {
        localVideoA.srcObject = localMediaStreamA;
        localVideoA.play();
        console.log("[Room A] Local video element found and stream assigned.");
      } else {
        console.error("[Room A] ERROR: Local video element (#local-video-A) not found!");
      }

      connA = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-A`, options);
      console.log("[Room A] Connection instance created:", connA);

      connA.connect(localMediaStreamA)
        .then(() => {
          console.log("[Room A] Successfully connected using provided media stream.");
        })
        .catch((err: any) => {
          console.error("[Room A] Failed to connect:", err);
        });
    } catch (error) {
      console.error("[Room A] Error in connectA:", error);
    }
  };

  // Connection B (後方カメラ with audio and video in send-only mode)
  const connectB = async () => {
    try {
      console.log("[Room B] Starting connection in send-only mode...");

      const localMediaStreamB = await getMediaStream();
      console.log("[Room B] Obtained local media stream:", localMediaStreamB);

      const localVideoB = document.getElementById("local-video-B") as HTMLVideoElement;
      if (localVideoB) {
        localVideoB.srcObject = localMediaStreamB;
        localVideoB.play();
        console.log("[Room B] Local video element found and stream assigned.");
      } else {
        console.error("[Room B] ERROR: Local video element (#local-video-B) not found!");
      }

      connB = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-B`, options);
      console.log("[Room B] Connection instance created:", connB);

      connB.connect(localMediaStreamB)
        .then(() => {
          console.log("[Room B] Successfully connected using provided media stream.");
        })
        .catch((err: any) => {
          console.error("[Room B] Failed to connect:", err);
        });
    } catch (error) {
      console.error("[Room B] Error in connectB:", error);
    }
  };

  // Connection C
  const connectC = async () => {
    connC = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-C`, options);
    connC.on("open", async () => {
      console.log("Connection C opened.");

      dataChannelC = await connC.createDataChannel("channelC", {});
      if (dataChannelC) {
        dataChannelC.onmessage = (messageEvent: MessageEvent) => {
          handleDataChannelMessage(messageEvent);
        };
      }
    });

    // Handle remote streams (if any)
    connC.on("addstream", (event: AyameAddStreamEvent) => {
      const remoteVideo = document.getElementById("remote-video-C") as HTMLVideoElement;
      if (remoteVideo) {
        remoteVideo.srcObject = event.stream;
      }
    });

    connC.on("datachannel", (dc: RTCDataChannel) => {
      dataChannelC = dc;
      dataChannelC.onopen = () => {
        console.log("DataChannel C opened:", dataChannelC);
      };
      dataChannelC.onmessage = (messageEvent: MessageEvent) => {
        handleDataChannelMessage(messageEvent);
      };
    });

    connC.connect(); // No local media stream provided, making it receive-only
  };

  document.querySelector("#connect")?.addEventListener("click", async () => {
    await connectA();
    await connectB();
    await connectC();
    console.log("All connections established.");
  });

  document.querySelector("#disconnect")?.addEventListener("click", async () => {
    if (connA) await connA.disconnect();
    if (connB) await connB.disconnect();
    if (connC) await connC.disconnect();

    connA = null;
    connB = null;
    connC = null;
    (document.getElementById("remote-video-A") as HTMLVideoElement).srcObject = null;
    (document.getElementById("remote-video-B") as HTMLVideoElement).srcObject = null;
    console.log("All connections disconnected.");
  })
});
