import * as nextEnv from "@next/env";

type NextEnvApi = typeof import("@next/env");
const nextEnvModules = nextEnv as unknown as {
  loadEnvConfig?: NextEnvApi["loadEnvConfig"];
  default?: NextEnvApi;
  "module.exports"?: NextEnvApi;
};
const loadEnvConfig =
  nextEnvModules.loadEnvConfig ??
  nextEnvModules.default?.loadEnvConfig ??
  nextEnvModules["module.exports"]?.loadEnvConfig;

if (!loadEnvConfig) throw new Error("@next/env did not expose loadEnvConfig");

loadEnvConfig(process.cwd());
