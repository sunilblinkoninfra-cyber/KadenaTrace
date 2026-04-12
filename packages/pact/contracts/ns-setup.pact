;; ns-setup.pact -- Defines the KadenaTrace namespace and shared keysets.
;; Deploy this file in its own transaction BEFORE deploying
;; fraud-registry.pact. After the module is loaded, call
;; init-reporters with the reporters keyset to seed the
;; reporters-config-table that the module's capabilities read from.
;;
;; Access control flow:
;;   1. kadenatrace.admin  -- governs contract deployment and reporter rotation
;;   2. kadenatrace.reporters -- used ONLY to derive the initial guard
;;      passed to init-reporters. After init, capabilities read
;;      from reporters-config-table, not this keyset directly.
(let* (
  (admin-guard    (read-keyset "kadenatrace-admin"))
  (reporter-guard (read-keyset "kadenatrace-reporters")))
  (define-namespace "kadenatrace" admin-guard admin-guard)
  (namespace "kadenatrace")
  (define-keyset "kadenatrace.admin"     admin-guard)
  ;; reporter-guard is the bootstrap value for reporters-config-table.
  ;; The module's write capabilities enforce the table guard, not this keyset.
  (define-keyset "kadenatrace.reporters" reporter-guard))
