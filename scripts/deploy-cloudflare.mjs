import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const DATABASE_NAME = "skycart-db";
const BINDING_NAME = "DB";
const CONFIG_PATH = "wrangler.toml";

function wrangler(args, { capture = false } = {}) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) {
      process.stderr.write(result.stderr || "");
      process.stderr.write(result.stdout || "");
    }
    throw new Error(`wrangler ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return capture ? result.stdout : "";
}

function parseJsonOutput(output) {
  const start = output.search(/[\\[{]/);
  if (start < 0) throw new Error("Wrangler D1 list did not return JSON.");
  return JSON.parse(output.slice(start));
}

function findDatabase(payload) {
  const pending = [payload];
  while (pending.length) {
    const value = pending.pop();
    if (Array.isArray(value)) {
      pending.push(...value);
    } else if (value && typeof value === "object") {
      const name = value.name ?? value.database_name;
      const id = value.uuid ?? value.database_id ?? value.id;
      if (name === DATABASE_NAME && typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) {
        return id;
      }
      pending.push(...Object.values(value));
    }
  }
  return null;
}

async function writeDatabaseId(databaseId) {
  const config = await readFile(CONFIG_PATH, "utf8");
  const sections = config.split(/(?=^\\[\\[d1_databases\\]\\]\\s*$)/m);
  let updated = false;

  const next = sections.map((section) => {
    if (!/^\\[\\[d1_databases\\]\\]/m.test(section)) return section;
    const nameMatch = section.match(/^database_name\\s*=\\s*["']([^"']+)["']/m);
    if (nameMatch?.[1] !== DATABASE_NAME) return section;
    if (/^database_id\\s*=\\s*["'][^"']*["']/m.test(section)) {
      updated = true;
      return section.replace(/^database_id\\s*=\\s*["'][^"']*["']/m, `database_id = "${databaseId}"`);
    }
    throw new Error(`The ${DATABASE_NAME} D1 binding has no database_id in wrangler.toml.`);
  }).join("");

  if (!updated) throw new Error(`Could not find the ${DATABASE_NAME} D1 binding in wrangler.toml.`);
  if (next !== config) await writeFile(CONFIG_PATH, next);
}

async function main() {
  console.log(`Checking Cloudflare D1 database: ${DATABASE_NAME}`);
  const listOutput = wrangler(["d1", "list", "--json"], { capture: true });
  let databaseId = findDatabase(parseJsonOutput(listOutput));

  if (!databaseId) {
    console.log(`D1 database not found. Creating ${DATABASE_NAME}...`);
    wrangler([
      "d1", "create", DATABASE_NAME,
      "--update-config",
      "--binding", BINDING_NAME,
      "--use-remote",
    ]);
    const config = await readFile(CONFIG_PATH, "utf8");
    const match = config.match(
      new RegExp(`\\[\\[d1_databases\\]\\][\\s\\S]*?database_name\\s*=\\s*["']${DATABASE_NAME}["'][\\s\\S]*?database_id\\s*=\\s*["']([0-9a-f-]{36})["']`, "i"),
    );
    databaseId = match?.[1] ?? null;
    if (!databaseId) {
      throw new Error("D1 was created, but Wrangler did not write its database_id into wrangler.toml.");
    }
    console.log(`Created ${DATABASE_NAME} (${databaseId}).`);
  } else {
    console.log(`Found existing ${DATABASE_NAME} (${databaseId}). Reusing it.`);
  }

  await writeDatabaseId(databaseId);
  console.log("Applying remote D1 migrations...");
  wrangler(["d1", "migrations", "apply", DATABASE_NAME, "--remote"]);
  console.log("Deploying SkyCart Worker...");
  wrangler(["deploy"]);
  console.log("SkyCart deployment completed.");
}

main().catch((error) => {
  console.error("SkyCart deployment failed:", error.message);
  process.exitCode = 1;
});
