import { extname, isAbsolute, join } from "path";
import { NSITE_KIND } from "./const.js";
import ndk from "./ndk.js";

export function getSearchPaths(path: string) {
  const paths = [path];

  // if the path does not have an extension, also look for index.html
  if (extname(path) === "") paths.push(join(path, "index.html"));

  // also look for relative paths
  for (const p of Array.from(paths)) {
    if (isAbsolute(p)) paths.push(path.replace(/^\//, ""));
  }

  return paths;
}

export function parseNsiteEvent(event: { pubkey: string; tags: string[][] }) {
  const path = event.tags.find((t) => t[0] === "d" && t[1])?.[1];
  const sha256 = event.tags.find((t) => t[0] === "x" && t[1])?.[1];

  if (path && sha256)
    return {
      pubkey: event.pubkey,
      path: join("/", path),
      sha256,
    };
}

export async function getNsiteBlobs(pubkey: string, path: string) {
  const paths = getSearchPaths(path);
  const events = await ndk.fetchEvents({ kinds: [NSITE_KIND], "#d": paths, authors: [pubkey] });

  return Array.from(events)
    .map(parseNsiteEvent)
    .filter((e) => !!e)
    .sort((a, b) => paths.indexOf(a.path) - paths.indexOf(b.path));
}
