import type { AyameAddStreamEvent, Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";
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

  let connC: Connection | null = null;
  let dataChannelC: RTCDataChannel | null = null;

  let fileMetadata: { fileName: string; fileSize: number } | null = null;
  let receivedFileChunks: ArrayBuffer[] = [];

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
    await connectC();
    console.log("All connections established.");
  });

  document.querySelector("#disconnect")?.addEventListener("click", async () => {
    if (connC) await connC.disconnect();

    connC = null;
    (document.getElementById("remote-video-C") as HTMLVideoElement).srcObject = null;
    console.log("All connections disconnected.");
  })
});
