# EDX_IMT — Build Task List for Claude Code

**Service:** EDX_IMT (International Money Transfer)
**Reference pattern repos:**

- https://github.com/MaridadiMe/iam — module structure, base classes, auth guard shape
- https://github.com/MaridadiMe/loans-decision-engine — Oracle production config (schema-per-service, Vault secrets, TypeORM migrations CLI), Configurations module pattern

**Stack:** NestJS + TypeORM + Oracle, fronted by WSO2 API Manager (WSO2-native IAM, no external Key Manager)
**Gateway/edge:** Traefik (per existing EDX conventions)

Follow the reference repo's structure exactly unless a task below says otherwise. Module shape per feature: `controllers/ dtos/ entities/ repositories/ services/`, wired through a `*.module.ts`. Reuse `BaseEntity`, `BaseRepository<T>`, `BaseService<T>`, `BaseController<T>`, `BaseResponseDto<T>`, `HttpExceptionFilter` unchanged from the reference — copy them into `src/common` verbatim as the foundation.

---

## Phase 0 — Scaffold & Config

> A fresh NestJS project already exists at the root of this repo (`nest new` has been run). Do not re-scaffold it — work within it. Align `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `.eslintrc.js`, `.prettierrc` with the reference repo's versions where they differ from the defaults NestJS generated.

- [ ] Copy `src/common/*` from the reference repo as-is (entities/base.entity.ts, repositories/base.repository.ts, services/base.service.ts, controllers/base.controller.ts, dto/base-response.dto.ts, filters/http-exception.filter.ts, helpers/app-helpers.ts).
- [ ] Install deps matching reference `package.json`, swapping `mysql2` → `oracledb` (`^6.6.0`+, matching `loans-decision-engine`). Keep `@nestjs/axios`, `@nestjs/config`, `@nestjs/swagger`, `@nestjs/schedule` (needed for cache-refresh crons, see Configurations/FSP modules), `class-validator`, `class-transformer`, `passport`, `passport-jwt`.
- [ ] Add `jwks-rsa` package (for JWKS-based JWT validation against WSO2's Key Manager — replaces the `iam` repo's local RSA-file approach).
- [ ] `.env-example` — model directly on `loans-decision-engine`'s `.env-example` structure:
  - `API_BASE_URL=api/v1/imt`, `APP_PORT`, `NODE_ENV`
  - `DB_TYPE=oracle`, `DB_HOST`, `DB_PORT`, `DB_SERVICE_NAME`, `DB_SCHEMA_NAME` (dedicated schema for EDX_IMT, per-service isolation as elsewhere), `DB_USER`, `DB_PASSWORD`, `DB_SYNCHRONIZE=false`, `DB_LOGGING=false`
  - `VAULT_ADDR`, `VAULT_ROLE_ID`, `VAULT_SECRET_ID`, `VAULT_SECRET_PATH=edx-imt` (secrets injected at boot, not committed)
  - `WSO2_JWKS_URI`, `WSO2_EXPECTED_AUD`, `WSO2_ISSUER` (token validation claims)
  - `CBS_BASE_URL`, `CBS_ACCOUNT_INQUIRY_ENDPOINT`, `CBS_POSTING_ENDPOINT`
  - `TIPS_BASE_URL`, `TIPS_TRANSFER_ENDPOINT`
- [ ] `src/config/vault.config.ts` — copy `fetchSecretsFromVault()` from `loans-decision-engine` verbatim (AppRole login → fetch KV secrets → inject into `process.env` at boot, before `AppModule` is created).
- [ ] `src/config/database.config.ts` — copy `loans-decision-engine`'s pattern exactly: `OracleConnectionOptions`, `serviceName` + `schema` from `DB_SERVICE_NAME`/`DB_SCHEMA_NAME`, conditional `initOracleClient()` call gated on `NODE_ENV === 'production'` (thick-client instant-client path — confirm `LD_LIBRARY_PATH`/`artifacts/instantclient` convention matches your other Oracle-backed services), entities glob `__dirname + '/../modules/**/*.entity{.ts,.js}'`, migrations glob, `migrationsTableName: 'MIGRATIONS'`.
- [ ] `src/config/migrations.config.ts` — copy `loans-decision-engine`'s standalone `DataSource` export verbatim (used by the TypeORM CLI, not the running app) so `npm run migration:generate` / `migration:run` / `migration:revert` work identically to your other Oracle services.
- [ ] Add the same `typeorm`/`migration:*` npm scripts as `loans-decision-engine`'s `package.json` (all pointed at `src/config/migrations.config.ts`).
- [ ] `src/config/swagger.config.ts` — copy pattern from `iam` repo, `addBearerAuth()`.
- [ ] `src/main.ts` — global prefix from `API_BASE_URL`, call `fetchSecretsFromVault()` before `NestFactory.create()`, `ValidationPipe`, `HttpExceptionFilter`, Swagger setup. Drop the `iam` repo's hardcoded CORS origin (see Phase 5).
- [ ] `Dockerfile` — copy multi-stage pattern from reference (node:20-slim build + production, non-root user). Confirm Oracle Instant Client requirements are satisfiable in `node:20-slim`, or switch base image if `oracledb` thin mode isn't sufficient (thin mode needs no Instant Client — confirm which mode you're using elsewhere and match it).
- [ ] `docker-compose.yml` — Traefik labels following reference pattern, routed under `PathPrefix('/api/v1/imt')`, joined to the same external network as your other EDX services.

---

## Phase 1 — Auth: WSO2-native JWT + Scope Validation

This replaces the reference repo's local-RSA-key `JwtStrategy` + `permissions` claim model.

- [ ] `src/modules/auth/strategies/jwt/jwt.strategy.ts` — use `passport-jwt` with `jwks-rsa`'s `passportJwtSecret()` as `secretOrKeyProvider`, pointed at `WSO2_JWKS_URI` (cached, rate-limited per `jwks-rsa` defaults). Validate `aud` and `iss` claims against `WSO2_EXPECTED_AUD` / `WSO2_ISSUER`.
- [ ] `validate(payload)` — return `{ sub, wso2ClientId: payload.client_id, scope: payload.scope?.split(' ') ?? [], ...rest }`. **Confirmed against a real WSO2 token**: the consumer key appears identically in `client_id`, `aud`, and `azp` — use `client_id`. Do **not** use `sub` for partner/client mapping — in the sample token `sub` was a different UUID (WSO2's internal Application ID, not the consumer key).
- [ ] `src/modules/auth/decorators/scopes.decorator.ts` — replaces `permissions.decorator.ts`. `export const Scopes = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes)`.
- [ ] `src/modules/auth/guards/scopes.guard.ts` — replaces `permissions.guard.ts`. Reads required scopes via `Reflector`, checks `request.user.scope` contains all required scopes (mirror the reference's `PermissionsGuard` logic exactly, just swap the claim source).
- [ ] `src/modules/auth/guards/jwt-auth-guard.ts` — copy from reference unchanged (still respects `@PublicRoute()`).
- [ ] `src/app.module.ts` — register `JwtAuthGuard` and `ScopesGuard` as `APP_GUARD` providers, same pattern as reference's `JwtAuthGuard` + `PermissionsGuard`.
- [ ] No login/local-strategy needed — EDX_IMT only validates tokens issued elsewhere (WSO2). Drop `local.strategy.ts`, `auth.controller.ts` login endpoint, and password-grant DTOs from the reference; this service is a resource server only.
- [ ] Confirm scope taxonomy in code comments/README: `imt:account:lookup`, `imt:transfer:create`, `imt:transfer:status`, `imt:fsp:list`, `imt:callback:receive` (reserved), `imt:recon:read` (reserved).
- [ ] **⚠️ WSO2-side blocker, not a code task**: a sample token pulled from the local WSO2 instance came back with `"scope": "default"` — none of the `imt:*` scopes are attached yet. Before the `ScopesGuard` can be tested end-to-end, the scopes need to be defined on the EDX_IMT API's resources in the WSO2 Publisher portal, and granted to the test Application's subscription. Flag this to whoever owns the WSO2 Publisher config — it'll block Phase 3 onward otherwise.

---

## Phase 2 — FSP Module (master data, list endpoint, activate/deactivate)

FSPs need to be switchable off _without redeploying_ — this is an operational kill-switch (an FSP having an outage shouldn't degrade the customer experience by letting lookups/transfers hang or fail late). Follow `loans-decision-engine`'s `ConfigurationRepository` caching pattern so `isActive` checks are served from memory, not a DB round-trip on every lookup/transfer.

- [ ] `src/modules/fsp/entities/fsp.entity.ts` — extends `BaseEntity`, `@Entity({ name: 'FSPS', schema: process.env['DB_SCHEMA_NAME'] })`. Fields: `fspCode` (unique), `fspName`, `fspType` (enum: `BANK`, `WALLET`, `INTERNAL` — internal representing Exim Bank itself; confirmed against seed data below, which uses `BANK` and `WALLET`), `country` (nullable), `isActive` (default true — the operational switch), `supportsAccountLookup` (boolean), `routingChannel` (enum: `CBS_DIRECT` | `TIPS` — **confirmed 2-way split**: Exim Bank itself uses `CBS_DIRECT` via the internal inquiry/posting API, every other FSP uses `TIPS`), `deactivationReason` (nullable).
- [ ] `src/modules/fsp/repositories/fsp.repository.ts` — extends `BaseRepository<Fsp>`, **plus** an in-memory cache mirroring `ConfigurationRepository`:
  - `private fspCache: Fsp[] = []`
  - `@Cron(CronExpression.EVERY_MINUTE) async refreshLocalCache()` — shorter interval than the 10-minute configurations cache, since FSP outages need the kill-switch to take effect fast, not up to 10 minutes later.
  - `getActiveFspFromCache(fspCode)` — used internally by Account Lookup (Phase 4) and Transfer (Phase 5) on every request; falls back to a DB hit + cache refresh if not found in cache (same defensive pattern as `getConfigurationFromLocalCache`).
  - `updateCacheEntry(fsp)` — called immediately after any create/update/activate/deactivate so the cache reflects the change without waiting for the next cron tick (same as `addConfigurationOnLocalCache`).
- [ ] `src/modules/fsp/services/fsp.service.ts` — extends `BaseService<Fsp>`. Methods: `findAllActive()` (for the partner-facing list), `findAll()` (admin view, includes inactive), `findByCode(fspCode)`, `activate(id)`, `deactivate(id, reason)` — both call `repository.updateCacheEntry()` after saving.
- [ ] `src/modules/fsp/controllers/fsp.controller.ts` — extends `BaseController<Fsp>`.
  - `GET /fsps` — `@Scopes('imt:fsp:list')`, returns **active-only** FSPs (code, name, type) for partner-side FSP selection UI.
  - `GET /fsps/admin` — `@Scopes('imt:fsp:admin')`, returns all FSPs including inactive, for the ops-facing management screen.
  - `PATCH /fsps/:id/activate` — `@Scopes('imt:fsp:admin')`.
  - `PATCH /fsps/:id/deactivate` — `@Scopes('imt:fsp:admin')`, body: `{ reason: string }` (required — don't allow silent deactivation, ops should always record why).
- [ ] `src/modules/fsp/dtos/fsp-response.dto.ts` — lean partner-facing shape (`fspCode`, `fspName`, `fspType`) — `routingChannel`, `deactivationReason` stay internal, not exposed to partners.
- [ ] `src/modules/fsp/dtos/fsp-admin-response.dto.ts` — full shape for the ops view, includes `isActive`, `routingChannel`, `deactivationReason`.
- [ ] Add new admin scope `imt:fsp:admin` to the scope taxonomy list (Phase 1) — this is an ops/internal capability, not something partner tokens should ever hold.
- [ ] Seed data: migration-based, following `loans-decision-engine`'s `InitialConfigurations` migration exactly — a `MigrationInterface` with raw `INSERT INTO FSPS (...)` statements in `up()` and matching `DELETE` in `down()`. Use the confirmed sample set:

  | fspCode | fspName | fspType | routingChannel |
  | ------- | ------- | ------- | -------------- |
  | 013     | EXIM    | BANK    | CBS_DIRECT     |
  | 014     | CRDB    | BANK    | TIPS           |
  | 015     | VODACOM | WALLET  | TIPS           |
  | 016     | YAS     | WALLET  | TIPS           |

  **⚠️ Flag before running this migration**: the codes given were `013` (EXIM), `014` (CRDB), `015` (VODACOM), `015` (YAS) — `015` was supplied twice. Assumed `016` for YAS above since it's very likely a typo, but confirm the real YAS code before this migration ships, since `fspCode` is a unique constraint and getting it wrong means a later correction migration.

- [ ] Include one FSP row representing Exim Bank itself (`routingChannel: CBS_DIRECT`, `isActive: true` always in practice, though the switch technically exists) so lookups against "our own" accounts share the same code path as external FSPs.
- [ ] Account Lookup (Phase 4) and Transfer (Phase 5) must check `isActive` before proceeding — if the resolved FSP is inactive, return a clear `503`-style error (e.g. `ServiceUnavailableException('This FSP is temporarily unavailable')`) rather than attempting the downstream call, so partners get an immediate, honest response instead of a timeout.

---

## Phase 3 — Partners Module

WSO2 tracks the **technical** identity of a caller (an Application with a consumer key, which is what authenticates the `client_credentials` call). It does not track the **business** identity — limits, callback URL, contact, or a kill-switch independent of revoking WSO2 credentials outright. `Partner` closes that gap, same shape as the FSP kill-switch pattern.

- [ ] `src/modules/partners/entities/partner.entity.ts` — extends `BaseEntity`, `@Entity({ name: 'PARTNERS', schema: process.env['DB_SCHEMA_NAME'] })`. Fields: `partnerCode` (e.g. `WESTERN_UNION`, `NALA` — unique, human-readable), `partnerName`, `wso2ClientId` (unique — the WSO2 consumer key, confirmed above as the `client_id` claim), `callbackUrl` (nullable — captured now even though delivery/retry logic is deferred to a later phase, no reason to block data capture on that), `isActive` (default true — same kill-switch semantics as FSP), `deactivationReason` (nullable), `dailyLimit` (nullable, decimal), `perTransactionLimit` (nullable, decimal — columns present even if not enforced yet), `contactEmail`.
- [ ] `src/modules/partners/repositories/partner.repository.ts` — extends `BaseRepository<Partner>`, same in-memory-cache pattern as FSP (Phase 2): `@Cron(CronExpression.EVERY_MINUTE) refreshLocalCache()`, `getActiveByClientIdFromCache(wso2ClientId)`, `updateCacheEntry()` called after any create/update/activate/deactivate.
- [ ] `src/modules/partners/services/partners.service.ts` — extends `BaseService<Partner>`. Methods: `findAll()`, `findByClientId(wso2ClientId)`, `activate(id)`, `deactivate(id, reason)`.
- [ ] `src/modules/partners/controllers/partners.controller.ts` — extends `BaseController<Partner>`. All routes `@Scopes('imt:partner:admin')` (internal/ops only — partners never call this themselves):
  - `GET /partners`
  - `POST /partners` (onboard a new partner — this is where `wso2ClientId` gets linked to the WSO2 Application created for them)
  - `PATCH /partners/:id`
  - `PATCH /partners/:id/activate`
  - `PATCH /partners/:id/deactivate` (body: `{ reason: string }`, required — same rule as FSP deactivation)
- [ ] **`PartnerContextGuard`** (new, `src/modules/partners/guards/partner-context.guard.ts`) — runs after `JwtAuthGuard`, before route handlers on partner-facing endpoints. Reads `request.user.wso2ClientId` (set by `JwtStrategy.validate()` in Phase 1), resolves it via `PartnersService.findByClientId()` (cache-backed), and:
  - Throws `ForbiddenException` if no matching `Partner` record exists — this closes the gap flagged during the earlier security discussion: a token can be technically valid (issued by WSO2) yet belong to no recognized business partner. Don't let that through.
  - Throws `ServiceUnavailableException` if the matched partner is `isActive: false` — same pattern as the FSP inactive-check in Phase 2/5.
  - Attaches `request.partner` for downstream use.
- [ ] Register `PartnerContextGuard` on the Account Lookup and Transfer controllers (Phases 4/5) — not globally, since `imt:fsp:admin`/`imt:config:admin`/`imt:partner:admin` internal-ops routes aren't called by partner tokens and shouldn't require a `Partner` record to exist.
- [ ] `Transfer` entity (Phase 5) gets a `partnerId` foreign key to `Partner`, populated from `request.partner.id` — every transfer is now traceable to which partner submitted it, which is what per-partner reporting and recon (deferred) will need.
- [ ] Add `imt:partner:admin` to the scope taxonomy (Phase 1 / final list in Phase 8).
- [ ] Open question to resolve with whoever owns WSO2 Publisher config: is it one WSO2 Application per partner (Western Union and NALA each get their own consumer key), or could multiple partners share an Application? The `Partner` design above assumes **one Application per partner** — confirm this matches how partner onboarding is actually being done in WSO2, since a shared-Application setup would break the 1:1 `wso2ClientId` mapping.

---

# EDX_IMT — Phase 3.5: Partner Settlement Accounts (Build Task List)

**Service:** EDX_IMT (International Money Transfer)
**Placement:** Between Phase 3 (Partners Module) and Phase 4 (Account Lookup Module)
**Scope:** Incoming transfers only. No product/corridor dimension, no per-transaction account selection logic.

A `Partner` (NALA, Western Union, etc.) may hold more than one settlement account with Exim Bank — typically one per currency. This phase adds `partner_accounts` as a child of `Partner`, following the same kill-switch/cache pattern as FSP and Partner.

---

## Tasks

- [ ] `src/modules/partners/entities/partner-account.entity.ts` — extends `BaseEntity`. `@Entity({ name: 'PARTNER_ACCOUNTS', schema: process.env['DB_SCHEMA_NAME'] })`. Fields:
  - `partnerId` (FK → `Partner.id`)
  - `accountNumber`
  - `currency`
  - `isDefault` (boolean, default `false`) — the account used when resolving "which account do we credit/debit for this partner+currency" during transfer posting
  - `status` (enum: `ACTIVE`, `INACTIVE`)
  - No uniqueness constraint on `(partnerId, currency)` — a partner can hold multiple accounts in the same currency.

- [ ] `src/modules/partners/repositories/partner-account.repository.ts` — extends `BaseRepository<PartnerAccount>`, same in-memory cache pattern as `FspRepository`/`PartnerRepository` (Phases 2/3):
  - `@Cron(CronExpression.EVERY_MINUTE) refreshLocalCache()`
  - `getDefaultAccountFromCache(partnerId, currency)` — falls back to DB + cache refresh on miss, same defensive pattern as `getActiveFspFromCache`.
  - `updateCacheEntry()` called after create/update/activate/deactivate.

- [ ] `src/modules/partners/services/partner-accounts.service.ts` — extends `BaseService<PartnerAccount>`. Methods:
  - `create(partnerId, dto)`
  - `listByPartner(partnerId)`
  - `setDefault(id)` — **transactional**: within the same transaction, flip `isDefault = false` on any other `ACTIVE` account sharing `(partnerId, currency)`, then set `isDefault = true` on the target. Reject if the target account is `INACTIVE`.
  - `deactivate(id)` — if the deactivated account was the default, do **not** auto-promote another account to default; leave `getDefaultAccountFromCache()` to return null/throw, forcing an explicit ops decision rather than silently rerouting settlement funds.
  - `getDefaultForCurrency(partnerId, currency)` — thin wrapper over the repository cache method; this is the one other modules (Transfer, Phase 5) call.

- [ ] `src/modules/partners/controllers/partner-accounts.controller.ts` — all routes `@Scopes('imt:partner:admin')` (same tier as Partner CRUD — ops-only, partners never call this themselves):
  - `GET /partners/:partnerId/accounts`
  - `POST /partners/:partnerId/accounts`
  - `PATCH /partners/accounts/:id/set-default`
  - `PATCH /partners/accounts/:id/deactivate`

- [ ] **Integration into Transfer (Phase 5)**: in `createTransfer()`, after resolving the beneficiary FSP and before persisting the transfer, call `PartnerAccountsService.getDefaultForCurrency(partner.id, dto.currency)`. Throw `BadRequestException` (or a dedicated `NoDefaultAccountException`) if no default account exists for that partner+currency — don't let a transfer proceed with an ambiguous settlement account. Store the resolved `partnerAccountId` on the `Transfer` entity (add this FK column to Phase 5's `transfer.entity.ts`) for audit/recon.

- [ ] Migration: create `PARTNER_ACCOUNTS` table, same `MigrationInterface` style as the FSP/Configurations seed migrations. No seed data required unless you already know NALA/Western Union's initial settlement accounts — if you do, seed them here with `isDefault: true` per currency.

- [ ] No new scope needed — reuse `imt:partner:admin` (already covers partner-level admin actions).

---

## Deferred (explicitly out of scope for this phase)

- [ ] Outbound/debit-side account resolution (this phase only supports incoming).
- [ ] Per-product or per-corridor account routing (`purpose`/`productCode` dimension) — future additive column.
- [ ] `effectiveFrom`/`effectiveTo` history tracking on accounts — deferred, additive later.

---

## Phase 4 — Account Lookup Module

Account lookup is no longer a stateless passthrough — it's the gatekeeper for transfers. Every lookup attempt (success or failure) gets logged, and a successful lookup produces a `lookupId` the partner must supply on the follow-up `POST /transfers` call. This mirrors TIPS's own rule (no transfer without a prior successful inquiry) and extends it to the whole IMT flow regardless of destination.

- [ ] `src/modules/account-lookup/entities/account-lookup-log.entity.ts` — extends `BaseEntity` (its `id` **is** the `lookupId` returned to partners — no separate field needed). `@Entity({ name: 'ACCOUNT_LOOKUP_LOGS', schema: process.env['DB_SCHEMA_NAME'] })`. Fields:
  - `partnerId` (FK to `Partner`, from `request.partner.id` via `PartnerContextGuard` — Phase 3) — prevents one partner from consuming another partner's lookup
  - `fspCode`, `routingChannelUsed` (`CBS_DIRECT` | `TIPS`, resolved at lookup time)
  - `accountIdentifier` (the identifier that was looked up — stored so the transfer service can verify the beneficiary on `POST /transfers` matches what was actually inquired, not a different account)
  - `accountName` (nullable — populated on success, useful to echo back to the partner for name-matching confirmation)
  - `currency` (nullable)
  - `lookupStatus` (enum: `SUCCESS`, `FAILED`)
  - `failureReason` (nullable)
  - `expiresAt` — set at creation time to `now + accountLookupValidityMinutes` (read from the **Configurations module**, Phase 6 — seed a `accountLookupValidityMinutes` config value, default `10`, so ops can tune the window without a redeploy)
  - `consumedAt` (nullable — set when a transfer successfully consumes this lookup)
  - `consumedByTransferId` (nullable FK to `Transfer`, set at the same time)
- [ ] `src/modules/account-lookup/repositories/account-lookup-log.repository.ts` — extends `BaseRepository<AccountLookupLog>`. Methods: `create/save` (standard), `findValidForConsumption(lookupId, partnerId)` — single query encapsulating the validation below, used by Transfer (Phase 5) rather than duplicating the checks there.
- [ ] `src/modules/account-lookup/dtos/account-lookup-request.dto.ts` — `fspCode` (required), `accountIdentifier` (required), `currency` (optional).
- [ ] `src/modules/account-lookup/dtos/account-lookup-response.dto.ts` — `lookupId`, `accountName`, `accountStatus`, `currency`, `fspCode`, `fspName`, `expiresAt` (so partners know the window without guessing).
- [ ] `src/modules/account-lookup/services/account-lookup.service.ts`:
  - Resolve FSP via `FspService` cache (Phase 2) — 404 if unknown, `ServiceUnavailableException` if inactive.
  - Branch on `fsp.routingChannel`:
    - `CBS_DIRECT` (FSP code `013`/EXIM only, per confirmed routing) → call `RestclientService` against `CBS_BASE_URL + CBS_ACCOUNT_INQUIRY_ENDPOINT` (internal inquiry API).
    - `TIPS` (every other FSP) → call the existing TIPS Gateway account-inquiry endpoint — confirm exact path/contract before wiring.
  - **Always** write an `AccountLookupLog` row, whether the downstream call succeeds or fails — this is the audit trail, not an optional add-on.
  - On success: return `lookupId` (the log's `id`), `accountName`, `expiresAt` to the partner.
  - On failure: log `lookupStatus: FAILED` + `failureReason`, and throw an HTTP error to the partner (e.g. `NotFoundException`/`BadRequestException` depending on cause) — **no `lookupId` is returned on failure**, since a failed lookup can never be consumed by a transfer. The audit row still exists internally for support/traceability, it's just never surfaced to the caller.
- [ ] `src/modules/account-lookup/controllers/account-lookup.controller.ts` — `POST /accounts/lookup`, `@Scopes('imt:account:lookup')`, guarded by `PartnerContextGuard` (Phase 3).

---

## Phase 5 — Transfer Module

- [ ] `src/modules/transfer/entities/transfer.entity.ts` — extends `BaseEntity`. Fields:
  - `partnerReference` (partner's own ref, for idempotency/dedupe)
  - `transactionId` (your own generated ref, unique, returned to partner)
  - `senderName`, `senderCountry`, `senderIdentifier`
  - `beneficiaryFspCode`, `beneficiaryAccountIdentifier`, `beneficiaryName`
  - `amount`, `currency`, `purposeCode`
  - `routingChannel` (`CBS_DIRECT` | `TIPS`) — resolved at creation time from the beneficiary FSP, stored for audit/recon even if FSP routing config changes later
  - `status` (enum: `PENDING`, `POSTED`, `FAILED`, `REVERSED` — same enum reused in status-inquiry responses and later callbacks, per earlier design decision)
  - `cbsReference` / `tipsReference` (nullable — populated once the downstream leg confirms)
  - `failureReason` (nullable)
- [ ] `src/modules/transfer/repositories/transfer.repository.ts` — extends `BaseRepository<Transfer>`.
- [ ] `src/modules/transfer/dtos/create-transfer.dto.ts` — partner reference, **`lookupId` (required, `@IsUUID`)**, sender details, beneficiary FSP code + account identifier + name, amount, currency, purpose code. Full `class-validator` decoration matching reference DTO style.
- [ ] `src/modules/transfer/dtos/transfer-response.dto.ts` — `transactionId`, `status`, timestamps.
- [ ] `src/modules/transfer/services/transfer.service.ts`:
  - `createTransfer(dto, partner)`:
    1. Idempotency check — if `partnerReference` already exists, return the existing transfer rather than creating a duplicate (partners will retry on timeout).
    2. **Lookup validation** (via `AccountLookupLogRepository.findValidForConsumption()`, Phase 4) — throw an HTTP error (e.g. `BadRequestException`) if: the `lookupId` doesn't exist; `lookupStatus !== SUCCESS`; `expiresAt` has passed; `consumedAt` is already set (replay attempt); `partnerId` on the log doesn't match the calling partner; or `fspCode`/`accountIdentifier` on the log don't match the transfer's beneficiary fields. Same pattern as Account Lookup's failure handling — throw and stop, no transfer record created. Any of these fail the transfer outright — this is the enforcement point for "no transfer without a successful prior lookup."
    3. Resolve beneficiary FSP via `FspService.findByCode()` (re-check `isActive` — an FSP could have gone inactive between lookup and transfer).
    4. Persist transfer with `status: PENDING`, `routingChannel` set from FSP, `partnerId` from `request.partner.id` (Phase 3).
    5. Mark the consumed `AccountLookupLog` row: `consumedAt = now`, `consumedByTransferId = <new transfer id>`.
    6. Kick off downstream posting **asynchronously** (don't block the HTTP response on CBS/TIPS latency) — for phase 1, a simple fire-and-forget async call is fine; note in code comments that a proper queue (matching your TIPS RabbitMQ pattern) is a candidate upgrade once volume justifies it.
    7. Return `202 Accepted` + `transactionId` immediately.
  - `postToDownstream(transfer)` (private, called async):
    - `CBS_DIRECT` → call CBS posting endpoint via `RestclientService`.
    - `TIPS` → call TIPS Gateway's transfer-initiation endpoint (reuse existing TIPS APIs — confirm contract, likely similar to your P1–P4 ESB proxy patterns).
    - On success/failure, update `transfer.status` and reference fields.
  - `dispatchCallback(transfer)` (private, called after status settles): **stub only for this phase** — log the intent to call the partner's registered webhook URL, but do not build retry/backoff/idempotency logic yet (deferred per your instruction). Leave a clear `// TODO(phase-2): retry/backoff/idempotent delivery via queue` marker so this is easy to find later.
- [ ] `src/modules/transfer/controllers/transfer.controller.ts`:
  - `POST /transfers` — `@Scopes('imt:transfer:create')`, returns `202` with `BaseResponseDto<TransferResponseDto>`.
  - `GET /transfers/:transactionId` — `@Scopes('imt:transfer:status')`, returns current status (same shape/enum as the future callback payload, so partners polling vs. receiving callbacks see identical data).

---

## Phase 6 — Configurations Module

Copy `loans-decision-engine`'s `configurations` module close to verbatim — this gives ops the ability to tweak operational values (timeouts, feature toggles, thresholds, retry counts once callbacks are built, etc.) from the front end without a redeploy, same purpose it serves in the loans engine.

- [ ] `src/modules/configurations/entities/configuration.entity.ts` — extends `BaseEntity`, `@Entity({ name: 'CONFIGURATIONS', schema: process.env['DB_SCHEMA_NAME'] })`. Fields: `key` (string), `value` (`type: 'clob'` — supports storing JSON blobs, not just scalars, matching the loans engine's `supportedProducts`-style config entries).
- [ ] `src/modules/configurations/repositories/configuration.repository.ts` — copy verbatim: local in-memory cache (`configCache: any[]`), `@Cron(CronExpression.EVERY_10_MINUTES) refreshLocalCache()`, `getConfigurationFromLocalCache(key)` (refreshes on cache miss), `addConfigurationOnLocalCache()`, `saveConfiguration()` (upsert by key), `getConfigs()`, `updateConfig()`, `deleteConfigById()`, `exists()`.
- [ ] `src/modules/configurations/services/configurations.service.ts` — copy verbatim: `addConfig()`, `getConfigs()`, `updateConfig()`, `deleteConfig()`, and critically `get(key)` — this is the method other EDX_IMT modules call internally to read a config value (cache-backed, not a DB hit per call).
- [ ] `src/modules/configurations/controllers/configuration.controller.ts` — copy verbatim: `POST /configurations`, `GET /configurations`, `PATCH /configurations/:id`, `DELETE /configurations/:id`. Add `@Scopes('imt:config:admin')` to all four (the reference repo left these unguarded — that's fine for an internal-only loans engine, but EDX_IMT is partner-facing, so this must be locked to an internal/ops scope, not left open).
- [ ] `src/modules/configurations/dtos/config.dto.ts` and `update-config.dto.ts` — copy verbatim.
- [ ] Add `imt:config:admin` to the scope taxonomy list (Phase 1) — same internal-only tier as `imt:fsp:admin`.
- [ ] Seed initial config values via migration (same `MigrationInterface` pattern as the FSP seed and the loans engine's `InitialConfigurations`). Candidates worth seeding from day one: default account-lookup timeout (ms), default transfer-posting timeout (ms) — values other modules read via `ConfigurationsService.get(key)` instead of hardcoding.
- [ ] Note the distinction from the FSP module's cache: `Configurations` uses a 10-minute refresh (matches the loans engine — these are low-frequency operational tweaks), while `FSP` uses a 1-minute refresh (Phase 2 — because an FSP outage needs the kill-switch to bite quickly). Don't unify these into one cache mechanism; keep them separate per their actual freshness needs.

---

## Phase 7 — Cross-Cutting / Hardening

- [ ] Global `ValidationPipe` — confirm `whitelist: true` for EDX_IMT (reference has `whitelist: false`; for a partner-facing financial API, stripping unknown fields is safer — recommend overriding this default).
- [ ] Structured logging — confirm whether request/response logging in `RestclientService` (copied from reference) should mask sensitive fields (account numbers, sender/beneficiary identifiers) before logging, given this handles real remittance data. Recommend adding a redaction helper before this goes near production.
- [ ] Swagger — tag controllers `@ApiTags('Accounts')`, `@ApiTags('Transfers')`, `@ApiTags('FSPs')`, `@ApiBearerAuth()` throughout, matching reference conventions.
- [ ] Confirm CORS policy for EDX_IMT — reference hardcodes a single origin; since this is partner-to-server (no browser CORS concerns for `client_credentials` flows), you likely don't need CORS enabled at all here — flag for a decision rather than copying the reference's browser-oriented CORS config.

---

## Phase 8 — Confirm Scope Taxonomy (final)

By this point the scope list has grown beyond Phase 1's original sketch — confirm the final set before wiring guards everywhere:

- `imt:account:lookup` (partner)
- `imt:transfer:create` (partner)
- `imt:transfer:status` (partner)
- `imt:fsp:list` (partner — active FSPs only)
- `imt:fsp:admin` (internal/ops — full FSP CRUD + activate/deactivate)
- `imt:partner:admin` (internal/ops — partner onboarding + activate/deactivate)
- `imt:config:admin` (internal/ops — configurations CRUD)
- `imt:callback:receive` (reserved, deferred)
- `imt:recon:read` (reserved, deferred)

---

## Deferred — Not This Phase

- Outbound callback delivery: retry/backoff, dead-lettering, HMAC signing, partner webhook URL registry/config. `dispatchCallback()` stub above is the seam to build this into later.
- Recon: settlement-file/ledger comparison job. `Transfer` entity's audit fields (`cbsReference`, `tipsReference`, `status`, timestamps) are intentionally recon-friendly from day one so this slots in without a schema rewrite.
- LDAP-bound internal/ops auth path — still being decided; doesn't block partner-facing endpoints (Phases 2–4 only need `client_credentials` scopes).

---

## Open Questions to Resolve Before/During Build

1. Exact TIPS Gateway API contracts for account inquiry and transfer initiation (endpoint paths, request/response shapes) — needed to wire Phase 4/5's `TIPS` branch correctly.
2. Exact WSO2 JWT claim shape for scopes (`scope` as space-delimited string is the OAuth2 default — **confirmed** against a real token; note the token sampled had `scope: "default"`, meaning the `imt:*` scopes still need to be attached at the WSO2 Publisher level before this can be tested end-to-end).
3. FSP seed data — **confirmed** (see Phase 2 table), except the duplicate `015` code needs correcting for YAS before the seed migration runs.
4. Whether the WSO2 Application-per-partner assumption in Phase 3 matches actual partner onboarding practice.
