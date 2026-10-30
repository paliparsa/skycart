import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const DATABASE_NAME = "skycart-db";
const CONFIG_PATH = "wrangler.toml";

function wrangler(args, capture = false) {
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
  const objectStart = output.indexOf("{");
  const arrayStart = output.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) throw new Error("Wrangler D1 list did not return JSON.");
  return JSON.parse(output.slice(Math.min(...starts)));
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
      if (name === DATABASE_NAME && typeof id === "string" && id.length === 36) return id;
      pending.push(...Object.values(value));
    }
  }
  return null;
}

function databaseSection(lines) {
  let inSection = false;
  let name = null;
  let idLine = -1;
  let id = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line === "[[d1_databases]]") {
      inSection = true;
      name = null;
      idLine = -1;
      id = null;
      continue;
    }
    if (inSection && line.startsWith("[")) {
      if (name === DATABASE_NAME) return { idLine, id };
      inSection = false;
    }
    if (!inSection) continue;
    if (line.startsWith("database_name")) {
      name = line.split("=").slice(1).join("=").trim().replaceAll('"', "");
    }
    if (line.startsWith("database_id")) {
      idLine = i;
      id = line.split("=").slice(1).join("=").trim().replaceAll('"', "");
    }
  }

  return name === DATABASE_NAME ? { idLine, id } : null;
}

async function writeDatabaseId(databaseId) {
  const config = await readFile(CONFIG_PATH, "utf8");
  const lines = config.split("\n");
  const section = databaseSection(lines);
  if (!section || section.idLine < 0) {
    throw new Error(`Could not find the ${DATABASE_NAME} D1 binding/database_id in wrangler.toml.`);
  }
  lines[section.idLine] = `database_id = "${databaseId}"`;
  await writeFile(CONFIG_PATH, lines.join("\n"));
}

async function main() {
  console.log(`Checking Cloudflare D1 database: ${DATABASE_NAME}`);
  let databaseId = findDatabase(parseJsonOutput(wrangler(["d1", "list", "--json"], true)));

  if (!databaseId) {
    console.log(`D1 database not found. Creating ${DATABASE_NAME}...`);
    wrangler(["d1", "create", DATABASE_NAME]);
    databaseId = findDatabase(parseJsonOutput(wrangler(["d1", "list", "--json"], true)));
    if (!databaseId) {
      throw new Error("D1 creation returned successfully, but the new database could not be found in the account.");
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
