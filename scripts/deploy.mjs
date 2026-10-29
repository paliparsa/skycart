import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !token) throw new Error("Set GitHub Actions secrets CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN. Configure application secrets directly in Cloudflare.");

async function cf(path, options = {}) {
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    ...options,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error("Cloudflare API error: " + JSON.stringify(data.errors || data));
  return data.result;
}
const found = await cf("/accounts/" + accountId + "/d1/database?name=skycart-db");
let db = Array.isArray(found) ? found.find(item => item.name === "skycart-db") : null;
if (!db) db = await cf("/accounts/" + accountId + "/d1/database", { method: "POST", body: JSON.stringify({ name: "skycart-db" }) });
if (!db?.uuid) throw new Error("Could not create or locate D1 database skycart-db.");

let config = await readFile("wrangler.toml", "utf8");
config = config.replace(/database_id\s*=\s*"[^"]+"/, 'database_id = "' + db.uuid + '"');
await writeFile("wrangler.toml", config);
console.log("D1 database ready:", db.name, db.uuid);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error(command + " " + args.join(" ") + " failed.");
}
run("npx", ["wrangler", "d1", "migrations", "apply", "skycart-db", "--remote"]);
run("npx", ["wrangler", "deploy"]);
console.log("Deployment complete. Application secrets are managed separately in Cloudflare Worker settings.");
