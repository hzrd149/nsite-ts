#!/usr/bin/env node
import "./polyfill.js";
import Koa from "koa";
import serve from "koa-static";
import path from "node:path";
import cors from "@koa/cors";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import mime from "mime";
import morgan from "koa-morgan";

import { resolveNpubFromHostname } from "./helpers/dns.js";
import { getNsiteBlobs } from "./events.js";
import { downloadFile, getUserBlossomServers } from "./blossom.js";
import { BLOSSOM_SERVERS } from "./env.js";
import { userRelays, userServers } from "./cache.js";
import { getUserOutboxes } from "./ndk.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = new Koa();

morgan.token("host", (req) => req.headers.host ?? "");

app.use(morgan(":method :host:url :status :response-time ms - :res[content-length]"));

// set CORS headers
app.use(
  cors({
    origin: "*",
    allowMethods: "*",
    allowHeaders: "Authorization,*",
    exposeHeaders: "*",
  }),
);

// handle errors
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = { message: "Something went wrong" };
  }
});

// map pubkeys to folders in sites dir
app.use(async (ctx, next) => {
  const pubkey = (ctx.state.pubkey = await resolveNpubFromHostname(ctx.hostname));

  if (pubkey) {
    console.log(`${pubkey}: Fetching relays`);

    let relays = await userRelays.get<string[] | undefined>(pubkey);
    if (!relays) {
      relays = await getUserOutboxes(pubkey);
      if (relays) await userRelays.set(pubkey, relays);
    }

    console.log(`${pubkey}: Searching for ${ctx.path}`);
    const blobs = await getNsiteBlobs(pubkey, ctx.path, relays);

    if (blobs.length === 0) {
      ctx.status = 404;
      ctx.body = "Not Found";
      return;
    }

    let servers = await userServers.get<string[] | undefined>(pubkey);
    if (!servers) {
      console.log(`${pubkey}: Searching for blossom servers`);
      servers = (await getUserBlossomServers(pubkey)) ?? [];

      await userServers.set(pubkey, servers);
    }
    servers.push(...BLOSSOM_SERVERS);

    for (const blob of blobs) {
      const res = await downloadFile(blob.sha256, servers);

      if (res) {
        const type = mime.getType(blob.path);
        if (type) ctx.set("Content-Type", type);
        else if (res.headers["content-type"]) ctx.set("content-type", res.headers["content-type"]);

        // pass headers along
        if (res.headers["content-length"]) ctx.set("content-length", res.headers["content-length"]);

        ctx.body = res;
        return;
      }
    }

    ctx.status = 500;
    ctx.body = "Failed to download blob";
  } else await next();
});

// serve static files from public
try {
  const www = path.resolve(process.cwd(), "public");
  fs.statSync(www);
  app.use(serve(www));
} catch (error) {
  const www = path.resolve(__dirname, "../public");
  app.use(serve(www));
}

app.listen(process.env.PORT || 3000, () => {
  console.log("Started on port", process.env.PORT || 3000);
});

async function shutdown() {
  console.log("Shutting down...");
  process.exit(0);
}

process.addListener("SIGTERM", shutdown);
process.addListener("SIGINT", shutdown);
