import type {
  AyameAddStreamEvent,
  Connection,
} from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";



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


  // send control over datachannel
  function sendCtrlBase(xin: number, zin: number) {
    if (!dataChannel) {
      console.log("sendCtrlBase: datachannel not found");
    } else {
      const xtmp = xin / 3.6; // km/h -> m/s
      const xsend = (Math.round(xtmp*maxspeedX*100)/100);
      const zsend = (Math.round(zin*maxspeedZ*100)/100);

      let sendjson = JSON.stringify({x: xsend, z: zsend});
      dataChannel.send(sendjson);
      console.log("sendCtrlBase: sent: ", sendjson);
    }
  }

  // JoyStick like 
  declare global {
    interface Window {
      JoyStick: any;
    }
  }
  const joy = new window.JoyStick('joyDiv');
  let maxspeedX = document.getElementById("maxspeed-x").value; 
  let maxspeedZ = document.getElementById("maxspeed-z").value;

  document.querySelector("#set-maxspeed")?.addEventListener("click", () => {
    maxspeedX = document.getElementById("maxspeed-x").value;
    maxspeedZ = document.getElementById("maxspeed-z").value;

    console.log("maxspeed: ", maxspeedX,", ",maxspeedZ)
  });

  function sendCtrlJoy() {
    sendCtrlBase(joy.GetY()/100, -joy.GetX()/100);
  }

  // Gamepad
  let isgamepad = false;
  const gamepadcheckbox = document.querySelector("#use-gamepad");
  gamepadcheckbox.addEventListener("change", () => {
    if (gamepadcheckbox.checked) {
      isgamepad = true;
    } else {
      isgamepad = false;
      document.getElementById("status-gamepad").innerHTML = "Disabled";
    }
  });
  window.addEventListener('DOMContentLoaded', () => {
    gamepadcheckbox.checked = false;
  });

  function sendCtrlGamepad() {
    const deadzone = 0.15;
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];
    if (gp) {
      const rawx = gp.axes[0]; // left: -1, right: 1
      const rawy = gp.axes[1]; // top: -1, bottom: 1
      const x = (Math.abs(rawx) < deadzone) ? 0 : rawx;
      const y = (Math.abs(rawy) < deadzone) ? 0 : rawy;
      const killbutton = gp.buttons[4].pressed || gp.buttons[5].pressed;
      if (killbutton) sendCtrlBase(0,0);
      else sendCtrlBase(-y, -x);
      document.getElementById("status-gamepad").innerHTML = "Connected: " + gamepads[0]?.id;
    } else {
      document.getElementById("status-gamepad").innerHTML = "Disconnected; Press Any Button!";
    }
  }

  function sendCtrl() {
    if(isgamepad) {
      sendCtrlGamepad();
    } else {
      sendCtrlJoy();
    }
  }
  // TODO: 周期をちゃんと決める
  setInterval(sendCtrl, 50);
});
