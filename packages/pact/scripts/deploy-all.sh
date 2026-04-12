#!/usr/bin/env bash
# deploy-all.sh -- Sequentially deploys the KadenaTrace namespace setup and fraud registry module.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CONTRACT_DIR="$ROOT_DIR/packages/pact/contracts"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

: "${KADENA_NODE_URL:?KADENA_NODE_URL is required}"
: "${KADENA_CHAIN_ID:?KADENA_CHAIN_ID is required}"
: "${KADENA_NETWORK_ID:?KADENA_NETWORK_ID is required}"
: "${KADENA_GAS_PAYER_PUBLIC_KEY:?KADENA_GAS_PAYER_PUBLIC_KEY is required}"
: "${KADENA_GAS_PAYER_SECRET_KEY:?KADENA_GAS_PAYER_SECRET_KEY is required}"

PAYER_ACCOUNT="${KADENA_SENDER_ACCOUNT:-k:${KADENA_GAS_PAYER_PUBLIC_KEY}}"
REPORTER_PUBLIC_KEY="${KADENA_REPORTER_PUBLIC_KEY:-$KADENA_GAS_PAYER_PUBLIC_KEY}"
REPORTER_SECRET_KEY="${KADENA_REPORTER_SECRET_KEY:-$KADENA_GAS_PAYER_SECRET_KEY}"

if ! command -v pact >/dev/null 2>&1; then
  echo "The 'pact' CLI is required to sign deployment transactions." >&2
  exit 1
fi

write_request_yaml() {
  local target_file="$1"
  local code_file="$2"
  local nonce="$3"

  cat >"$target_file" <<EOF
codeFile: "$code_file"
networkId: "$KADENA_NETWORK_ID"
publicMeta:
  chainId: "$KADENA_CHAIN_ID"
  sender: "$PAYER_ACCOUNT"
  gasLimit: 2500
  gasPrice: 0.0000001
  ttl: 28800
signers:
  - public: "$KADENA_GAS_PAYER_PUBLIC_KEY"
    secret: "$KADENA_GAS_PAYER_SECRET_KEY"
nonce: "$nonce"
data:
  kadenatrace-admin:
    keys: ["$KADENA_GAS_PAYER_PUBLIC_KEY"]
    pred: "keys-all"
  kadenatrace-reporters:
    keys: ["$REPORTER_PUBLIC_KEY"]
    pred: "keys-all"
EOF
}

submit_contract() {
  local request_yaml="$1"
  local response_file="$2"

  pact -a "$request_yaml" | curl -sS -H "Content-Type: application/json" -X POST "$KADENA_NODE_URL/api/v1/send" -d @- >"$response_file"
}

extract_request_key() {
  local response_file="$1"
  sed -n 's/.*"requestKeys":[[:space:]]*\["\([^"]*\)".*/\1/p' "$response_file"
}

NS_REQUEST="$TMP_DIR/ns-setup.yaml"
MODULE_REQUEST="$TMP_DIR/fraud-registry.yaml"
NS_RESPONSE="$TMP_DIR/ns-response.json"
MODULE_RESPONSE="$TMP_DIR/module-response.json"

write_request_yaml "$NS_REQUEST" "$CONTRACT_DIR/ns-setup.pact" "kadenatrace-ns-setup-$(date +%s)"
submit_contract "$NS_REQUEST" "$NS_RESPONSE"
NS_REQUEST_KEY="$(extract_request_key "$NS_RESPONSE")"

write_request_yaml "$MODULE_REQUEST" "$CONTRACT_DIR/fraud-registry.pact" "kadenatrace-fraud-registry-$(date +%s)"
submit_contract "$MODULE_REQUEST" "$MODULE_RESPONSE"
MODULE_REQUEST_KEY="$(extract_request_key "$MODULE_RESPONSE")"

echo "Namespace setup request key: ${NS_REQUEST_KEY:-unknown}"
echo "Fraud registry request key: ${MODULE_REQUEST_KEY:-unknown}"
echo "Wait for finality on network '$KADENA_NETWORK_ID' chain '$KADENA_CHAIN_ID' before querying the module."
