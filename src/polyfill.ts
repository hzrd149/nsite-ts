import { ClientOptions, WebSocket } from "ws";
import { ClientRequestArgs } from "http";

import agent from "./proxy.js";

class ProxyWebSocket extends WebSocket {
  constructor(address: string | URL, options?: ClientOptions | ClientRequestArgs) {
    super(address, { agent, ...options });
  }
}

// @ts-expect-error
global.WebSocket = agent ? ProxyWebSocket : WebSocket;
