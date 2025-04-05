import type { AyameAddStreamEvent, Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";

document.addEventListener("DOMContentLoaded", async () => {
    // Environment variables
    const signalingUrl = import.meta.env.VITE_AYAME_SIGNALING_URL;
    const roomIdPrefix = import.meta.env.VITE_AYAME_ROOM_ID_PREFIX;
    const signalingKey = import.meta.env.VITE_AYAME_SIGNALING_KEY;

    let roomName = import.meta.env.VITE_AYAME_ROOM_NAME;
    const clientId = crypto.randomUUID();
    const options = defaultOptions;
    options.signalingKey = signalingKey;
    options.clientId = clientId;

    let connC: Connection | null = null;
    let dataChannelC: RTCDataChannel | null = null;

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

    const connectC = async () => {
        connC = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-C`, options);
        connC.on("open", async () => {
            console.log("Connection C opened.");

            // データチャンネルの設定
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
    });

    document.querySelector("#disconnect")?.addEventListener("click", async () => {
        if (connC) await connC.disconnect();
        connC = null;
        (document.getElementById("remote-video-C") as HTMLVideoElement).srcObject = null;
    });
});
