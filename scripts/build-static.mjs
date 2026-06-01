import { mkdir, readdir, copyFile, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await copyDir("src", "dist");
console.log("Wrote static Cloudflare Pages build to dist/.");

async function copyDir(from, to) {
  await mkdir(to, { recursive: true });
  const entries = await readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const src = `${from}/${entry.name}`;
    const dest = `${to}/${entry.name}`;
    if (entry.isDirectory()) {
      await copyDir(src, dest);
    } else {
      await copyFile(src, dest);
    }
  }
}

