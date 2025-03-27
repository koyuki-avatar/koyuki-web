import type { AyameAddStreamEvent, Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";

document.addEventListener("DOMContentLoaded", async () => {
  const signalingUrl = import.meta.env.VITE_AYAME_SIGNALING_URL;
  const roomIdPrefix = import.meta.env.VITE_AYAME_ROOM_ID_PREFIX;
  const roomName = import.meta.env.VITE_AYAME_ROOM_NAME;
  const signalingKey = import.meta.env.VITE_AYAME_SIGNALING_KEY;

  const clientId = crypto.randomUUID();
  const options = defaultOptions;
  options.signalingKey = signalingKey;
  options.clientId = clientId;

  let connA: Connection | null = null;
  let connB: Connection | null = null;
  let connC: Connection | null = null;
  let dataChannelC: RTCDataChannel | null = null;

  let videoResolution = { width: 640, height: 480 }; // Default resolution

  // Add dropdown for selecting resolution
  const resolutionSelector = document.createElement("select");
  resolutionSelector.id = "resolution-selector";
  resolutionSelector.innerHTML = `
    <option value="640x480" selected>640x480</option>
    <option value="360x240">360x240</option>
    <option value="144x108">144x108</option>
  `;
  document.body.insertBefore(resolutionSelector, document.body.firstChild);

  resolutionSelector.addEventListener("change", () => {
    const selected = resolutionSelector.value.split("x");
    videoResolution = { width: parseInt(selected[0], 10), height: parseInt(selected[1], 10) };
    console.log("Video resolution set to:", videoResolution);
  });

  // Helper function to get media stream with the selected resolution
  const getMediaStream = async (): Promise<MediaStream> => {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        width: videoResolution.width,
        height: videoResolution.height,
      },
    });
  };

  // Connection A (前方カメラ)
  const connectA = async () => {
    try {
      console.log("Connecting to Room A...");
      const localMediaStreamA = await getMediaStream();
      const localVideoA = document.getElementById("local-video-A") as HTMLVideoElement;
      if (localVideoA) {
        localVideoA.srcObject = localMediaStreamA; // Display local camera feed
        localVideoA.play();
      }

      connA = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-A`, options);

      connA.on("addstream", (event: AyameAddStreamEvent) => {
        const remoteVideoA = document.getElementById("remote-video-A") as HTMLVideoElement;
        if (remoteVideoA) {
          remoteVideoA.srcObject = event.stream;
        }
      });

      connA.connect(localMediaStreamA);
    } catch (error) {
      console.error("Error in connectA:", error);
    }
  };

  // Connection B (後方カメラ)
  const connectB = async () => {
    try {
      console.log("Connecting to Room B...");
      const localMediaStreamB = await getMediaStream();
      const localVideoB = document.getElementById("local-video-B") as HTMLVideoElement;
      if (localVideoB) {
        localVideoB.srcObject = localMediaStreamB; // Display local camera feed
        localVideoB.play();
      }

      connB = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-B`, options);

      connB.on("addstream", (event: AyameAddStreamEvent) => {
        const remoteVideoB = document.getElementById("remote-video-B") as HTMLVideoElement;
        if (remoteVideoB) {
          remoteVideoB.srcObject = event.stream;
        }
      });

      connB.connect(localMediaStreamB);
    } catch (error) {
      console.error("Error in connectB:", error);
    }
  };

  const handleDataChannelMessage = (messageEvent: MessageEvent) => {
    console.log("Received message:", messageEvent.data);

    let receivedImages = document.querySelector("#received-images") as HTMLDivElement;
    if (!receivedImages) {
      console.error("Error: #received-images element not found. Creating dynamically...");
      receivedImages = document.createElement("div");
      receivedImages.id = "received-images";
      document.body.appendChild(receivedImages);
    }

    if (messageEvent.data instanceof ArrayBuffer) {
      const blob = new Blob([new Uint8Array(messageEvent.data)], { type: "image/png" });
      const url = URL.createObjectURL(blob);

      const existingImages = Array.from(receivedImages.querySelectorAll("img"));
      const isDuplicate = existingImages.some((img) => img.src === url);

      if (isDuplicate) {
        console.log("Duplicate image detected. Skipping display.");
        return;
      }

      const img = document.createElement("img");
      img.src = url;
      img.style.maxWidth = "300px";
      img.alt = "Received Image";
      receivedImages.appendChild(img);
      console.log("Image displayed successfully.");
    } else {
      console.error("Unsupported message type:", messageEvent.data);
    }
  };

  const waitForDataChannelOpen = (channel: RTCDataChannel): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (channel.readyState === "open") {
        resolve();
      } else {
        const onOpenHandler = () => {
          channel.removeEventListener("open", onOpenHandler);
          resolve();
        };
        const onErrorHandler = (error: Event) => {
          channel.removeEventListener("error", onErrorHandler);
          reject(new Error("DataChannel failed to open."));
        };

        channel.addEventListener("open", onOpenHandler);
        channel.addEventListener("error", onErrorHandler);
      }
    });
  };

  const handleSendQRCode = async () => {
    try {
      if (!dataChannelC) {
        console.error("DataChannel C が存在しません。まだ初期化されていない可能性があります。");
        return;
      }

      await waitForDataChannelOpen(dataChannelC);

      const qrCodeFile = document.querySelector("#qr-code-input") as HTMLInputElement;
      if (!qrCodeFile || !qrCodeFile.files?.length) {
        console.error("QRコードファイルが選択されていません。");
        return;
      }

      const file = qrCodeFile.files[0];
      const arrayBuffer = await file.arrayBuffer();
      dataChannelC.send(arrayBuffer);
      console.log("QRコードファイルが送信されました。");
    } catch (error) {
      console.error("Error sending QR code:", error);
    }
  };

  document.querySelector("#send-qr-code")?.addEventListener("click", handleSendQRCode);

  const connectC = async () => {
    try {
      console.log("Connecting to Room C...");
      connC = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-C`, options);

      connC.on("open", async () => {
        console.log("Connection C opened.");
        dataChannelC = await connC.createDataChannel("channelC", {});
        if (dataChannelC) {
          console.log("DataChannel C created.");
          dataChannelC.onopen = () => console.log("DataChannel C open.");
          dataChannelC.onmessage = handleDataChannelMessage;
        }
      });

      connC.on("error", (error) => {
        console.error("Connection C encountered an error:", error);
      });

      connC.on("disconnect", () => {
        console.log("Connection C disconnected.");
        dataChannelC = null;
      });

      connC.on("datachannel", (channel: RTCDataChannel) => {
        console.log("DataChannel received:", channel.label);
        channel.onopen = () => console.log("Received DataChannel opened:", channel.label);
        channel.onmessage = handleDataChannelMessage;
        dataChannelC = channel;
      });

      connC.connect();
    } catch (error) {
      console.error("Error in connectC:", error);
    }
  };

  document.querySelector("#connect")?.addEventListener("click", async () => {
    await connectA();
    await connectB();
    await connectC();
  });

  document.querySelector("#disconnect")?.addEventListener("click", async () => {
    if (connA) await connA.disconnect();
    if (connB) await connB.disconnect();
    if (connC) await connC.disconnect();
  });
});
