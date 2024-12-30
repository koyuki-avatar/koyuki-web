# Ayame Web SDK サンプル

[OpenAyame/ayame-web-sdk](https://github.com/OpenAyame/ayame-web-sdk) のサンプル集です。

## 時雨堂のオープンソースソフトウェアについて

利用前に <https://github.com/shiguredo/oss> をお読みください。

## オンラインサンプル

<https://openayame.github.io/ayame-web-sdk-examples/index.html>

## 環境変数を設定する

```bash
# cp .env.example .env.local
VITE_AYAME_SIGNALING_URL=wss://ayame.example.com/signaling
VITE_AYAME_ROOM_ID=ayame-room-id
VITE_AYAME_SIGNALING_KEY=ayame-signaling-key
```

## 起動する

```bash
pnpm install
pnpm dev
```

## サンプル

- sendrecv(双方向送受信)
- recvonly(受信のみ)
- sendonly(送信のみ)
- DataChannel

## ライセンス

Apache License 2.0

```text
Copyright 2019-2024, Shiguredo Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
