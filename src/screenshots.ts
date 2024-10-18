import { nip19 } from "nostr-tools";
import puppeteer, { PuppeteerLaunchOptions } from "puppeteer";
import { join } from "path";
import pfs from "fs/promises";
import { npubEncode } from "nostr-tools/nip19";

import { NSITE_PORT, SCREENSHOTS_DIR } from "./env.js";

try {
  await pfs.mkdir(SCREENSHOTS_DIR, { recursive: true });
} catch (error) {}

export function getScreenshotPath(pubkey: string) {
  return join(SCREENSHOTS_DIR, pubkey + ".png");
}

export async function hasScreenshot(pubkey: string) {
  try {
    await pfs.stat(getScreenshotPath(pubkey));
    return true;
  } catch (error) {
    return false;
  }
}

export async function takeScreenshot(pubkey: string) {
  console.log(`${npubEncode(pubkey)}: Generating screenshot`);

  const opts: PuppeteerLaunchOptions = {
    args: ["--no-sandbox"],
  };
  if (process.env.PUPPETEER_SKIP_DOWNLOAD) opts.executablePath = "google-chrome-stable";

  const browser = await puppeteer.launch(opts);
  const page = await browser.newPage();
  const url = new URL(`http://${nip19.npubEncode(pubkey)}.localhost:${NSITE_PORT}`);
  await page.goto(url.toString());
  await page.screenshot({ path: getScreenshotPath(pubkey) });
  await browser.close();
}

export async function removeScreenshot(pubkey: string) {
  try {
    await pfs.rm(getScreenshotPath(pubkey));
    console.log(`${npubEncode(pubkey)}: Removed screenshot`);
  } catch (error) {}
}
