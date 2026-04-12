;; fraud-registry.pact -- KadenaTrace fraud case registry and attestations module.
(namespace 'kadenatrace)

(module fraud-registry GOV
  (defcap GOV ()
    @doc "Governance capability — enforces the kadenatrace admin keyset."
    (enforce-keyset "kadenatrace.admin"))

  (defcap WRITE-CASE ()
    @doc "Required to create a new fraud case record."
    (with-read reporters-config-table "reporters" { "guard" := g }
      (enforce-guard g)))

  (defcap APPEND-EVENT ()
    @doc "Required to append a new event to an existing fraud case."
    (with-read reporters-config-table "reporters" { "guard" := g }
      (enforce-guard g)))

  (defcap ATTEST-WALLET-RISK ()
    @doc "Required to attest a specific risk level to a wallet."
    (with-read reporters-config-table "reporters" { "guard" := g }
      (enforce-guard g)))

  (defcap MANAGE-REPORTERS ()
    @doc "Governance-only capability to rotate the reporters keyset."
    (enforce-keyset "kadenatrace.admin"))

  (defconst VALID-RISK-LEVELS ["low" "medium" "high" "critical"])
  (defconst VALID-SUBJECT-KINDS ["address" "tx"])

  (defschema case
    case-id:string
    subject-chain:string
    subject-kind:string
    subject-hash:string
    metadata-hash:string
    public-uri-hash:string
    reporter:string)

  (defschema case-event
    event-id:string
    case-id:string
    event-type:string
    content-hash:string
    signer:string)

  (defschema wallet-attestation
    attestation-id:string
    case-id:string
    wallet:string
    chain:string
    risk-level:string
    risk-score:integer
    evidence-hash:string
    signer:string)

  (defschema dispute
    dispute-id:string
    case-id:string
    disputer:string
    reason-hash:string
    status:string)

  (defschema reporters-config
    guard:guard)

  (deftable reporters-config-table:{reporters-config})
  (deftable cases:{case})
  (deftable case-events:{case-event})
  (deftable wallet-attestations:{wallet-attestation})
  (deftable disputes:{dispute})

  (defcap DISPUTE (case-id:string)
    @doc "Required to raise a dispute regarding an existing case."
    (with-read reporters-config-table "reporters" { "guard" := g }
      (enforce-guard g)))

  (defun create-case
    (case-id subject-chain subject-kind subject-hash metadata-hash public-uri-hash reporter reporter-guard)
    @doc "Creates an immutable fraud case anchored to a subject wallet or transaction."
    (require-capability (WRITE-CASE))
    (enforce (!= case-id "") "case-id is required")
    (enforce (!= subject-hash "") "subject-hash is required")
    (enforce (!= metadata-hash "") "metadata-hash is required")
    (enforce (!= public-uri-hash "") "public-uri-hash is required")
    (enforce (!= reporter "") "reporter is required")
    (enforce 
      (contains subject-kind VALID-SUBJECT-KINDS) 
      "subject-kind must be address or tx")
    (enforce-guard reporter-guard)
    (insert cases case-id
      {
        "case-id": case-id,
        "subject-chain": subject-chain,
        "subject-kind": subject-kind,
        "subject-hash": subject-hash,
        "metadata-hash": metadata-hash,
        "public-uri-hash": public-uri-hash,
        "reporter": reporter
      }))

  (defun append-case-event (event-id case-id event-type content-hash signer signer-guard)
    @doc "Appends a new event to a case."
    (require-capability (APPEND-EVENT))
    (enforce (!= event-id "") "event-id is required")
    (enforce (!= content-hash "") "content-hash is required")
    (read cases case-id)
    (enforce-guard signer-guard)
    (insert case-events event-id
      {
        "event-id": event-id,
        "case-id": case-id,
        "event-type": event-type,
        "content-hash": content-hash,
        "signer": signer
      }))

  (defun attest-wallet-risk
    (attestation-id case-id wallet chain risk-level risk-score evidence-hash signer signer-guard)
    @doc "Attests a risk level and score to a specific wallet related to a case."
    (require-capability (ATTEST-WALLET-RISK))
    (enforce (!= attestation-id "") "attestation-id is required")
    (enforce (!= evidence-hash "") "evidence-hash is required")
    (enforce (>= risk-score 0) "risk-score must be non-negative")
    (enforce (<= risk-score 100) "risk-score must be <= 100")
    (enforce 
      (contains risk-level VALID-RISK-LEVELS) 
      "risk-level must be one of: low, medium, high, critical")
    (read cases case-id)
    (enforce-guard signer-guard)
    (insert wallet-attestations attestation-id
      {
        "attestation-id": attestation-id,
        "case-id": case-id,
        "wallet": wallet,
        "chain": chain,
        "risk-level": risk-level,
        "risk-score": risk-score,
        "evidence-hash": evidence-hash,
        "signer": signer
      }))

  (defun get-case (case-id:string)
    @doc "Retrieves a fraud case by its case-id."
    (read cases case-id))

  (defun get-case-event (event-id:string)
    @doc "Retrieves a case event by its event-id."
    (read case-events event-id))

  (defun get-wallet-attestation (attestation-id:string)
    @doc "Retrieves a wallet attestation by its attestation-id."
    (read wallet-attestations attestation-id))

  (defun verify-subject-hash (subject-hash:string)
    @doc "Returns true if any case exists for the given subject-hash.
         Allows public verification without exposing case metadata."
    (> (length
         (fold-db cases
           (lambda (k obj)
             (= (at "subject-hash" obj) subject-hash))
           (lambda (k obj)
             (at "case-id" obj))))
       0))

  (defun list-cases-for-chain (target-chain:string)
    @doc "Lists all cases associated with a given target chain."
    (fold-db cases
      (lambda (k obj) (= (at "subject-chain" obj) target-chain))
      (lambda (k obj) obj)))

  (defun list-attestations-for-case (target-case-id:string)
    @doc "Lists all wallet attestations for a given case-id."
    (fold-db wallet-attestations
      (lambda (k obj) (= (at "case-id" obj) target-case-id))
      (lambda (k obj) obj)))

  (defun init-reporters (initial-guard:guard)
    @doc "Initialises the reporters guard. Can only be called once."
    (require-capability (MANAGE-REPORTERS))
    (insert reporters-config-table "reporters"
      { "guard": initial-guard }))

  (defun rotate-reporters (new-guard:guard)
    @doc "Rotates the reporters guard. Requires MANAGE-REPORTERS."
    (require-capability (MANAGE-REPORTERS))
    (update reporters-config-table "reporters"
      { "guard": new-guard }))

  (defun get-reporters-guard ()
    @doc "Returns the current reporters guard for inspection."
    (at "guard" (read reporters-config-table "reporters")))

  (defpact raise-dispute (dispute-id case-id disputer reason-hash disputer-guard)
    @doc "Two-step pact: step 1 opens a dispute, step 2 (GOV) marks it reviewed."
    (step
      (require-capability (DISPUTE case-id))
      (enforce (!= dispute-id "") "dispute-id required")
      (enforce (!= reason-hash "") "reason-hash required")
      (read cases case-id)
      (enforce-guard disputer-guard)
      (insert disputes dispute-id
        {
          "dispute-id": dispute-id,
          "case-id": case-id,
          "disputer": disputer,
          "reason-hash": reason-hash,
          "status": "pending"
        })
      (yield { "dispute-id": dispute-id, "case-id": case-id }))
    (step
      (resume { "dispute-id" := did, "case-id" := cid }
        (require-capability (GOV))
        (update disputes did { "status": "reviewed" }))))

  (defun get-dispute (dispute-id:string)
    @doc "Retrieves a dispute by its dispute-id."
    (read disputes dispute-id))
)

(create-table cases)
(create-table case-events)
(create-table wallet-attestations)
(create-table disputes)
(create-table reporters-config-table)
