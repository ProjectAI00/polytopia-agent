#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tsx = path.join(root, "node_modules", ".bin", "tsx");
const bot = path.join(root, "src", "bot.ts");

const result = spawnSync(tsx, [bot], { stdio: "inherit", cwd: root });
process.exit(result.status ?? 0);
