import http from "node:http";
import { NGINX_HOST } from "./env.js";

export function invalidateCache(host: string, path: string) {
  if (!NGINX_HOST) return Promise.resolve(false);

  return new Promise<boolean>((resolve, reject) => {
    const req = http.request(
      {
        hostname: NGINX_HOST,
        method: "GET",
        port: 80,
        path,
        headers: {
          Host: host,
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(true);
        else reject(new Error("Failed to invalidate"));
      },
    );

    req.end();
  });
}
