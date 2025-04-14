import type {
  AyameAddStreamEvent,
  Connection,
} from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";
import { ControlSender } from "../lib/ControlSender.ts";

// WebRTC
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoomId = urlParams.get("roomId");

  const signalingUrl = import.meta.env.VITE_AYAME_SIGNALING_URL;
  const roomIdPrefix = import.meta.env.VITE_AYAME_ROOM_ID_PREFIX;
  let roomName = urlRoomId || import.meta.env.VITE_AYAME_ROOM_NAME || "default-room";
  const signalingKey = import.meta.env.VITE_AYAME_SIGNALING_KEY;

  const clientId = crypto.randomUUID();

  const roomIdPrefixElement = document.querySelector(
    "#room-id-prefix",
  ) as HTMLLabelElement;
  if (roomIdPrefixElement) {
    roomIdPrefixElement.textContent = roomIdPrefix;
  }

  let roomNameInputElement = document.querySelector(
    "#room-name",
  ) as HTMLInputElement;
  if (roomNameInputElement) {
    roomNameInputElement.value = roomName;
  }

  const clientIdInputElement = document.querySelector(
    "#client-id-input",
  ) as HTMLInputElement;
  if (clientIdInputElement) {
    clientIdInputElement.value = clientId;
  }

  document.querySelector("#update-id")?.addEventListener("click", () => {
    roomName = document.getElementById("room-name").value;
    console.log(roomNameInputElement.value);
    roomNameInputElement = document.querySelector(
      "#room-name",
    ) as HTMLInputElement;
    if (roomNameInputElement) {
      roomNameInputElement.value = roomName;
    }
  });

  // video resolution
  // Default video resolution
  let videoResolution = { width: 640, height: 480 };

  const resolutionSelector = document.querySelector("#resolution-selector");
  resolutionSelector.addEventListener("change", () => {
    const [width, height] = resolutionSelector.value.split("x").map(Number);
    videoResolution = { width, height };
    console.log("Video resolution set to:", videoResolution);
  });

  // Helper function for setting up WebRTC connections
  const getMediaStream = async (): Promise<MediaStream> => {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: videoResolution.width,
        height: videoResolution.height,
      },
    });
  };

  const debug = true;

  const options = defaultOptions;
  options.clientId = clientId;
  options.signalingKey = signalingKey;

  let localMediaStream: MediaStream | null = null;
  let conn: Connection | null = null;
  // DataChannel
  const label = "message";
  let dataChannel: RTCDataChannel | null = null;

  document.querySelector("#connect")?.addEventListener("click", async () => {
    localMediaStream = await getMediaStream();
    const localVideoElement = document.getElementById(
      "local-video",
    ) as HTMLVideoElement;
    if (localVideoElement) {
      localVideoElement.srcObject = localMediaStream;
    }

    const roomId = `${roomIdPrefix}${roomName}`;
    conn = createConnection(signalingUrl, roomId, options, debug);

    conn.on("addstream", (event: AyameAddStreamEvent) => {
      const remoteVideoElement = document.getElementById(
        "remote-video",
      ) as HTMLVideoElement;
      if (remoteVideoElement) {
        remoteVideoElement.srcObject = event.stream;
      }
    });

    // WebRTC が確立したら connection-state に pc.connectionState 反映する
    conn.on("open", (event: Event) => {
      if (!conn) {
        return;
      }
      const pc = conn.peerConnection;
      if (pc) {
        pc.onconnectionstatechange = (event: Event) => {
          const connectionStateElement = document.getElementById(
            "connection-state",
          ) as HTMLSpanElement;
          if (connectionStateElement) {
            // data- に connectionState を追加する
            connectionStateElement.dataset.connectionState = pc.connectionState;
          }
        };
      }
    });
    conn.on("open", async (e: unknown) => {
      if (!conn) {
        return;
      }
      dataChannel = await conn.createDataChannel(label, {});
      if (dataChannel) {
        console.log(
          "------------- dataChannel created ----------------",
          dataChannel,
        );
        dataChannel.onopen = () => {
          console.log("------------- dataChannel onopen ----------------");
          sender.setDataChannel(dataChannel);
          sender.start(50);
        };
        dataChannel.onmessage = (messageEvent: MessageEvent) => {
          console.log(
            "------------- dataChannel onmessage ----------------",
            messageEvent,
          );
          const receivedMessages = document.querySelector(
            "#received-messages",
          ) as HTMLTextAreaElement;
          if (receivedMessages) {
            receivedMessages.value += `${messageEvent.data}\n`;
          }
        };
      }
    });

    conn.on("datachannel", (dc: RTCDataChannel) => {
      console.log("------------- dataChannel created ----------------", dc);
      dataChannel = dc;
      dataChannel.onopen = () => {
        console.log("------------- dataChannel onopen ----------------");
        sender.setDataChannel(dataChannel);
        sender.start(50);
      };
      dataChannel.onmessage = (messageEvent: MessageEvent) => {
        const receivedMessages = document.querySelector(
          "#received-messages",
        ) as HTMLTextAreaElement;
        if (receivedMessages) {
          receivedMessages.value += `${messageEvent.data}\n`;
        }
      };
    });

    conn.on("disconnect", (event: Event) => {
      if (!conn) {
        return;
      }
      conn = null;

      for (const track of localMediaStream?.getTracks() ?? []) {
        track.stop();
      }
      localMediaStream = null;

      const localVideoElement = document.getElementById(
        "local-video",
      ) as HTMLVideoElement;
      if (localVideoElement) {
        localVideoElement.srcObject = null;
      }
      const remoteVideoElement = document.getElementById(
        "remote-video",
      ) as HTMLVideoElement;
      if (remoteVideoElement) {
        remoteVideoElement.srcObject = null;
      }
    });

    conn.connect(localMediaStream);
  });


  document.querySelector("#disconnect")?.addEventListener("click", async () => {
    if (!conn) {
      return;
    }
    await conn.disconnect();
  });

  const sender = new ControlSender();
});
