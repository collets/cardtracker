import { createRequire } from "node:module";

const requireModule = createRequire(import.meta.url);
const nextEnv = requireModule("@next/env") as typeof import("@next/env");

nextEnv.loadEnvConfig(process.cwd());
