---
status: accepted
---

# Soft-deactivate accounts and block KYC hard deletion until retention is approved

HomeCare will treat a user-requested account closure as soft deactivation for the MVP: the profile records an explicit `deactivated` status and timestamp, existing sessions immediately lose application-data access through RLS, and the account's operational and audit records remain intact. Hard deletion of any profile that has technician identity documents is deliberately blocked until HomeCare approves a legal retention schedule and implements an audited purge workflow for both PostgreSQL records and private Storage objects.

## Consequences

- A signed-in user can call the audited `deactivate_own_account()` workflow; clients cannot directly mutate account-status fields.
- Deactivation is not anonymization or hard deletion. Support copy and privacy notices must describe it accurately.
- KYC objects and their review history remain immutable after submission and cannot be removed by the ordinary Auth Admin delete flow. The hard-delete guard checks both retained `technician_documents` rows and the technician's private Storage prefix, so deleting a draft database row cannot orphan a file and accidentally make Auth deletion permissible.
- A deactivated technician cannot receive document or profile review decisions and is excluded from public discovery, even if the profile had previously been verified.
- The configurable KYC file-count limit lives in `private.kyc_storage_configuration`; changes require a trusted database migration or a future audited operations workflow.
- A `technician_documents` row is the authoritative upload reservation. Registration is serialized per technician with a transaction-level advisory lock, and Storage accepts only a path backed by a pending draft reservation; concurrent registration and upload requests therefore cannot create more retained KYC objects than the configured reservation limit.
- Before production pilot, legal/operations must approve retention periods, lawful deletion exceptions, restore/reactivation rules, and the identity of the operator allowed to run a purge.
- A future purge must revoke active sessions, lock the account and KYC rows, delete Storage objects through the supported Storage API, append a non-sensitive audit record, and only then remove database/Auth records. It must be idempotent and tested for partial failure.

## Rejected alternatives

- Immediate cascade deletion was rejected because it can erase evidence needed for technician review, complaints, disputes, fraud investigation, and audit continuity before retention obligations are defined.
- Silent prevention by an incidental foreign-key or immutability-trigger failure was rejected because account lifecycle behavior must be an explicit product and operational invariant.
