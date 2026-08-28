# ODCS schema diff: v3.0.2-strict → v3.1.0

**Diff run:** 2026-02-10  
**Files compared:**
- `src/backend/src/schemas/odcs-json-schema-v3.0.2-strict.json` (2394 lines)
- Upstream `odcs-json-schema-v3.1.0.json` (2928 lines)

**Unified diff:** [odcs-schema-diff-v3.0.2-strict-to-v3.1.0.diff](odcs-schema-diff-v3.0.2-strict-to-v3.1.0.diff) (~633 insertions, 99 deletions)

## Summary of changes (from diff)

### Root / apiVersion
- **apiVersion**: default `v3.0.2` → `v3.1.0`; enum adds `v3.1.0` first.

### team
- **team**: `type: array`, `items: $ref Team` → **oneOf** (1) Team object with members array, (2) deprecated array of TeamMember. Top-level `team` now allows both v3.1.0 Team object and v3.0.x array.

### slaDefaultElement
- **slaDefaultElement**: description updated to "DEPRECATED SINCE 3.1. WILL BE REMOVED IN ODCS 4.0"; `"deprecated": true` added.

### New $defs (before Server)
- **ShorthandReference**: string, pattern `table_name.column_name`.
- **FullyQualifiedReference**: string, pattern for path/id notation.
- **StableId**: string, pattern `[A-Za-z0-9_-]+`.

### Server
- **Server.properties**: new optional **id** (`$ref StableId`).
- **Server.type enum**: adds **hive**, **impala**, **zen**; order change.
- **Server allOf**: new branches for `hive` → HiveServer, `impala` → ImpalaServer, `zen` → ZenServer.

### ServerSource
- **DuckdbServer.schema**: `type: integer` → `type: string`.
- **AzureServer.format / delimiter**: `enum` → `examples` (string).
- **S3Server.format / delimiter**: `enum` → `examples` (string).
- **SftpServer.format / delimiter**: `enum` → `examples` (string).
- **CustomServer**: new property **stream** (string).
- **New**: **HiveServer**, **ImpalaServer**, **ZenServer** definitions.

### SchemaElement
- **SchemaElement.properties**: new optional **id** (`$ref StableId`).

### SchemaObject
- **SchemaObject.properties**: new optional **relationships** array, `items: $ref RelationshipSchemaLevel`.

### SchemaBaseProperty
- **logicalType enum**: adds **timestamp**, **time** (was string, date, number, integer, object, array, boolean).
- **SchemaBaseProperty.properties**: new optional **relationships** array, `items: $ref RelationshipPropertyLevel`.

### logicalTypeOptions (breaking)
- **date**: exclusiveMaximum / exclusiveMinimum `type: boolean` → `type: string` (value bounds).
- **timestamp / time**: new conditional block with format, min/max, **timezone**, **defaultTimezone**.
- **integer / number**: exclusiveMaximum / exclusiveMinimum `type: boolean` → `type: number`.

### DataQuality
- **DataQuality.properties**: new optional **id** (`$ref StableId`).
- **DataQualityLibrary**: **rule** deprecated, **metric** required; enum `["nullValues", "missingValues", "invalidValues", "duplicateValues", "rowCount"]`; new **DataQualityOperators** oneOf (mustBe, mustNotBe, mustBeGreaterThan, …); **arguments** object; DataQualitySql/DataQualityLibrary allOf DataQualityOperators.

### AuthoritativeDefinitions (items)
- New optional **id** (StableId), **description** (string).

### SupportItem
- New optional **id** (StableId).
- **url** no longer required (`required: ["channel"]` only).
- **tool** examples: add **googlechat**.
- **scope** examples: add **notifications**.
- New optional **customProperties**.

### Pricing
- **Pricing.properties**: new optional **id** (StableId).

### Team / TeamMember
- **Team** (v3.0.2) was single member shape → split into **TeamMember** (id, username, name, description, role, dateIn, dateOut, replacedByUsername, tags, customProperties, authoritativeDefinitions; required username) and **Team** (id, name, description, **members** array of TeamMember, tags, customProperties, authoritativeDefinitions).

### Role
- **Role.properties**: new optional **id** (StableId).

### ServiceLevelAgreementProperty
- New optional **id** (StableId).
- New optional **description**, **scheduler**, **schedule** (with examples).

### CustomProperty
- New optional **id** (StableId), **description** (string).

### New $defs (Relationship)
- **RelationshipBase**: type (default foreignKey), from (ShorthandReference | FullyQualifiedReference | array), to (same), customProperties.
- **RelationshipSchemaLevel**: allOf RelationshipBase, required from+to, oneOf (from/to both string, or both arrays).
- **RelationshipPropertyLevel**: allOf RelationshipBase, required to only, from must not be specified.
- **Relationship**: oneOf RelationshipSchemaLevel | RelationshipPropertyLevel.
