import { IncomingMessage } from "http";
import followRedirects from "follow-redirects";
const { http, https } = followRedirects;

import agent from "../proxy.js";

export function makeRequestWithAbort(url: URL) {
  return new Promise<{ response: IncomingMessage; controller: AbortController }>((res, rej) => {
    const cancelController = new AbortController();
    const request = (url.protocol === "https:" ? https : http).get(
      url,
      {
        signal: cancelController.signal,
        agent,
      },
      (response) => {
        res({ response, controller: cancelController });
      },
    );
    request.on("error", (err) => rej(err));
    request.end();
  });
}
