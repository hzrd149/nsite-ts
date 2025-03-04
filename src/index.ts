#!/usr/bin/env node
import "./polyfill.js";
import Koa from "koa";
import serve from "koa-static";
import path, { basename } from "node:path";
import cors from "@koa/cors";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import mime from "mime";
import morgan from "koa-morgan";
import send from "koa-send";
import { npubEncode } from "nostr-tools/nip19";
import { spawn } from "node:child_process";
import { nip19 } from "nostr-tools";

import { resolveNpubFromHostname } from "./helpers/dns.js";
import { getNsiteBlobs, parseNsiteEvent } from "./events.js";
import { downloadFile, getUserBlossomServers } from "./blossom.js";
import {
  BLOSSOM_SERVERS,
  ENABLE_SCREENSHOTS,
  HOST,
  NGINX_CACHE_DIR,
  NSITE_HOMEPAGE,
  NSITE_HOMEPAGE_DIR,
  NSITE_HOST,
  NSITE_PORT,
  ONION_HOST,
  SUBSCRIPTION_RELAYS,
} from "./env.js";
import { userDomains, userRelays, userServers } from "./cache.js";
import { invalidatePubkeyPath } from "./nginx.js";
import pool, { getUserOutboxes, subscribeForEvents } from "./nostr.js";
import logger from "./logger.js";

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
    if (err instanceof Error) ctx.body = { message: err.message };
  }
});

// handle nsite requests
app.use(async (ctx, next) => {
  let pubkey = await userDomains.get<string | undefined>(ctx.hostname);

  // resolve pubkey if not in cache
  if (pubkey === undefined) {
    logger(`${ctx.hostname}: Resolving`);
    pubkey = await resolveNpubFromHostname(ctx.hostname);

    if (pubkey) {
      await userDomains.set(ctx.hostname, pubkey);
      logger(`${ctx.hostname}: Found ${pubkey}`);
    } else {
      await userDomains.set(ctx.hostname, "");
    }
  }

  if (pubkey) {
    const npub = npubEncode(pubkey);
    const log = logger.extend(npub);
    ctx.state.pubkey = pubkey;

    let relays = await userRelays.get<string[] | undefined>(pubkey);

    // fetch relays if not in cache
    if (!relays) {
      log(`Fetching relays`);

      relays = await getUserOutboxes(pubkey);
      if (relays) {
        await userRelays.set(pubkey, relays);
        log(`Found ${relays.length} relays`);
      } else {
        relays = [];
        await userServers.set(pubkey, [], 30_000);
        log(`Failed to find relays`);
      }
    }

    relays.push(...SUBSCRIPTION_RELAYS);

    if (relays.length === 0) throw new Error("No nostr relays");

    log(`Searching for ${ctx.path}`);
    let blobs = await getNsiteBlobs(pubkey, ctx.path, relays);

    if (blobs.length === 0) {
      // fallback to custom 404 page
      log(`Looking for custom 404 page`);
      blobs = await getNsiteBlobs(pubkey, "/404.html", relays);
    }

    if (blobs.length === 0) {
      log(`Found 0 events`);
      ctx.status = 404;
      ctx.body = "Not Found";
      return;
    }

    let servers = await userServers.get<string[] | undefined>(pubkey);

    // fetch blossom servers if not in cache
    if (!servers) {
      log(`Fetching blossom servers`);
      servers = await getUserBlossomServers(pubkey, relays);

      if (servers) {
        await userServers.set(pubkey, servers);
        log(`Found ${servers.length} servers`);
      } else {
        servers = [];
        await userServers.set(pubkey, [], 30_000);
        log(`Failed to find servers`);
      }
    }

    // always fetch from additional servers
    servers.push(...BLOSSOM_SERVERS);

    for (const blob of blobs) {
      const res = await downloadFile(blob.sha256, servers);

      if (res) {
        const type = mime.getType(blob.path);
        if (type) ctx.set("content-type", type);
        else if (res.headers["content-type"]) ctx.set("content-type", res.headers["content-type"]);

        // pass headers along
        if (res.headers["content-length"]) ctx.set("content-length", res.headers["content-length"]);
        if (res.headers["last-modified"]) ctx.set("last-modified", res.headers["last-modified"]);

        // set Onion-Location header
        if (ONION_HOST) {
          const url = new URL(ONION_HOST);
          url.hostname = npubEncode(pubkey) + "." + url.hostname;
          ctx.set("Onion-Location", url.toString().replace(/\/$/, ""));
        }

        ctx.status = 200;
        ctx.body = res;
        return;
      }
    }

    ctx.status = 500;
    ctx.body = "Failed to find blob";
  } else await next();
});

if (ONION_HOST) {
  app.use((ctx, next) => {
    // set Onion-Location header if it was not set before
    if (!ctx.get("Onion-Location") && ONION_HOST) {
      ctx.set("Onion-Location", ONION_HOST);
    }

    return next();
  });
}

// get screenshots for websites
if (ENABLE_SCREENSHOTS) {
  app.use(async (ctx, next) => {
    if (ctx.method === "GET" && ctx.path.startsWith("/screenshot")) {
      const [pubkey, etx] = basename(ctx.path).split(".");

      if (pubkey) {
        const { hasScreenshot, takeScreenshot, getScreenshotPath } = await import("./screenshots.js");
        if (!(await hasScreenshot(pubkey))) await takeScreenshot(pubkey);

        await send(ctx, getScreenshotPath(pubkey));
      } else throw Error("Missing pubkey");
    } else return next();
  });
}

// download homepage
if (NSITE_HOMEPAGE) {
  try {
    const log = logger.extend("homepage");
    // create the public dir
    try {
      fs.mkdirSync(NSITE_HOMEPAGE_DIR);
    } catch (error) {}

    const bin = (await import.meta.resolve("nsite-cli")).replace("file://", "");

    const decode = nip19.decode(NSITE_HOMEPAGE);
    if (decode.type !== "nprofile") throw new Error("NSITE_HOMEPAGE must be a valid nprofile");

    // use nsite-cli to download the homepage
    const args = [bin, "download", NSITE_HOMEPAGE_DIR, nip19.npubEncode(decode.data.pubkey)];
    if (decode.data.relays) args.push("--relays", decode.data.relays?.join(","));

    const child = spawn("node", args, { stdio: "pipe" });

    child.on("spawn", () => log("Downloading..."));
    child.stdout.on("data", (line) => log(line.toString("utf-8")));
    child.on("error", (e) => log("Failed", e));
    child.on("close", (code) => {
      if (code === 0) log("Finished");
      else log("Failed");
    });
  } catch (error) {
    console.log(`Failed to download homepage`);
    console.log(error);
  }
}

// serve static files from public
const serveOptions: serve.Options = {
  hidden: true,
  maxAge: 60 * 60 * 1000,
  index: "index.html",
};

try {
  const www = NSITE_HOMEPAGE_DIR;
  fs.statSync(www);
  app.use(serve(www, serveOptions));
} catch (error) {
  const www = path.resolve(__dirname, "../public");
  app.use(serve(www, serveOptions));
}

app.listen({ host: NSITE_HOST, port: NSITE_PORT }, () => {
  logger("Started on port", HOST);
});

// invalidate nginx cache and screenshots on new events
if (SUBSCRIPTION_RELAYS.length > 0) {
  logger(`Listening for new nsite events on: ${SUBSCRIPTION_RELAYS.join(", ")}`);

  subscribeForEvents(SUBSCRIPTION_RELAYS, async (event) => {
    try {
      const nsite = parseNsiteEvent(event);
      if (nsite) {
        const log = logger.extend(nip19.npubEncode(nsite.pubkey));
        if (NGINX_CACHE_DIR) {
          log(`Invalidating ${nsite.path}`);
          await invalidatePubkeyPath(nsite.pubkey, nsite.path);
        }

        // invalidate screenshot for nsite
        if (ENABLE_SCREENSHOTS && (nsite.path === "/" || nsite.path === "/index.html")) {
          const { removeScreenshot } = await import("./screenshots.js");
          await removeScreenshot(nsite.pubkey);
        }
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
  logger("Shutting down...");
  pool.destroy();
  process.exit(0);
}

process.addListener("SIGTERM", shutdown);
process.addListener("SIGINT", shutdown);
