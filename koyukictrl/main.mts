import type {
    AyameAddStreamEvent,
    Connection,
} from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";
import { Dualshock4 } from 'webhid-ds4'

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
        "#client-id-input",
    ) as HTMLInputElement;
    if (clientIdInputElement) {
        clientIdInputElement.value = clientId;
    }

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
        localMediaStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        });

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

    // メッセージ送信
    //  document
    //    .querySelector("#send-message")
    //    ?.addEventListener("click", async () => {
    //      if (!dataChannel) {
    //        console.log("------------- dataChannel not found ----------------");
    //        return;
    //      }
    //      const message = document.querySelector("#message") as HTMLInputElement;
    //      if (!message) {
    //        console.log("------------- message not found ----------------");
    //        return;
    //      }
    //      dataChannel.send(message.value);
    //      console.log("------------- send message ----------------", message.value);
    //    });

    document.querySelector("#disconnect")?.addEventListener("click", async () => {
        if (!conn) {
            return;
        }
        await conn.disconnect();
    });


    // JoyStick like 
    let joy = new JoyStick('joyDiv');
    let maxspeedX = document.getElementById("maxspeed-x").value; 
    let maxspeedZ = document.getElementById("maxspeed-z").value;
    document.querySelector("#set-maxspeed")?.addEventListener("click", () => {
        maxspeedX = document.getElementById("maxspeed-x").value;
        maxspeedZ = document.getElementById("maxspeed-z").value;
    });

    function sendCtrlBase(xin: number, zin: number) {
        if (!dataChannel) {
            console.log("sendCtrlBase: datachannel not found");
        } else {
            let sendjson = JSON.stringify({x: xin, z: zin});
            dataChannel.send(sendjson);
            console.log("sendCtrlBase: sent: ", sendjson);
        }

    }
    function sendCtrlJoy() {
        let divmaxX = 100.0 / maxspeedX;
        let divmaxZ = 100.0 / maxspeedZ;
        sendCtrlBase(Math.round(joy.GetY() *100/ divmaxZ)/100, Math.round(joy.GetX() *100/ divmaxZ)/100)
    }

    let isds4av = false;
    let DS4;
    // DS4
    document.querySelector("#init-ds4")?.addEventListener("click",
        async () => {
            DS4 = new DualShock4();
            await DS4.init();
            await DS4.lightbar.setColorRGB(0,128,0);
            isds4av = true;
        });
    function sendCtrlDS4() {
        // TODO: 値の範囲を反映
        let divmaxX = 100.0 / maxspeedX;
        let divmaxZ = 100.0 / maxspeedZ;
        sendCtrlBase(Math.round(DS4.state.axes.leftStickY *100/ divmaxZ)/100, Math.round(DS4.state.axes.leftStickX *100/ divmaxZ)/100)
    }

    function sendCtrl() {
        if(!isds4av) {
            sendCtrlJoy();
        } else {
            sendCtrlDS4();
        }
    }
    // TODO: 周期をちゃんと決める
    setInterval(sendCtrl, 50);
});
