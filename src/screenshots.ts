import { nip19 } from "nostr-tools";
import puppeteer from "puppeteer";
import { join } from "path";
import pfs from "fs/promises";

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
  console.log(`${pubkey}: Generating screenshot`);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const url = new URL(`http://${nip19.npubEncode(pubkey)}.localhost:${NSITE_PORT}`);
  await page.goto(url.toString());
  await page.screenshot({ path: getScreenshotPath(pubkey) });
  await browser.close();
}

export async function removeScreenshot(pubkey: string) {
  try {
    await pfs.rm(getScreenshotPath(pubkey));
  } catch (error) {}
}
