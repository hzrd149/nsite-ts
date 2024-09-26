import pfs from "node:fs/promises";
import crypto from "node:crypto";
import { join } from "node:path";

import { NGINX_CACHE_DIR } from "./env.js";
import { userDomains } from "./cache.js";

export async function invalidatePubkeyPath(pubkey: string, path: string) {
  const iterator = userDomains.iterator?.(undefined);
  if (!iterator) return;

  const promises: Promise<boolean | undefined>[] = [];
  for await (const [domain, key] of iterator) {
    if (key === pubkey) {
      promises.push(invalidateNginxCache(domain, path));
    }
  }

  await Promise.allSettled(promises);
}

export async function invalidateNginxCache(host: string, path: string) {
  if (!NGINX_CACHE_DIR) return Promise.resolve(false);

  try {
    const key = `${host}${path}`;
    const md5 = crypto.createHash("md5").update(key).digest("hex");

    // NOTE: hard coded to cache levels 1:2
    const cachePath = join(NGINX_CACHE_DIR, md5.slice(-1), md5.slice(-3, -1), md5);
    await pfs.rm(cachePath);

    console.log(`Invalidated ${key} (${md5})`);
  } catch (error) {
    // ignore errors
  }
}
