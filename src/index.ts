#!/usr/bin/env node
import "./polyfill.js";
import Koa from "koa";
import serve from "koa-static";
import path, { join } from "node:path";
import cors from "@koa/cors";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import send from "koa-send";

import logger from "./logger.js";
import { isHttpError } from "./helpers/error.js";
import { resolveNpubFromHostname } from "./helpers/dns.js";
import { downloadSite } from "./downloader.js";
import { downloaded } from "./cache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = new Koa();

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
    if (isHttpError(err)) {
      const status = (ctx.status = err.status || 500);
      if (status >= 500) console.error(err.stack);
      ctx.body = status > 500 ? { message: "Something went wrong" } : { message: err.message };
    } else {
      console.log(err);
      ctx.status = 500;
      ctx.body = { message: "Something went wrong" };
    }
  }
});

// map pubkeys to folders in sites dir
app.use(async (ctx, next) => {
  const pubkey = (ctx.state.pubkey = await resolveNpubFromHostname(ctx.hostname));

  if (pubkey) {
    if (!(await downloaded.get(pubkey))) {
      // don't wait for download
      downloadSite(pubkey);

      await downloaded.set(pubkey, true);
    }

    await send(ctx, join(pubkey, ctx.path), { root: "data/sites", index: "index.html" });
  } else await next();
});

// serve static sites
app.use(serve("sites"));

// serve static files from public
try {
  const www = path.resolve(process.cwd(), "public");
  fs.statSync(www);
  app.use(serve(www));
} catch (error) {
  const www = path.resolve(__dirname, "../public");
  app.use(serve(www));
}

app.listen(process.env.PORT || 3000);
logger("Started on port", process.env.PORT || 3000);

async function shutdown() {
  logger("Shutting down...");
  process.exit(0);
}

process.addListener("SIGTERM", shutdown);
process.addListener("SIGINT", shutdown);
