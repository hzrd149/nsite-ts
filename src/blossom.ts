import { getServersFromServerListEvent, USER_BLOSSOM_SERVER_LIST_KIND } from "blossom-client-sdk";

import { BLOSSOM_SERVERS, MAX_FILE_SIZE } from "./env.js";
import { makeRequestWithAbort } from "./helpers/http.js";
import pool from "./nostr.js";

export async function getUserBlossomServers(pubkey: string, relays: string[]) {
  const blossomServersEvent = await pool.get(relays, { kinds: [USER_BLOSSOM_SERVER_LIST_KIND], authors: [pubkey] });

  return blossomServersEvent ? getServersFromServerListEvent(blossomServersEvent).map((u) => u.toString()) : undefined;
}

// TODO: download the file to /tmp and verify it
export async function downloadFile(sha256: string, servers = BLOSSOM_SERVERS) {
  for (const server of servers) {
    try {
      const { response } = await makeRequestWithAbort(new URL(sha256, server));

      try {
        if (!response.statusCode) throw new Error("Missing headers or status code");

        const size = response.headers["content-length"];
        if (size && parseInt(size) > MAX_FILE_SIZE) throw new Error("File too large");

        if (response.statusCode >= 200 && response.statusCode < 300) {
          return response;
        } else throw new Error("Request failed");
      } catch (error) {
        // Consume response data to free up memory
        response.resume();
      }
    } catch (error) {
      // ignore error, try next server
    }
  }
}
