// src/lib/StatusControler.ts (main.mts からの import パスに合わせる)

export class StatusController {
    private dataChannel: RTCDataChannel | null = null;
    private vbatDisplayElement: HTMLSpanElement | null;
    private lidarToggleButton: HTMLButtonElement | null;
    private powerToggleButton: HTMLButtonElement | null;
    private receivedMessagesTextarea: HTMLTextAreaElement | null; // デバッグ用メッセージ表示

    // 状態変数 (初期値 ON)
    private isLidarOn = true;
    private isPowerOn = true;
    private armOn = false;
    // タイマーID (start/stop のインターフェースのため用意)
    private intervalId: number | null = null;

    constructor() {
        // DOM要素を取得
        this.vbatDisplayElement = document.getElementById("vbat_display") as HTMLSpanElement;
        this.lidarToggleButton = document.getElementById("lidarToggleButton") as HTMLButtonElement;
        this.powerToggleButton = document.getElementById("powerToggleButton") as HTMLButtonElement;
        this.armToggleButton = document.getElementById("arm") as HTMLButtonElement;
        this.receivedMessagesTextarea = document.getElementById("received-messages") as HTMLTextAreaElement;

        // 初期ボタン表示と状態を設定
        this.updateButtonStates();
        this.setButtonsDisabled(true); // 初期は無効

        // ボタンにイベントリスナーを設定
        this.lidarToggleButton?.addEventListener('click', () => this.toggleLidar());
        this.powerToggleButton?.addEventListener('click', () => this.togglePower());
        this.armToggleButton?.addEventListener('click', () => this.togglearm());
        console.log("StatusControler initialized.");
    }

    /**
     * Ayame からデータチャネルが設定/クリアされたときに main.mts から呼ばれることを想定
     */
    public setDataChannel(channel: RTCDataChannel | null) {
        if (this.dataChannel && this.dataChannel !== channel) {
            // 既存のデータチャネルがあれば、イベントリスナーを削除 (念のため)
            this.removeDataChannelEventHandlers();
        }

        this.dataChannel = channel;

        if (this.dataChannel) {
            console.log("StatusControler: DataChannel set.");
            // 新しいデータチャネルにイベントハンドラを設定
            this.setupDataChannelEventHandlers();
        } else {
            console.log("StatusControler: DataChannel cleared.");
            this.resetStatus(); // データチャネルがなくなったらリセット
        }
    }

    /**
     * データチャネルのイベントハンドラを設定する (private)
     */
    private setupDataChannelEventHandlers() {
        if (!this.dataChannel) return;

        // ★ main.mts で onopen/onmessage などが設定されることを前提とするため、
        //    StatusControler 側で onopen/onclose/onerror を上書きしないようにする。
        //    メッセージ処理は main.mts から handleMessage が呼ばれることを期待する。

        // ただし、main.mts の onmessage が StatusControler の handleMessage を呼ぶ想定。
        // main.mts の onopen/onclose で StatusControler の対応メソッドを呼ぶ想定。

        // (onopen, onclose, onerror の設定は削除)

        // onmessage は main.mts 側で設定され、そこから handleMessage を呼ぶ
        // this.dataChannel.onmessage = async (event: MessageEvent) => { /* ... */}
    }

    /**
     * 既存のデータチャネルからイベントリスナーを削除する (private)
     */
    private removeDataChannelEventHandlers() {
        if (!this.dataChannel) return;
        // this.dataChannel.onopen = null; // main.mtsで設定されるので、ここでは触らない
        // this.dataChannel.onclose = null;
        // this.dataChannel.onerror = null;
        // this.dataChannel.onmessage = null;
    }


    /**
     * データチャネルメッセージを処理するメソッド (public - main.mts から呼ばれる想定)
     */
    public async handleMessage(data: string | Blob | ArrayBuffer) {
        let messageText: string | null = null;
        // メッセージデコード
        if (typeof data === 'string') { messageText = data; }
        else if (data instanceof ArrayBuffer) { try { messageText = new TextDecoder().decode(data); } catch (e) { console.error("Failed to decode ArrayBuffer:", e); return; } }
        else if (data instanceof Blob) { try { messageText = await data.text(); console.log("StatusControler: Read Blob as text:", messageText); } catch (e) { console.error("Failed to read Blob data as text:", e); return; } }
        else { console.warn("StatusControler: Received unknown data type:", data); return; }

        // デバッグ用 Textarea への表示 (main.mts でも表示されるかもしれないが、ここでも行う)
         if (this.receivedMessagesTextarea) { this.receivedMessagesTextarea.value += `[SC] ${messageText}\n`; this.receivedMessagesTextarea.scrollTop = this.receivedMessagesTextarea.scrollHeight; }

        // VBat 値の処理
        const lines = messageText.trim().split('\n');
        lines.forEach(line => {
            if (line.startsWith('vbat:')) {
                this.updateVBatDisplay(line.substring(5));
            }
            // 他の受信メッセージタイプがあればここで処理
        });
    }

    // VBat 表示を更新 (private)
    private updateVBatDisplay(vbatValueString: string) {
        console.log('StatusControler: Received VBat:', vbatValueString);
        if (this.vbatDisplayElement) {
            const numValue = parseFloat(vbatValueString);
            this.vbatDisplayElement.textContent = !isNaN(numValue) ? numValue.toFixed(3) + ' V' : 'Invalid';
        }
    }

    // LiDAR トグル処理 (private)
    private toggleLidar() {
        this.isLidarOn = !this.isLidarOn;
        
        if(this.isLidarOn == true){
          const command = 'l1';
          this.sendCommand(command);
        }

        else{
          const command = 'l0';
          this.sendCommand(command);
        }
        //const command = `lidar_on:"${this.isLidarOn}"`;
        //this.sendCommand(command);
        this.updateButtonStates();
    }

    // Power トグル処理 (private)
    private togglePower() {
        this.isPowerOn = !this.isPowerOn;

        if(this.isPowerOn == true){
          const command = 'p1';
          this.sendCommand(command);
        }

        else{
          const command = 'p0';
          this.sendCommand(command);
        }
        //const command = `power_on:"${this.isPowerOn}"`;
        //this.sendCommand(command);
        this.updateButtonStates();
    }

    private togglearm() {
        
      const command = 'a1';
      this.sendCommand(command);
      //this.updateButtonStates();
  }
    // コマンド送信 (private)
    private sendCommand(command: string) {
        if (this.dataChannel == null || this.dataChannel.readyState !== "open") {
            console.warn(`StatusControler: DataChannel not open. Cannot send: ${command}`);
            // データチャネルが開いていない場合、ボタンの状態を戻すことも検討
            // this.isLidarOn = !this.isLidarOn; // 例: LiDARの場合
            // this.updateButtonStates();
            return;
        }
        console.log(`StatusControler: Sending command: ${command}`);
        this.dataChannel.send(command);
    }

    // ボタンの有効/無効状態を更新 (public - main.mtsからも呼べるように)
    public setButtonsDisabled(disabled: boolean) {
        if (this.lidarToggleButton) this.lidarToggleButton.disabled = disabled;
        if (this.powerToggleButton) this.powerToggleButton.disabled = disabled;
        if (this.armToggleButton) this.armToggleButton.disabled = disabled;
        if (disabled) {
            this.updateButtonStates(); // 無効化時はテキストも現在の状態に更新
        }
    }

    // ボタンのテキストを現在の状態に合わせて更新 (private)
    private updateButtonStates() {
        console.log(this.lidarToggleButton, this.powerToggleButton);
         if (this.lidarToggleButton) {
            //this.lidarToggleButton.value = `Toggle LiDAR (${this.isLidarOn ? 'ON' : 'OFF'})`;
           this.lidarToggleButton.textContent = `Toggle LiDAR (${this.isLidarOn ? 'ON' : 'OFF'})`; 
        }
        if (this.powerToggleButton) {
            //this.powerToggleButton.value = `Toggle Power (${this.isPowerOn ? 'ON' : 'OFF'})`;
            this.powerToggleButton.textContent = `Toggle Power (${this.isPowerOn ? 'ON' : 'OFF'})`;
        }
    }

    // ステータスを初期状態にリセット (public - main.mtsからも呼べるように)
    public resetStatus() {
        this.isLidarOn = true;
        this.isPowerOn = true;
        if (this.vbatDisplayElement) this.vbatDisplayElement.textContent = 'N/A';
        this.setButtonsDisabled(true); // ボタンを無効化 & テキストリセット
        console.log("StatusControler: Status reset.");
    }

     /**
      * データチャネルが開いたときに main.mts から呼ばれることを想定
      */
     public onDataChannelOpen() {
        console.log("StatusControler: DataChannel opened event received.");
        this.setButtonsDisabled(false); // ボタンを有効化
        // ★ 初期コマンド送信 (必要なら) ★
        // this.sendCommand(`lidar_on:"${this.isLidarOn}"`);
        // this.sendCommand(`power_on:"${this.isPowerOn}"`);
    }

    /**
     * データチャネルが閉じたときに main.mts から呼ばれることを想定
     */
    public onDataChannelClose() {
        console.log("StatusControler: DataChannel closed event received.");
        this.resetStatus(); // 状態をリセット
    }

    /**
     * main.mts から呼ばれる start メソッド (ControlSender に倣う)
     */
    public start(intervalMs: number = 50) { // intervalMs は使用しない
        this.stop(); // 既存のタイマーがあれば停止
        console.log("StatusControler started.");
        // 定期実行する処理はないが、メソッド自体は用意
    }

    /**
     * main.mts から呼ばれる stop メソッド (ControlSender に倣う)
     */
    public stop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log("StatusControler stopped.");
        // 必要であれば stop 時にボタンを無効化するなどの処理を追加
        // this.setButtonsDisabled(true);
    }
}
