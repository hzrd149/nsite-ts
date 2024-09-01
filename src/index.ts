#!/usr/bin/env node
import "./polyfill.js";
import Koa from "koa";
import serve from "koa-static";
import path from "node:path";
import cors from "@koa/cors";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import HttpErrors from "http-errors";

import logger from "./logger.js";
import { isHttpError } from "./helpers/error.js";
import { resolveNpubFromHostname } from "./helpers/dns.js";
import ndk from "./ndk.js";
import { NSITE_KIND } from "./const.js";
import { BLOSSOM_SERVERS } from "./env.js";
import { makeRequestWithAbort } from "./helpers/http.js";

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

// serve nsite files
app.use(async (ctx, next) => {
  const pubkey = (ctx.state.pubkey = await resolveNpubFromHostname(ctx.hostname));

  if (pubkey) {
    const event = await ndk.fetchEvent([
      { kinds: [NSITE_KIND], "#d": [ctx.path, ctx.path.replace(/^\//, "")], authors: [pubkey] },
    ]);
    if (!event) throw new HttpErrors.NotFound("Failed to find event for path");

    const sha256 = event.tags.find((t) => t[0] === "x" || t[0] === "sha256")?.[1];
    if (!sha256) throw new HttpErrors.BadGateway("Failed to find file for path");

    for (const server of BLOSSOM_SERVERS) {
      try {
        const { response } = await makeRequestWithAbort(new URL(sha256, server));
        const { headers, statusCode } = response;

        if (!headers || !statusCode) throw new Error("Missing headers or status code");

        if (statusCode >= 200 && statusCode < 300) {
          ctx.status = statusCode;

          // @ts-expect-error
          ctx.set(headers);

          ctx.response.body = response;
        } else {
          // Consume response data to free up memory
          response.resume();
        }
      } catch (error) {
        // ignore error, try next server
      }
    }

    // throw new HttpErrors.NotFound(`Unable to find ${sha256} on blossom servers`);
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

app.listen(process.env.PORT || 3000);
logger("Started on port", process.env.PORT || 3000);

async function shutdown() {
  logger("Shutting down...");
  process.exit(0);
}

process.addListener("SIGTERM", shutdown);
process.addListener("SIGINT", shutdown);
