import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname),
  // NOTE:baseをデプロイ先のURLに変える
  base: "https://avatar.doshisha.ac.jp/dist/",
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        sendrecv: resolve(__dirname, "sendrecv/index.html"),
        sendonly: resolve(__dirname, "sendonly/index.html"),
        recvonly: resolve(__dirname, "recvonly/index.html"),
        datachannel: resolve(__dirname, "datachannel/index.html"),
        sendrecvdata: resolve(__dirname, "sendrecvdata/index.html"),
        koyukictrl: resolve(__dirname, "koyukictrl/index.html"),
      },
    },
  },
  envDir: resolve(__dirname),
});
