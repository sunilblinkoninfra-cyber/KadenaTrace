import { readFileSync } from "node:fs";

export const FRAUD_REGISTRY_MODULE = "kadenatrace.fraud-registry";
export const NS_SETUP_CONTRACT = readFileSync(new URL("../contracts/ns-setup.pact", import.meta.url), "utf8");
export const FRAUD_REGISTRY_CONTRACT = readFileSync(
  new URL("../contracts/fraud-registry.pact", import.meta.url),
  "utf8"
);
