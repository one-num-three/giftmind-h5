# GiftMind Data Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a passcode-protected GiftMind data-entry studio that stores product and activity gifts in separate typed models, assists collectors with confirmed DeepSeek suggestions, and safely exports, imports, backs up, and evolves the database.

**Architecture:** Create a new repository named `giftmind-data-studio`. A Vue 3 single-page application calls a FastAPI service under `/api`; FastAPI owns all validation, DeepSeek access, image processing, imports, exports, and backups. SQLAlchemy stores shared gift data plus one-to-one product or activity details in SQLite WAL mode, while controlled custom fields handle early-stage schema experiments without weakening the core model.

**Tech Stack:** Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2 async, Alembic, SQLite, itsdangerous, Pillow, OpenPyXL, HTTPX, Pytest, Vue 3, TypeScript, Vite, Pinia, Vue Router, Vitest, Playwright, Docker Compose, Nginx.

## Global Constraints

- The target is a separate repository: `one-num-three/giftmind-data-studio`.
- The first release supports exactly two active top-level gift types: `product` and `activity`.
- `physical`/`digital`/`hybrid`, `offline`/`online`/`hybrid`, customization, and bundle status are independent dimensions.
- No personal accounts, roles, invitations, payment, public API, scraping, live inventory, or live ticket scheduling.
- A shared `TEAM_PASSCODE` in server `.env` creates a fixed 7-day HttpOnly, SameSite=Strict session cookie; HTTPS cookies are Secure.
- All data and AI endpoints require a valid team session; the first release has no CSRF token, login rate limit, server-side session revocation, user table, or admin role.
- DeepSeek suggestions never write to the database until a collector confirms fields and saves.
- `DEEPSEEK_API_KEY` exists only in server `.env`; the web UI never saves, displays, or exports it.
- Uploaded images are decoded, randomly named, converted to WebP derivatives, and limited to 10 MB each and 8 per gift.
- SQLite runs with WAL, foreign keys, integrity checks, migrations, and persistent storage outside the container image.
- Full backups exclude plaintext passcodes and DeepSeek keys.
- The application must work without DeepSeek and must not spend real DeepSeek credits in automated tests.
- Internal exports include `schemaVersion`, `exportedAt`, and application version.
- Unknown future fields survive internal JSON import/export round trips.
- Git commits are small, intentional, and created only after the task's focused tests pass.

---

## Repository and File Map

Create this repository beside the current `giftmind-h5` checkout:

```text
giftmind-data-studio/
├── .env.example
├── .gitignore
├── Dockerfile
├── compose.yml
├── Makefile
├── README.md
├── alembic.ini
├── pyproject.toml
├── backend/
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── main.py
│       ├── api/
│       │   ├── deps.py
│       │   ├── router.py
│       │   └── routes/
│       │       ├── ai.py
│       │       ├── backups.py
│       │       ├── dashboard.py
│       │       ├── dimensions.py
│       │       ├── exports.py
│       │       ├── gifts.py
│       │       ├── images.py
│       │       ├── imports.py
│       │       ├── session.py
│       │       └── settings.py
│       ├── core/
│       │   ├── config.py
│       │   ├── database.py
│       │   ├── errors.py
│       │   └── security.py
│       ├── models/
│       │   ├── assets.py
│       │   ├── base.py
│       │   ├── custom_fields.py
│       │   ├── gift.py
│       │   ├── operations.py
│       │   └── taxonomy.py
│       ├── schemas/
│       │   ├── ai.py
│       │   ├── common.py
│       │   ├── fields.py
│       │   ├── gift.py
│       │   ├── import_export.py
│       │   ├── session.py
│       │   └── settings.py
│       └── services/
│           ├── ai/
│           │   ├── deepseek.py
│           │   ├── prompts.py
│           │   └── schemas.py
│           ├── backups.py
│           ├── completeness.py
│           ├── duplicates.py
│           ├── exports.py
│           ├── fields.py
│           ├── gifts.py
│           ├── images.py
│           └── imports.py
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── playwright.config.ts
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.vue
│       ├── main.ts
│       ├── api/
│       │   ├── client.ts
│       │   ├── gifts.ts
│       │   └── types.ts
│       ├── components/
│       │   ├── ai/
│       │   ├── fields/
│       │   ├── gifts/
│       │   └── layout/
│       ├── composables/
│       │   ├── useDraft.ts
│       │   └── useUnsavedChanges.ts
│       ├── router/index.ts
│       ├── stores/
│       │   ├── session.ts
│       │   ├── settings.ts
│       │   └── workbench.ts
│       ├── styles/tokens.css
│       └── views/
│           ├── DashboardView.vue
│           ├── GiftListView.vue
│           ├── GiftWorkbenchView.vue
│           ├── ImportsView.vue
│           ├── LoginView.vue
│           ├── RecycleBinView.vue
│           └── SettingsView.vue
├── scripts/
│   ├── backup.py
│   └── restore.py
├── tests/
│   ├── api/
│   ├── e2e/
│   ├── services/
│   └── conftest.py
└── docs/
    ├── DATA-SCHEMA-EXTENSION-GUIDE.md
    ├── DEPLOYMENT.md
    └── nginx-giftmind-data.conf
```

Files remain focused by responsibility: routes translate HTTP, services enforce use cases, Pydantic schemas define contracts, SQLAlchemy models persist state, and Vue views compose small field and workflow components.

## Locked Data Contract

Use these column groups when implementing Task 3. Do not move type-specific fields into `gifts`:

```text
gifts
  id, schema_version, gift_type_code, canonical_name, aliases,
  short_description, subcategory_code, is_customizable, is_bundle,
  status, emoji, completeness_score,
  recipient_types, relationship_stages, age_ranges, traits, interests,
  occasions, desired_feelings, memory_hooks, tags, custom_tags,
  price_min, price_max, is_free, currency,
  lead_days_min, lead_days_max, rush_available,
  taboo_flags, allergy_notes, safety_notes, unsuitable_groups,
  why_template, best_scenarios, unsuitable_scenarios,
  purchase_or_booking_tip, ritual_tip, pairing_ideas, collector_notes,
  source_notes, source_urls, confidence_level, verified_at,
  created_at, updated_at, deleted_at

product_details
  gift_id, product_form, generic_product_name,
  materials, colors, sizes, specifications, variant_notes,
  weight_grams, package_dimensions, size_class,
  is_bulky, is_fragile, is_consumable,
  shelf_life_days, storage_requirements,
  personalization_methods, personalization_requirements,
  device_or_platform_compatibility, digital_delivery_method,
  shipping_required, shipping_notes,
  return_risk_notes, warranty_expectation

product_offers
  id, gift_id, merchant, brand, offer_name, sku_or_model,
  current_price, currency, stock_status, ship_from, service_regions,
  delivery_days, shipping_cost, purchase_url,
  return_policy, warranty_policy, source_url, verified_at,
  active, created_at, updated_at

activity_details
  gift_id, activity_mode, activity_category, service_regions,
  duration_minutes_min, duration_minutes_max,
  participants_min, participants_max, pricing_unit, schedule_type,
  booking_required, booking_lead_days_min, booking_lead_days_max,
  validity_days, included_items, excluded_items, equipment_requirements,
  age_restrictions, height_restrictions, health_restrictions,
  accessibility_notes, weather_dependency, indoor_outdoor,
  cancellation_expectation, reschedule_expectation, refund_expectation

activity_offers
  id, gift_id, provider_name, offer_name, city, venue_name, address,
  longitude, latitude, service_regions,
  current_price_min, current_price_max, currency, pricing_unit,
  opening_hours_or_schedule_notes, availability_status,
  booking_url, booking_contact,
  cancellation_policy, reschedule_policy, refund_policy,
  source_url, verified_at, active, created_at, updated_at

gift_bundle_components
  id, bundle_gift_id, component_gift_id,
  component_type_code, component_name, quantity, required,
  display_order, role_notes
```

Collection-like fields use normalized JSON arrays in release 1 and receive Pydantic item validation. Money uses `Decimal` with two places; timestamps are UTC; booleans never use null when the concept has a meaningful default. Unknown remains null rather than `0`, empty string, or “其他”.

---

### Task 1: Bootstrap the New Repository and Health Slice

**Files:**
- Create: `giftmind-data-studio/pyproject.toml`
- Create: `giftmind-data-studio/backend/app/core/config.py`
- Create: `giftmind-data-studio/backend/app/core/database.py`
- Create: `giftmind-data-studio/backend/app/core/errors.py`
- Create: `giftmind-data-studio/backend/app/main.py`
- Create: `giftmind-data-studio/tests/conftest.py`
- Create: `giftmind-data-studio/tests/api/test_health.py`
- Create: `giftmind-data-studio/frontend/package.json`
- Create: `giftmind-data-studio/frontend/index.html`
- Create: `giftmind-data-studio/frontend/tsconfig.json`
- Create: `giftmind-data-studio/frontend/vite.config.ts`
- Create: `giftmind-data-studio/frontend/src/main.ts`
- Create: `giftmind-data-studio/frontend/src/App.vue`
- Create: `giftmind-data-studio/.gitignore`
- Create: `giftmind-data-studio/.env.example`

**Interfaces:**
- Produces: `Settings`, `get_settings()`, `create_engine(settings)`, `create_app(settings: Settings | None = None) -> FastAPI`.
- Produces: `GET /api/health -> {"status":"ok","schemaVersion":1}`.
- Produces: Vite application mounted at `/` and API proxying `/api` to port 8000 in development.

- [ ] **Step 1: Initialize the repository and write the failing health test**

Run:

```powershell
New-Item -ItemType Directory -Path ..\giftmind-data-studio
Set-Location ..\giftmind-data-studio
git init -b main
```

Create `tests/api/test_health.py`:

```python
from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_health_reports_schema_version(test_settings):
    with TestClient(create_app(test_settings)) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "schemaVersion": 1}
```

- [ ] **Step 2: Run the test and verify the application does not exist**

Run:

```powershell
python -m pytest tests/api/test_health.py -v
```

Expected: collection fails with `ModuleNotFoundError: No module named 'backend'`.

- [ ] **Step 3: Add configuration, database setup, and the app factory**

Implement these exact public contracts:

```python
# backend/app/core/config.py
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_secret: str
    team_passcode: str
    database_url: str = "sqlite+aiosqlite:///./data/giftmind.sqlite3"
    data_dir: Path = Path("./data")
    upload_dir: Path = Path("./uploads")
    backup_dir: Path = Path("./backups")
    app_base_path: str = "/"
    schema_version: int = 1
    session_days: int = 7
    deepseek_api_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

```python
# backend/app/main.py
from fastapi import FastAPI
from backend.app.core.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or get_settings()
    app = FastAPI(title="GiftMind Data Studio")
    app.state.settings = resolved

    @app.get("/api/health")
    async def health() -> dict[str, str | int]:
        return {"status": "ok", "schemaVersion": resolved.schema_version}

    return app


app = create_app()
```

Configure SQLAlchemy async engine creation to execute `PRAGMA foreign_keys=ON`, `PRAGMA journal_mode=WAL`, and `PRAGMA busy_timeout=5000` for SQLite connections.

- [ ] **Step 4: Add the minimal Vue shell**

Create `frontend/src/App.vue`:

```vue
<template>
  <main class="app-shell">
    <h1>GiftMind 数据工作台</h1>
    <p>礼物数据库采集与维护</p>
  </main>
</template>
```

Set Vite `base` from `VITE_BASE_PATH` and proxy `/api` to `http://127.0.0.1:8000`.

- [ ] **Step 5: Install dependencies and verify both projects**

Run:

```powershell
python -m pip install -e ".[dev]"
python -m pytest tests/api/test_health.py -v
Set-Location frontend
npm install
npm run typecheck
npm run build
```

Expected: one backend test passes; TypeScript and production build succeed.

- [ ] **Step 6: Commit the bootstrap**

```powershell
git add .
git commit -m "chore: bootstrap GiftMind data studio"
```

---

### Task 2: Add Lightweight Shared-Passcode Sessions

**Files:**
- Create: `backend/app/core/security.py`
- Create: `backend/app/schemas/session.py`
- Create: `backend/app/api/deps.py`
- Create: `backend/app/api/routes/session.py`
- Create: `backend/app/api/router.py`
- Modify: `backend/app/main.py`
- Create: `tests/api/test_session.py`

**Interfaces:**
- Produces: `create_session_token(session_id: UUID, expires_at: datetime, secret: str) -> str`.
- Produces: `require_session(request) -> SessionContext`.
- Produces: `POST /api/session/login`, `POST /api/session/logout`, `GET /api/session`.

- [ ] **Step 1: Write failing login, cookie, expiry, logout, and protected-route tests**

Use this core assertion pattern:

```python
def test_login_sets_http_only_cookie(client):
    response = client.post("/api/session/login", json={"passcode": "team-secret"})
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=strict" in response.headers["set-cookie"]


def test_wrong_passcode_is_rejected(client):
    assert client.post("/api/session/login", json={"passcode": "wrong"}).status_code == 401
```

Add a protected test-only endpoint and assert a missing, malformed, or expired cookie returns 401.

- [ ] **Step 2: Run the security tests and verify 404 failures**

Run:

```powershell
python -m pytest tests/api/test_session.py -v
```

Expected: requests return 404 because session routes are absent.

- [ ] **Step 3: Implement passcode verification and signed sessions**

Compare the submitted passcode with server-side `TEAM_PASSCODE` using `secrets.compare_digest`. Sign a compact session payload with `itsdangerous.URLSafeTimedSerializer`; it contains only a random session ID and issue time. No session table, revocation table, or login-rate-limit store is required.

The login response schema is:

```python
class SessionResponse(BaseModel):
    authenticated: Literal[True]
    expires_at: datetime = Field(alias="expiresAt")
```

The cookie name is `giftmind_session`. Set `SameSite=Strict`; set `Secure` when the request is HTTPS or `X-Forwarded-Proto` is `https`.

- [ ] **Step 4: Add session dependency and router integration**

Require a valid signed session for all data, image, AI, import/export, backup, and settings routes. Logout deletes the browser cookie; it does not record server-side revocation.

- [ ] **Step 5: Run focused security tests**

Run:

```powershell
python -m pytest tests/api/test_session.py -v
```

Expected: all login, cookie, expiry, logout, and protected-route cases pass.

- [ ] **Step 6: Commit session security**

```powershell
git add backend tests/api/test_session.py
git commit -m "feat: add lightweight team sessions"
```

---

### Task 3: Create the Versioned Product/Activity Database Model

**Files:**
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/gift.py`
- Create: `backend/app/models/taxonomy.py`
- Create: `backend/app/models/custom_fields.py`
- Create: `backend/app/models/assets.py`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/0001_initial_schema.py`
- Create: `alembic.ini`
- Create: `tests/services/test_schema.py`
- Create: `tests/services/test_model_constraints.py`

**Interfaces:**
- Produces SQLAlchemy models: `Gift`, `ProductDetail`, `ProductOffer`, `ActivityDetail`, `ActivityOffer`, `GiftBundleComponent`, `GiftTypeDefinition`, `DimensionOption`, `CustomFieldDefinition`, `GiftCustomFieldValue`, `GiftImage`, `AuditEvent`, `AIRun`, `ImportRun`, `BackupRecord`, `RevokedSession`.
- Produces migration command: `alembic upgrade head`.
- Establishes `CURRENT_SCHEMA_VERSION = 1`.

- [ ] **Step 1: Write failing schema and constraint tests**

```python
async def test_product_and_activity_details_are_separate(db_session):
    product = Gift(canonical_name="黄铜书签", gift_type_code="product")
    activity = Gift(canonical_name="陶艺双人课", gift_type_code="activity")
    db_session.add_all([product, activity])
    await db_session.flush()
    db_session.add(ProductDetail(gift_id=product.id, product_form="physical"))
    db_session.add(ActivityDetail(gift_id=activity.id, activity_mode="offline"))
    await db_session.commit()
    product_detail = await db_session.get(ProductDetail, product.id)
    activity_detail = await db_session.get(ActivityDetail, activity.id)
    assert product_detail.product_form == "physical"
    assert activity_detail.activity_mode == "offline"


async def test_bundle_component_rejects_self_reference(db_session):
    gift = Gift(canonical_name="周末礼物包", gift_type_code="product", is_bundle=True)
    db_session.add(gift)
    await db_session.flush()
    db_session.add(GiftBundleComponent(bundle_gift_id=gift.id, component_gift_id=gift.id))
    with pytest.raises(IntegrityError):
        await db_session.commit()
```

- [ ] **Step 2: Run tests and verify model imports fail**

Run:

```powershell
python -m pytest tests/services/test_schema.py tests/services/test_model_constraints.py -v
```

Expected: collection fails because the models do not exist.

- [ ] **Step 3: Implement shared and type-specific tables**

Use UUID strings, timezone-aware timestamps, explicit foreign keys, `ondelete="CASCADE"` for owned details, and `ondelete="RESTRICT"` for referenced bundle components. Add check constraints for non-negative ranges and minimum values not exceeding maximum values.

Define gift type codes as text foreign keys, not SQL enums:

```python
gift_type_code: Mapped[str] = mapped_column(
    ForeignKey("gift_type_definitions.code", ondelete="RESTRICT"),
    index=True,
)
```

Seed active `product` and `activity` type definitions in migration `0001`.

- [ ] **Step 4: Add custom-field and operational tables**

`custom_field_definitions.machine_key` is unique and immutable after first value. Store `value_json` in `gift_custom_field_values`, with a unique `(gift_id, field_definition_id)` constraint. Model field states as `draft`, `active`, `deprecated`, and `retired`.

- [ ] **Step 5: Generate and inspect the migration**

Run:

```powershell
alembic upgrade head
alembic current
```

Expected: current revision is `0001_initial_schema`.

- [ ] **Step 6: Run schema tests**

```powershell
python -m pytest tests/services/test_schema.py tests/services/test_model_constraints.py -v
```

Expected: all schema, one-to-one, range, and foreign-key tests pass.

- [ ] **Step 7: Commit the model**

```powershell
git add backend/alembic backend/app/models alembic.ini tests/services
git commit -m "feat: add versioned gift data model"
```

---

### Task 4: Implement Typed Gift Validation, Completeness, Duplicates, and CRUD

**Files:**
- Create: `backend/app/schemas/common.py`
- Create: `backend/app/schemas/gift.py`
- Create: `backend/app/services/completeness.py`
- Create: `backend/app/services/duplicates.py`
- Create: `backend/app/services/gifts.py`
- Create: `backend/app/api/routes/gifts.py`
- Modify: `backend/app/api/router.py`
- Create: `tests/services/test_gift_validation.py`
- Create: `tests/services/test_completeness.py`
- Create: `tests/api/test_gifts.py`
- Create: `tests/api/test_recycle_bin.py`

**Interfaces:**
- Produces: `ProductGiftCreate`, `ActivityGiftCreate`, `GiftCreate`, `GiftUpdate`, `GiftRead`.
- Produces: `calculate_completeness(gift: GiftAggregate) -> CompletenessResult`.
- Produces: `find_duplicates(session, canonical_name, aliases) -> list[DuplicateMatch]`.
- Produces CRUD, copy, duplicate-check, soft-delete, restore, and purge endpoints from the approved spec.

- [ ] **Step 1: Write failing discriminated-union tests**

```python
def test_product_rejects_activity_details():
    with pytest.raises(ValidationError):
        ProductGiftCreate.model_validate({
            "gift_type_code": "product",
            "canonical_name": "书签",
            "activity_details": {"activity_mode": "offline"},
        })


def test_activity_accepts_activity_details():
    value = GiftCreateAdapter.validate_python({
        "gift_type_code": "activity",
        "canonical_name": "陶艺课",
        "activity_details": {
            "activity_mode": "offline",
            "duration_minutes_min": 90,
            "duration_minutes_max": 120,
            "participants_min": 2,
            "participants_max": 2,
            "pricing_unit": "per_session",
        },
    })
    assert value.gift_type_code == "activity"
```

- [ ] **Step 2: Run validation tests and verify missing schema failures**

Run:

```powershell
python -m pytest tests/services/test_gift_validation.py -v
```

Expected: import fails for `ProductGiftCreate`.

- [ ] **Step 3: Implement exact request and response contracts**

Define:

```python
class ProductGiftCreate(GiftBase):
    gift_type_code: Literal["product"]
    product_details: ProductDetailsInput
    activity_details: None = None


class ActivityGiftCreate(GiftBase):
    gift_type_code: Literal["activity"]
    activity_details: ActivityDetailsInput
    product_details: None = None


GiftCreate = Annotated[
    ProductGiftCreate | ActivityGiftCreate,
    Field(discriminator="gift_type_code"),
]
GiftCreateAdapter = TypeAdapter(GiftCreate)
```

Apply all range, free-price, digital-product, online-activity, URL, bundle, and type-detail rules from the design specification.

- [ ] **Step 4: Write failing completeness and duplicate tests**

Assert that common completeness plus product/activity weights reaches 100 only when all required fields for the selected type are valid. Assert exact normalized names block creation and trigram similarity above 0.82 returns a warning without blocking.

- [ ] **Step 5: Implement the domain service**

Expose these exact public function signatures:

```text
create_gift(session: AsyncSession, payload: ProductGiftCreate | ActivityGiftCreate) -> GiftRead
update_gift(session: AsyncSession, gift_id: UUID, payload: ProductGiftCreate | ActivityGiftCreate) -> GiftRead
copy_gift(session: AsyncSession, gift_id: UUID) -> GiftRead
soft_delete_gift(session: AsyncSession, gift_id: UUID) -> None
restore_gift(session: AsyncSession, gift_id: UUID) -> GiftRead
purge_gift(session: AsyncSession, gift_id: UUID) -> None
```

Copying creates a new UUID, appends “（副本）” to the name, and clears all channel verification, inventory, availability, and channel timestamp fields.

- [ ] **Step 6: Add protected routes and audit events**

List supports pagination, unified query, status, type, carrier/mode, customization, bundle, price, completeness, image, offer, and verification filters. Every mutation records an `AuditEvent`.

- [ ] **Step 7: Run gift API and service tests**

```powershell
python -m pytest tests/services/test_gift_validation.py tests/services/test_completeness.py tests/api/test_gifts.py tests/api/test_recycle_bin.py -v
```

Expected: all typed CRUD, duplicate, copy, soft-delete, restore, purge, and completeness tests pass.

- [ ] **Step 8: Commit the gift domain**

```powershell
git add backend/app/schemas backend/app/services backend/app/api tests
git commit -m "feat: add typed gift collection workflow"
```

---

### Task 5: Build the Frontend Shell, Session Flow, and Design Tokens

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/types.ts`
- Create: `frontend/src/router/index.ts`
- Create: `frontend/src/stores/session.ts`
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/components/layout/AppShell.vue`
- Create: `frontend/src/views/LoginView.vue`
- Create: `frontend/src/views/DashboardView.vue`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/main.ts`
- Create: `frontend/src/views/__tests__/LoginView.test.ts`

**Interfaces:**
- Produces: `apiRequest<T>(path, options) -> Promise<T>` with cookies.
- Produces Pinia session actions: `restore()`, `login(passcode)`, `logout()`.
- Produces authenticated route guard and responsive application shell.

- [ ] **Step 1: Write the failing login-view test**

```ts
it('logs in with one passcode field and redirects', async () => {
  mockApi.post('/api/session/login', {
    authenticated: true,
    expiresAt: '2026-08-03T00:00:00Z',
  })
  const wrapper = mountLogin()
  await wrapper.get('input[type="password"]').setValue('team-secret')
  await wrapper.get('form').trigger('submit')
  expect(router.currentRoute.value.name).toBe('dashboard')
})
```

- [ ] **Step 2: Run the test and verify missing component failure**

```powershell
Set-Location frontend
npm run test -- LoginView
```

Expected: module resolution fails for `LoginView.vue`.

- [ ] **Step 3: Implement the API client and session store**

Send requests with cookies. On 401, clear session state and redirect to login. No CSRF token storage or retry logic is required in the first release.

- [ ] **Step 4: Implement the approved visual shell**

Use cream background, forest green primary, muted gold accent, visible focus rings, minimum 44 px interactive targets, and no decorative hero imagery. The login page contains only application context, one passcode field, show/hide control, and submit button.

- [ ] **Step 5: Run unit, type, and build checks**

```powershell
npm run test -- LoginView
npm run typecheck
npm run build
```

Expected: tests, typecheck, and build pass.

- [ ] **Step 6: Commit the frontend shell**

```powershell
git add frontend
git commit -m "feat: add protected data studio shell"
```

---

### Task 6: Build the Product/Activity Guided Workbench

**Files:**
- Create: `frontend/src/api/gifts.ts`
- Create: `frontend/src/stores/workbench.ts`
- Create: `frontend/src/composables/useDraft.ts`
- Create: `frontend/src/composables/useUnsavedChanges.ts`
- Create: `frontend/src/components/gifts/GiftTypeSelector.vue`
- Create: `frontend/src/components/gifts/WorkbenchProgress.vue`
- Create: `frontend/src/components/gifts/CommonFieldsSection.vue`
- Create: `frontend/src/components/gifts/ProductFieldsSection.vue`
- Create: `frontend/src/components/gifts/ActivityFieldsSection.vue`
- Create: `frontend/src/components/gifts/OfferEditor.vue`
- Create: `frontend/src/components/gifts/BundleEditor.vue`
- Create: `frontend/src/components/gifts/QualityPanel.vue`
- Create: `frontend/src/views/GiftWorkbenchView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/src/components/gifts/__tests__/GiftWorkbench.test.ts`

**Interfaces:**
- Consumes: typed API contracts and gift CRUD from Tasks 4–5.
- Produces: `WorkbenchDraft`, `ProductGiftDraft`, `ActivityGiftDraft`, local draft persistence, unsaved-change guard.
- Produces save actions: `saveDraft()`, `saveAndContinue()`, `saveAndCreateNext()`.

- [ ] **Step 1: Write failing conditional-form tests**

```ts
it('shows only product fields after product confirmation', async () => {
  const wrapper = mountWorkbench()
  await wrapper.get('[data-type="product"]').trigger('click')
  expect(wrapper.find('[data-section="product"]').exists()).toBe(true)
  expect(wrapper.find('[data-section="activity"]').exists()).toBe(false)
})

it('requires confirmation before discarding type-specific values', async () => {
  const wrapper = mountProductDraft({ materials: ['黄铜'] })
  await wrapper.get('[data-type="activity"]').trigger('click')
  expect(wrapper.text()).toContain('商品专属信息不会用于活动记录')
})
```

- [ ] **Step 2: Run tests and verify missing workbench failure**

```powershell
npm run test -- GiftWorkbench
```

Expected: component imports fail.

- [ ] **Step 3: Implement the store and discriminated TypeScript types**

```ts
export type ProductGiftDraft = CommonGiftDraft & {
  giftTypeCode: 'product'
  productDetails: ProductDetailsInput
  activityDetails?: never
}

export type ActivityGiftDraft = CommonGiftDraft & {
  giftTypeCode: 'activity'
  activityDetails: ActivityDetailsInput
  productDetails?: never
}

export type GiftDraft = ProductGiftDraft | ActivityGiftDraft
```

Mirror backend field names at the API boundary and map camelCase UI state in one serializer module.

- [ ] **Step 4: Implement the three-column guided layout**

Desktop: progress on the left, current form section in the center, completeness/errors/save actions on the right. Narrow screens: progress header, one-column form, bottom quality drawer.

Sections are Basic, Type Confirmation, Matching, Type-Specific Details, Concrete Channels, and Content & Quality.

- [ ] **Step 5: Add local drafts and navigation protection**

Key drafts by `new` or gift UUID plus schema version. Save to `localStorage` after 500 ms debounce. Never auto-submit to the server. Display restore/discard choice when a matching draft exists.

- [ ] **Step 6: Run workbench tests and production checks**

```powershell
npm run test -- GiftWorkbench
npm run typecheck
npm run build
```

Expected: conditional sections, type-switch confirmation, drafts, and save actions pass.

- [ ] **Step 7: Commit the workbench**

```powershell
git add frontend/src
git commit -m "feat: add guided product and activity workbench"
```

---

### Task 7: Add Dashboard, Search, Filtering, Copy, and Recycle Bin

**Files:**
- Create: `backend/app/api/routes/dashboard.py`
- Modify: `backend/app/api/routes/gifts.py`
- Create: `tests/api/test_dashboard.py`
- Create: `tests/api/test_gift_filters.py`
- Create: `frontend/src/components/gifts/GiftFilters.vue`
- Create: `frontend/src/components/gifts/GiftTable.vue`
- Create: `frontend/src/components/gifts/GiftCards.vue`
- Modify: `frontend/src/views/DashboardView.vue`
- Create: `frontend/src/views/GiftListView.vue`
- Create: `frontend/src/views/RecycleBinView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/src/views/__tests__/GiftListView.test.ts`

**Interfaces:**
- Produces: `GET /api/dashboard -> DashboardSummary`.
- Extends: `GET /api/gifts` with documented filters and `deleted=only|exclude`.
- Produces list/card mode, bulk status changes, copy, soft delete, restore, and purge UI.

- [ ] **Step 1: Write failing dashboard and filter tests**

Seed one complete product, one incomplete activity, one inactive gift, and one deleted gift. Assert counts, product/activity coverage, stale offer counts, and default exclusion of deleted rows.

- [ ] **Step 2: Run API tests and verify failures**

```powershell
python -m pytest tests/api/test_dashboard.py tests/api/test_gift_filters.py -v
```

Expected: dashboard is 404 and filter assertions fail.

- [ ] **Step 3: Implement aggregate queries and filters**

Return stable response keys:

```python
class DashboardSummary(BaseModel):
    total: int
    complete: int
    drafts: int
    needs_review: int
    inactive: int
    product_count: int
    activity_count: int
    missing_images: int
    missing_sources: int
    stale_channels: int
    possible_duplicates: int
    recent_changes: list[AuditEventRead]
```

- [ ] **Step 4: Write the failing list-view test**

Assert debounced search, type filter, table/card toggle, copy confirmation, and recycle-bin restore call the correct APIs and preserve current filters in the URL query.

- [ ] **Step 5: Implement dashboard, list, and recycle-bin views**

Desktop defaults to table; narrow screens default to cards. Purge requires typing the gift name. Bulk operations show affected count and record one audit event per gift.

- [ ] **Step 6: Run backend and frontend tests**

```powershell
python -m pytest tests/api/test_dashboard.py tests/api/test_gift_filters.py -v
Set-Location frontend
npm run test -- GiftListView
npm run typecheck
```

Expected: all dashboard, filtering, copy, delete, and restore tests pass.

- [ ] **Step 7: Commit discovery and maintenance views**

```powershell
git add backend tests frontend/src
git commit -m "feat: add gift discovery and recycle bin"
```

---

### Task 8: Add Controlled Custom Fields and the Extension Guide

**Files:**
- Create: `backend/app/schemas/fields.py`
- Create: `backend/app/services/fields.py`
- Create: `backend/app/api/routes/dimensions.py`
- Create: `tests/services/test_custom_fields.py`
- Create: `tests/api/test_field_definitions.py`
- Modify: `tests/conftest.py`
- Create: `frontend/src/components/fields/CustomFieldRenderer.vue`
- Create: `frontend/src/components/fields/FieldDefinitionEditor.vue`
- Create: `frontend/src/views/SettingsView.vue`
- Modify: `frontend/src/views/GiftWorkbenchView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `docs/DATA-SCHEMA-EXTENSION-GUIDE.md`

**Interfaces:**
- Produces: `validate_custom_value(definition, value) -> JsonValue`.
- Produces dimension and field-definition endpoints from the approved API.
- Produces generic controls for text, long text, integer, decimal, currency, boolean, date, URL, single choice, and multi choice.

- [ ] **Step 1: Write failing field lifecycle and validation tests**

```python
@pytest.fixture
def active_product_text_field(client, auth_headers):
    response = client.post(
        "/api/field-definitions",
        headers=auth_headers,
        json={
            "machine_key": "sensory_notes",
            "label": "感官描述",
            "scope": "product",
            "data_type": "text",
            "cardinality": "single",
            "required_mode": "draft_optional",
            "help_text": "描述触感、气味或声音",
            "positive_example": "触感温润",
            "negative_example": "很好",
            "source_requirement": "human_judgment",
            "ai_policy": "suggest",
            "sensitive": False,
            "introduced_version": 1,
            "owner": "GiftMind 数据组",
            "status": "active",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_machine_key_is_immutable_after_value_exists(
    client,
    auth_headers,
    complete_product_payload,
    active_product_text_field,
):
    field = active_product_text_field
    payload = {
        **complete_product_payload,
        "custom_fields": {field["id"]: "触感温润"},
    }
    assert client.post(
        "/api/gifts",
        headers=auth_headers,
        json=payload,
    ).status_code == 201
    response = client.put(
        f"/api/field-definitions/{field['id']}",
        headers=auth_headers,
        json={**field, "machine_key": "texture_notes"},
    )
    assert response.status_code == 409


def test_retired_field_value_is_preserved_in_internal_export(
    client,
    auth_headers,
    complete_product_payload,
    active_product_text_field,
):
    field = active_product_text_field
    payload = {
        **complete_product_payload,
        "custom_fields": {field["id"]: "触感温润"},
    }
    gift = client.post("/api/gifts", headers=auth_headers, json=payload).json()
    assert client.post(
        f"/api/field-definitions/{field['id']}/deprecate",
        headers=auth_headers,
        json={
            "replacement_field_id": None,
            "reason": "第一轮采集后不再使用",
        },
    ).status_code == 200
    assert client.put(
        f"/api/field-definitions/{field['id']}",
        headers=auth_headers,
        json={**field, "status": "retired"},
    ).status_code == 200
    exported = client.get(
        "/api/exports/internal.json",
        headers=auth_headers,
    ).json()
    record = next(item for item in exported["gifts"] if item["id"] == gift["id"])
    assert record["custom_fields"]["sensory_notes"] == "触感温润"
```

- [ ] **Step 2: Run tests and verify missing endpoint failures**

```powershell
python -m pytest tests/services/test_custom_fields.py tests/api/test_field_definitions.py -v
```

Expected: imports or endpoints fail.

- [ ] **Step 3: Implement field definitions and typed value validation**

Require immutable `snake_case` machine keys, scope, data type, cardinality, required mode, help text, positive and negative examples, source requirement, AI policy, sensitivity flag, export mapping, introduced version, owner, status, and replacement field.

Reject any custom field marked sensitive in release 1. Prevent physical deletion after values exist.

- [ ] **Step 4: Implement generic frontend controls**

Render fields only in the Common, Product, or Activity scope that matches the current draft. Show units, help text, validation errors, and deprecated replacement guidance.

- [ ] **Step 5: Write the extension guide**

Document the three-layer decision rule, immutable keys, lifecycle, schema versioning, migration/backfill/rollback checklist, and two complete examples:

- Add `sensory_notes` as a product-scoped draft custom text field, then promote it to a core field.
- Add a hypothetical `donation` top-level type with boundary examples, one-to-one detail table, AI schema, import/export mapping, migration, and tests.

- [ ] **Step 6: Run custom-field tests and docs checks**

```powershell
python -m pytest tests/services/test_custom_fields.py tests/api/test_field_definitions.py -v
Set-Location frontend
npm run test
npm run typecheck
rg -n "TBD|TODO|implement later" ..\docs\DATA-SCHEMA-EXTENSION-GUIDE.md
```

Expected: tests pass and `rg` returns no matches.

- [ ] **Step 7: Commit controlled extensibility**

```powershell
git add backend tests frontend/src docs
git commit -m "feat: add controlled schema extensions"
```

---

### Task 9: Integrate Two-Stage DeepSeek Suggestions

**Files:**
- Create: `backend/app/services/ai/schemas.py`
- Create: `backend/app/services/ai/prompts.py`
- Create: `backend/app/services/ai/deepseek.py`
- Create: `backend/app/schemas/ai.py`
- Create: `backend/app/api/routes/ai.py`
- Create: `tests/services/test_deepseek.py`
- Create: `tests/api/test_ai.py`
- Create: `frontend/src/components/ai/AIEnrichmentPanel.vue`
- Create: `frontend/src/components/ai/AISuggestionDiff.vue`
- Modify: `frontend/src/stores/workbench.ts`
- Modify: `frontend/src/views/GiftWorkbenchView.vue`
- Create: `frontend/src/components/ai/__tests__/AIEnrichmentPanel.test.ts`

**Interfaces:**
- Produces: `classify_gift(request) -> GiftTypeSuggestion`.
- Produces: `enrich_gift(request, confirmed_type) -> EnrichmentResult`.
- Produces: `POST /api/ai/enrich` with `stage: classify|enrich|auto`.
- Produces per-field `suggestedValue`, `confidence`, `reason`, and `factStatus`.

- [ ] **Step 1: Write failing AI service tests with HTTPX MockTransport**

Cover:

```python
async def test_ambiguous_name_returns_two_candidates():
    result = await service.classify_gift(name="手作对戒", description="")
    assert [item.gift_type_code for item in result.candidates] == ["product", "activity"]


async def test_model_cannot_return_factual_venue():
    result = await service.enrich_gift(activity_request)
    assert "venue_name" not in result.suggestions
    assert result.rejected_fields == ["venue_name"]
```

Also test 45-second timeout configuration, one retry on network/5xx, no retry on 4xx, malformed JSON, invalid enum removal, token logging, and environment-key precedence.

- [ ] **Step 2: Run tests and verify missing service failures**

```powershell
python -m pytest tests/services/test_deepseek.py tests/api/test_ai.py -v
```

Expected: imports fail for the AI service.

- [ ] **Step 3: Implement strict prompts and Pydantic output**

The classification prompt receives only name, description, current confirmed fields, and product/activity definitions. The enrichment prompt receives only the confirmed type's schema and active data dictionary.

Mark merchant, brand, SKU, provider, current price, stock, URL, city, venue, coordinates, opening hours, schedule, policies, sources, verification, and image rights as prohibited facts. Strip and report these if returned.

- [ ] **Step 4: Add protected API orchestration**

`stage="auto"` classifies first unless `confirmedGiftType` is supplied. If classification confidence is below 0.75 or candidates are close, return `needsTypeConfirmation: true` and do not run enrichment. The first release does not enforce an AI rate limit.

- [ ] **Step 5: Write and run failing frontend suggestion tests**

Assert green additions, yellow changes with original values, orange low-confidence values, individual accept/reject/edit, and “accept all” without automatic save.

- [ ] **Step 6: Implement the AI panel**

Keep AI suggestions outside `GiftDraft` until accepted. Accepted values enter the draft with provenance `{source: "ai", runId}`; saving persists only final values, while `ai_runs` retains request metadata without the full passcode or API key.

- [ ] **Step 7: Run all AI tests**

```powershell
python -m pytest tests/services/test_deepseek.py tests/api/test_ai.py -v
Set-Location frontend
npm run test -- AIEnrichmentPanel
npm run typecheck
```

Expected: all tests pass without external network access.

- [ ] **Step 8: Commit DeepSeek assistance**

```powershell
git add backend tests frontend/src
git commit -m "feat: add confirmed DeepSeek enrichment"
```

---

### Task 10: Add Safe Local Image Upload and Management

**Files:**
- Create: `backend/app/services/images.py`
- Create: `backend/app/api/routes/images.py`
- Create: `tests/services/test_images.py`
- Create: `tests/api/test_image_upload.py`
- Create: `frontend/src/components/gifts/ImageUploader.vue`
- Create: `frontend/src/components/gifts/ImageGallery.vue`
- Create: `frontend/src/components/gifts/__tests__/ImageUploader.test.ts`

**Interfaces:**
- Produces: `process_image(source, upload_root) -> ProcessedImage`.
- Produces upload, delete, reorder, and cover-image API operations.
- Produces image metadata with original, large, and thumbnail variants.

- [ ] **Step 1: Write failing image processing tests**

Generate in-memory JPEG, PNG, WebP, invalid binary, oversized, duplicate, and EXIF-rotated fixtures. Assert:

```python
assert processed.large.width <= 1600
assert processed.thumb.width <= 360
assert processed.large.format == "WEBP"
assert processed.sha256 == expected_sha256
```

- [ ] **Step 2: Run tests and verify missing processor failure**

```powershell
python -m pytest tests/services/test_images.py tests/api/test_image_upload.py -v
```

Expected: image service import fails.

- [ ] **Step 3: Implement decoding and atomic storage**

Decode bytes with Pillow rather than trusting extensions. Apply EXIF transpose, remove unnecessary metadata, generate random UUID filenames, write to temporary files, fsync, and atomically rename. Keep the original and make 1600 px and 360 px WebP derivatives.

Reject unsupported formats, files above 10 MB, the ninth image, path-like names, and duplicate SHA-256 per gift.

- [ ] **Step 4: Implement upload and gallery UI**

Show per-file progress, individual failures, source and rights fields, cover selection, drag reorder, and delete confirmation. Successful files remain if another upload in the same batch fails.

- [ ] **Step 5: Run backend and frontend image tests**

```powershell
python -m pytest tests/services/test_images.py tests/api/test_image_upload.py -v
Set-Location frontend
npm run test -- ImageUploader
npm run typecheck
```

Expected: processing, limits, duplicates, partial failure, cover, and reorder tests pass.

- [ ] **Step 6: Commit image management**

```powershell
git add backend tests frontend/src
git commit -m "feat: add safe gift image management"
```

---

### Task 11: Implement Versioned JSON, CSV, and Nine-Sheet Excel Import/Export

**Files:**
- Create: `backend/app/schemas/import_export.py`
- Create: `backend/app/services/exports.py`
- Create: `backend/app/services/imports.py`
- Create: `backend/app/api/routes/exports.py`
- Create: `backend/app/api/routes/imports.py`
- Create: `tests/services/test_exports.py`
- Create: `tests/services/test_imports.py`
- Create: `tests/api/test_import_export.py`
- Create: `frontend/src/views/ImportsView.vue`
- Create: `frontend/src/components/fields/ImportPreview.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/src/views/__tests__/ImportsView.test.ts`

**Interfaces:**
- Produces: `export_internal_json`, `export_giftmind_json`, `export_csv`, `export_excel`.
- Produces: `preview_import(file, strategy) -> ImportPreview` and `commit_import(import_id) -> ImportResult`.
- Produces sheets: 礼物基础, 商品详情, 活动详情, 商品渠道, 活动渠道, 组合组件, 自定义字段值, 图片清单, 数据字典.

- [ ] **Step 1: Write failing export contract tests**

Assert internal JSON contains schema metadata and round-trips an unknown future field. Assert compatibility category priority:

```python
def export_gift(**overrides):
    base = {
        "id": "gift-1",
        "name": "测试礼物",
        "gift_type_code": "product",
        "is_bundle": False,
        "is_customizable": False,
        "product_form": "physical",
        "why": "适合测试映射",
        "price_min": 10,
        "price_max": 20,
        "traits": [],
        "occasions": ["生日"],
        "recipients": ["朋友"],
        "lead_days": 1,
        "tags": ["测试"],
        "tip": "提前准备",
        "avoid": [],
    }
    return GiftExportInput.model_validate(base | overrides)


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"gift_type_code": "activity", "is_bundle": True}, "组合"),
        ({"is_customizable": True}, "定制"),
        ({"gift_type_code": "activity"}, "体验"),
        ({"product_form": "digital"}, "数字"),
        ({"product_form": "physical"}, "实物"),
    ],
)
def test_legacy_category_priority(overrides, expected):
    assert to_giftmind_record(export_gift(**overrides))["category"] == expected
```

- [ ] **Step 2: Run export tests and verify missing service failure**

```powershell
python -m pytest tests/services/test_exports.py -v
```

Expected: export service import fails.

- [ ] **Step 3: Implement all exports and templates**

CSV is a documented flattened summary, not a lossless format. Excel contains exactly the approved nine sheets; write the schema version and application version to workbook document properties rather than creating a tenth metadata sheet. Internal JSON is lossless; GiftMind JSON applies the approved five-category compatibility mapping and excludes inactive/deleted gifts.

- [ ] **Step 4: Write failing import preview and transaction tests**

Cover valid product/activity rows, wrong-sheet fields, invalid ranges, unknown future fields, exact duplicate strategies (`skip`, `update`, `copy`), line-numbered errors, and a commit failure that rolls back the entire batch.

- [ ] **Step 5: Implement staged import**

Upload to a temporary import directory, parse without writing formal records, persist `ImportRun` plus a normalized preview and error report, then commit in one database transaction only after explicit confirmation.

- [ ] **Step 6: Implement import UI**

Display sheet, row, field, offending value, and Chinese reason. Provide downloadable error report and explicit duplicate strategy before enabling Commit.

- [ ] **Step 7: Run import/export tests**

```powershell
python -m pytest tests/services/test_exports.py tests/services/test_imports.py tests/api/test_import_export.py -v
Set-Location frontend
npm run test -- ImportsView
npm run typecheck
```

Expected: all formats, version metadata, compatibility mapping, preview, rollback, and UI tests pass.

- [ ] **Step 8: Commit data portability**

```powershell
git add backend tests frontend/src
git commit -m "feat: add versioned data import and export"
```

---

### Task 12: Add Read-Only DeepSeek Status, Backup, and Restore

**Files:**
- Create: `backend/app/schemas/settings.py`
- Create: `backend/app/services/backups.py`
- Create: `backend/app/api/routes/settings.py`
- Create: `backend/app/api/routes/backups.py`
- Create: `scripts/backup.py`
- Create: `scripts/restore.py`
- Create: `tests/services/test_backups.py`
- Create: `tests/api/test_settings.py`
- Create: `tests/api/test_backups.py`
- Modify: `frontend/src/views/SettingsView.vue`
- Create: `frontend/src/stores/settings.ts`
- Create: `frontend/src/views/__tests__/SettingsView.test.ts`

**Interfaces:**
- Produces: `create_backup() -> BackupManifest`, `restore_backup(path, passcode) -> RestoreResult`.
- Produces settings and backup endpoints from the approved API.

- [ ] **Step 1: Write failing DeepSeek environment-status tests**

Assert the settings response exposes only DeepSeek configured/unconfigured state, model, Base URL, timeout, and retry values from server `.env`; it never exposes a key field and has no endpoint that accepts a Key.

- [ ] **Step 2: Write failing backup atomicity tests**

Create a database, image, and settings fixture; back it up; mutate all three; restore; and verify exact recovery. Corrupt the ZIP and assert the live database and images remain unchanged.

- [ ] **Step 3: Run tests and verify missing services**

```powershell
python -m pytest tests/services/test_backups.py tests/api/test_settings.py tests/api/test_backups.py -v
```

Expected: imports or routes fail.

- [ ] **Step 4: Implement read-only DeepSeek settings**

Read DeepSeek Key, model, Base URL, 45-second timeout, and one retry from server `.env`. Return only `configured`, model, Base URL, timeout, and retry through settings. Store only non-secret interface, image, and data-maintenance settings in SQLite.

- [ ] **Step 5: Implement atomic backup and restore**

Before backup, run WAL checkpoint and `PRAGMA integrity_check`. ZIP the database, originals, derivatives, non-secret settings manifest, schema/application versions, and per-file SHA-256 checksums. Exclude `TEAM_PASSCODE`, `APP_SECRET`, session cookies, and `DEEPSEEK_API_KEY`.

Before restore, verify structure, version, and every checksum; create a pre-restore backup; extract to a sibling temporary directory; then atomically swap persistent paths. On failure, leave the original paths untouched.

- [ ] **Step 6: Implement settings and backup UI**

Show DeepSeek enabled/disabled state and read-only model configuration, manual backup, backup list, download, and restore. Restore requires the shared team passcode plus a second confirmation naming the backup timestamp.

- [ ] **Step 7: Run settings and backup tests**

```powershell
python -m pytest tests/services/test_backups.py tests/api/test_settings.py tests/api/test_backups.py -v
Set-Location frontend
npm run test -- SettingsView
npm run typecheck
```

Expected: environment-only Key status, backup, corruption, rollback, and UI tests pass.

- [ ] **Step 8: Commit operations**

```powershell
git add backend scripts tests frontend/src
git commit -m "feat: add settings and backups"
```

---

### Task 13: Package, Document, Exercise End-to-End, and Prepare Deployment

**Files:**
- Create: `Dockerfile`
- Create: `compose.yml`
- Create: `Makefile`
- Create: `docs/nginx-giftmind-data.conf`
- Create: `docs/DEPLOYMENT.md`
- Create: `tests/e2e/gift-collection.spec.ts`
- Create: `tests/e2e/import-backup.spec.ts`
- Create: `tests/e2e/support.ts`
- Create: `frontend/playwright.config.ts`
- Modify: `frontend/package.json`
- Create: `README.md`
- Modify: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces one container that serves `/api` and built frontend assets.
- Produces persistent paths under `/srv/giftmind-data`.
- Produces `make dev`, `make test`, `make build`, `make backup`, and `make verify`.
- Produces Nginx configuration for `/giftmind-data/`.

- [ ] **Step 1: Write the full collector E2E test**

Automate:

```ts
import {
  activityFixture,
  bundleFixture,
  createActivityGift,
  createMixedBundle,
  createProductGift,
  login,
  productFixture,
} from './support'

test('collector creates product, activity, and mixed bundle', async ({ page }) => {
  await login(page, 'team-secret')
  await createProductGift(page, productFixture)
  await createActivityGift(page, activityFixture)
  await createMixedBundle(page, bundleFixture)
  await expect(page.getByText('3 条礼物')).toBeVisible()
})
```

The concrete fixtures must include all completeness requirements. Add assertions for ambiguous AI classification, manual type confirmation, accepted suggestions, image upload, search, copy, delete, restore, and compatibility export.

- [ ] **Step 2: Write import and backup E2E tests**

Upload an Excel file containing one valid and one invalid row, verify preview errors and no formal write before commit, then import a valid file. Create and restore a backup in an isolated test data directory.

- [ ] **Step 3: Build the production container**

Use a multi-stage Dockerfile: Node builds `frontend/dist`; Python installs the backend; the final image runs as a non-root user and mounts `/app/data`, `/app/uploads`, and `/app/backups`. FastAPI serves frontend assets and SPA fallback outside `/api`.

- [ ] **Step 4: Add Compose, Nginx, and command wrappers**

Compose binds the app only to `127.0.0.1:8013`, restarts unless stopped, mounts `/srv/giftmind-data` subdirectories, and loads `/srv/giftmind-data/.env`.

The Nginx template:

```nginx
location /giftmind-data/ {
    proxy_pass http://127.0.0.1:8013/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 12m;
}
```

Add a deny rule for hidden files and never expose `/data`, `/uploads/original`, `/backups`, or `.env` directly.

- [ ] **Step 5: Write deployment and recovery documentation**

Document:

1. Create `/srv/giftmind-data/{data,uploads/original,uploads/large,uploads/thumb,backups,logs}`.
2. Set `APP_SECRET`, `TEAM_PASSCODE`, and optionally `DEEPSEEK_API_KEY` in the server `.env`.
3. Set optional DeepSeek model, Base URL, timeout, and retry environment values.
4. Build and start Compose.
5. Install the Nginx configuration and HTTPS certificate.
6. Run migrations and health check.
7. Add the 02:30 daily backup cron and 30-day retention.
8. Upgrade, rollback, download backup, restore, and rotate passcode/key.

- [ ] **Step 6: Run the complete local verification**

Run:

```powershell
python -m ruff check backend tests scripts
python -m pytest -v
Set-Location frontend
npm run test
npm run typecheck
npm run build
npx playwright test
Set-Location ..
docker compose build
docker compose up -d
Invoke-RestMethod http://127.0.0.1:8013/api/health
docker compose down
```

Expected: lint, backend tests, frontend tests, typecheck, build, E2E, container build, and health check all pass; health reports schema version 1.

- [ ] **Step 7: Verify secret and placeholder hygiene**

Run:

```powershell
rg -n "sk-[A-Za-z0-9]|DEEPSEEK_API_KEY=.+|TEAM_PASSCODE=.+|TBD|TODO|implement later" . `
  -g '!frontend/node_modules/**' -g '!.git/**'
git status --short
```

Expected: no real key, plaintext passcode, placeholder, untracked database, uploaded image, backup, or environment file appears.

- [ ] **Step 8: Commit the release-ready package**

```powershell
git add .
git commit -m "docs: package and document data studio deployment"
```

- [ ] **Step 9: Prepare GitHub publication without silently deploying**

Run:

```powershell
git log --oneline --decorate -15
git status --short
```

Expected: clean main branch with the planned commits. Before creating the remote repository, pushing, or changing the Tencent Cloud Nginx configuration, obtain the user's confirmation that the implementation and local verification results are accepted.

---

## Final Acceptance Checklist

- [ ] A collector can enter the shared passcode and create a complete product gift in under 10 minutes.
- [ ] A collector can create an activity gift without seeing or storing product-only fields.
- [ ] A mixed bundle can contain product and activity components without a cycle.
- [ ] DeepSeek classifies first, pauses on ambiguity, suggests only the confirmed type's fields, and never saves automatically.
- [ ] Factual merchant, venue, current price, availability, policy, source, and rights fields remain human-verified.
- [ ] Custom fields follow immutable keys and draft/active/deprecated/retired lifecycle.
- [ ] JSON is lossless and versioned; CSV is documented as flattened; Excel contains all nine sheets.
- [ ] GiftMind compatibility JSON follows Bundle → Custom → Activity → Digital → Physical priority.
- [ ] Images, SQLite, settings manifest, and schema version restore from a verified backup.
- [ ] The application remains fully usable when DeepSeek is disabled.
- [ ] No automated test contacts DeepSeek or spends model credits.
- [ ] All backend, frontend, E2E, build, container, and health checks pass.
- [ ] No secret, passcode, runtime database, image upload, or backup is committed.
