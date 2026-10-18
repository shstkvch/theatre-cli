import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function cacheDir() {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(base, "theatre-cli");
}

const cachePath = (name) => path.join(cacheDir(), `${name}.json`);

export async function readCache(name) {
  try {
    const raw = await readFile(cachePath(name), "utf8");
    const value = JSON.parse(raw);
    if (!value || typeof value.fetchedAt !== "number" || !value.data) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/** Best-effort: a read-only or missing cache directory must not break a run. */
export async function writeCache(name, value) {
  const file = cachePath(name);
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(temporary, JSON.stringify(value), "utf8");
    await rename(temporary, file);
  } catch {
    try {
      await unlink(temporary);
    } catch {
      // nothing to clean up
    }
  }
}
