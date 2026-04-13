;; trace-registry.pact -- Stores immutable case hashes, velocity metrics, and investigator attestations for KadenaTrace.
(namespace 'kadenatrace)

(module trace-registry GOVERNANCE
  (defcap GOVERNANCE ()
    @doc "Governance capability protecting upgrades and investigator-managed writes."
    (enforce-keyset "kadenatrace.admin"))

  (defcap INVESTIGATOR-CASE-WRITE (case-id:string)
    @doc "Managed investigator capability for writing immutable fraud case records."
    @managed
    (enforce-keyset "kadenatrace.reporters"))

  (defcap INVESTIGATOR-ATTEST (address:string)
    @doc "Managed investigator capability for writing wallet risk attestations."
    @managed
    (enforce-keyset "kadenatrace.reporters"))

  (defschema fraud-case
    case-id:string
    report-hash:string
    status:string
    velocity-metrics:string
    incident-chain:string
    terminal-chain:string
    incident-block-time:string
    terminal-block-time:string
    spv-proof-hash:string
    investigator:string)

  (defschema wallet-risk-attestation
    address:string
    case-id:string
    score:integer
    timestamp:string
    investigator:string
    investigator-guard:guard)

  (deftable fraud-case-registry:{fraud-case})
  (deftable wallet-risk-attestations:{wallet-risk-attestation})

  (defun register-case
    (case-id:string
     report-hash:string
     status:string
     velocity-metrics:string
     incident-chain:string
     terminal-chain:string
     incident-block-time:string
     terminal-block-time:string
     spv-proof-hash:string
     investigator:string)
    @doc "Registers a case hash and velocity metrics. Cross-chain exits require an SPV proof hash."
    (require-capability (INVESTIGATOR-CASE-WRITE case-id))
    (enforce (!= case-id "") "case-id required")
    (enforce (!= report-hash "") "report-hash required")
    (enforce (!= velocity-metrics "") "velocity-metrics required")
    (enforce (!= incident-block-time "") "incident-block-time required")
    (enforce (!= terminal-block-time "") "terminal-block-time required")
    (enforce
      (or (= incident-chain terminal-chain) (!= spv-proof-hash ""))
      "Cross-chain exits require an SPV-backed block-time proof hash")
    (insert fraud-case-registry case-id
      {
        "case-id": case-id,
        "report-hash": report-hash,
        "status": status,
        "velocity-metrics": velocity-metrics,
        "incident-chain": incident-chain,
        "terminal-chain": terminal-chain,
        "incident-block-time": incident-block-time,
        "terminal-block-time": terminal-block-time,
        "spv-proof-hash": spv-proof-hash,
        "investigator": investigator
      }))

  (defun update-case-status (case-id:string status:string)
    @doc "Updates a case status while preserving the immutable report and velocity hashes."
    (require-capability (INVESTIGATOR-CASE-WRITE case-id))
    (enforce (!= status "") "status required")
    (update fraud-case-registry case-id
      {
        "status": status
      }))

  (defun attest-wallet-risk
    (address:string case-id:string score:integer timestamp:string investigator:string investigator-guard:guard)
    @doc "Stores a wallet risk attestation signed by an investigator guard."
    (require-capability (INVESTIGATOR-ATTEST address))
    (enforce (!= address "") "address required")
    (enforce (!= case-id "") "case-id required")
    (enforce (>= score 0) "score must be non-negative")
    (enforce (<= score 100) "score must be <= 100")
    (enforce (!= timestamp "") "timestamp required")
    (enforce-guard investigator-guard)
    (insert wallet-risk-attestations (+ case-id ":" address)
      {
        "address": address,
        "case-id": case-id,
        "score": score,
        "timestamp": timestamp,
        "investigator": investigator,
        "investigator-guard": investigator-guard
      }))

  (defun get-case (case-id:string)
    @doc "Returns the immutable case record for public hash verification."
    (read fraud-case-registry case-id))

  (defun get-wallet-attestation (case-id:string address:string)
    @doc "Returns the stored wallet risk attestation for a case and address."
    (read wallet-risk-attestations (+ case-id ":" address)))
)

(create-table fraud-case-registry)
(create-table wallet-risk-attestations)
