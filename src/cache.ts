import Keyv from "keyv";
import pfs from "fs/promises";
import { CACHE_PATH } from "./env.js";

try {
  await pfs.mkdir("data");
} catch (error) {}

async function createStore() {
  if (!CACHE_PATH || CACHE_PATH === "in-memory") return undefined;
  else if (CACHE_PATH.startsWith("redis://")) {
    const { default: KeyvRedis } = await import("@keyv/redis");
    return new KeyvRedis(CACHE_PATH);
  } else if (CACHE_PATH.startsWith("sqlite://")) {
    const { default: KeyvSqlite } = await import("@keyv/sqlite");
    return new KeyvSqlite(CACHE_PATH);
  }
}

const store = await createStore();

store?.on("error", (err) => {
  console.log("Connection Error", err);
  process.exit(1);
});

const opts = store ? { store } : {};

/** domain -> pubkey */
export const userDomains = new Keyv({
  ...opts,
  namespace: "domains",
  // cache domains for an hour
  ttl: 60 * 60 * 1000,
});

/** pubkey -> blossom servers */
export const userServers = new Keyv({
  ...opts,
  namespace: "servers",
  // cache servers for an hour
  ttl: 60 * 60 * 1000,
});

/** pubkey -> relays */
export const userRelays = new Keyv({
  ...opts,
  namespace: "relays",
  // cache relays for an hour
  ttl: 60 * 60 * 1000,
});
