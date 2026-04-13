;; ns-setup.pact -- Defines the KadenaTrace namespace and shared keysets.
;; Deploy this file in its own transaction BEFORE deploying
;; fraud-registry.pact. After the module is loaded, call
;; init-reporters with the reporters guard to seed the
;; reporters-config-table that the module capabilities read from.
;;
;; Access control flow:
;;   1. kadenatrace.admin     -- governs deployment and reporter rotation
;;   2. kadenatrace.reporters -- bootstrap value for reporters-config-table
;;      only. After init-reporters is called, all write capabilities
;;      enforce the table guard, not this keyset directly.
(let* (
  (admin-guard    (read-keyset "kadenatrace-admin"))
  (reporter-guard (read-keyset "kadenatrace-reporters")))
  (define-namespace "kadenatrace" admin-guard admin-guard)
  (namespace "kadenatrace")
  (define-keyset "kadenatrace.admin"     admin-guard)
  ;; reporter-guard seeds reporters-config-table via init-reporters.
  ;; The module's write capabilities use the table, not this keyset.
  (define-keyset "kadenatrace.reporters" reporter-guard))
