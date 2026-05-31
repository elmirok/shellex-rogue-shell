import { readFile } from "node:fs/promises";

const appPackage = JSON.parse(await readFile("package.sapp.json", "utf8"));
const { manifest, files } = appPackage;

const errors = [];
if (!manifest?.id) errors.push("manifest.id is required");
if (!manifest?.name) errors.push("manifest.name is required");
if (manifest?.type !== "webapp") errors.push("Rogue Shell must be a webapp package");
if (manifest?.runtime !== "iframe") errors.push("Rogue Shell must use iframe runtime");
if (!files?.[manifest?.entry]) errors.push(`entry file missing: ${manifest?.entry}`);
for (const required of ["index.html", "style.css", "app.js"]) {
  if (!files?.[required]) errors.push(`missing file: ${required}`);
}
for (const permission of manifest?.permissions || []) {
  if (permission.includes("/home") || permission === "fs:read:/") {
    errors.push(`permission is too broad for POC: ${permission}`);
  }
}

if (errors.length) {
  console.error(errors.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

const bytes = Buffer.byteLength(JSON.stringify(appPackage), "utf8");
console.log(`Package OK: ${manifest.id}, ${(bytes / 1024).toFixed(1)} KiB.`);
