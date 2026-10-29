import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const adminPassword = process.env.ADMIN_PASSWORD;
if (!accountId || !token) throw new Error("Set GitHub Actions secrets CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.");
if (!adminPassword || adminPassword.length < 20) throw new Error("Set ADMIN_PASSWORD to a unique password of at least 20 characters.");

async function cf(path, options = {}) {
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    ...options,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error("Cloudflare API error: " + JSON.stringify(data.errors || data));
  return data.result;
}
const query = "?name=skycart-db";
const found = await cf("/accounts/" + accountId + "/d1/database" + query);
let db = Array.isArray(found) ? found.find(item => item.name === "skycart-db") : null;
if (!db) db = await cf("/accounts/" + accountId + "/d1/database", { method: "POST", body: JSON.stringify({ name: "skycart-db" }) });
if (!db?.uuid) throw new Error("Could not create or locate D1 database skycart-db.");

let config = await readFile("wrangler.toml", "utf8");
config = config.replace(/database_id\s*=\s*"[^"]+"/, 'database_id = "' + db.uuid + '"');
await writeFile("wrangler.toml", config);
console.log("D1 database ready:", db.name, db.uuid);

function run(command, args, input) {
  const result = spawnSync(command, args, { stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"], input, env: process.env });
  if (result.status !== 0) throw new Error(command + " " + args.join(" ") + " failed.");
}
function putSecret(name, value, required = false) {
  if (!value) {
    if (required) throw new Error("Missing required secret: " + name);
    console.log("Optional secret not set; integration stays disabled:", name);
    return;
  }
  run("npx", ["wrangler", "secret", "put", name], value + "\n");
}
putSecret("ADMIN_PASSWORD", adminPassword, true);
putSecret("SUNSKY_API_KEY", process.env.SUNSKY_API_KEY);
putSecret("SUNSKY_API_SECRET", process.env.SUNSKY_API_SECRET);
run("npx", ["wrangler", "d1", "migrations", "apply", "skycart-db", "--remote"]);
run("npx", ["wrangler", "deploy"]);
console.log("SkyCart deployed. Attach your custom domain in Cloudflare Workers > skycart > Settings > Domains & Routes.");
