import { FRAUD_REGISTRY_CONTRACT, FRAUD_REGISTRY_MODULE, NS_SETUP_CONTRACT } from "../src/index.js";

console.log("Deploy KadenaTrace in the following transaction order:");
console.log("1. Namespace + keysets bootstrap");
console.log(NS_SETUP_CONTRACT);
console.log("");
console.log(`2. Module deployment (${FRAUD_REGISTRY_MODULE})`);
console.log(FRAUD_REGISTRY_CONTRACT);
