import Keyv from "keyv";
import KeyvSqlite from "@keyv/sqlite";
import pfs from "fs/promises";

try {
  await pfs.mkdir("data");
} catch (error) {}

const keyvSqlite = new KeyvSqlite({ dialect: "sqlite", uri: "./data/cache.db" });
keyvSqlite.on("error", (err) => {
  console.log("Connection Error", err);
  process.exit(1);
});

export const files = new Keyv({ store: keyvSqlite, ttl: 1000 * 60 * 60 * 24, namespace: "files" });
export const downloaded = new Keyv({ store: keyvSqlite, ttl: 1000 * 30, namespace: "downloaded" });
