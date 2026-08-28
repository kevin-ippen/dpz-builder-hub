# [FEATURE]: Indirect Data Contract Validation

**Labels:** `feature`, `needs-triage`

---

## Is there an existing issue for this?

- [x] I have searched the existing issues

---

## Problem statement

Contract validation (schema drift, SLA/freshness, DQ) today runs **directly** against Unity Catalog and the remote system: the validation job uses Spark to `DESCRIBE TABLE` / `DESCRIBE DETAIL` on the physical tables and checks Postgres for DQ results. When Ontos cannot access the remote system—e.g. no network path from Ontos to the source, or no connector available yet—these checks fail and we have no way to validate the contract.

We need an **indirect validation** option: the provider publishes validation-relevant data (current schemas, access grants, metadata such as last updated / status) into UC tables (Lakebase or Delta) that conform to a versioned schema. Ontos then validates contracts by reading from that UC schema instead of the live remote system.

---

## Proposed Solution

1. **Contract model**
   - Add to Data Contracts:
     - **Validation method**: `direct` (default, current behavior) or `indirect`.
     - **Indirect validation schema**: when method is `indirect`, the UC schema name (e.g. `catalog.schema`) where the provider’s exchange tables live.
   - Persist in DB, API (Read/Update/Create), and show in the contract details UI (e.g. a “Contract validation” section near Server configurations).

2. **Indirect Validation Exchange**
   - Define a **versioned JSON schema** that providers must adhere to for the UC exchange schema:
     - **Metadata table**: e.g. `exchange_metadata` with `exchange_definition_version`, `last_updated`, `status`, etc.
     - **Named tables**: e.g. `table_schemas` (physical_table_name, column_name, data_type, nullable, …) so Ontos can compare contract schema to “current” schema; optionally later `access_grants`, `ownership`.
   - Ontos reads the metadata first, then by schema version loads the correct tables and runs equivalent checks (schema drift, freshness from metadata, optionally access/ownership later).

3. **Validation workflow**
   - When loading contracts (e.g. from UC), include `validation_method` and `indirect_validation_schema`.
   - In `validate_contract()`:
     - **Direct**: keep current behavior (qualify physical name, Spark DESCRIBE, freshness, DQ).
     - **Indirect**: resolve the UC schema from the contract, read metadata → exchange version → read exchange tables → run schema drift and freshness checks against that data; store results as today.

4. **Implementation order (summary)**
   - DB + API + manager (new columns, migration, create/update/build API model).
   - Frontend (types + “Contract validation” section with method + UC schema input).
   - Exchange JSON schema + short provider doc.
   - Workflow: extend contract load with validation fields; branch in `validate_contract`; implement indirect path with helpers (read metadata, read table_schemas, check_schema_drift_indirect, freshness from metadata).
   - Ensure UC `data_contracts` (used by the job) exposes the new columns (sync or migration).

---

## Additional Context

- **Current validation:** `src/backend/src/workflows/data_contract_validation/data_contract_validation.py` — `load_active_contracts_from_uc`, then per contract `check_schema_drift`, `check_table_freshness`, `check_dq_status`.
- **Key files to touch:**  
  - Backend: `db_models/data_contracts.py`, `models/data_contracts_api.py`, `controller/data_contracts_manager.py`, `workflows/data_contract_validation/data_contract_validation.py`, Alembic migration.  
  - Frontend: `types/data-contract.ts`, `views/data-contract-details.tsx` (new “Contract validation” section).
- **ODCS:** Treat as Ontos extension (API/DB only; optional round-trip via `customProperties` in export).
- **Out of scope for initial implementation:** Access/ownership checks in indirect mode (can be added later via exchange schema extensions); no change to core ODCS JSON schema.

A detailed implementation plan with data flow exists in the repo (plan: “Indirect Contract Validation”).
