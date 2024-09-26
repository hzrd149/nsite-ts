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
import { getNsiteBlobs, parseNsiteEvent } from "./events.js";
import { downloadFile, getUserBlossomServers } from "./blossom.js";
import { BLOSSOM_SERVERS, NGINX_CACHE_DIR, SUBSCRIPTION_RELAYS } from "./env.js";
import { userDomains, userRelays, userServers } from "./cache.js";
import { NSITE_KIND } from "./const.js";
import { invalidatePubkeyPath } from "./nginx.js";
import pool, { getUserOutboxes, subscribeForEvents } from "./nostr.js";

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

// handle nsite requests
app.use(async (ctx, next) => {
  let pubkey = await userDomains.get<string | undefined>(ctx.hostname);

  // resolve pubkey if not in cache
  if (!pubkey) {
    console.log(`${ctx.hostname}: Resolving`);
    pubkey = await resolveNpubFromHostname(ctx.hostname);

    if (pubkey) {
      await userDomains.set(ctx.hostname, pubkey);
      console.log(`${ctx.hostname}: Found ${pubkey}`);
    } else {
      await userDomains.set(ctx.hostname, "");
    }
  }

  if (pubkey) {
    ctx.state.pubkey = pubkey;

    let relays = await userRelays.get<string[] | undefined>(pubkey);

    // fetch relays if not in cache
    if (!relays) {
      console.log(`${pubkey}: Fetching relays`);

      relays = await getUserOutboxes(pubkey);
      if (relays) {
        await userRelays.set(pubkey, relays);
        console.log(`${pubkey}: Found ${relays.length} relays`);
      } else {
        relays = [];
        await userServers.set(pubkey, [], 30_000);
        console.log(`${pubkey}: Failed to find relays`);
      }
    }

    console.log(`${pubkey}: Searching for ${ctx.path}`);
    const blobs = await getNsiteBlobs(pubkey, ctx.path, relays);

    if (blobs.length === 0) {
      console.log(`${pubkey}: Found 0 events`);
      ctx.status = 404;
      ctx.body = "Not Found";
      return;
    }

    let servers = await userServers.get<string[] | undefined>(pubkey);

    // fetch blossom servers if not in cache
    if (!servers) {
      console.log(`${pubkey}: Searching for blossom servers`);
      servers = await getUserBlossomServers(pubkey, relays);

      if (servers) {
        await userServers.set(pubkey, servers);
        console.log(`${pubkey}: Found ${servers.length} servers`);
      } else {
        servers = [];
        await userServers.set(pubkey, [], 30_000);
        console.log(`${pubkey}: Failed to find servers`);
      }
    }

    // always fetch from additional servers
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
    ctx.body = "Failed to find blob";
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

app.listen(
  {
    port: process.env.NSITE_PORT || 3000,
    host: process.env.NSITE_HOST || "0.0.0.0",
  },
  () => {
    console.log("Started on port", process.env.PORT || 3000);
  },
);

// invalidate nginx cache on new events
if (NGINX_CACHE_DIR && SUBSCRIPTION_RELAYS.length > 0) {
  console.log(`Listening for new nsite events`);

  subscribeForEvents(SUBSCRIPTION_RELAYS, async (event) => {
    try {
      const nsite = parseNsiteEvent(event);
      if (nsite) {
        console.log(`${nsite.pubkey}: Invalidating ${nsite.path}`);
        await invalidatePubkeyPath(nsite.pubkey, nsite.path);
      }
    } catch (error) {
      console.log(`Failed to invalidate ${event.id}`);
    }
  });
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

async function shutdown() {
  console.log("Shutting down...");
  pool.destroy();
  process.exit(0);
}

process.addListener("SIGTERM", shutdown);
process.addListener("SIGINT", shutdown);
