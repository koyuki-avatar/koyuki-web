import type {
  AyameAddStreamEvent,
  Connection,
} from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";
import "../lib/joy.js";
import { ControlSender } from "../lib/ControlSender.ts";

// WebRTC
document.addEventListener("DOMContentLoaded", () => {
  const signalingUrl = import.meta.env.VITE_AYAME_SIGNALING_URL;
  const roomIdPrefix = import.meta.env.VITE_AYAME_ROOM_ID_PREFIX;
  let roomName = import.meta.env.VITE_AYAME_ROOM_NAME;
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

  const debug = true;

  const options = defaultOptions;
  options.clientId = clientId;
  options.signalingKey = signalingKey;

  let conn: Connection | null = null;
  // DataChannel
  const label = "message";
  let dataChannel: RTCDataChannel | null = null;

  document.querySelector("#connect")?.addEventListener("click", async () => {
    const roomId = `${roomIdPrefix}${roomName}`;
    conn = createConnection(signalingUrl, roomId, options, debug);

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
    });

    conn.connect(null);
  });

  document.querySelector("#disconnect")?.addEventListener("click", async () => {
    if (!conn) {
      return;
    }
    await conn.disconnect();
  });

  const sender = new ControlSender();
});
