import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const seedPath = join(process.cwd(), "data", "demo-seed.json");
if (existsSync(seedPath)) rmSync(seedPath);
const commands = [["tsx", "scripts/generate-data.ts"]];
if (process.env.DATABASE_URL) commands.push(["tsx", "scripts/seed.ts"]);
else console.info("DATABASE_URL is not set; regenerated local fixtures without database seeding.");

for (const command of commands) {
  const result = spawnSync("npx", command, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
