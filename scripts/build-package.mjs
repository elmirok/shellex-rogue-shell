import { readFile, readdir, writeFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const files = {};

for (const name of await listSourceFiles("src")) {
  files[name] = await readFile(`src/${name}`, "utf8");
}

files["README.md"] = await readFile("README.md", "utf8");
for (const name of await listSourceFiles("docs")) {
  files[`docs/${name}`] = await readFile(`docs/${name}`, "utf8");
}

const appPackage = { manifest, files };
await writeFile("package.sapp.json", `${JSON.stringify(appPackage, null, 2)}\n`);
console.log(`Wrote package.sapp.json for ${manifest.name} ${manifest.version}.`);

async function listSourceFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      paths.push(...await listSourceFiles(`${dir}/${entry.name}`, relative));
    } else {
      paths.push(relative);
    }
  }
  return paths.sort();
}
