🌐 [한국어](./README_ko.md) | [English](./README.md)

# AI BI Assistant

> Automated production anomaly detection + AI-powered analysis + Power BI dashboard

## Overview

Manufacturing sites rely on manual monitoring to catch production issues — delays, defect spikes, equipment failures — often after the damage is done. This system automates the entire loop: it monitors hourly production data from Google Sheets, detects anomalies using config-driven rules, classifies patterns (new / recurring / worsening), calls Claude API for root cause analysis on critical cases, sends email alerts with severity-based routing, and presents everything on a Power BI dashboard.

Built as a portfolio/demo project. Core logic (anomaly detection, AI analysis, alerting, dashboard) is production-grade. Authentication, multi-user, and ops layers are documented but not implemented (see [Production Deployment Guide](#documents)).

## Table of Contents

- [Operation Flow](#operation-flow)
- [Technology Stack](#technology-stack)
- [AI Components](#ai-components)
- [Reliability](#reliability)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Current Status](#current-status)
- [Documents](#documents)
- [Limitations](#limitations)
- [Future Plans](#future-plans)

## Operation Flow

```
Google Sheets (hourly production data, appended externally)
  → n8n self-hosted via npm (60-min schedule / Webhook for testing)
    → JavaScript anomaly detection (Config-driven: rules.json + engine.js)
      → JavaScript pattern classification (rule-based, local)
        → Claude API (critical/worsening cases only, masked data)
          → Gmail alerts (critical+moderate: immediate / all: daily report at 07:40)
            → Google Sheets result storage
              → Power BI Service dashboard (CSV Publish + Web connector, 8x/day refresh)
```

## Technology Stack

| Technology | Role | Why |
|---|---|---|
| Google Sheets | Data storage (all input/output) | Free, service account API integration stable; switched from OneDrive Excel due to OAuth2 credential issues |
| n8n (npm self-hosted) | Workflow orchestration | Free, runs without Docker/WSL2; 4 workflows (simulator, monitor, weekly backup, daily report) |
| JavaScript (n8n Code node) | Anomaly detection + pattern classification | npm-installed n8n supports JS natively; standard math operations sufficient for demo scale |
| Claude API (Anthropic) | AI root cause analysis + pattern verification | Called only for critical/worsening cases; masked data for security; ~$1-3/month |
| Claude API Tool Use | AI Agent daily report (Workflow D) | Agent autonomously queries data and adjusts report depth by severity; ~+$0.2-0.5/month |
| Gmail (n8n node) | Email alerts (immediate + daily report) | Free, n8n native integration |
| Power BI Pro (E3) | Dashboard + AI visualizations | Key Influencers, Decomposition Tree, Smart Narrative; connects via CSV Publish + Web connector |
| googleapis + google-auth-library | Data generation scripts | Service account authentication for initial data setup |

## AI Components

This project uses AI at three distinct layers, each with a different role:

### Layer 1 — JavaScript Anomaly Detection (Local, no AI)

Config-driven engine (`rules.json` + `engine.js`) evaluates 8 detection rules x 3 severity levels against hourly production data. Runs entirely in n8n Code nodes — no external API calls, zero cost.

| # | Detection Rule | Comparison Type | Critical | Moderate | Low |
|---|---|---|---|---|---|
| 1 | Production drop | drop_rate | 40%+ | 20-40% | 5-20% |
| 2 | Operation rate decline | below_threshold | <30% | 30-50% | 50-70% |
| 3 | Defect rate spike | exceeds_baseline | 5x+ normal | 3-5x | 2-3x |
| 4 | Achievement delay | below_threshold | gap -30%p+ | -15~-30%p | -5~-15%p |
| 5 | Production halt | consecutive_zero | 3h+ zeros | 2h | 1h |
| 6 | Scrap occurrence | above_threshold | 3%+ | 1-3% | <1% |
| 7 | Compound anomaly | compound (AND) | 30%↓+3x↑ | 15%↓+2x↑ | 5%↓+1.5x↑ |
| 8 | Operation rate plunge | drop_points | 50%p+ drop | 30-50%p | 15-30%p |

### Layer 2 — JavaScript Pattern Classification (Local, no AI)

Queries `anomaly_log` for the past 7 days to classify each anomaly:
- **New**: 0 prior occurrences of same line + type
- **Recurring**: 1-2 prior occurrences
- **Worsening**: 3+ occurrences or severity escalation trend

Low-severity anomalies classified as "worsening" are escalated to critical.

### Layer 3 — Claude API Analysis (Critical/Worsening only)

- Multiple critical+worsening cases are batched into a single API call
- Data is masked before sending (line names → `LINE_A`, products → `PROD_01`)
- AI verifies pattern classification ("agree" or "correction + reason")
- AI generates root cause suggestions and cross-line impact analysis
- Response parsed as JSON; fallback to raw text on parse failure (`ai_parsed` column tracks this)

### Layer 4 — AI Agent Daily Report (Workflow D, Tool Use)

Claude API Agent with 4 tools autonomously queries data and generates daily reports:
- `get_anomaly_log`: Query anomaly history by date/severity/line
- `get_daily_summary`: Query daily summaries by date/team
- `get_line_master`: Query line/team configuration
- `get_hourly_detail`: Query hourly production detail by date/line

The Agent adjusts report depth based on severity: brief (0 critical) → standard (1-2 critical) → detailed with trend analysis (3+ critical or worsening trend). Max 8 tool calls per run, with fallback to fixed-format report on failure.

### Data Security

| Level | Description | Data Sent Externally |
|---|---|---|
| Level 1 (Basic) | Aggregate numbers only | Numbers only, no names |
| Level 1+ (Recommended) | Masking — names replaced with codes | Masked codes only |
| Level 2 (Option) | Template mode — no LLM | None |
| Level 3 (Extension) | Local LLM via Ollama | None |

## Reliability

### Duplicate Prevention

- **idempotency_key**: `{lineID}_{ruleID}_{date}_{hour}` — prevents duplicate anomaly records on re-execution
- **run_id**: `B_{date}_{time}` — traces all records from a single workflow execution; joins anomaly_log and error_log

### Alert Deduplication

- **Critical**: Re-alert after 60 minutes (next cycle) if unresolved
- **Moderate**: Once per cycle
- **Low**: No email (log only, included in daily report)
- Tracked via n8n Static Data with `{lineID}_{anomalyType}` keys

### Notification Tracking

`notification_status` column in anomaly_log: `pending` → `sent` / `failed` / `skipped`
- Power BI filters for unsent alerts (`failed`) for manual follow-up

### Error Handling (7 error points)

| Error Point | Response |
|---|---|
| Google Sheets read failure | Log to error_log → terminate (retry next cycle) |
| Data validation (null/missing lines) | Exclude affected lines → alert user → continue with valid lines |
| Detection calculation error | Skip that rule only → continue remaining rules |
| Google Sheets write failure | Retry 2x (10s interval) → still send email if write fails |
| Claude API failure | Retry 1x (15s) → fallback template message |
| AI response parse failure | Store raw text in ai_insight, mark ai_parsed=false |
| Gmail send failure | Retry 2x (10s) → update notification_status to "failed" |

## Quick Start

### Prerequisites

- Node.js v18+
- Google account (Google Sheets, Google Cloud Console)
- Google Cloud service account key (`config/credentials.json`)
- n8n (`npm install -g n8n`)

### Installation

```bash
git clone https://github.com/SoyeonAhn3/ai_production_monitor.git
cd ai_production_monitor
npm install
```

### Google Sheets Setup

1. Create 4 Google Sheets:
   - `production_week` (1 tab)
   - `production_results` (4 tabs: hourly_summary, anomaly_log, daily_summary, error_log)
   - `line_master` (1 tab)
   - `data_bank` (1 tab)
2. Share each sheet with the service account email (from `credentials.json` → `client_email`) as Editor
3. Copy each Spreadsheet ID into `config/sheets_config.json`

### Data Generation

```bash
node scripts/generate_line_master.js    # 12 lines, 3 teams
node scripts/generate_data_bank.js      # 120 rows (12 lines x 10 hours) + 5 anomaly scenarios
node scripts/generate_empty_files.js    # Headers for production_week + production_results
```

### n8n Setup

```bash
n8n start    # http://localhost:5678
```

1. Create Google Sheets OAuth2 credential in n8n (separate from service account)
2. Import `n8n/workflow_a_simulator.json`
3. Connect credential to Google Sheets nodes
4. Activate workflow → visit `http://localhost:5678/webhook/simulate` to test

## Project Structure

```
ai_production_monitor/
├── config/
│   ├── credentials.json          # Google service account key (.gitignore)
│   └── sheets_config.json        # Spreadsheet ID mapping for all 4 sheets
├── scripts/
│   ├── google_auth.js            # Google Sheets API auth helper (service account)
│   ├── generate_line_master.js   # Line/team master data (12 lines, 3 teams)
│   ├── generate_data_bank.js     # Demo data with 5 anomaly scenarios (120 rows)
│   └── generate_empty_files.js   # Headers for production_week + production_results
├── n8n/
│   └── workflow_a_simulator.json # Test simulator workflow (12 nodes)
├── Phase/
│   ├── Phase1_환경구축_데이터.md    # Environment setup + data (Phase 1)
│   ├── Phase2_이상탐지_AI연동.md   # Anomaly detection + AI (Phase 2)
│   ├── Phase3_PowerBI_대시보드.md  # Power BI dashboard (Phase 3)
│   └── Phase4_통합테스트_완성.md    # Integration test + completion (Phase 4)
├── pre-requirement/
│   ├── pre-requirement.txt       # Project specification v3.0
│   └── ai.md                     # AI expansion strategy document
├── package.json
└── README.md
```

### Google Sheets Structure

| Sheet | Tab(s) | Purpose |
|---|---|---|
| production_week | production_week | Weekly raw data (25 columns, up to ~720 rows) |
| production_results | hourly_summary, anomaly_log, daily_summary, error_log | Analysis results (4 tabs) |
| line_master | line_master | Line/team config — Single Source of Truth |
| data_bank | data_bank | Demo data (12 lines x 10 hours, 5 anomaly scenarios) |

## Current Status

| Phase | Status | Deliverable |
|---|---|---|
| Phase 1 — Environment + Data | ✅ Done | n8n self-hosted, Google Sheets 4 sheets, data scripts, Workflow A simulator tested |
| Phase 2 — Anomaly Detection + AI | ✅ Done | rules.json + engine.js, validator, classifier, masker, Claude API integration, email alerts, Workflow B/D, AI Agent daily report, unit tests |
| Phase 3 — Power BI Dashboard | 📋 Planned | 3-page dashboard + AI visualizations (Key Influencers, Decomposition Tree, Smart Narrative) |
| Phase 4 — Integration Test + Completion | 📋 Planned | 10-hour scenario test, weekly backup (Workflow C), portfolio documentation |

## Documents

| Document | Description |
|---|---|
| [pre-requirement.txt](pre-requirement/pre-requirement.txt) | Project specification v3.0 — architecture, data structures, detection rules, workflows, error handling |
| [ai.md](pre-requirement/ai.md) | AI expansion strategy — Agent patterns, Sub-Agent architecture, cost analysis |
| [Phase 1](Phase/Phase1_환경구축_데이터.md) | Environment setup + data generation details |
| [Phase 2](Phase/Phase2_이상탐지_AI연동.md) | Anomaly detection + AI integration plan |
| [Phase 3](Phase/Phase3_PowerBI_대시보드.md) | Power BI dashboard design |
| [Phase 4](Phase/Phase4_통합테스트_완성.md) | Integration testing + completion plan |

## Limitations

- **Local only**: n8n runs on localhost:5678 (no cloud deployment)
- **No tests**: No automated test suite; verification is manual via simulator
- **Demo data**: 12 lines, 3 teams, 1-day data bank; not connected to real MES/ERP
- **No authentication**: n8n UI, Google Sheets access are unprotected
- **Single user**: No multi-user or multi-factory support
- **Public CSV links**: Google Sheets "Publish to web" for Power BI connection exposes data URLs (acceptable for demo/portfolio data)

## Future Plans

- **Phase 3**: Power BI 3-page dashboard with AI visualizations, auto-refresh 8x/day via Gateway
- **Phase 4**: End-to-end 10-hour scenario test, weekly backup automation, portfolio documentation
- **Data source migration**: OneDrive Excel conversion guide included in spec (Section 16) for enterprise deployment

---

<p align="center">Made with AI-assisted development</p>
