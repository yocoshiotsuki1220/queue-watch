// 一旦全部無効
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());