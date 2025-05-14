import type { AyameAddStreamEvent, Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";
import { ControlSender } from "../lib/ControlSender.ts";
import {StatusController} from "../lib/StatusController.ts";

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

  const sender_status = new StatusController();

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
      audio: true, // Ensure audio is included
      video: {
        width: videoResolution.width,
        height: videoResolution.height,
      },
    });
  };

  const handleDataChannelAReceived = (messageEvent: MessageEvent) => {
    console.log("Received control information:", messageEvent.data);
    const receivedMessages = document.getElementById("received-messages") as HTMLTextAreaElement;
    if (receivedMessages) {
      receivedMessages.value += `Control: ${messageEvent.data}\n`;
    } 
  }

  // Connection A (Front camera with control via DataChannel)
  const connectA = async () => {
    connA = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-A`, options);

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
          sender.setDataChannel(dataChannelA);
          sender.start(50);
          sender_status.setDataChannel(dataChannelA);
          sender_status.start(50);
          sender_status.onDataChannelOpen();
        // Handle incoming messages
        dataChannelA.onmessage = (messageEvent: MessageEvent) => {
          try{
            handleDataChannelAReceived(messageEvent);
          }catch(e){
            console.error("Error in handleDataChannelAReceived (create channel):", e);
          }

          try{
            sender_status.handleMessage(messageEvent.data);
          }catch(e){
            console.error("Error in sender_status.handleMessage (create channel):", e);
          } 
        };
      }
    });

    connA.on("datachannel", (dc: RTCDataChannel) => {
      dataChannelA = dc;
      dataChannelA.onopen = () => {
        console.log("DataChannel A opened:", dataChannelA);
        sender.setDataChannel(dataChannelA);
        sender.start(50);
        sender_status.setDataChannel(dataChannelA);
        sender_status.start(50);
        sender_status.onDataChannelOpen();
    };
      dataChannelA.onmessage = (messageEvent: MessageEvent) => {
        try{
          handleDataChannelAReceived(messageEvent);
        }catch(e){
          console.error("Error in handleDataChannelAReceived (remote channel):", e);
        }
        try{
          sender_status.handleMessage(messageEvent.data);
        }catch(e){
          console.error("Error in sender_status.handleMessage (remote channel):", e);
        }
      };
    });

    connA.connect(null);
  };

  const sender = new ControlSender();

  // Connection B (後方カメラ)
  const connectB = async () => {
    connB = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-B`, options);

    connB.on("addstream", (event: AyameAddStreamEvent) => {
      const remoteVideo = document.getElementById("remote-video-B") as HTMLVideoElement;
      if (remoteVideo) {
        remoteVideo.srcObject = event.stream;
      }
    });

    connB.connect(null);
  };

  // Connection C (映像送信＋データチャンネル)
  const connectC = async () => {
    connC = createConnection(signalingUrl, `${roomIdPrefix}${roomName}-C`, options);

    const localMediaStream = await getMediaStream();

    const localVideo = document.getElementById("local-video-C") as HTMLVideoElement;
    if (localVideo) {
      localVideo.srcObject = localMediaStream;
      localVideo.play();
    }

    connC.on("open", async () => {
      console.log("Connection C opened.");
      
      const videoSender = connC.pc.getSenders().find(sender => sender.track && sender.track.kind === "video");
      if (videoSender) {
        const params = videoSender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          // encodings が空の場合は最低1つのエンコーディングを作成
          params.encodings = [{}];
        }
        // maxBitrate を 800kbps (800,000bps) に制限する
        params.encodings[0].maxBitrate = 800000;
        try {
          await videoSender.setParameters(params);
          console.log("RTCRtpSender parameters updated to 800kbps.");
        } catch (e) {
          console.error("Failed to update video sender parameters:", e);
        }
      } else {
        console.warn("No video sender found.");
      }

      dataChannelC = await connC.createDataChannel("channelC", {});
      if (dataChannelC) {
        console.log("DataChannel C created:", dataChannelA);
        dataChannelC.onmessage = (messageEvent: MessageEvent) => {
        };
      }
    });

    connC.on("datachannel", (dc: RTCDataChannel) => {
      dataChannelC = dc;
      dataChannelC.onopen = () => {
        console.log("DataChannel C opened:", dataChannelC);
      };
      dataChannelC.onmessage = (messageEvent: MessageEvent) => {
        // do nothing
      };
    });

    connC.connect(localMediaStream);
  };

  const CHUNK_SIZE = 16384; // 16KB

  const sendQRCode = async () => {
    if (!dataChannelC || dataChannelC.readyState !== "open") {
      console.error("DataChannel C is not open:", dataChannelC);
      return;
    }

    const qrInput = document.getElementById("qr-code-input") as HTMLInputElement;
    if (!qrInput.files?.length) {
      console.error("QRコードファイルが選択されていません。");
      return;
    }

    const file = qrInput.files[0];
    const fileSize = file.size;
    console.log("送信するファイル:", file.name, "サイズ：", fileSize);

    const header = JSON.stringify({ type: "fileHeader", fileName: file.name, fileSize });
    dataChannelC.send(header);

    let offset = 0;
    while (offset < fileSize) {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const arrayBuffer = await slice.arrayBuffer();
      dataChannelC.send(arrayBuffer);
      console.log("チャンク送信: オフセット", offset, "～", offset + arrayBuffer.byteLength);
      offset += CHUNK_SIZE;
    }

    const doneMsg = JSON.stringify({ type: "fileDone" });
    dataChannelC.send(doneMsg);
    console.log("ファイルの送信が完了しました。");
    const sendViewMode = async (mode: "SHOW_VIDEO" | "SHOW_QR" | "SHOW_BOTH") => {
      console.log(`送信リクエスト: ${mode}, DataChannel 状態: ${dataChannelC.readyState}`);
    
      if (!dataChannelC || dataChannelC.readyState !== "open") {
        console.error("DataChannelC が未接続、または送信不可");
        return;
      }
    
      dataChannelC.send(mode);
      console.log(`送信完了: ${mode}`);
    };

    document.getElementById("show-both")?.addEventListener("click", () => sendViewMode("SHOW_BOTH"));
    document.getElementById("show-video")?.addEventListener("click", () => sendViewMode("SHOW_VIDEO"));
    document.getElementById("show-qr")?.addEventListener("click", () => sendViewMode("SHOW_QR"));
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

    connA = null;
    connB = null;
    connC = null;
    (document.getElementById("remote-video-A") as HTMLVideoElement).srcObject = null;
    (document.getElementById("remote-video-B") as HTMLVideoElement).srcObject = null;
    console.log("All connections disconnected.");
  });
});
