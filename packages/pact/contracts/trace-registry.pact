;; trace-registry.pact -- Stores hash-only trace commitments and wallet risk attestations for verifiable investigations.
(namespace 'kadenatrace)

(module trace-registry GOVERNANCE
  (defcap GOVERNANCE ()
    @doc "Governance capability protecting module administration."
    (enforce-keyset "kadenatrace.admin"))

  (defcap CREATE_CASE ()
    @doc "Allows approved investigators to register a case trace commitment."
    (enforce-keyset "kadenatrace.reporters"))

  (defcap ATTEST_RISK ()
    @doc "Allows approved investigators to anchor wallet risk attestations."
    (enforce-keyset "kadenatrace.reporters"))

  (defschema fraud-case
    case-id:string
    trace-hash:string
    metadata-hash:string
    timestamp:string
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

  (defun create-case
    (case-id:string trace-hash:string metadata-hash:string timestamp:string investigator:string)
    @doc "Registers a hash-only trace commitment for a case."
    (require-capability (CREATE_CASE))
    (enforce (!= case-id "") "case-id required")
    (enforce (!= trace-hash "") "trace-hash required")
    (enforce (!= metadata-hash "") "metadata-hash required")
    (enforce (!= timestamp "") "timestamp required")
    (insert fraud-case-registry case-id
      {
        "case-id": case-id,
        "trace-hash": trace-hash,
        "metadata-hash": metadata-hash,
        "timestamp": timestamp,
        "investigator": investigator
      }))

  (defun verify-trace (case-id:string trace-hash:string)
    @doc "Verifies a recomputed trace hash against the stored on-chain commitment."
    (let ((stored-hash (at "trace-hash" (read fraud-case-registry case-id))))
      (enforce (= trace-hash stored-hash) "Trace mismatch")
      true))

  (defun attest-wallet-risk
    (case-id:string address:string score:integer timestamp:string investigator:string investigator-guard:guard)
    @doc "Stores a wallet risk attestation without publishing raw investigation data."
    (require-capability (ATTEST_RISK))
    (enforce (!= case-id "") "case-id required")
    (enforce (!= address "") "address required")
    (enforce (!= timestamp "") "timestamp required")
    (enforce (>= score 0) "score must be non-negative")
    (enforce (<= score 100) "score must be <= 100")
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
    @doc "Returns the stored case commitment for independent verification."
    (read fraud-case-registry case-id))

  (defun get-wallet-attestation (case-id:string address:string)
    @doc "Returns the risk attestation record for the specified address."
    (read wallet-risk-attestations (+ case-id ":" address)))

  (defun list-attestations-for-case (target-case-id:string)
    @doc "Lists all on-chain wallet attestations for a case."
    (fold-db wallet-risk-attestations
      (lambda (k obj) (= (at "case-id" obj) target-case-id))
      (lambda (k obj) obj)))
)

(create-table fraud-case-registry)
(create-table wallet-risk-attestations)
