import fs from "fs";
import pfs from "fs/promises";

import { NSITE_KIND } from "./const.js";
import ndk from "./ndk.js";
import { BLOSSOM_SERVERS, MAX_FILE_SIZE } from "./env.js";
import { makeRequestWithAbort } from "./helpers/http.js";
import { dirname, join } from "path";
import { downloaded, files } from "./cache.js";
import { getServersFromServerListEvent, USER_BLOSSOM_SERVER_LIST_KIND } from "blossom-client-sdk";

// TODO: download the file to /tmp and verify it
async function downloadFile(sha256: string, servers = BLOSSOM_SERVERS) {
  for (const server of servers) {
    try {
      const { response } = await makeRequestWithAbort(new URL(sha256, server));
      if (!response.statusCode) throw new Error("Missing headers or status code");

      const size = response.headers["content-length"];
      if (size && parseInt(size) > MAX_FILE_SIZE) {
        throw new Error("File too large");
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return response;
      } else {
        // Consume response data to free up memory
        response.resume();
      }
    } catch (error) {
      // ignore error, try next server
    }
  }

  throw new Error("No server found");
}

export async function downloadSite(pubkey: string) {
  const user = await ndk.getUser({ pubkey });

  const blossomServers = await ndk.fetchEvent([{ kinds: [USER_BLOSSOM_SERVER_LIST_KIND], authors: [pubkey] }]);
  const servers = blossomServers ? getServersFromServerListEvent(blossomServers).map((u) => u.toString()) : [];

  const nsiteEvents = await ndk.fetchEvents([{ kinds: [NSITE_KIND], authors: [pubkey] }]);

  servers.push(...BLOSSOM_SERVERS);

  console.log(`Found ${nsiteEvents.size} events for ${pubkey}`);

  for (const event of nsiteEvents) {
    const path = event.dTag;
    const sha256 = event.tagValue("x") || event.tagValue("sha256");

    if (!path || !sha256) continue;

    const current = await files.get(join(pubkey, path));
    if (sha256 === current) continue;

    try {
      await pfs.mkdir(dirname(join("data/sites", pubkey, path)), { recursive: true });
    } catch (error) {}

    try {
      const res = await downloadFile(sha256, servers);

      console.log(`Downloading ${pubkey}${path}`);
      res.pipe(fs.createWriteStream(join("data/sites", pubkey, path)));

      await files.set(join(pubkey, path), sha256);
    } catch (error) {
      console.log(`Failed to download ${join(pubkey, path)}`, error);
    }
  }

  console.log(`Finished downloading ${pubkey}`);
  await downloaded.set(pubkey, true);
}
