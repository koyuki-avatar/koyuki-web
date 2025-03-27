import type { AyameAddStreamEvent, Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";

document.addEventListener("DOMContentLoaded", async () => {
  // Environment variables
  const signalingUrl = import.meta.env.VITE_AYAME_SIGNALING_URL;
  const roomIdPrefix = import.meta.env.VITE_AYAME_ROOM_ID_PREFIX;
  const signalingKey = import.meta.env.VITE_AYAME_SIGNALING_KEY;

  let roomName = import.meta.env.VITE_AYAME_ROOM_NAME || "default-room";
  const clientId = crypto.randomUUID();
  const options = defaultOptions;
  options.signalingKey = signalingKey;
  options.clientId = clientId;

  let connA: Connection | null = null;
  let connB: Connection | null = null;
  let connC: Connection | null = null;
  let dataChannelC: RTCDataChannel | null = null;
  let localMediaStreamA: MediaStream | null = null;
  let localMediaStreamB: MediaStream | null = null;

  // Default video resolution
  let videoResolution = { width: 640, height: 480 };
  const resolutionSelector = document.querySelector("#resolution-selector");
  resolutionSelector.addEventListener("change", () => {
    const [width, height] = resolutionSelector.value.split("x").map(Number);
    videoResolution = { width, height };
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

  // Helper function for setting up WebRTC connections
  const getMediaStream = async (): Promise<MediaStream> => {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        width: videoResolution.width,
        height: videoResolution.height,
      },
    });
  };

  const setupConnection = async (
    conn: Connection,
    localVideoId: string,
    remoteVideoId: string
  ) => {
    const localMediaStream = await getMediaStream();
    const localVideo = document.getElementById(localVideoId) as HTMLVideoElement;
    if (localVideo) {
      localVideo.srcObject = localMediaStream;
      localVideo.play();
    }

    conn.on("addstream", (event: AyameAddStreamEvent) => {
      const remoteVideo = document.getElementById(remoteVideoId) as HTMLVideoElement;
      if (remoteVideo) {
        remoteVideo.srcObject = event.stream;
      }
    });

    conn.connect(localMediaStream);
    return localMediaStream;
  };

  // Connection A (前方カメラ)
  const connectA = async () => {
    connA = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-A`, options);
    localMediaStreamA = await setupConnection(connA, "local-video-A", "remote-video-A");
  };

  // Connection B (後方カメラ)
  const connectB = async () => {
    connB = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-B`, options);
    localMediaStreamB = await setupConnection(connB, "local-video-B", "remote-video-B");
  };

  // QR Code Handling (Connection C)
  const handleQRCodeMessage = (messageEvent: MessageEvent) => {
    console.log("Received message:", messageEvent.data);
    const receivedImages = document.getElementById("received-images") as HTMLDivElement;
    if (messageEvent.data instanceof ArrayBuffer) {
      const blob = new Blob([messageEvent.data], { type: "image/png" });
      const img = document.createElement("img");
      img.src = URL.createObjectURL(blob);
      img.style.maxWidth = "300px";
      receivedImages.appendChild(img);
    }
  };

  const connectC = async () => {
    connC = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-C`, options);

    connC.on("open", async () => {
      console.log("Connection C opened.");
      dataChannelC = await connC.createDataChannel("channelC", {});
      if (dataChannelC) {
        dataChannelC.onmessage = handleQRCodeMessage;
      }
    });

    connC.connect();
  };

  const sendQRCode = async () => {
    if (!dataChannelC || dataChannelC.readyState !== "open") {
      console.error("DataChannel C is not open.");
      return;
    }

    const qrInput = document.getElementById("qr-code-input") as HTMLInputElement;
    if (!qrInput.files?.length) {
      console.error("No QR code file selected.");
      return;
    }

    const file = qrInput.files[0];
    const arrayBuffer = await file.arrayBuffer();
    dataChannelC.send(arrayBuffer);
    console.log("QR Code sent.");
  };

  document.getElementById("send-qr-code")?.addEventListener("click", sendQRCode);

  // Connect button
  document.getElementById("connect")?.addEventListener("click", async () => {
    await connectA();
    await connectB();
    await connectC();
    console.log("All connections established.");
  });

  // Disconnect button
  document.getElementById("disconnect")?.addEventListener("click", async () => {
    if (connA) await connA.disconnect();
    if (connB) await connB.disconnect();
    if (connC) await connC.disconnect();
    if (localMediaStreamA) localMediaStreamA.getTracks().forEach((track) => track.stop());
    if (localMediaStreamB) localMediaStreamB.getTracks().forEach((track) => track.stop());
    console.log("All connections disconnected.");
  });

});
