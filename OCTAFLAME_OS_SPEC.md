# Octaflame OS — Operations Management System
**Version 3.0 · MVP Specification**
> **For Claude Code.** Read this entire file before writing code. Build in the phase order in §18. Do not scaffold anything under §19 (Roadmap). When a decision is not covered here, stop and ask rather than inventing one.
---
## 1. Product Vision
Octaflame OS is the centralized Operations Management System for **Octaflame**, authorized distributor of **Fiesta Gas** canisters in **Sorsogon Province, Philippines**.
It replaces every manual spreadsheet and chat-message report with one platform where each department performs its daily work, while management gains real-time visibility into sales, inventory, KPI progress, and field activity.
It should feel like modern software — Linear, Stripe Dashboard, Notion — not a traditional ERP.
### Core philosophy
**Users never create reports. Users only perform transactions.**
Every dashboard derives from transactional data automatically. Nothing is typed twice. If a number appears on a dashboard, it was computed from a transaction someone already recorded as part of their normal job.
---
## 2. Business Coverage
**Province:** Sorsogon · **17 areas**
| DSP | Areas |
|---|---|
| **DSP Weng** | Castilla, Donsol, Pilar, Sorsogon, Bacon |
| **DSP Genie** | Gubat, Casiguran, Prieto Diaz, Barcelona, Bulusan, Irosin |
| **DSP Grace** | Juban, Magallanes, Bulan, Sta. Magdalena, Matnog |
| **DSP Mark** | Ticao Island |
Territories are **data, not code**. Management reassigns areas between DSPs from Settings. The system must handle an area moving mid-year without corrupting historical reports — every transaction stores the `dsp_id` that was responsible **at time of sale**.
---
## 3. Confirmed Business Constants
These are **verified with the business**. Seed them into a `settings` table so they can be changed without a redeploy, but these are the correct MVP values.
| Constant | Value |
|---|---|
| Canisters per crate | **24** |
| Net LPG per canister | **0.17 kg (170 g)** |
| Kg per crate (derived) | 4.08 kg |
| Annual KPI — accounts | **300 unique RTL + WS accounts** |
| Annual KPI — volume | **14.45 metric tonnes** |
| KPI scope | **Company-wide** (not split per DSP) |
| Fiscal year | Calendar year, Jan 1 – Dec 31 |
| Currency | PHP (₱) |
| Timezone | Asia/Manila |
### 3.1 Derived reference figures
Precompute and surface these on the Management dashboard as pace targets:
| Metric | Value |
|---|---|
| Canisters required for 14.45 MT | **85,000** |
| Crates required for 14.45 MT | **3,541.7** |
| Required pace | 7,083 canisters/mo · 295 crates/mo |
| Required account pace | 25 new accounts/mo company-wide |
### 3.3 The exchange model — read this before designing anything
Octaflame runs a **true exchange business**. The ₱40 gap between a refill (₱35) and a full canister (₱75) is the price of the steel shell itself. This means physical objects circulate in a loop, and the system must track that loop or the business loses money invisibly.
**Three stock holders, three ledgers:**
```
Fiesta Gas plant → WAREHOUSE → DSP ROLLING STOCK → CUSTOMER
                       ↑              ↑                 │
                       └── empties ───┴──── empties ────┘
```
1. **Warehouse** — stock at the depot
2. **DSP rolling stock** — every DSP carries inventory in their vehicle. Stock issued to a DSP has left the warehouse but is **not yet sold**. It is still company property and must be counted.
3. **Customer** — sold, but may still hold an empty shell they owe back
**Exchange rules by product:**
| Product | Full canister out | Empty shell expected back |
|---|---|---|
| `REFILL` | 1 | **1** |
| `CANISTER` | 1 | 0 (customer keeps the shell) |
| `STOVE_SET_399` | 1 | 0 |
| `STOVE_SET_599` | 3 | 0 |
Empties expected on a sale = total quantity of `REFILL` canisters on that sale. Customers do not always return one on the spot, so actual collected is recorded separately and any shortfall becomes a **customer empties balance** — canisters they owe.
**Crates circulate too.** The plastic crate is company property and comes back empty. Track crate balances the same way, per DSP and per customer.
- **Refills count toward volume at full weight**, identical to full canisters. A refill moves 0.17 kg of LPG and that is what the KPI measures.
- **Stove sets contribute the volume of their included canisters only** — the stove hardware itself is not LPG and adds 0 kg.
- Households (HH) **do** contribute to the 14.45 MT volume KPI.
- Households **do not** count toward the 300-account KPI. Only RTL and WS do. (See §7.3.)
---
## 4. Tech Stack
Do not substitute without asking.
**Frontend:** Next.js 15 (App Router) · React · TypeScript (strict) · TailwindCSS · shadcn/ui · TanStack Query · TanStack Table · Recharts · Framer Motion (restrained — transitions and micro-interactions only, never blocking) · react-hook-form + zod · date-fns + date-fns-tz
**Backend:** Supabase — PostgreSQL, Row Level Security, Supabase Auth, Supabase Storage
**Exports:** `exceljs` (XLS/XLSX) · `papaparse` (CSV) · `@react-pdf/renderer` (PDF)
**Deployment:** Vercel
### 4.1 Architectural non-negotiables
1. **Security lives in the database.** Every table gets RLS policies written *before* the UI that consumes it. Hiding a nav item is not access control.
2. **Ledgers, not balances.** Inventory levels are always `SUM(in) − SUM(out)`. Never store a mutable stock column. Never allow manual stock editing — corrections are `adjustment` movements with a reason.
3. **One volume utility.** All canister → kg → MT math lives in exactly one module, imported everywhere. Zero duplicate arithmetic.
4. **Server-derived scope.** Never accept `dsp_id` from the client on write. Derive it from the authenticated user's profile server-side.
5. **Snapshot on write.** Sales store the price, customer type, and DSP as they were at time of sale. Historical reports must never shift when a price or territory changes.
6. **Built to scale.** New municipalities, provinces, products, warehouses, and users must be addable through data entry alone.
---
## 5. Roles & Permissions
### 5.1 Base roles
`management` · `dsp` · `warehouse` · `office` · `viewer`
A role seeds a default permission set. Management can then toggle **individual permissions per user** — this is the granular grant-access system the COO asked for. Only Management can change permissions.
**Lockout guards:** a user cannot remove their own `users.manage`; the last active management account cannot be deactivated or demoted.
### 5.2 Permission keys
Stored as `text[]` on the profile.
```
dashboard.management     dashboard.dsp.own       dashboard.dsp.all
dashboard.warehouse      dashboard.office
sales.create             sales.read.own          sales.read.all
sales.edit.own           sales.edit.all          sales.delete
customers.create         customers.read.own      customers.read.all
customers.edit.own       customers.edit.all
tasks.create             tasks.read.own          tasks.read.all
tasks.assign             tasks.edit.own          tasks.edit.all
warehouse.read           warehouse.create        warehouse.adjust
truck.read                truck.create
office.read              office.create           office.adjust
reports.read.own         reports.read.all
export.own               export.all
users.manage             settings.manage         products.manage
audit.read                notifications.manage
```
### 5.3 Default templates
| | management | dsp | warehouse | office | viewer |
|---|---|---|---|---|---|
| Own dashboard | ✅ | ✅ | ✅ | ✅ | — |
| All dashboards | ✅ | — | — | — | configurable |
| Sales create / read own / edit own | ✅ | ✅ | — | — | — |
| Sales read all / edit all / delete | ✅ | — | — | — | read only |
| Customers create / read own / edit own | ✅ | ✅ | — | — | — |
| Customers read all | ✅ | — | — | — | ✅ |
| Tasks create / read own / edit own | ✅ | ✅ | ✅ | ✅ | — |
| Tasks read all / assign | ✅ | — | — | — | — |
| Warehouse read / create / adjust | ✅ | read | ✅ | — | read |
| Truck read / create | ✅ | — | ✅ | — | read |
| Office read / create / adjust | ✅ | read own allocations | — | ✅ | read |
| Reports & export | all | own | own | own | own |
| Users / settings / products / audit | ✅ | — | — | — | — |
**Viewer** starts with nothing but login. Management switches on exactly what that person should see. This is the role for an accountant, a Fiesta Gas rep, or an owner who wants numbers without operational access.
### 5.4 Data scoping
- `dsp` users see only rows where `dsp_id` matches their assignment
- `warehouse` / `office` users see only their own module plus their own tasks
- `management` sees everything
- `viewer` sees whatever is toggled on, read-only, always company-wide when granted
Enforce every rule in RLS **and** in server actions **and** in the UI. All three.
### 5.5 Bootstrap — creating the first Management account
There is a chicken-and-egg problem: only Management can create users, but initially no Management exists. Solve it deliberately, not by leaving public signup open.
**Rules:**
1. **Public signup is permanently disabled.** Turn off email signup in Supabase Auth. The only paths into the system are the seed script and an invitation from Management.
2. **The seed script creates exactly one Management account** using the Supabase Admin API and credentials read from environment variables (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`). Never commit these; never hard-code a default password in the repo.
3. That account is flagged `must_change_password = true`. On first login the user is forced to set a new password before reaching any other screen.
4. The bootstrap path is **idempotent and self-disabling** — if any active `management` user already exists, it exits without doing anything. It must not be usable as a backdoor after go-live.
5. The COO logs in with that account and creates everyone else from the UI.
### 5.6 Inviting a user
All user creation runs server-side through the Supabase Admin API. The service role key lives in server environment variables only and is **never** exposed to the browser.
**Management fills one form:**
| Field | Required | Notes |
|---|---|---|
| Full name | ✅ | |
| Email | ✅ | Becomes the login identity, must be unique |
| Phone | — | For future SMS notifications |
| Role | ✅ | `management` · `dsp` · `warehouse` · `office` · `viewer` |
| DSP assignment | Conditional | **Required when role = `dsp`**, hidden otherwise |
| Permissions | ✅ | Pre-filled from the role template (§5.3), editable before sending |
**On submit, server-side:**
1. Validate — reject duplicate email; reject `role = dsp` without a `dsp_id`; reject a `dsp_id` already claimed by another active user
2. Call `auth.admin.inviteUserByEmail()` — Supabase emails a secure setup link
3. Create the `profiles` row with role, `dsp_id`, permissions, `active = true`
4. Write an `audit_log` entry recording who invited whom, with what role and permissions
**The invited user** clicks the emailed link, sets their own password, and lands on the dashboard their permissions allow. Management never sees or sets another person's password.
**`user_invitations`** — `id`, `email`, `full_name`, `role`, `dsp_id`, `permissions text[]`, `invited_by`, `status` (`pending` | `accepted` | `expired` | `revoked`), `expires_at` (7 days), `accepted_at`, `created_at`
The user list shows pending invitations inline with a **Resend** and **Revoke** action. An unaccepted invite must not sit forever as an open door.
### 5.7 Assigning a DSP user to a territory
**`profiles.dsp_id` is the single source of truth** for who owns a DSP territory. Do **not** also store `user_id` on the `dsps` table — two writable links to the same relationship will drift apart, and the day they disagree, sales get scoped to the wrong person. If a DSP record needs to display its owner, resolve it with a join or a database view, never a second stored column.
**Constraints:**
- One active user per DSP, enforced with a partial unique index on `profiles(dsp_id) WHERE role = 'dsp' AND active = true`
- A `dsp` role user must have a `dsp_id`; enforce with a `CHECK` constraint
- Municipalities attach to a **DSP record**, not to a person. Reassigning a municipality is done in Settings and affects only future transactions — historical sales keep their snapshotted `dsp_id`
**Territory changes** are handled in Settings → Territories: a drag-or-select interface listing all 17 municipalities against the 4 DSPs, with a confirmation dialog stating plainly that the change applies going forward and does not rewrite history. Log every reassignment to the audit log.
### 5.8 Promoting someone to Management
Handled in the user edit screen by changing their role, but guarded:
1. Only a user with `users.manage` can grant `users.manage`
2. Promotion requires typing the target user's email to confirm — no accidental clicks on a role dropdown
3. Always logged to `audit_log` with previous and new role
4. **A user cannot remove their own `users.manage` permission or demote their own role** — this prevents an accidental self-lockout that would require database access to fix
5. **The last active Management account cannot be deactivated, demoted, or stripped of `users.manage`.** Block it server-side with a clear message, not just a disabled button
6. Recommend at least two Management accounts in production so a forgotten password never locks the business out of its own system. Surface a dismissible banner when only one exists
**Demoting a Management user to `dsp`** requires assigning a DSP territory in the same action, or the save is rejected.
### 5.9 Deactivation and handover
**Never delete a user.** Sales, tasks, and inventory movements all reference `created_by`; deleting the row destroys the audit trail and orphans historical records.
**Deactivating** (`active = false`) immediately revokes login and drops the user from all assignment dropdowns, while their historical data and name remain intact everywhere they appear.
**When a DSP leaves, the handover flow must:**
1. Prompt for a replacement user for that DSP, or leave the territory temporarily unassigned
2. Offer to **bulk-reassign that person's open tasks** to the incoming DSP or to Management — otherwise follow-ups silently vanish along with the account
3. Leave all customers attached to the **DSP record**, so the incoming person inherits the full book of business and every activity timeline
4. Leave historical sales untouched, still attributed to the person who made them
### 5.10 Permission editor
Reached from the user detail screen.
- Permissions grouped by module (Dashboard, Sales, Customers, Tasks, Warehouse, Office, Reports, Administration) as labelled checkbox groups — never a raw list of 30 string keys
- Each permission shows a plain-language description: `sales.read.all` → *"View sales from all DSPs, not just their own"*
- A **visual diff** marks every permission that deviates from the role's default template, so Management can see at a glance what has been customised
- **Reset to role default** button
- Dependent permissions resolve automatically: granting `sales.edit.own` grants `sales.read.own`; revoking a read permission revokes the matching write permissions and says so before saving
- Changes take effect on the user's next request — no logout required
- Every change writes previous and new permission arrays to `audit_log`
**Viewer is the flexible role.** It starts with nothing but the ability to log in. Use it for an accountant, a Fiesta Gas representative, or an owner who should see KPI progress and nothing else. Build the editor well enough that Management can compose that person's access in under a minute without touching the database.
---
## 6. Data Model
PostgreSQL. `uuid` PKs, `created_at` / `updated_at` on everything, `deleted_at` soft deletes on all transactional tables.
### 6.1 Reference
**`settings`** — `key`, `value`, `data_type`, `label`, `description`, `updated_by`, `updated_at`. Seeded from §3.
**`dsps`** — `id`, `name`, `code`, `active`
No `user_id` column — ownership is resolved from `profiles.dsp_id` (§5.7). Expose the owner through a view if a joined lookup is inconvenient.
**`municipalities`** — `id`, `name`, `dsp_id`, `active`. Seed all 17.
**`barangays`** — `id`, `municipality_id`, `name`. Optional depth for customer addresses; seed empty and let users add free-text initially.
**`profiles`** — extends `auth.users`: `id`, `full_name`, `email`, `phone`, `role`, `dsp_id`, `permissions text[]`, `active`, `must_change_password`, `invited_by`, `deactivated_at`, `deactivated_by`, `last_login_at`, `avatar_url`
Constraints: `CHECK (role <> 'dsp' OR dsp_id IS NOT NULL)` · partial unique index on `dsp_id WHERE role = 'dsp' AND active = true`
**`products`** — `id`, `code`, `name`, `unit_price`, `unit_type` (`canister` | `crate` | `set`), `canisters_included`, `includes_stove`, `stove_count`, `sort_order`, `active`
Seed:
| code | name | price | unit_type | canisters_included | stove |
|---|---|---|---|---|---|
| `REFILL` | Refill | 35.00 | canister | 1 | — |
| `CANISTER` | Canister | 75.00 | canister | 1 | — |
| `STOVE_SET_399` | Stove Set 399 | 399.00 | set | 1 | 1 |
| `STOVE_SET_599` | Stove Set 599 | 599.00 | set | 3 | 1 |
**`price_history`** — `product_id`, `unit_price`, `effective_from`, `effective_to`, `changed_by`
**`kpi_targets`** — `year`, `accounts_target`, `volume_target_mt`, `notes`. Seed the current year with 300 / 14.45. Scope is company-wide; per-DSP columns exist but stay null in MVP.
### 6.2 Customers
**`customers`**
- `id`, `business_name`, `owner_name`, `contact_number`
- `customer_type` (`HH` | `RTL` | `WS`)
- `municipality_id`, `barangay`, `address`, `landmark`
- `latitude`, `longitude` (optional)
- `dsp_id` — denormalized from municipality for query speed, kept in sync by trigger
- `status` (see §7.3), `notes`
- **Maintained by trigger on sale insert/update/delete:** `first_purchase_date`, `latest_purchase_date`, `total_transactions`, `lifetime_canisters`, `lifetime_volume_kg`, `lifetime_amount`, `average_purchase_amount`, `is_repeat_customer`
- `created_by`, `created_at`
**Validation:** HH requires only `business_name` (or owner name) + `municipality_id`. RTL and WS additionally require `owner_name`, `contact_number`, and `address` — these are the accounts being counted toward the 300, so they must be real and reachable.
**Duplicate guard:** on create, fuzzy-match name within the same municipality and warn before saving. A double-entered retailer inflates the account KPI, which is the one number nobody can afford to be wrong.
### 6.3 Sales
**`sales`** (header)
- `id`, `sale_date`, `deployment_date` (date stock was physically handed over — required for RTL/WS, null for HH)
- `customer_id`, `customer_type` (snapshot), `municipality_id` (snapshot), `dsp_id` (snapshot)
- `total_amount`, `total_canisters`, `total_crates`, `total_volume_kg`, `total_volume_mt` — all computed on save
- `is_repeat_purchase` (computed: customer had ≥1 prior sale)
- `payment_status` (`paid` | `partial` | `unpaid`), `amount_paid`
- **Exchange:** `empties_expected` (computed from REFILL lines), `empties_collected` (entered by DSP), `empties_variance` (computed), `crates_returned_by_customer`
- **Integrity:** `client_ref` (uuid generated on the device, **unique index**), `synced_at`, `receipt_no`
- `notes`, `created_by`, `created_at`, `updated_at`, `deleted_at`
**`sale_items`**
- `id`, `sale_id`, `product_id`
- `qty_crates`, `qty_canisters`, `qty_sets`
- `unit_price` (snapshot), `line_total`
- `line_canisters`, `line_volume_kg` — computed
- `notes` — line-level, optional
**`sale_returns`** — damaged, leaking, or rejected goods coming back after a sale
- `id`, `sale_id`, `sale_item_id`, `product_id`, `quantity`
- `return_type` (`damaged` | `leaking` | `wrong_item` | `customer_return` | `expired`)
- `restockable` (bool — leaking canisters are not), `refund_amount`
- `return_date`, `notes`, `created_by`, `approved_by`
A return **reverses the corresponding volume from the KPI** and returns non-damaged units to DSP rolling stock. Damaged units move to a `damaged` bucket that is deducted from stock but never resold. Returns are how mistakes get corrected — **DSPs must never delete a sale to fix one.**
### 6.4 DSP Rolling Stock
Every DSP carries inventory in their vehicle. This ledger is what makes warehouse issuance and sales reconcile.
**`dsp_stock_movements`** — balance is always `SUM(in) − SUM(out)`, never stored
- `id`, `dsp_id`, `item_id`, `quantity` (always positive)
- `movement_type`:
  - `issued` — received from warehouse (in)
  - `sold` — **auto-written by trigger on sale insert** (out)
  - `returned_to_warehouse` — unsold stock handed back (out)
  - `transfer_in` / `transfer_out` — DSP to DSP
  - `damaged` (out) · `adjustment` (either direction, reason required)
- `movement_date`, `reference_table`, `reference_id` (links to the sale or issuance that caused it)
- `reason` (required for `adjustment` and `damaged`), `notes`, `created_by`
**`stock_issuances`** — two-party handover from warehouse to DSP, with acknowledgement
- `id`, `issuance_no`, `dsp_id`, `issued_by`, `issue_date`
- `status` (`pending` | `acknowledged` | `disputed`)
- `acknowledged_by`, `acknowledged_at`, `dispute_reason`
- `truck_report_id` (nullable), `notes`
**`stock_issuance_items`** — `id`, `issuance_id`, `item_id`, `quantity_issued`, `quantity_received`, `variance`, `notes`
**Why acknowledgement matters:** warehouse says 100 crates left; the DSP confirms what actually arrived. If those numbers disagree, the system surfaces it the same day instead of at year-end when nobody remembers. A pending issuance older than 48 hours raises a notification to Management.
### 6.5 Empties & Crate Returns
**`empties_movements`** — the reverse loop, tracked at every holder
- `id`, `item_type` (`canister_shell` | `crate`), `quantity`
- `holder_type` (`customer` | `dsp` | `warehouse`), `holder_id`
- `movement_type`:
  - `collected_from_customer` (DSP in) · `owed_by_customer` (customer balance up)
  - `returned_by_customer` (customer balance down)
  - `dsp_to_warehouse` (DSP out, warehouse in)
  - `warehouse_to_plant` (warehouse out — back to Fiesta Gas)
  - `lost` · `damaged` · `adjustment`
- `movement_date`, `reference_table`, `reference_id`, `reason`, `notes`, `created_by`
**Derived balances** (views, never stored columns):
- `customer_empties_balance` — shells and crates each customer owes
- `dsp_empties_balance` — shells and crates each DSP is holding
- `warehouse_empties_balance` — shells ready to return to the plant
Surface customer empties balance on the customer profile **and on the sales form**. A retailer who owes 40 shells is holding roughly ₱1,600 of company property, and the DSP should see that before handing over more.
### 6.6 Accounting Periods
**`accounting_periods`** — `id`, `year`, `month`, `status` (`open` | `closed`), `closed_by`, `closed_at`, `reopened_by`, `reopened_at`, `reopen_reason`
Once a month is closed, sales in that period cannot be created, edited, or deleted by anyone. Only Management can reopen, must give a reason, and every reopen is logged. This exists so a report sent to Fiesta Gas still matches the system a month later.
### 6.7 Warehouse
**`inventory_items`** — `id`, `name`, `category` (`crate` | `canister` | `stove` | `other`), `unit`, `reorder_level`, `active`
**`stock_movements`** — `id`, `item_id`, `movement_type` (`in` | `out` | `transfer` | `adjustment` | `return`), `quantity` (always positive; type carries direction), `movement_date`, `source`, `destination_dsp_id`, `destination_municipality_id`, `truck_report_id` (nullable), `reference_no`, `reason` (required for `adjustment`), `remarks`, `created_by`
**`truck_reports`** — `id`, `report_date`, `truck_plate`, `driver_name`, `helper_name`, `dsp_id`, `destination_municipality_ids` (uuid[]), `crates_out`, `crates_returned`, `empty_crates_collected`, `stoves_out`, `stoves_returned`, `fuel_cost`, `odometer_start`, `odometer_end`, `remarks`, `created_by`
Computed display: `crates_delivered = crates_out − crates_returned`.
### 6.8 Office
**`collateral_items`** — `id`, `name`, `category`, `unit`, `reorder_level`, `active`. Seed: Stick-out Sign, Poster, Tarpaulin, Streamer, Cap, Bag, Apron, Umbrella.
**`collateral_movements`** — `id`, `item_id`, `movement_type` (`in` | `out` | `adjustment` | `return`), `quantity`, `movement_date`, `assigned_to_dsp_id`, `assigned_to_municipality_id`, `assigned_to_customer_id`, `received_by`, `reference_no`, `reason`, `remarks`, `created_by`
### 6.9 Activity & Follow-ups
**`task_types`** — `id`, `name`, `color`, `sort_order`, `active`. Management-configurable. Seed:
Customer Follow-up · Repeat Deployment · Sales Visit · Collection of Empty Crates · Deliver Marketing Collateral · Inventory Check · Product Demonstration · Account Activation · New Account Prospecting · Complaint Resolution · Site Inspection · Other
**`tasks`**
- `id`, `title`, `description`
- `task_type_id`
- `assigned_to` (FK profiles), `assigned_by` (FK profiles)
- `customer_id`, `municipality_id`, `dsp_id`, `sale_id` (all nullable — a task links to at least one of these)
- `due_date`, `due_time` (nullable)
- `priority` (`low` | `medium` | `high` | `urgent`)
- `status` (`pending` | `in_progress` | `completed` | `cancelled`)
- `tags text[]`
- `completed_at`, `completion_notes`, `cancelled_reason`
- `created_at`, `updated_at`
**Visibility:** a task is visible to `assigned_to`, to `assigned_by`, and to anyone with `tasks.read.all`. Nobody else — a DSP must not see another DSP's task list.
### 6.10 Activity timeline
**`activity_log`** — the customer-facing chronological history. Written by trigger, never by hand.
- `id`, `customer_id`, `activity_type` (`customer_created` | `sale` | `task_created` | `task_completed` | `collateral_delivered` | `status_changed` | `note`)
- `activity_date`, `title`, `description`, `metadata` (jsonb)
- `reference_table`, `reference_id`, `created_by`
Distinct from `audit_log` — this one is a **business** narrative meant to be read by a DSP, not a security trail.
### 6.11 Notifications
**`notifications`** — `id`, `user_id`, `type`, `title`, `body`, `link_url`, `severity` (`info` | `warning` | `critical`), `read_at`, `created_at`
**`notification_rules`** — `id`, `type`, `enabled`, `threshold_config` (jsonb), `applies_to_roles text[]`. Management-editable.
### 6.12 Audit
**`audit_log`** — `id`, `user_id`, `action`, `table_name`, `record_id`, `previous_value` (jsonb), `new_value` (jsonb), `ip_address`, `user_agent`, `created_at`
Log every: permission change, user create/deactivate, delete, settings change, price change, inventory adjustment, territory reassignment, and any edit to a sale older than 7 days.
---
## 7. Business Logic
### 7.1 Volume calculation — single source of truth
One utility module. Every screen imports it. No exceptions.
```ts
// Constants read from settings, never hard-coded at call sites
// CANISTERS_PER_CRATE = 24
// KG_PER_CANISTER     = 0.17
lineCanisters =
    (qtyCrates    × CANISTERS_PER_CRATE)
  + qtyCanisters
  + (qtySets      × product.canistersIncluded)
lineVolumeKg = lineCanisters × KG_PER_CANISTER
saleVolumeKg = Σ lineVolumeKg
saleVolumeMt = saleVolumeKg / 1000
```
Display rules: MT to **3 decimals**, kg to **1 decimal**, canisters and crates as integers, currency as `₱` with thousand separators and 2 decimals. Use tabular figures everywhere.
### 7.2 Account KPI
An **account** = a `customers` row where `customer_type IN ('RTL','WS')` **and** `total_transactions >= 1`.
- Counted **once** for the lifetime of the customer, in the year of first purchase
- HH customers are excluded from this count entirely, at every level of the app
- The dashboard must label it unambiguously: *"Unique RTL + WS accounts"* — so nobody mistakes it for total customers
### 7.3 Customer status
Computed nightly by a scheduled function, and immediately on each new sale. Thresholds live in `settings`.
| Status | Rule |
|---|---|
| `prospect` | Created, zero purchases |
| `newly_acquired` | First purchase within last 30 days |
| `active` | Purchased within last 60 days |
| `dormant` | Last purchase 61–120 days ago |
| `inactive` | No purchase in 120+ days |
**Repeat customer** = `total_transactions >= 2`.
**Repeat rate** for a period = transactions from customers with ≥1 prior purchase ÷ total transactions.
### 7.4 KPI pace and forecast
On the Management dashboard, for both KPIs:
```
progressPct   = actual / target
expectedPct   = daysElapsedInYear / daysInYear
paceStatus    = progressPct >= expectedPct ? 'on_track' : 'behind'
forecast      = actual / daysElapsed × daysInYear
requiredPerMo = (target − actual) / monthsRemaining
```
Display forecast plainly: *"On pace for 11.8 MT — 2.65 MT behind target. Needs 662 crates/month for the remaining 4 months."* The COO is new and the business is new; the dashboard's job is to say what must happen next, not just what happened.
### 7.5 Payments
Credit is rare but possible. MVP tracks `payment_status` and `amount_paid` on the sale, and surfaces an unpaid total on dashboards. **No** receivables ledger, aging buckets, or collection workflow in MVP — that's roadmap.
### 7.6 Three-way reconciliation — the core control
This is the single most important integrity check in the system. Without it, warehouse issuance and sales are two unrelated numbers and nobody can explain the gap.
For any DSP and date range:
```
opening_stock
  + issued_from_warehouse
  − sold                          (sum of sale line canisters/crates)
  − returned_to_warehouse
  − damaged
  ± transfers
  ± adjustments
  = expected_closing_stock
variance = expected_closing_stock − physical_count
```
**Rules:**
- `sold` is written by trigger from actual sales — it can never be typed by hand
- A non-zero variance is **not blocked**, it is **surfaced**. Real distribution has breakage and miscounts; the system's job is to make them visible, not to pretend they don't happen
- Variance above a configurable threshold raises a notification to Management
- Physical counts are recorded through a **Stock Count** entry (see §7.7), which creates an `adjustment` movement with the variance and a mandatory reason
**Empties reconcile on the same pattern:**
```
empties_expected  = Σ REFILL canisters sold
empties_collected = entered per sale
shortfall         = expected − collected   → customer empties balance
```
DSP empties held = collected from customers − returned to warehouse. Warehouse empties = received from DSPs − sent back to the plant. Every tier must balance.
### 7.7 Stock counts
A DSP or the warehouse periodically counts what is physically present.
**`stock_counts`** — `id`, `scope` (`dsp` | `warehouse`), `scope_id`, `count_date`, `counted_by`, `status` (`draft` | `submitted` | `approved`), `approved_by`, `notes`
**`stock_count_items`** — `id`, `count_id`, `item_id`, `system_quantity` (snapshot at submit), `counted_quantity`, `variance`, `reason`, `notes`
On approval, the system writes `adjustment` movements to bring the ledger in line, each carrying the count reference and reason. Only Management approves counts with variance beyond the threshold.
### 7.8 Returns and damaged goods
A DSP **never deletes a sale to correct a problem.** Deletion destroys history and silently moves the KPI. Instead:
| Situation | Action |
|---|---|
| Wrong quantity encoded, same day, period open | Edit the sale (logged) |
| Customer returns a leaking canister | `sale_return` with `return_type = leaking`, `restockable = false` |
| Customer returns unopened stock | `sale_return`, `restockable = true` — goes back to DSP rolling stock |
| Sale encoded for the wrong customer | Edit if period open; otherwise return + re-enter, both logged |
| Damage found in the vehicle, not customer-linked | `dsp_stock_movements` type `damaged` with reason |
Returns reverse volume, revenue, and canister counts from all KPI calculations, dated to the **return date**, not the original sale date, so closed periods are never retroactively altered.
### 7.9 Duplicate protection
Poor signal plus a saved draft plus an impatient double-tap produces two identical sales and inflated volume. Prevent it structurally:
1. The device generates a `client_ref` uuid **when the form is opened**, not when it is submitted
2. `sales.client_ref` carries a unique constraint
3. A retry with the same `client_ref` returns the original sale and reports success — it does not create a second row
4. The submit button disables on first tap and shows progress state
5. Independently, warn (don't block) if the same customer, same amount, and same line items were recorded within the last 10 minutes
### 7.10 Period close
Management closes a month from Settings → Periods. On close, the system runs a pre-check and refuses to close while any of these are outstanding, listing them:
- Pending stock issuances not yet acknowledged
- Stock counts in `submitted` but not `approved`
- Sales with unresolved empties variance beyond threshold
- Draft or unsynced offline sales still queued on any device
This turns month-end into a real checkpoint rather than a formality.
---
## 8. Dashboards
### 8.1 Management Dashboard
The COO is new to this business. The landing page must answer two questions **in the first screenful, before any scrolling**: *are we on track,* and *what needs me today.* Everything else lives below the fold or behind a click.
Ten equally-weighted sections means nothing is important. Enforce this hierarchy:
**Tier 1 — above the fold, always visible**
- **Two KPI cards.** Accounts `X / 300` and Volume `X.XXX / 14.45 MT`, each with progress ring, on-track/behind status, forecast, and required-per-month. These are the largest elements on the page.
- **Exceptions strip.** A single row of red/amber counters, each clicking through to a filtered list: overdue tasks · unacknowledged stock issuances · stock variances beyond threshold · items below reorder · DSPs with no sale logged today · customers owing empties beyond threshold · unsynced sales. **If everything is clean, this collapses to one green line** — silence is the signal that nothing needs attention.
**Tier 2 — one scroll**
- Period toggle (Today / WTD / MTD / YTD) driving: revenue, volume MT, canisters, transactions, new accounts, active accounts
- **DSP leaderboard** — volume, revenue, accounts, new accounts, repeat rate, stock variance, task completion
- **Municipality performance** — ranked, with the bottom three highlighted
**Tier 3 — below, or on dedicated pages**
Trends (volume vs required pace, customer mix, deployment) · inventory and empties position · truck activity · collateral summary · top customers · recent transactions · activity metrics.
**Rule for Claude Code:** do not render Tier 2 or Tier 3 as expanded charts on initial load. Lazy-load them. The dashboard must paint its KPI cards and exceptions strip in under a second.
### 8.2 DSP Dashboard
Scoped strictly to their own municipalities and customers.
Today's / Weekly / Monthly sales · unique accounts · repeat customers · customer visits · volume (canisters, crates, MT) · **progress to company KPI with their contribution highlighted** · top municipality · top customer · sales calendar heatmap · recent transactions.
**Task widgets:** Today's Tasks · Upcoming Follow-ups · Overdue Tasks · Due This Week · Recently Completed.
**Rolling stock widget (top of screen, always visible):** current stock on hand by item, empties held, pending issuances awaiting acknowledgement, and last stock count date. A DSP should know what is in their vehicle before they drive out, without navigating anywhere.
Because the KPI is company-wide, do **not** invent a per-DSP target. Show the company gauge with that DSP's share rendered as a highlighted segment, plus their own absolute numbers. This keeps it honest — Mark covers one island, Genie covers six municipalities, and a synthetic ÷4 target would be unfair to both.
### 8.3 Warehouse Dashboard
Current crates · current stoves · current canisters · incoming today · outgoing today · today's transactions · recent truck reports · low-inventory alerts.
**Stock out with DSPs** — a table of all four DSPs' current rolling stock, so the warehouse knows total company inventory, not just what is on the shelf.
**Empties position** — shells and crates held at warehouse, held by each DSP, and owed by customers, with a total. Plus a "ready to return to plant" figure.
**Pending acknowledgements** — issuances sent but not yet confirmed by the receiving DSP, aged.
### 8.4 Office Dashboard
Current collateral inventory by item · incoming · outgoing · most-requested materials · allocation by DSP (YTD) · inventory ledger · low-stock alerts.
---
## 9. Sales Entry
The most important screen in the system. If this is slow, DSPs go back to paper and everything else is worthless.
**Target: under 30 seconds for a repeat retailer.**
### 9.1 The form
1. **Date** — defaults to today, editable. Blocked if the period is closed, with a clear message.
2. **Customer** — search-as-you-type, recent customers surfaced first, prominent inline "+ New Customer"
3. **Type & municipality** — auto-filled from the customer, shown as read-only badges
4. **Deployment date** — RTL/WS only. Defaults to sale date. Helper text: *"When stocks were physically handed over."*
5. **Line items** — repeatable rows. Product chosen from four large tiles, not a dropdown. Then:
   - **RTL / WS** → crate stepper, with canister equivalent shown live beneath (`× 24`)
   - **HH** → canister stepper, crate field hidden entirely
   - **Stove sets** → set stepper for any customer type
   - A single sale may mix line types
   - **Each line has an optional note field**, collapsed behind a small icon so it never slows the common path
6. **Empties collected** — appears only when the sale contains refills. Pre-filled with `empties_expected`; the DSP adjusts down if the customer didn't return all of them. Shortfall is shown live: *"Customer will owe 3 shells."*
7. **Crates returned by customer** — optional counter
8. **Sticky summary bar** — running ₱ total, canisters, kg, and **remaining rolling stock after this sale**
9. **Payment status** + amount paid
10. **Notes** — free text on every sale, always available
11. **Save**
### 9.2 Context the DSP sees before saving
- **Repeat chip:** *"Repeat customer · 4th purchase · last bought 12 days ago · lifetime 38 crates"*
- **Empties owed:** *"⚠ Owes 40 shells and 2 crates"* — shown prominently for any customer with an outstanding balance, so the DSP can collect before handing over more
- **Stock warning:** if the sale exceeds current rolling stock, warn clearly but **do not block** — the ledger may simply be behind, and blocking a real sale is worse than recording a negative that gets reconciled
### 9.3 Offline queue
Ticao Island is reached by ferry, and signal across Matnog, Bulusan, and Prieto Diaz is unreliable. A single `localStorage` draft is not enough — a DSP doing eight stops with no signal must be able to record all eight.
- Queue pending sales in **IndexedDB**, not `localStorage`. Multiple sales, full line items, survives app restart.
- Persistent header indicator: *"3 sales pending sync"* with a manual **Sync now** action
- Auto-sync on reconnect, sequentially, with per-item success or failure
- `client_ref` is generated on the device at form open, so a sale synced twice can never duplicate (§7.9)
- Customer list, product list, and the user's own recent customers cached locally so the form works fully offline
- A **new customer created offline** gets a local uuid and syncs as a real record; the sale references it by that same id
- Queued sales that fail to sync surface in a **Sync Issues** screen with the reason and a retry — never silently dropped
- Period close is blocked while any device reports unsynced sales (§7.10)
### 9.4 Route mode (bulk entry)
A DSP finishing a route encodes eight to twelve stops at night. Twelve full form submissions is punishing enough that they'll stop doing it.
**Route mode** presents a compact repeating list: customer → product tiles → quantity → next. One screen, no navigation between entries, running totals for the whole route at the top. Submit posts all sales in a single batch, each with its own `client_ref`.
Also provide **"Repeat last order"** on any customer — pre-fills the entire form with their previous purchase, which for a regular refill retailer is nearly always correct.
### 9.5 Delivery receipt
Retailers expect a slip. If the system doesn't produce one, DSPs keep hand-writing them and the app has added work instead of removing it.
On save, generate a receipt with a sequential `receipt_no`:
- Octaflame header, receipt number, date, DSP name
- Customer name and municipality
- Line items with quantities and prices, total amount
- **Empties collected and empties still owed**
- Payment status
- Signature line for the customer
Available as a **share sheet action** (sends to Messenger/SMS as an image or PDF, which is how this will actually be delivered in practice) and as a printable PDF. Receipts are reprintable from the sale record.
### 9.6 On save
Confirmation offers: **Log another sale in this municipality** · **Create a follow-up task** · **Send receipt**.
## 10. Activity & Follow-ups Module
A lightweight CRM layer that keeps accounts from being forgotten. Every task links to at least one of: customer, municipality, DSP, or sale.
### 10.1 Task list
Filterable by status, priority, type, due date, customer, municipality. Grouped by Overdue / Today / This Week / Later. Quick-complete from the list without opening the task.
### 10.2 Calendar view
Daily · Weekly · Monthly. Drag to reschedule. Click to edit. Filters: DSP (management only), municipality, priority, status, type.
### 10.3 From the customer profile
Create a follow-up in one click from any customer. The profile displays Upcoming / Overdue / Completed tasks alongside the full activity timeline.
### 10.4 Activity timeline
Chronological history per customer, rendered as a vertical timeline:
```
Jun 2   Customer created                        — DSP Genie
Jun 5   First purchase · 10 refill canisters    — ₱350 · 1.7 kg
Jun 18  Follow-up task created                  — "Offer stove bundle"
Jun 20  Marketing collateral delivered          — 1 stick-out sign
Jul 1   Purchased Stove Set 399
Jul 12  Repeat refill purchase · 2 crates       — ₱1,680 · 8.16 kg
Jul 15  Empty crates collected                  — 2 crates
```
Written by database triggers from sales, tasks, collateral movements, and status changes. Never manually authored.
### 10.5 Prospect pipeline (structure now, stages later)
The `status` field already carries `prospect → newly_acquired → active → dormant → inactive`. Build the schema so pipeline stages (Lead → Contacted → Negotiating → First Order → Active) can be added later **without migration**. Do not build stage UI in MVP.
---
## 11. Reports & Exports
**Filters:** date range · DSP · municipality · customer · customer type · product · payment status · volume threshold.
**Formats:** PDF · CSV · XLS · XLSX. Every export respects the requester's data scope — a DSP exporting gets only their own rows, always.
**XLSX quality bar:** styled header row, frozen panes, column widths, currency and number formats, and a summary sheet. This gets emailed to Fiesta Gas — it should look like it came from a real company.
**PDF quality bar:** Octaflame header, period label, generated-by and timestamp, summary table, charts rendered as static images.
**Preset one-click reports:**
1. Daily Sales Summary (all DSPs)
2. Monthly Volume vs KPI
3. Customer Master List with lifetime volume
4. DSP Performance Comparison
5. Municipality Performance Ranking
6. Inventory Movement Ledger
7. Truck Report Summary
8. Collateral Allocation by DSP
9. Activity & Task Completion Report
Filename pattern: `octaflame_{report}_{YYYY-MM-DD}_to_{YYYY-MM-DD}.{ext}`
---
## 12. Analytics
Sales trend · growth (MoM, YoY) · repeat customer % · top municipalities · top DSP · top products · inventory turnover · deployment frequency · customer acquisition curve · municipality heatmap.
Heatmap: 17 municipalities coloured by volume, with a toggle for volume / revenue / account count / growth.
---
## 13. Notifications
In-app only for MVP (bell icon, unread badge, notification centre).
Triggers: low inventory · KPI milestones (25/50/75/90/100%) · inactive customers · large orders (configurable threshold) · pending inventory · truck overdue · task due today · task overdue · newly assigned task · task completed (to assigner).
Management can enable/disable rules and set thresholds. Email, SMS, and push are roadmap.
---
## 14. Global Search
Single `⌘K` command palette across customers, transactions, municipalities, DSPs, inventory items, truck reports, and tasks. Results scoped to the user's permissions. Keyboard-navigable.
---
## 15. Security
1. RLS on every table, written before the consuming UI
2. Permission enforced at RLS + server action + UI — all three
3. `dsp_id` derived server-side on write, never trusted from client
4. Soft deletes on all transactional records; sales are never hard-deleted
5. Session timeout after 12 hours idle
6. Rate limiting on auth endpoints
7. Audit log is append-only and cannot be edited or deleted by anyone, including Management
---
## 16. UI & Design Direction
**Reference quality:** Linear, Stripe Dashboard, Notion, Vercel. Premium, minimal, fast.
**Layout:** desktop-first for Management, Warehouse, and Office. **However — the DSP sales entry form, task list, and customer lookup must be fully usable at 375px width with ≥44px tap targets.** DSPs work standing in front of sari-sari stores, not at desks. This is the one place where mobile is not a nice-to-have.
**Palette:** deep charcoal base with a warm flame accent (amber/orange) for primary actions and KPI progress. Teal for secondary data series. Red reserved strictly for genuine problems — below reorder, overdue, dormant, behind pace. Full dark mode support.
**Typography:** one strong sans (Inter or Geist). Numbers are the product here — tabular figures on every metric, generous size contrast between a KPI value and its label.
**Composition:** cards, large KPI widgets, beautiful charts, lots of whitespace, no clutter. Skeleton loaders, never spinners. Empty states are instructional, not blank.
**Motion:** Framer Motion for page transitions, card entrance stagger, and number count-ups on dashboard load. Never animate anything that delays data being readable.
### 16.1 Mobile navigation
The spec requires DSP screens to work at 375px, but a collapsed desktop sidebar is not a mobile interface. Define it explicitly:
**Below 768px, DSPs get a fixed bottom tab bar** with five items: **Home · Sell · Customers · Tasks · More**. "Sell" is a raised centre button — it is the action the app exists for and should be reachable with a thumb without looking.
Everything else (stock, empties, reports, settings) lives under **More**. Warehouse and Office get their own three-tab bar. Management on mobile gets a read-focused view: KPI cards, exceptions, and leaderboard only — no data entry, no wide tables.
### 16.2 Responsive data rules
Tables and charts are the two things that break hardest on a phone. Handle both explicitly:
- **Tables → cards below 768px.** A 9-column sales table does not scroll usefully. Each row becomes a card with the two or three fields that matter and a tap to expand.
- **Charts → ranked lists below 768px.** A 17-municipality bar chart at 375px is unreadable. Render a ranked list with inline bar fills and the value on the right instead. This is more useful on a phone than a shrunken chart, not a degraded fallback.
- **Number formatting stays consistent** across breakpoints — never abbreviate ₱1,234.56 to ₱1.2k on mobile in a financial context.
### 16.3 Notes are everywhere
**Every transaction in the system accepts a free-text note.** Sales, sale lines, returns, stock movements, issuances, stock counts, empties movements, collateral movements, truck reports, tasks, and customer records.
Implementation rules:
- Notes are **optional and never block a save**
- On mobile, the note field is collapsed behind a small icon so it never slows the common path — one tap to open
- Notes appear in the activity timeline, in exports, and in the record detail view
- Notes are searchable through global search
- A record that has a note shows a small indicator in list views, so context isn't buried
This is the field that captures what structured data can't: *"store closed, left with the neighbour"*, *"asked for stove set next visit"*, *"3 shells dented, not accepted"*. In a business this new, those notes are where the operational learning lives.
### 16.4 Other UI requirements
- **Optimistic UI on save** with rollback on failure — the DSP should not wait on a round trip to move to the next customer
- **Skeleton loaders, never spinners**
- **Empty states are instructional** — a DSP opening Home at 7am should see a call to action, not a void
- **Destructive actions require typed confirmation**, never a bare "Are you sure?"
- **Every list has a persistent filter state** that survives navigation — Management filtering to one municipality shouldn't lose it on every click-through
---
## 17. Seed Data
Write a seed script producing:
- 4 DSPs, 17 municipalities correctly mapped, 4 products, settings per §3, current-year KPI target
- 8 inventory items, 8 collateral items, 12 task types
- One test user per role (including a viewer with a partial permission set, to prove the RBAC works)
- ~250 customers weighted realistically: ~60% HH, ~32% RTL, ~8% WS
- ~800 sales across the last 6 months — HH most frequent by count, WS largest by volume, refills dominant, stove sets occasional
- ~120 tasks across all statuses including overdue ones
- Stock movements and truck reports consistent with the sales data
Seeded volume should land near a believable mid-year KPI position — roughly 5–7 MT and 120–160 accounts — so dashboards, pace calculations, and forecast copy all render meaningfully on first run.
---
## 18. Build Phases
**Phase 1 — Foundation**
Schema, RLS policies, auth with public signup disabled, bootstrap Management account (§5.5), invite-user flow (§5.6), forced first-login password change, seed script, app shell with permission-aware navigation, login/logout, settings table wired to the volume utility.
The permission *editor* UI can wait for Phase 6, but the underlying permission model, the invite flow, and the lockout guards must be correct in Phase 1 — every later phase enforces against them.
**Phase 2 — DSP Core**
Customers module, sales entry form (including empties capture and notes), duplicate protection, sales list, delivery receipt, DSP dashboard. This is the feature that ends manual reporting — nothing else matters until it's fast.
**Phase 2.5 — Stock integrity (do not skip)**
DSP rolling stock ledger, warehouse issuance with acknowledgement, empties ledger across all three tiers, stock counts, reconciliation report, returns and damaged goods. Build this **before** the management dashboard — a dashboard reporting numbers that don't reconcile is worse than no dashboard, and retrofitting these ledgers means backfilling every movement already recorded.
**Phase 3 — Management Visibility**
Management dashboard, KPI engine with pace and forecast, DSP leaderboard, municipality performance, sales explorer.
**Phase 4 — Warehouse & Office**
Warehouse and office dashboards, truck reports, adjustments with reasons, collateral ledger, empties returns to plant, and their feeds into the Management dashboard.
**Phase 4.5 — Offline queue**
IndexedDB queue for multiple pending sales, cached customer and product lists, sync indicator, sync issues screen, route mode. Ticao and Matnog cannot use the system reliably without this — one of four DSPs stays on paper until it ships.
**Phase 5 — Activity & Follow-ups**
Tasks, calendar, customer timeline, task widgets on both dashboards.
**Phase 6 — Control & Extraction**
User management, granular permission editor, product and price management, period close with pre-checks, all four export formats, preset reports, audit log.
**Phase 7 — Polish**
Analytics, heatmaps, notifications, global search, dark mode, motion.
---
## 19. Roadmap — Do Not Build
Collections · AR/AP · Purchase Orders · Supplier Module · Route Planning · GPS Tracking · Expense Tracking · Commission Tracking · Payroll · Full CRM pipeline stages · Native mobile app · Full offline-first architecture · Barcode scanning · QR customer check-ins · AI forecasting · Predictive inventory · Route optimization · Automatic KPI recommendations · Email/SMS/push notifications · File attachments on tasks
---
## 20. Definition of Done
- [ ] A DSP logs a sale on a phone in under 30 seconds
- [ ] Deployment date is captured on every RTL/WS transaction
- [ ] Volume math runs through one utility and produces identical results on every screen
- [ ] The COO opens one page and sees exact progress against 300 accounts and 14.45 MT, with pace and forecast
- [ ] Every dashboard number traces back to a transaction someone entered as part of their job — nobody writes a report
- [ ] Inventory balances are always ledger-derived and can never be hand-edited
- [ ] Warehouse and Office movements appear on the Management dashboard without anyone being asked
- [ ] Management can grant or revoke any single permission for any user, and the database enforces it
- [ ] A DSP hitting the API directly cannot read another DSP's data
- [ ] Every table on screen exports to PDF, CSV, XLS, and XLSX, correctly scoped
- [ ] No customer with an open follow-up is ever invisible to the DSP who owns it
- [ ] Warehouse issuance, DSP rolling stock, and sales reconcile to an explainable variance for every DSP and period
- [ ] Every empty shell and crate is accounted for at the customer, DSP, or warehouse tier
- [ ] A DSP can record eight sales with no signal on Ticao and sync them all without duplication
- [ ] Submitting the same sale twice never creates two records
- [ ] A retailer receives a delivery receipt without anyone hand-writing one
- [ ] A closed month cannot change, and a report sent to Fiesta Gas still matches the system a month later
- [ ] Mistakes are corrected through returns and adjustments, never by deleting a sale
- [ ] Every transaction in the system carries an optional note, searchable and visible in exports
- [ ] The Management dashboard answers "are we on track" and "what needs me today" without scrolling
