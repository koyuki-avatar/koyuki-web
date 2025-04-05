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
    let dataChannelA: RTCDataChannel | null = null;
    let dataChannelC: RTCDataChannel | null = null;

    // Display Client ID in the UI
    const clientIdInput = document.querySelector("#client-id-input") as HTMLInputElement;
    if (clientIdInput) {
        clientIdInput.value = clientId; // Ensure the Client ID is visible in the input field
        console.log("Client ID set to:", clientId);
    }

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

    let maxspeedX = parseFloat((document.getElementById("maxspeed-x") as HTMLInputElement).value);
    let maxspeedZ = parseFloat((document.getElementById("maxspeed-z") as HTMLInputElement).value);

    // Connection A (Front camera with control via DataChannel)
    const connectA = async () => {
        connA = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-A`, options);

        const localMediaStreamA = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: true,
        });

        const localVideoA = document.getElementById("local-video-A") as HTMLVideoElement;
        if (localVideoA) {
            localVideoA.srcObject = localMediaStreamA;
            localVideoA.play();
        }

        connA.on("addstream", (event: AyameAddStreamEvent) => {
            const remoteVideo = document.getElementById("remote-video-A") as HTMLVideoElement;
            if (remoteVideo) {
                remoteVideo.srcObject = event.stream;
            }
        });

        // DataChannel setup
        connA.on("open", async () => {
            console.log("Connection A opened.");
            dataChannelA = await connA.createDataChannel("controlA", {});

            if (dataChannelA) {
                console.log("DataChannel A created:", dataChannelA);

                // Handle incoming messages
                dataChannelA.onmessage = (messageEvent: MessageEvent) => {
                    console.log("Received control information:", messageEvent.data);
                    const receivedMessages = document.getElementById("received-messages") as HTMLTextAreaElement;
                    if (receivedMessages) {
                        receivedMessages.value += `Control: ${messageEvent.data}\n`;
                    }
                };
            }
        });

        connA.connect(localMediaStreamA);
    };

    // Joystick setup
    declare global {
        interface Window {
            JoyStick: any;
        }
    }
    const joy = new window.JoyStick("joyDiv");

    document.querySelector("#set-maxspeed")?.addEventListener("click", () => {
        maxspeedX = parseFloat((document.getElementById("maxspeed-x") as HTMLInputElement).value);
        maxspeedZ = parseFloat((document.getElementById("maxspeed-z") as HTMLInputElement).value);
        console.log("Max speeds updated:", { maxspeedX, maxspeedZ });
    });

    function sendCtrlBase(xin: number, zin: number) {
        if (!dataChannelA) {
            console.error("DataChannel A is not available.");
            return;
        }

        const xsend = Math.round((xin / 3.6) * maxspeedX * 100) / 100; // Convert km/h to m/s
        const zsend = Math.round(zin * maxspeedZ * 100) / 100;
        const controlMessage = JSON.stringify({ x: xsend, z: zsend });

        dataChannelA.send(controlMessage);
        console.log("Sent control message:", controlMessage);
    }

    function sendCtrlJoy() {
        sendCtrlBase(joy.GetY() / 100, -joy.GetX() / 100);
    }

    // Gamepad setup
    let isGamepadActive = false;
    const gamepadCheckbox = document.querySelector("#use-gamepad") as HTMLInputElement;

    gamepadCheckbox.addEventListener("change", () => {
        isGamepadActive = gamepadCheckbox.checked;
        if (!isGamepadActive) {
            (document.getElementById("status-gamepad") as HTMLElement).innerText = "Disabled";
        }
    });

    function sendCtrlGamepad() {
        const deadzone = 0.15;
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0];
        if (gp) {
            const x = Math.abs(gp.axes[0]) < deadzone ? 0 : gp.axes[0];
            const y = Math.abs(gp.axes[1]) < deadzone ? 0 : gp.axes[1];
            const killButton = gp.buttons[4].pressed || gp.buttons[5].pressed;

            if (killButton) sendCtrlBase(0, 0);
            else sendCtrlBase(-y, -x);

            (document.getElementById("status-gamepad") as HTMLElement).innerText = `Connected: ${gp.id}`;
        } else {
            (document.getElementById("status-gamepad") as HTMLElement).innerText = "Disconnected; Press Any Button!";
        }
    }

    // Send control messages at intervals
    setInterval(() => {
        if (isGamepadActive) {
            sendCtrlGamepad();
        } else {
            sendCtrlJoy();
        }
    }, 50);


    // Connect button
    document.getElementById("connect")?.addEventListener("click", async () => {
        await connectA();
        console.log("Connection A established.");
    });

    // Disconnect button
    document.getElementById("disconnect")?.addEventListener("click", async () => {
        if (connA) {
            await connA.disconnect();
            console.log("Connection A disconnected.");
        }
    });

    // Connection B (後方カメラ + 音声)
    const connectB = async () => {
        connB = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-B`, options);

        const localMediaStreamB = await getMediaStream();

        // Display local video and audio feed
        const localVideoB = document.getElementById("local-video-B") as HTMLVideoElement;
        if (localVideoB) {
            localVideoB.srcObject = localMediaStreamB;
            localVideoB.play();
        }

        connB.on("addstream", (event: AyameAddStreamEvent) => {
            const remoteVideo = document.getElementById("remote-video-B") as HTMLVideoElement;
            if (remoteVideo) {
                remoteVideo.srcObject = event.stream;
            }
        });

        connB.connect(localMediaStreamB); // Attach local media stream to Connection B
    };


    // Connection C (映像送信専用＋データチャンネル)
    const connectC = async () => {
        connC = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-C`, options);

        // 映像の送信用メディアストリームを設定
        const localMediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: videoResolution.width,
                height: videoResolution.height,
            },
            audio: false, // 映像のみ送信
        });

        const localVideo = document.getElementById("local-video-C") as HTMLVideoElement;
        if (localVideo) {
            localVideo.srcObject = localMediaStream;
            localVideo.play();
        }

        connC.on("open", async () => {
            console.log("Connection C opened.");

            // データチャンネルの設定
            dataChannelC = await connC.createDataChannel("channelC", {});
            if (dataChannelC) {
                dataChannelC.onmessage = (messageEvent: MessageEvent) => {
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
            }
        });

        // ローカルメディアストリームを接続
        connC.connect(localMediaStream);
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
        console.log("All connections disconnected.");
    });
});

