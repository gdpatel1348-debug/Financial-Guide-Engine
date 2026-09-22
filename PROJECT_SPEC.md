# Financial Guidance Engine
## Product Specification, Architecture, and Agent Build Guide

**Document status:** Authoritative implementation specification  
**Version:** 1.0.0  
**Audience:** Antigravity coding agents, senior engineers, reviewers, and product owner  
**Primary objective:** Build a trustworthy goal-based financial planning application for Indian financial-advisor clients.

> **This is a calculator and planning-analysis product, not an autonomous investment adviser.** It must explain assumptions, show calculations, preserve historical results, and clearly distinguish educational analysis from regulated personalized advice.

---

## Questions for GD

The agents must not block Phase 1 on these questions. Use the defaults below, record them in the README, and isolate them behind configuration so they can be changed later.

| Decision | Default for v1 | Why it is isolated |
|---|---|---|
| Goal types | Retirement, child education, marriage, travel, medical, emergency fund, and other | The product may add goal types without changing the engine contract. |
| Client geography | India; currency is INR; dates use `YYYY-MM-DD` | Tax and data assumptions are India-specific. |
| Advisor workflow | One authenticated user owns their own plans in v1 | Multi-advisor tenancy can be added after the ownership boundary is correct. |
| Investment advice scope | No security-specific buy/sell recommendation; only gap analysis, allocation diagnostics, and educational suggestions | The legal and regulatory scope must be reviewed before personalized recommendations are enabled. |
| PDF library | Puppeteer with a server-rendered report page | It gives reliable print CSS, charts, and page layout. Keep the report template separate from calculation code. |
| Frontend framework | None. Use HTML, modern CSS, and vanilla JavaScript ES modules | This is the requested fixed stack. Do not introduce React, Vue, or Angular. |
| Background scheduling | Cron-compatible worker entry points, initially invoked manually or by an external scheduler | The worker must remain independently runnable. |
| Data refresh policy | Daily NAV refresh; monthly portfolio-holdings refresh; every import records its source and timestamp | Public source files are not guaranteed to have identical formats. |

If a later requirement conflicts with this document, do not silently reinterpret the requirement. Record the conflict in `docs/DECISIONS.md`, explain the impact, and ask GD only when the decision changes product behavior, data ownership, legal scope, or security.

---

## 1. Product Definition

### 1.1 The problem

Clients and advisors need to answer a practical question: **given the client's current financial position, income, assets, liabilities, insurance, and goals, what is likely to be funded, what is at risk, and what structural problems should be reviewed?**

The product is therefore a **goal-based financial planning engine** with a guided intake flow. It is not a generic dashboard and it is not a collection of disconnected calculators.

### 1.2 The product loop

The product has three connected stages:

1. **Intake:** collect a structured financial snapshot through a multi-step wizard.
2. **Visualize:** show income, tax, savings, assets, liabilities, and goal funding in a comprehensible summary.
3. **Analyze:** project goals and existing assets, calculate funding gaps, estimate a corrective monthly SIP, and diagnose allocation, overlap, emergency-fund, and insurance issues.

The output is a **plan snapshot**. A snapshot contains the exact normalized inputs, the exact assumptions, the exact outputs, and the engine version used to calculate it. Once created, it is immutable.

### 1.3 v1 success criteria

The application is successful when a test user can:

- register, log in, and safely access only their own data;
- complete or resume a saved intake wizard;
- enter all required personal, income, asset, insurance, liability, and goal data;
- see the currently selected tax regime and a comparison of both regimes when sufficient data exists;
- run an analysis with explicit assumptions and no hidden constants;
- understand each goal's future value, projected funding, shortfall, and indicative monthly SIP;
- see diagnostics with severity, evidence, and a plain-language explanation;
- revisit a historical plan without it changing after configuration updates;
- export the selected snapshot to a readable PDF;
- verify the major workflows using automated tests and a documented manual checklist.

### 1.4 Non-goals for v1

The following are explicitly out of scope unless GD approves a change:

- executing trades, insurance purchases, loans, or payments;
- custody of client money;
- filing tax returns;
- scraping authenticated financial accounts;
- claiming guaranteed returns;
- selecting a specific security to buy or sell;
- replacing a SEBI-registered investment adviser or tax professional;
- real-time tax-rate discovery from an unofficial API;
- multi-organization advisor permissions beyond the single-user ownership model.

---

## 2. Non-Negotiable Engineering Rules

These rules apply to every phase and every agent.

1. **Separation of concerns:** frontend, backend, database, API route files, calculation services, jobs, and tests live in their own clearly named areas.
2. **Pure calculation engine:** tax, projections, gap analysis, diagnostics, SIP calculations, and mutual-fund overlap logic must accept plain serializable inputs and return plain serializable outputs. They must not import Express, a database client, environment variables, filesystem APIs, or network clients.
3. **Configuration is data:** tax slabs, cess, rebates, standard deductions, inflation assumptions, asset-class return assumptions, and diagnostic thresholds must be stored in versioned configuration data. No tax rate or return assumption may be embedded in calculation code.
4. **Decimal arithmetic:** PostgreSQL money values use `NUMERIC`; JavaScript calculations use `decimal.js` or an equivalent decimal library. Do not use binary floating-point arithmetic for money or tax results.
5. **Immutable snapshots:** a completed analysis writes an immutable `plan_runs` record containing normalized inputs, effective configuration, outputs, engine version, and provenance. Never update a completed run in place.
6. **Explicit versioning:** configuration has a financial-year or effective-period key. The engine version is a separate semantic version. Both are stored in a plan snapshot.
7. **Thin HTTP layer:** route files register endpoints. Controllers validate and orchestrate. Models perform persistence. Services calculate. No layer may bypass these boundaries for convenience.
8. **Tenant isolation:** every authenticated query is scoped by the authenticated user ID. Never trust a user ID from the request body when the route can derive it from the JWT.
9. **No unused endpoints:** every API route must have a real frontend caller or a documented worker/admin caller. Every frontend fetch must have a matching API contract.
10. **No silent assumptions:** assumptions appear in the UI, in the response, in the PDF, and in the stored snapshot. If an assumption is missing, the engine returns a structured validation error instead of inventing one.
11. **Tests before integration:** pure engine tests must pass before the engine is wired to the database. API integration tests must pass before the frontend is declared complete.
12. **Explainability over decoration:** charts support an explanation. They do not replace tables, labels, units, dates, or textual interpretation.

---

## 3. Fixed Technology Stack

- **Backend:** Node.js, Express, plain JavaScript. Use ES modules consistently.
- **Frontend:** semantic HTML, modern CSS, and vanilla JavaScript ES modules. Use CSS Grid, Flexbox, custom properties, and accessible components.
- **Database:** PostgreSQL. Use `pg` and SQL migrations. A lightweight query builder is allowed only if SQL remains visible and reviewable. Do not use a heavy ORM.
- **Authentication:** JWT access tokens, bcrypt password hashing, and secure cookie storage where deployment permits. Do not store passwords or raw tokens in logs.
- **Validation:** `zod` or an equivalent schema validator at every untrusted input boundary.
- **Decimal arithmetic:** `decimal.js`.
- **Charts:** a small browser chart library may be used if it is vendored or explicitly documented; otherwise use accessible SVG charts generated by the frontend.
- **PDF:** Puppeteer. Render the same report data through a dedicated print-friendly HTML template, then print to PDF.
- **Security middleware:** `helmet`, rate limiting on authentication and expensive analysis endpoints, strict CORS configuration, and structured error handling.
- **Testing:** Node's built-in test runner or Jest for unit tests; Supertest or equivalent for HTTP integration tests.

Do not substitute the fixed stack without recording a decision and obtaining approval.

---

## 4. Repository Structure

Create this structure before implementing features. Empty placeholder files may contain TODO comments during scaffolding, but no placeholder may be presented as complete functionality.

```text
financial-guidance-app/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── wizard.html
│   │   ├── dashboard.html
│   │   ├── analysis.html
│   │   ├── history.html
│   │   ├── report.html
│   │   └── error.html
│   └── assets/
│       ├── css/
│       │   ├── base.css
│       │   ├── tokens.css
│       │   ├── components.css
│       │   ├── forms.css
│       │   ├── wizard.css
│       │   ├── dashboard.css
│       │   ├── analysis.css
│       │   └── print.css
│       └── js/
│           ├── api/
│           │   ├── client.js
│           │   ├── authApi.js
│           │   ├── profileApi.js
│           │   ├── financialApi.js
│           │   ├── mfApi.js
│           │   ├── analysisApi.js
│           │   └── reportApi.js
│           ├── pages/
│           │   ├── loginPage.js
│           │   ├── registerPage.js
│           │   ├── wizardPage.js
│           │   ├── dashboardPage.js
│           │   ├── analysisPage.js
│           │   ├── historyPage.js
│           │   └── reportPage.js
│           ├── components/
│           │   ├── appShell.js
│           │   ├── formStep.js
│           │   ├── moneyInput.js
│           │   ├── emptyState.js
│           │   ├── errorState.js
│           │   ├── assumptionPanel.js
│           │   ├── metricCard.js
│           │   ├── dataTable.js
│           │   └── charts.js
│           └── utils/
│               ├── formatting.js
│               ├── validation.js
│               ├── storage.js
│               └── accessibility.js
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── auth.routes.js
│   │   │   ├── profile.routes.js
│   │   │   ├── income.routes.js
│   │   │   ├── assets.routes.js
│   │   │   ├── insurance.routes.js
│   │   │   ├── liabilities.routes.js
│   │   │   ├── goals.routes.js
│   │   │   ├── mf.routes.js
│   │   │   ├── analysis.routes.js
│   │   │   ├── report.routes.js
│   │   │   └── admin.routes.js
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── engine/
│   │   │   │   ├── taxEngine.js
│   │   │   │   ├── goalProjection.js
│   │   │   │   ├── corpusProjection.js
│   │   │   │   ├── sipCalculator.js
│   │   │   │   ├── gapAnalysis.js
│   │   │   │   ├── diagnostics.js
│   │   │   │   ├── mfOverlapEngine.js
│   │   │   │   └── financialEngine.js
│   │   │   ├── analysisOrchestrator.js
│   │   │   └── reportService.js
│   │   ├── models/
│   │   ├── middlewares/
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   ├── engineVersion.js
│   │   │   └── assumptionsRepository.js
│   │   ├── jobs/
│   │   │   ├── syncAmfiNav.js
│   │   │   └── syncMfHoldings.js
│   │   ├── db/
│   │   │   ├── pool.js
│   │   │   └── transaction.js
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   │   ├── services/
│   │   ├── api/
│   │   └── fixtures/
│   └── package.json
├── database/
│   ├── migrations/
│   ├── seeds/
│   │   ├── assumptions_fy_2026_27.sql
│   │   └── tax_slabs_fy_2026_27.sql
│   ├── schema.sql
│   └── README.md
├── docs/
│   ├── PROJECT_SPEC.md
│   ├── API_CONTRACT.md
│   ├── CALCULATIONS.md
│   ├── SECURITY.md
│   ├── DECISIONS.md
│   └── TEST_PLAN.md
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

### File ownership rule

A calculation service cannot import a model. A model cannot import a controller. A route cannot contain SQL. A frontend page cannot construct raw authorization headers or duplicate endpoint URLs; it must call an API wrapper. These constraints make the system replaceable and testable.

---

## 5. Domain Model and Database Design

Use UUID primary keys. Use `created_at` and `updated_at` timestamps where a record is mutable. Use `TIMESTAMPTZ` for audit events. Use `NUMERIC(18,2)` for currency and `NUMERIC(12,6)` for rates or percentages where appropriate.

### 5.1 Core tables

```sql
users (
  id UUID PRIMARY KEY,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  dependents INTEGER NOT NULL DEFAULT 0 CHECK (dependents >= 0),
  retirement_age INTEGER NOT NULL CHECK (retirement_age BETWEEN 40 AND 90),
  risk_profile TEXT NOT NULL CHECK (risk_profile IN ('CONSERVATIVE','MODERATE','AGGRESSIVE')),
  city_tier TEXT CHECK (city_tier IN ('TIER_1','TIER_2','TIER_3')),
  monthly_expense NUMERIC(18,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

incomes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,
  gross_annual NUMERIC(18,2) NOT NULL CHECK (gross_annual >= 0),
  net_annual NUMERIC(18,2) CHECK (net_annual >= 0),
  other_income NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (other_income >= 0),
  eligible_deductions NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (eligible_deductions >= 0),
  regime_opted TEXT NOT NULL CHECK (regime_opted IN ('OLD','NEW')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, financial_year)
)

assets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('MF','EQUITY','DEBT','REAL_ESTATE','GOLD','EPF','FD','CASH','OTHER')),
  label TEXT,
  current_value NUMERIC(18,2) NOT NULL CHECK (current_value >= 0),
  annual_contribution NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (annual_contribution >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

insurance_policies (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('TERM','HEALTH','ULIP','ENDOWMENT','OTHER')),
  insurer TEXT,
  sum_assured NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (sum_assured >= 0),
  annual_premium NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (annual_premium >= 0),
  maturity_year INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

liabilities (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loan_type TEXT NOT NULL,
  outstanding NUMERIC(18,2) NOT NULL CHECK (outstanding >= 0),
  emi NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (emi >= 0),
  annual_interest_rate NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK (annual_interest_rate >= 0),
  tenure_months_left INTEGER NOT NULL DEFAULT 0 CHECK (tenure_months_left >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

goals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,
  label TEXT,
  target_amount_today NUMERIC(18,2) NOT NULL CHECK (target_amount_today > 0),
  target_year INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100 CHECK (priority >= 1),
  inflation_key TEXT NOT NULL,
  linked_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

### 5.2 Configuration and market-data tables

```sql
assumption_sets (
  id UUID PRIMARY KEY,
  financial_year TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (financial_year, version)
)

assumptions (
  id UUID PRIMARY KEY,
  assumption_set_id UUID NOT NULL REFERENCES assumption_sets(id),
  assumption_key TEXT NOT NULL,
  numeric_value NUMERIC(18,8),
  text_value TEXT,
  unit TEXT NOT NULL,
  UNIQUE (assumption_set_id, assumption_key)
)

tax_slab_sets (
  id UUID PRIMARY KEY,
  financial_year TEXT NOT NULL,
  regime TEXT NOT NULL CHECK (regime IN ('OLD','NEW')),
  standard_deduction NUMERIC(18,2) NOT NULL,
  rebate_limit NUMERIC(18,2),
  rebate_amount NUMERIC(18,2),
  cess_rate NUMERIC(12,8) NOT NULL,
  source_note TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (financial_year, regime, version)
)

tax_slabs (
  id UUID PRIMARY KEY,
  tax_slab_set_id UUID NOT NULL REFERENCES tax_slab_sets(id) ON DELETE CASCADE,
  slab_from NUMERIC(18,2) NOT NULL,
  slab_to NUMERIC(18,2),
  rate NUMERIC(12,8) NOT NULL,
  CHECK (slab_to IS NULL OR slab_to > slab_from)
)

mf_schemes (
  amfi_code TEXT PRIMARY KEY,
  isin TEXT,
  scheme_name TEXT NOT NULL,
  amc TEXT,
  category TEXT,
  latest_nav NUMERIC(18,6),
  nav_date DATE,
  source_updated_at TIMESTAMPTZ NOT NULL
)

mf_holdings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  amfi_code TEXT NOT NULL REFERENCES mf_schemes(amfi_code),
  units NUMERIC(24,8) NOT NULL CHECK (units >= 0),
  average_cost NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (average_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, amfi_code)
)

mf_scheme_holdings (
  id UUID PRIMARY KEY,
  amfi_code TEXT NOT NULL REFERENCES mf_schemes(amfi_code) ON DELETE CASCADE,
  isin TEXT NOT NULL,
  instrument_name TEXT NOT NULL,
  sector TEXT,
  weight_pct NUMERIC(12,8) NOT NULL CHECK (weight_pct >= 0),
  as_of_date DATE NOT NULL,
  source_file TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (amfi_code, isin, as_of_date)
)
```

### 5.3 Plan snapshots and audit data

```sql
plan_runs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  engine_version TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  assumption_set_id UUID NOT NULL REFERENCES assumption_sets(id),
  tax_slab_set_ids JSONB NOT NULL,
  input_snapshot JSONB NOT NULL,
  output_snapshot JSONB NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (id)
)

refresh_runs (
  id UUID PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  source_url TEXT,
  records_seen INTEGER,
  records_written INTEGER,
  error_summary TEXT
)

audit_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  request_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

### Database requirements

- Add indexes on every foreign-key ownership column, especially `user_id`.
- Add a case-insensitive unique index for email.
- Use transactions for multi-table writes and for snapshot creation.
- Never expose `password_hash`, internal source paths, or raw exception traces through the API.
- Do not use JSONB where a field needs relational constraints, joins, or independent lifecycle management.
- JSONB is appropriate for an immutable input/output snapshot and extensible metadata.

---

## 6. Calculation Engine Contract

The engine is the core intellectual property. It must be independently testable with fixtures and must not know whether its inputs came from PostgreSQL, a request body, a CSV file, or a test.

### 6.1 Shared conventions

- All money values enter and leave the engine as decimal-compatible strings, not JavaScript numbers.
- All rates are decimal fractions: `0.12` means 12%.
- All dates are ISO strings.
- The engine returns a stable result shape with `value`, `unit`, `assumptionKey`, and `explanation` where an output may be misunderstood.
- Negative gaps are normalized to zero shortfall and reported separately as surplus.
- Invalid or incomplete inputs produce typed validation errors. They do not silently default to zero.
- Every output includes the assumptions used and the calculation period.

### 6.2 Tax engine

Recommended pure function:

```js
calculateTax({
  grossIncome,
  otherIncome,
  eligibleDeductions,
  capitalGains,
  regime,
  taxRuleSet
})
```

The rule set contains the selected financial year's slab rows, standard deduction, rebate policy, cess rate, surcharge policy, and special treatment for capital gains. The function must separate ordinary slab income from capital gains. Section 87A handling must not be applied indiscriminately to capital gains.

Core flow:

```text
taxableNormalIncome = max(0, grossIncome + otherIncome
                              - standardDeduction
                              - eligibleDeductions)
normalIncomeTax = applySlabs(taxableNormalIncome, slabRows)
rebate = calculateEligibleRebate(normalIncomeTax, taxableNormalIncome, ruleSet)
relief = calculateMarginalRelief(...)
capitalGainsTax = calculateCapitalGainsTax(capitalGains, ruleSet)
subtotal = max(0, normalIncomeTax - rebate - relief) + capitalGainsTax
cess = subtotal × cessRate
totalTax = subtotal + cess + surcharge
```

The actual legal rules must be verified against authoritative current sources before seeding a financial year. The specification deliberately does not treat pasted tax figures as automatically authoritative.

Tests must cover:

- income below the first slab;
- income exactly on every slab boundary;
- income just above a rebate boundary;
- standard deduction;
- eligible deductions in the old regime;
- capital gains excluded from normal-income rebate logic;
- cess applied after eligible reductions;
- marginal relief at the boundary;
- zero and invalid income;
- old versus new regime comparison.

### 6.3 Goal projection

```text
yearsToGoal = targetYear - currentYear
futureGoalValue = amountToday × (1 + inflationRate) ^ yearsToGoal
```

Use a decimal power operation or a carefully documented conversion strategy. If the target year is in the past, return a validation error. If it is the current year, the inflation multiplier is one.

Each goal must carry the inflation assumption key used, not only the numeric value. The output must show both today's amount and the future amount.

### 6.4 Retirement corpus

Retirement is a decumulation problem, not merely another lump-sum goal. The engine must model an annual retirement expense stream using a real return where the assumption set provides sufficient information.

```text
realRate = ((1 + postRetirementReturn) / (1 + inflationRate)) - 1
corpus = annualExpenseAtRetirement
          × (1 - (1 + realRate)^(-yearsInRetirement)) / realRate
```

When `realRate` is zero, use the limiting case `annualExpenseAtRetirement × yearsInRetirement`. Document whether withdrawals occur at the beginning or end of each period. The UI must state that the result is an estimate sensitive to lifespan, inflation, returns, and withdrawal assumptions.

### 6.5 Existing corpus projection

```text
futureValue(asset) = currentValue × (1 + expectedAnnualReturn) ^ years
futureCorpus = sum(futureValue(asset) for each asset)
```

Asset-class assumptions are configuration data. A goal may use either explicitly linked assets or a documented allocation rule. The engine must not allocate the same asset to multiple goals without recording that allocation. If allocation is ambiguous, return a warning and use only explicitly linked assets.

### 6.6 Gap and SIP

```text
gap = max(0, futureGoalValue - futureAllocatedCorpus)
surplus = max(0, futureAllocatedCorpus - futureGoalValue)
```

For a monthly contribution model, define the convention explicitly. If contributions occur at the beginning of each month, use the annuity-due formula:

```text
monthlyRate = annualRate converted to a monthly effective rate
months = yearsToGoal × 12
sip = gap × monthlyRate /
      (((1 + monthlyRate)^months - 1) × (1 + monthlyRate))
```

If `monthlyRate` is zero, use `gap / months`. If the product later chooses end-of-month contributions, change the formula and version the engine. Do not label an annuity-due result as an ordinary annuity.

### 6.7 Mutual-fund overlap

Holdings are matched by normalized ISIN, never by display name. The weighted overlap between two funds is:

```text
overlapPct = sum(min(weightInFundA[isin], weightInFundB[isin]))
             for every common ISIN
```

For a user's portfolio, calculate pairwise overlap and an aggregate view with a documented aggregation method. Do not imply that pairwise percentages can be simply added.

Interpretation thresholds are configuration data. The initial display labels are:

- below 30%: healthy;
- 30% through below 50%: watch;
- 50% or above: high redundancy.

The report must show the data date and source date because holdings are periodic, not real-time.

### 6.8 Diagnostics

Diagnostics are rule-based observations, not investment instructions. Each diagnostic has:

```json
{
  "code": "INSURANCE_COVER_LOW",
  "severity": "WARNING",
  "title": "Life cover may be below the configured reference range",
  "evidence": { "currentCover": "...", "referenceLowerBound": "..." },
  "assumptionKeys": ["termCoverIncomeMultiple"],
  "explanation": "...",
  "nextStep": "Review the cover with a qualified adviser."
}
```

Minimum diagnostic rules:

- **Net worth:** assets minus liabilities. Never display gross assets as net worth.
- **Emergency fund:** compare liquid assets with the configured multiple of monthly essential expenses. Initial reference: six months, clearly labeled as a configurable rule of thumb.
- **Insurance adequacy:** compare term cover with a configured income multiple. Do not count ULIP or endowment sum assured as equivalent to pure term cover without a visible qualification.
- **Asset allocation:** compare current allocation with the risk-profile reference band. Show the band and the source assumption.
- **MF overlap:** show pairwise overlap and affected common holdings.
- **Debt load:** compare EMI or debt service with income using a configured diagnostic threshold.
- **Goal prioritization:** allocate or explain shortfalls in priority order without claiming that priority is objectively correct.

---

## 7. Configuration and Versioning

### 7.1 What “dynamic” means

The system must not attempt to discover tax law from a fictional real-time government feed. Dynamic means that the application reads rules from versioned data and an authorized administrator can add a new financial-year set without redeploying calculation code.

Every configuration record needs:

- financial year or effective period;
- version number;
- status (`DRAFT`, `ACTIVE`, or `RETIRED`);
- source note and review date;
- explicit units;
- validation rules;
- who created or activated it, if admin identity exists.

### 7.2 Admin behavior

Implement protected admin endpoints only after the basic user flow is stable. Admins can create a draft set, validate it, preview its impact on fixtures, and activate it. Activation must be auditable and must not mutate historical snapshots.

Suggested endpoints:

- `GET /api/admin/config/:financialYear`
- `POST /api/admin/config/:financialYear/draft`
- `POST /api/admin/config/:financialYear/validate`
- `POST /api/admin/config/:financialYear/activate`

The admin surface must reject overlapping active periods, invalid slab gaps, negative rates, and missing sources.

---

## 8. External Data Ingestion

### 8.1 AMFI NAV data

Implement `syncAmfiNav.js` as an idempotent worker. It should:

1. download the configured public source;
2. record the URL, retrieval time, checksum, and response status;
3. parse into a normalized staging structure;
4. validate codes, names, dates, and NAV values;
5. upsert schemes and NAV values in a transaction;
6. record counts and failures in `refresh_runs`;
7. leave the last known good data intact if the import fails.

### 8.2 Scheme holdings

Holdings files may differ by asset-management company. Use an adapter interface:

```js
parseHoldingsFile({ buffer, sourceFile, amc }): {
  records: [{ amfiCode, isin, instrumentName, sector, weightPct, asOfDate }],
  warnings: []
}
```

Do not let parser-specific code leak into the overlap engine. Reject or quarantine rows without an ISIN. Preserve source file metadata and `as_of_date`.

### 8.3 Refresh safety

Workers must be repeatable. They must not duplicate records when run twice. They must use timeouts, bounded retries, and clear error messages. They must never replace valid production data with an empty import caused by a parser regression.

---

## 9. API Contract

All JSON responses use this envelope unless a file stream is being returned:

```json
{ "data": {}, "error": null, "meta": { "requestId": "..." } }
```

Errors use:

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "fields": { "targetYear": "Must be the current year or later." }
  },
  "meta": { "requestId": "..." }
}
```

### 9.1 Authentication

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create an account. Validate email and password policy. |
| POST | `/api/auth/login` | No | Issue an access token or secure cookie. |
| POST | `/api/auth/logout` | Yes | Revoke or clear the session according to the selected token strategy. |
| GET | `/api/auth/me` | Yes | Return the current user's safe identity. |

### 9.2 Profile and financial data

| Method | Route | Auth | Frontend caller |
|---|---|---|---|
| GET/PUT | `/api/profile` | Yes | `wizardPage.js` |
| GET/PUT | `/api/income` | Yes | `wizardPage.js` |
| GET/POST/PUT/DELETE | `/api/assets` | Yes | `wizardPage.js` |
| GET/POST/PUT/DELETE | `/api/insurance` | Yes | `wizardPage.js` |
| GET/POST/PUT/DELETE | `/api/liabilities` | Yes | `wizardPage.js` |
| GET/POST/PUT/DELETE | `/api/goals` | Yes | `wizardPage.js` |

Each write route validates the body, derives `userId` from authentication, writes within a transaction when necessary, and returns the normalized saved record. Delete operations require the resource ID in the URL and return `204` or a consistent JSON success response.

### 9.3 Mutual-fund routes

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/mf/schemes?search=` | Yes | Autocomplete by scheme name, AMC, code, or ISIN. |
| GET | `/api/mf/schemes/:amfiCode` | Yes | Show current scheme metadata and data date. |
| GET | `/api/mf/holdings` | Yes | List the user's MF holdings. |
| POST/PUT/DELETE | `/api/mf/holdings` | Yes | Manage holdings linked to an asset. |
| GET | `/api/mf/overlap` | Yes | Run the overlap engine using the latest available holdings data. |

### 9.4 Analysis and reports

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/analysis/run` | Yes | Load the user's current data, resolve configuration, run the pure engine, and create one immutable plan snapshot. |
| GET | `/api/analysis/history` | Yes | List historical snapshot summaries, newest first. |
| GET | `/api/analysis/:planRunId` | Yes | Return one immutable snapshot owned by the user. |
| GET | `/api/report/:planRunId/pdf` | Yes | Render and stream the selected snapshot as a PDF. |

`POST /api/analysis/run` must accept a small options object, such as the target financial year or scenario overrides. It must not accept arbitrary output values. The server is the authority for loaded user data and active configuration.

Example analysis response shape:

```json
{
  "planRun": {
    "id": "uuid",
    "runAt": "2026-09-21T00:00:00.000Z",
    "engineVersion": "1.0.0",
    "financialYear": "2026-27"
  },
  "summary": {
    "netWorth": "...",
    "annualSavings": "...",
    "selectedRegimeTax": "...",
    "recommendedRegime": "OLD",
    "totalFutureGoalValue": "...",
    "totalProjectedCorpus": "...",
    "totalShortfall": "..."
  },
  "goals": [],
  "diagnostics": [],
  "assumptions": [],
  "provenance": []
}
```

---

## 10. Frontend Experience

### 10.1 Design principles

The interface should feel calm, precise, and trustworthy. Use a restrained financial-product visual language: strong hierarchy, generous whitespace, high-contrast text, clear units, and restrained color. Do not use decorative gradients or animations that compete with the numbers.

Every monetary value must show INR formatting and its period. Every percentage must show whether it is annual, monthly, a portfolio weight, or an overlap percentage. A chart must have an equivalent accessible data table or summary.

### 10.2 Wizard steps

1. **Personal profile:** name, date of birth, dependents, retirement age, risk profile, city tier, monthly essential expenses.
2. **Income and tax:** financial year, gross income, other income, deductions, selected regime.
3. **Assets:** asset class, current value, annual contribution, optional label, MF linkage.
4. **Insurance and liabilities:** policies, cover, premiums, loans, outstanding balances, EMI, rate, tenure.
5. **Goals:** type, label, amount in today's rupees, target year, priority, linked assets.
6. **Assumptions review:** display all active assumptions and their source dates. Allow scenario overrides only where the product explicitly supports them.
7. **Review and run:** show missing fields, warnings, net-worth preview, and a clear “Run analysis” action.

Use step-wise autosave. A failed autosave must be visible and retryable. Preserve draft state on navigation and reload. Do not mark a step complete merely because the user clicked Next; mark it complete only after validation and a successful save.

### 10.3 Dashboard

The dashboard is a summary of a selected plan snapshot, not a second calculation engine. It should include:

- net worth and liquidity cards;
- income, tax, spending, and savings distribution;
- asset allocation by current value;
- goal funding table with future value, projected funding, shortfall, and SIP;
- high-priority diagnostics;
- timestamp, financial year, engine version, and assumptions link;
- actions to open analysis, history, or PDF report.

### 10.4 Analysis page

The analysis page explains the result in this order:

1. What is funded and what is short.
2. Which goals create the largest shortfalls.
3. What monthly contribution is indicated under the selected assumptions.
4. What structural diagnostics need review.
5. Which assumptions most affect the result.
6. What the product does not know and what a qualified professional should review.

Avoid a single red “failure” score. Use severity, evidence, and a next-step explanation.

### 10.5 Accessibility and resilience

- Use semantic headings and labels.
- Support keyboard navigation and visible focus.
- Use `aria-live` for autosave and analysis status.
- Do not rely on color alone for severity.
- Handle empty, loading, error, and stale-data states.
- Render a usable layout on mobile widths.
- Ensure the PDF report remains legible in grayscale.

---

## 11. Security, Privacy, and Compliance Boundaries

This product handles personally identifiable information and financial information. Security is a release requirement, not a later enhancement.

### Required controls

- Hash passwords with bcrypt using a cost factor appropriate for deployment.
- Validate and normalize email addresses.
- Use short-lived access tokens and a safe refresh strategy if refresh tokens are added.
- Set secure, HTTP-only, same-site cookies where applicable.
- Configure CORS to explicit allowed origins.
- Add `helmet` and rate limiting.
- Use parameterized SQL only.
- Redact passwords, tokens, PAN, and sensitive financial payloads from logs.
- Encrypt sensitive fields at rest if the deployment environment supports field-level encryption.
- Do not store PAN in plaintext unless a future approved requirement establishes a compliant need.
- Add audit events for login, logout, profile changes, analysis runs, configuration activation, and report generation.
- Return generic authentication errors to prevent account enumeration.
- Apply resource ownership checks to every read, update, delete, and report request.
- Set request body limits and timeouts.
- Scan dependencies and keep secrets in environment variables.

### Regulatory boundary

If the product begins making personalized security-specific recommendations, the legal and regulatory scope may change. Until that scope is reviewed, use language such as **indicative**, **estimated**, **under the selected assumptions**, and **review with a qualified adviser**. Do not use “guaranteed,” “assured return,” or “will achieve.”

---

## 12. PDF Report Requirements

The PDF is a rendered representation of an immutable plan snapshot. It must never recalculate using today's assumptions.

Required sections:

1. Client and report metadata.
2. Important limitations and educational-use disclaimer.
3. Financial snapshot: income, savings, assets, liabilities, and net worth.
4. Tax comparison and selected regime assumptions.
5. Goal-by-goal future value, projected corpus, gap, and indicative SIP.
6. Diagnostic findings with severity and evidence.
7. Mutual-fund overlap details and holdings data date, when available.
8. Assumptions and sources.
9. Engine version, financial year, plan ID, and generation timestamp.

Use Puppeteer to open a report URL that is authorized for the selected plan ID. The report route must pass a server-side snapshot to the template or load it through an internal trusted path. It must not trust client-supplied output JSON.

---

## 13. Build Sequence for Antigravity

Work in this order. Each phase ends with tests, a short change summary, and a manual test checklist. Do not silently skip ahead.

### Phase 1 — Scaffold and local runtime

Create the repository structure, package files, environment example, Docker Compose PostgreSQL service, health endpoint, frontend shell, lint/test commands, and README run instructions.

**Acceptance:** the app starts locally, the database connection is validated, `/api/health` returns success, and the frontend shell loads.

### Phase 2 — Migrations and seed data

Create SQL migrations, constraints, indexes, seed data for a clearly labeled financial year, configuration validation, and a repeatable migration command.

**Acceptance:** a fresh database can be created from zero; migrations are idempotent or fail clearly; seeds can be rerun safely; no money column uses floating-point types.

### Phase 3 — Pure calculation engine

Implement the engine modules and fixtures before adding database calls. Add unit tests for boundary conditions, invalid inputs, decimal behavior, goal projections, retirement, corpus allocation, SIP, diagnostics, and overlap.

**Acceptance:** the service tests pass without starting Express or PostgreSQL. The test output must include coverage for all formula branches.

### Phase 4 — Authentication

Implement registration, login, logout, current-user endpoint, password hashing, JWT/session handling, middleware, rate limiting, and ownership helpers.

**Acceptance:** a user can register and log in; invalid credentials are handled safely; protected endpoints reject unauthenticated requests; user A cannot access user B's resources.

### Phase 5 — CRUD API

Implement profile, income, assets, insurance, liabilities, and goals models, controllers, routes, validators, and integration tests.

**Acceptance:** every endpoint has a matching API wrapper and a browser test path; invalid values return structured errors; writes are scoped to the authenticated user.

### Phase 6 — AMFI data ingestion and MF APIs

Implement the source adapters, idempotent workers, refresh-run logging, scheme search, holdings management, and overlap route.

**Acceptance:** a fixture import works without the public network; a repeated import does not duplicate data; malformed files are quarantined; the overlap endpoint reports its data date.

### Phase 7 — Analysis orchestration and immutable snapshots

Load current data, resolve the active configuration, map database records to engine input DTOs, run the pure engine, and persist a single immutable snapshot in a transaction.

**Acceptance:** the analysis response and stored output match; a later configuration change does not change an old snapshot; the history and detail routes are ownership-safe.

### Phase 8 — Wizard frontend

Build the multi-step form, validation, autosave, draft recovery, API integration, assumptions review, loading states, and accessible errors.

**Acceptance:** a new user can complete the entire wizard in a browser and return to a saved draft without losing data.

### Phase 9 — Dashboard and analysis frontend

Render summary cards, accessible tables, charts, diagnostics, assumptions, history, and snapshot navigation. Use only API response data; do not duplicate formulas in the browser.

**Acceptance:** the frontend numbers match the API response and the PDF data. Empty and error states are usable.

### Phase 10 — PDF report

Implement the report template, print styles, route authorization, snapshot rendering, and a browser download action.

**Acceptance:** the PDF contains the plan ID, date, engine version, assumptions, calculations, diagnostics, and disclaimer, and it remains readable when printed.

### Phase 11 — Security and release hardening

Run dependency checks, route authorization review, input fuzzing for important validators, rate-limit tests, log-redaction checks, and production configuration review.

**Acceptance:** no secret is committed; security tests pass; errors do not expose stack traces or sensitive payloads; the README describes deployment configuration.

---

## 14. Testing Strategy

### Unit tests

The highest priority is the pure engine. Tests must assert exact decimal strings or a documented precision rule. Include property-style tests where practical, such as non-negative tax, non-negative SIP, and monotonic future value when positive rates and time increase.

### Integration tests

Use a disposable test database. Test migrations, ownership, validation, authentication, transactions, analysis persistence, history, and report authorization.

### Contract tests

For every API route, verify method, status code, response envelope, validation errors, authentication behavior, and ownership behavior. For every frontend API wrapper, verify the route and HTTP method match `docs/API_CONTRACT.md`.

### Manual smoke test

1. Register a user.
2. Complete the profile step.
3. Enter income and compare tax regimes.
4. Add an asset and a liability; confirm net worth is assets minus liabilities.
5. Add an education goal and a retirement goal.
6. Review assumptions and run analysis.
7. Confirm the dashboard and analysis pages show the same plan ID.
8. Change active assumptions in a test environment and rerun analysis.
9. Open the old plan and confirm it has not changed.
10. Download the old plan PDF and confirm its assumptions and engine version are preserved.
11. Log in as a second user and confirm no first-user data is visible.

---

## 15. Agent Operating Protocol

Antigravity agents must follow these rules while implementing:

- Read this file before changing code.
- Before each phase, state the phase objective and the files it will change.
- Do not create speculative abstractions that are not required by the current phase.
- Keep commits or checkpoints small and named by phase.
- After each phase, run the relevant tests and update the README or phase log.
- Never mark a TODO complete without either a test or a manual verification step.
- If an external source is unavailable, use a fixture and mark the data as fixture data. Do not silently substitute invented production data.
- If a formula or legal rule is uncertain, isolate it in versioned configuration, add a warning, and document the uncertainty in `docs/CALCULATIONS.md`.
- Never implement a browser-only calculation that the server does not also own.
- Never alter a completed plan snapshot to “fix” a new calculation. Create a new run.

A phase is complete only when its acceptance criteria, automated tests, and manual checklist are present.

---

## 16. Required Companion Documents

The project must maintain these documents alongside this specification:

- `docs/API_CONTRACT.md`: endpoint-by-endpoint request and response schemas, status codes, auth rules, and frontend caller.
- `docs/CALCULATIONS.md`: formulas, units, rounding policy, configuration keys, edge cases, and source notes.
- `docs/SECURITY.md`: threat model, token strategy, ownership checks, logging policy, deployment secrets, and incident response notes.
- `docs/TEST_PLAN.md`: test commands, fixtures, coverage expectations, browser smoke tests, and release checklist.
- `docs/DECISIONS.md`: material architecture decisions, alternatives considered, date, owner, and consequence.

These documents are not optional commentary. They are part of the implementation surface and must be kept synchronized with code.

---

## 17. Definition of Done

The product is ready for a first controlled demonstration when:

- all v1 user journeys work from a fresh database;
- the engine is pure and independently tested;
- no financial assumption is hidden inside calculation code;
- every plan snapshot is reproducible from its stored input, configuration, and engine version;
- all authenticated data access is ownership-scoped;
- the wizard autosaves and recovers drafts;
- the dashboard, analysis page, and PDF agree on the same snapshot;
- AMFI imports are idempotent and data dates are visible;
- tax and regulatory claims are documented and reviewed before production use;
- security controls and error handling are tested;
- the README explains setup, migration, seed, test, worker, and production commands;
- the open questions at the top of this document have either been answered or remain safely isolated behind configuration.

The quality bar is **trustworthy, explainable, reproducible, and maintainable**. Visual polish is valuable, but it must never hide a calculation, assumption, data-provenance, or security weakness.

---

## References

[1]: https://www.incometax.gov.in/ "Income Tax Department of India"

[2]: https://www.amfiindia.com/ "Association of Mutual Funds in India"

[3]: https://www.sebi.gov.in/ "Securities and Exchange Board of India"

[4]: https://nodejs.org/en/docs "Node.js Documentation"

[5]: https://expressjs.com/ "Express Documentation"

[6]: https://www.postgresql.org/docs/ "PostgreSQL Documentation"

[7]: https://pptr.dev/ "Puppeteer Documentation"

[8]: https://developer.mozilla.org/en-US/docs/Web/Accessibility "MDN Web Accessibility Documentation"
