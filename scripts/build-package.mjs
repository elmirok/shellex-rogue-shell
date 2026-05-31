import { readFile, writeFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const sourceFiles = ["index.html", "style.css", "app.js"];
const files = {};

for (const name of sourceFiles) {
  let content = await readFile(`src/${name}`, "utf8");
  if (name === "index.html") {
    content = content.replace(/\n?\s*<link[^>]*data-dev-only[^>]*>\s*/g, "\n");
    content = content.replace(/\n\s*<script[^>]*data-dev-only[^>]*><\/script>\s*/g, "\n");
  }
  files[name] = content;
}

files["README.md"] = await readFile("README.md", "utf8");
files["docs/architecture.md"] = await readFile("docs/architecture.md", "utf8");

const appPackage = { manifest, files };
await writeFile("package.sapp.json", `${JSON.stringify(appPackage, null, 2)}\n`);
console.log(`Wrote package.sapp.json for ${manifest.name} ${manifest.version}.`);
