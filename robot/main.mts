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
  let mode: string | null = null;

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

  const handleViewMode = (mode: "SHOW_VIDEO" | "SHOW_QR" | "SHOW_BOTH") => {
    console.log(`画面モード変更: ${mode}`);
    const videoContainer = document.getElementById("remote-video-C") as HTMLVideoElement;
    const qrContainer = document.getElementById("received-images") as HTMLDivElement;
  

    if (mode === "SHOW_VIDEO") {
      videoContainer.style.display = "block";
      
      // ウィンドウ幅に合わせる
      videoContainer.style.width = `${window.innerWidth}px`;  
      videoContainer.style.height = `${window.innerHeight}px`;  

      // アスペクト比を維持
      videoContainer.style.objectFit = "contain"; 

      qrContainer.style.display = "none";
      console.log("切り替え: 映像モード (ウィンドウ幅に適応)");
    } else if (mode === "SHOW_QR") {
      videoContainer.style.display = "none";
  
      if (qrContainer.children.length > 0) {
        qrContainer.style.display = "block";
        qrContainer.style.width = "100vw";
        qrContainer.style.height = "100vh";
        console.log("切り替え: QRコードモード (フルスクリーン)");
      } else {
        console.warn("QRコードがまだ受信されていません。");
      }
    } else if (mode === "SHOW_BOTH") {
      videoContainer.style.display = "block";
      videoContainer.style.width = "600px"; 
      videoContainer.style.height = "450px"; 
  
      if (qrContainer.children.length > 0) {
        qrContainer.style.display = "block";
        qrContainer.style.width = "230px";
        qrContainer.style.height = "auto";
        console.log("切り替え: 映像 + QRコードモード");
      }
    }
  };
  
  const handleDataChannelMessage = (messageEvent: MessageEvent) => {
    let data: any;
    console.log("-----mode------:", mode)
  
    if (typeof messageEvent.data === "string") {
      try {
        if (messageEvent.data === "SHOW_VIDEO" || messageEvent.data === "SHOW_QR" || messageEvent.data ==="SHOW_BOTH") {
          data = messageEvent.data;
          mode = data
          handleViewMode(mode);
          console.log("mode:",mode)
        } else {
          data = JSON.parse(messageEvent.data);
        }
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

      // 既存のQRコード画像を削除（上書きするため）
      while (receivedImages.firstChild) {
        receivedImages.removeChild(receivedImages.firstChild);
      }

      const img = document.createElement("img");
      img.src = url;
      img.alt = fileMetadata?.fileName || "Received Image";

      console.log("mode2:",mode)
      if (mode === "SHOW_QR") {
        img.style.width = "100%";  
        img.style.height = "100%"; 
        img.style.objectFit = "contain"; 
        console.log("QRコードのみ表示: フルスクリーン化");
      } else {
        img.style.maxWidth = "300px";
        console.log("QRコード表示: 通常サイズ (max-width: 300px)");
      }

      receivedImages.appendChild(img);
      receivedImages.style.display = "block";
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
        console.log("DataChannel C opened:", dataChannelC);  
        dataChannelC.onmessage = (messageEvent: MessageEvent) => { 
          handleDataChannelMessage(messageEvent); 
          console.log(`受信メッセージ: ${messageEvent.data}, DataChannel 状態: ${dataChannelC.readyState}`); 
          const message = messageEvent.data; 
          const videoContainer = document.getElementById("remote-video-C") as HTMLVideoElement; 
          const qrContainer = document.getElementById("received-images") as HTMLDivElement; 
          if (message === "SHOW_VIDEO") { 
            console.log("SHOW_VIDEO 受信！"); 
            videoContainer.style.display = "block";
            qrContainer.style.display = "none";
            console.log("切り替え: 映像モード"); 
          } else if (message === "SHOW_QR") { 
            console.log("SHOW_QR 受信！"); 
            videoContainer.style.display = "none"; 
            if (qrContainer.children.length > 0) { 
              qrContainer.style.display = "block"; 
            } else { 
              console.warn("QRコードがまだ受信されていません。"); 
            } 
            console.log("切り替え: QRコードモード"); 
          } else if (message === "SHOW_BOTH") {
            videoContainer.style.display = "block";
            
            if (qrContainer.children.length > 0) {
              qrContainer.style.display = "block";
              console.log("切り替え: 映像 + QRコードモード");
            } else {
              console.warn("QRコードがまだ受信されていませんが、映像は表示します。");
            }
          }
        
        };
      } 
    }); 
    // Handle remote streams (if any) 
    connC.on("addstream", (event: AyameAddStreamEvent) => { 
      const remoteVideo = document.getElementById("remote-video-C") as HTMLVideoElement; 
      if (remoteVideo) { remoteVideo.srcObject = event.stream; } 
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
