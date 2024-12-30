import type { Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";

document.addEventListener("DOMContentLoaded", () => {
  const signalingUrl = import.meta.env.VITE_AYAME_SIGNALING_URL;
  const roomIdPrefix = import.meta.env.VITE_AYAME_ROOM_ID_PREFIX;
  const roomName = import.meta.env.VITE_AYAME_ROOM_NAME;
  const signalingKey = import.meta.env.VITE_AYAME_SIGNALING_KEY;

  const clientId = crypto.randomUUID();

  const roomIdPrefixElement = document.querySelector(
    "#room-id-prefix",
  ) as HTMLLabelElement;
  if (roomIdPrefixElement) {
    roomIdPrefixElement.textContent = roomIdPrefix;
  }

  const roomNameInputElement = document.querySelector(
    "#room-name",
  ) as HTMLInputElement;
  if (roomNameInputElement) {
    roomNameInputElement.value = roomName;
  }

  const clientIdInputElement = document.querySelector(
    "#clientIdInput",
  ) as HTMLInputElement;
  if (clientIdInputElement) {
    clientIdInputElement.value = clientId;
  }

  const debug = true;

  const options = defaultOptions;
  options.clientId = clientId;
  options.signalingKey = signalingKey;

  let conn: Connection | null = null;
  const label = "message";
  let dataChannel: RTCDataChannel | null = null;

  document.querySelector("#connect")?.addEventListener("click", async () => {
    const roomId = `${roomIdPrefix}${roomName}`;
    conn = createConnection(signalingUrl, roomId, options, debug);

    conn.on("open", async (_) => {
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

    conn.connect(null);
  });

  // メッセージ送信
  document
    .querySelector("#send-message")
    ?.addEventListener("click", async () => {
      if (!dataChannel) {
        console.log("------------- dataChannel not found ----------------");
        return;
      }
      const message = document.querySelector("#message") as HTMLInputElement;
      if (!message) {
        console.log("------------- message not found ----------------");
        return;
      }
      dataChannel.send(message.value);
      console.log("------------- send message ----------------", message.value);
    });

  document.querySelector("#disconnect")?.addEventListener("click", async () => {
    if (!conn) {
      return;
    }
    await conn.disconnect();
  });
});
