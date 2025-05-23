// src/ControlSender.ts

export class ControlSender {
  private dataChannel: RTCDataChannel;
  private maxspeedX = 1;
  private maxspeedZ = 1;
  private isGamepad = false;
  private intervalId: number | null = null;
  private joy: JoyStick;

  constructor(dataChannel: RTCDataChannel) {
    if (dataChannel) this.dataChannel = dataChannel;
    this.joy = new JoyStick("joyDiv");

    const gamepadCheckbox = document.querySelector<HTMLInputElement>("#use-gamepad");
    gamepadCheckbox?.addEventListener("change", () => {
      this.isGamepad = gamepadCheckbox.checked;
      if (!this.isGamepad) this.updateStatus("Disabled");
    });

    window.addEventListener("DOMContentLoaded", () => {
      if (gamepadCheckbox) gamepadCheckbox.checked = false;
    });

    document.querySelector("#set-maxspeed")?.addEventListener("click", () => {
      const x = parseFloat((document.getElementById("maxspeed-x") as HTMLInputElement).value);
      const z = parseFloat((document.getElementById("maxspeed-z") as HTMLInputElement).value);
      this.setMaxSpeed(x, z);
      console.log("maxspeed set:", this.maxspeedX, this.maxspeedZ);
    });
  }

  public setDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    console.log("ControlSender: dataChannel set!");
  }

  public setMaxSpeed(x: number, z: number) {
    this.maxspeedX = x;
    this.maxspeedZ = z;
  }

  private lastsendjson = "";
  private lastsendtime = 0;
  // xin, zin, ain: -1〜1
  private sendCtrlBase(xin: number, zin: number, ain: number) {
    if (!this.dataChannel) {
      console.log("sendCtrlBase: datachannel not found");
      return;
    }

    const xtmp = xin / 3.6;
    const xsend = Math.round(xtmp * this.maxspeedX * 100) / 100;
    const zsend = Math.round(zin * this.maxspeedZ * 100) / 100;
    const asend = Math.round((ain*0.5+0.5) * 180);

    const now = Date.now();
    if ((now - this.lastsendtime) > 300) {
      this.lastsendjson = "";
    }

    const sendjson = JSON.stringify({ x: xsend, z: zsend, a: asend});
    if (sendjson !== this.lastsendjson) {
      // 念のため，2回送る
      this.dataChannel.send(sendjson);
      setTimeout(() => this.dataChannel.send(sendjson), 10);
      this.lastsendjson = sendjson;
      this.lastsendtime = now;
      console.log("sendCtrlBase: sent:", sendjson);
    }
  }

  private sendFromJoy() {
    const x = this.joy.GetY() / 100;
    const z = -this.joy.GetX() / 100;
    const a = parseFloat((document.getElementById("arms") as HTMLInputElement).value);
    if (isNaN(a)) {
      this.sendCtrlBase(x, z, 0);
    } else {
      this.sendCtrlBase(x, z, a);
    }
  }

  private sendFromGamepad() {
    const deadzone = 0.15;
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];

    if (!gp) {
      this.updateStatus("Disconnected; Press Any Button!");
      return;
    }

    const rawx = gp.axes[0];
    const rawy = gp.axes[1];
    const rawa = gp.axes[2];
    const x = Math.abs(rawx) < deadzone ? 0 : rawx;
    const y = Math.abs(rawy) < deadzone ? 0 : rawy;
    const a = Math.abs(rawa) < deadzone ? 0 : rawa;

    const kill = gp.buttons[4].pressed || gp.buttons[5].pressed;
    if (kill) {
      this.sendCtrlBase(0, 0, a);
    } else {
      this.sendCtrlBase(-y, -x, a);
    }

    this.joy.SetXY?.(rawx * 100, -rawy * 100);
    this.updateStatus("Connected: " + gp.id);
    (document.getElementById("arms") as HTMLInputElement).value = a.toString();
  }

  private updateStatus(text: string) {
    const el = document.getElementById("status-gamepad");
    if (el) el.innerText = text;
  }

  public sendCtrl() {
    if (this.isGamepad) {
      this.sendFromGamepad();
    } else {
      this.sendFromJoy();
    }
  }

  public start(intervalMs = 50) {
    this.stop();
    this.intervalId = window.setInterval(() => this.sendCtrl(), intervalMs);
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
