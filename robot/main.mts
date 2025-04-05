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

  // Connection A (前方カメラ with audio and video in send-only mode)
  const connectA = async () => {
    try {
      console.log("Connecting to Room A in send-only mode...");
      const localMediaStreamA = await getMediaStream();

      // Display local video and audio feed
      const localVideoA = document.getElementById("local-video-A") as HTMLVideoElement;
      if (localVideoA) {
        localVideoA.srcObject = localMediaStreamA;
        localVideoA.play();
      }

      connA = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-A`, options);

      connA.connect(localMediaStreamA); // Send local media stream (send-only)
    } catch (error) {
      console.error("Error in connectA:", error);
    }
  };

  // Connection B (後方カメラ with audio and video in send-only mode)
  const connectB = async () => {
    try {
      console.log("Connecting to Room B in send-only mode...");
      const localMediaStreamB = await getMediaStream();

      // Display local video and audio feed
      const localVideoB = document.getElementById("local-video-B") as HTMLVideoElement;
      if (localVideoB) {
        localVideoB.srcObject = localMediaStreamB;
        localVideoB.play();
      }

      connB = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-B`, options);

      connB.connect(localMediaStreamB); // Send local media stream (send-only)
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

  const connectC = async () => {
    try {
      console.log("Connecting to Room C as receive-only...");
      connC = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-C`, options);
  
      // Handle incoming messages from the data channel
      connC.on("datachannel", (channel: RTCDataChannel) => {
        console.log("DataChannel received:", channel.label);
        channel.onopen = () => console.log("DataChannel opened:", channel.label);
        channel.onmessage = (messageEvent: MessageEvent) => {
          console.log("Received message:", messageEvent.data);
          handleDataChannelMessage(messageEvent);
        };
        dataChannelC = channel; // Assign to global variable for reference
      });
  
      // Handle remote streams (if any)
      connC.on("addstream", (event: AyameAddStreamEvent) => {
        const remoteVideo = document.getElementById("remote-video-C") as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = event.stream;
          console.log("Received remote stream for Connection C.");
        }
      });
  
      connC.on("error", (error) => {
        console.error("Connection C encountered an error:", error);
      });
  
      connC.on("disconnect", () => {
        console.log("Connection C disconnected.");
        dataChannelC = null;
      });
  
      connC.connect(); // No local media stream provided, making it receive-only
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
