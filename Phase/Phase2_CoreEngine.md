# Phase 2 — Core Engine `✅ Completed`

> Implement a config-driven anomaly detection engine, integrate AI analysis and pattern classification, and complete the core analysis pipeline. Apply the AI Agent pattern to the daily report (Workflow D) for autonomous analytical reporting.

**Completed**: 2026-05-08
**Status**: ✅ Completed
**Prerequisites**: Phase 1 completion (n8n + Google Sheets + Workflow A/B basic structure)

---

## Overview

This phase implements the project's core business logic. Develop a config-driven anomaly detection engine based on rules.json + engine.js, and implement a hybrid structure of JavaScript first-pass pattern classification → Claude API second-pass verification/analysis. Update Workflow B (monitor) to its complete form including masking, duplicate alert prevention, error handling, and email alerts. Additionally, apply the AI Agent pattern to Workflow D (daily report), where AI autonomously queries data using Tool Use and generates reports with adaptive depth based on the situation.

---

## Deliverables

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Claude Code Skill `/rules-gen` development | ✅ Completed | config/rules.json created directly (8 rules × 3 levels, 123 lines) |
| 2 | Config-driven anomaly detection (rules.json + engine.js) | ✅ Completed | src/detection/engine.js (294 lines) + config/rules.json |
| 3 | Data validation logic | ✅ Completed | src/detection/validator.js (139 lines) + src/n8n_nodes/code1_validate.js |
| 4 | JavaScript pattern first-pass classification | ✅ Completed | src/detection/classifier.js (91 lines) + src/n8n_nodes/code3_classify.js |
| 5 | Masking logic | ✅ Completed | src/detection/masker.js (50 lines) + src/n8n_nodes/code4_mask_prompt.js |
| 6 | Claude API analysis + pattern second-pass verification | ✅ Completed | src/n8n_nodes/code4_mask_prompt.js + code5_parse_email.js |
| 7 | Email alerts (severity-based routing) | ✅ Completed | src/n8n_nodes/code5_parse_email.js (severity-based HTML) |
| 8 | Duplicate alert prevention (Static Data) | ✅ Completed | src/n8n_nodes/code3_classify.js (n8n Static Data) |
| 9 | Error handling (7 error points) | ✅ Completed | try-catch per rule, retry logic in workflow nodes |
| 10 | Google Sheets auto-save | ✅ Completed | workflow_b_monitor.json (hourly_summary + anomaly_log nodes) |
| 11 | Workflow B updated JSON regeneration | ✅ Completed | n8n/workflow_b_monitor.json (675 lines, full pipeline) |
| 12 | AI Agent tool functions (Workflow D) | ✅ Completed | src/n8n_nodes/d_code1_prepare.js (4 tools defined) |
| 13 | Claude Code Skill `/agent-prompt` development | ✅ Completed | config/agent_prompt.md created directly |
| 14 | AI Agent System Prompt + loop implementation | ✅ Completed | src/n8n_nodes/d_code2_agent_loop.js (max 8 calls) |
| 15 | AI Agent safety mechanisms (fallback, call limit) | ✅ Completed | d_code2 (call limit) + d_code3_report.js (fallback) |
| 16 | Workflow D JSON generation | ✅ Completed | n8n/workflow_d_report.json (404 lines) |

---

## Claude Code Skill `/rules-gen` — rules.json Generation/Validation

### Purpose

The structure of rules.json (8 rules × 3 severity levels) is complex, so initial generation and format validation are automated via a skill.

### Features

1. **Initial generation**: Auto-generate rules.json with specification-based reference values
2. **Format validation**: Check existing rules.json for missing required fields, type errors, min/max range overlaps
3. **Rule addition**: Verify id conflicts and type duplicates when adding new rules
4. **Compound validation**: Check compound rule conditions array structure and referenced target existence

### Validation Items

| Validation | Content |
|---|---|
| Required fields | id, name, type, levels existence |
| levels structure | 3 tiers (critical/moderate/low), min/max range continuity |
| type validity | One of 7 comparison types |
| compound structure | operator, conditions array, referenced target validity |
| id duplication | No id conflicts between rules |

---

## rules.json — Detection Rule Configuration

### Purpose

Define anomaly detection criteria outside the code so that threshold changes take effect immediately by modifying JSON only, with no code changes.

### Structure

```json
{
  "id": "rule_01",
  "name": "Production drop",
  "type": "drop_rate",
  "target": "hourly_production",
  "compare_with": "previous",
  "levels": [
    {"severity": "critical", "min": 40, "max": null},
    {"severity": "moderate", "min": 20, "max": 40},
    {"severity": "low", "min": 5, "max": 20}
  ],
  "message": "{line_name}: Production decreased by {change}%"
}
```

### 8 Detection Rules

| # | Detection Rule | Comparison Type | Critical | Moderate | Low |
|---|---|---|---|---|---|
| 1 | Production drop | drop_rate | 40%+ decrease | 20-40% | 5-20% |
| 2 | Operation rate decline | below_threshold | Below 30% | 30-50% | 50-70% |
| 3 | Defect rate spike | exceeds_baseline | 5x+ normal | 3-5x | 2-3x |
| 4 | Achievement delay | below_threshold | Gap -30%p+ | -15~-30%p | -5~-15%p |
| 5 | Production halt | consecutive_zero | 3h+ consecutive 0 | 2h | 1h |
| 6 | Scrap occurrence | above_threshold | Scrap rate 3%+ | 1-3% | Below 1% |
| 7 | Compound anomaly | compound (AND) | 30%↓+3x↑ | 15%↓+2x↑ | 5%↓+1.5x↑ |
| 8 | Operation rate plunge | drop_points | 50%p+ drop | 30-50%p | 15-30%p |

### 7 Comparison Types

- `drop_rate`: N% decrease compared to previous
- `exceeds_baseline`: Exceeds N times the baseline
- `below_threshold`: Below a fixed value
- `above_threshold`: Above a fixed value
- `consecutive_zero`: N consecutive zeros
- `drop_points`: N%p drop compared to previous
- `compound`: Two conditions met simultaneously (AND only)

---

## engine.js — Universal Detection Engine

### Purpose

A universal engine that reads and automatically executes rules.json. No changes to engine.js needed when rules are added or modified.

### Data Input Method: n8n Node Division

engine.js does not directly open Google Sheets. n8n's Google Sheets nodes read sheets and convert them to JSON, then pass them to JavaScript Code nodes.

```
[n8n Google Sheets node] Read line_master sheet → JSON conversion
[n8n Google Sheets node] Read production_week sheet → JSON conversion
    ↓
[JavaScript Code node] Receives JSON input for analysis
    const lines = items[0].json.line_master;   // already read by n8n
    const rows = items[0].json.production_week;
```

**Reason**: n8n Google Sheets nodes handle read/write, while JavaScript Code nodes focus on analysis logic. Since n8n is Node.js-based, JavaScript Code nodes are natively supported with the most stable compatibility.

### Operation Sequence

1. n8n Google Sheets nodes read line_master and production_week, pass as JSON
2. JavaScript Code node dynamically identifies line list, team list, and reference values from JSON
3. Load rules.json → rule list
4. Extract last 2 time slots
5. Run anomaly detection for each line × each rule combination
6. Output results as JSON → n8n Google Sheets node saves to anomaly_log

### Design Decisions

- **n8n node division**: Google Sheets read/write via n8n nodes, analysis logic via JavaScript Code nodes. No external libraries needed.
- **Previous hour comparison**: All hours accumulate in production_week sheet, so extract last 2 time slots from the same sheet. No separate "previous" tab needed.
- **One rule error must not stop everything**: Each rule wrapped in try-catch so only that rule is skipped.
- **Division by zero handling**: If previous value is 0, change rate calculation is impossible, so that rule is skipped (normal handling, not an error).

---

## Data Validation

### Purpose

null/blank means "data transmission problem" while value 0 means "actual production anomaly" — these must be handled differently.

### Validation Items

| Validation | Scenario | Response |
|---|---|---|
| Field null/blank | MES value not transmitted | Exclude that line from detection + notification email |
| Line row missing (target complete) | Cumulative production ≥ daily target | Normal, ignore |
| Line row missing (MES error) | Cumulative production < daily target | Notification email + error_log |
| Line row missing (not operating) | 0 records today | Normal, ignore |
| Column missing/type error | Schema change | error_log → terminate workflow |

### Design Decisions

- **Data warnings displayed at top of email**: Information that takes priority over anomalies.
- **Saved to error_log** (not anomaly_log): Prevents data errors from mixing into Power BI "5 anomalies" statistics.

---

## Pattern Classification: JavaScript + AI Hybrid

### Stage 1 — JavaScript (All Anomalies, No AI Call)

```
Query anomaly_log for last 7 days of history
COUNT same line + type
  0 occurrences → "New"
  1-2 occurrences → "Recurring"
  3+ occurrences or severity escalation → "Worsening"
```

### Stage 2 — Claude API (Critical or Worsening Cases Only)

- Pass JavaScript first-pass classification results + history with masking applied
- AI verifies first-pass classification ("agree" or "correction + reason")
- Generate root cause suggestions

### Design Decisions

- **Hybrid approach reason**: Calling AI for every case increases cost 3-5x. Only important cases get AI verification.
- **Batch processing for simultaneous cases**: If multiple critical+worsening cases occur in one cycle, batch into 1 API call for 1/3 cost + cross-line correlation analysis.
- **AI batch processing max 5 cases**: If 5 or fewer critical+worsening cases, batch all into 1 call. If 6+, only top 5 get AI analysis; rest get template messages. Priority: severity (critical > moderate) → pattern (worsening > recurring > new) → magnitude of change. Reason: more cases degrade AI response quality, and 6+ cases indicate a system-wide failure where on-site inspection takes priority over AI analysis.

---

## Masking

### Purpose

Replace actual names with codes when sending company data to AI for security.

### Method

```javascript
// maskDict: dynamically generated from line_master
const maskDict = {"CNC Unit 1": "LINE_A", "Shaft A": "PROD_01", ...};

// Masking: before AI call
const maskedText = applyMask(text, maskDict);

// Unmasking: after AI response
const unmaskedText = applyUnmask(aiResponse, maskDict);
```

### Design Decisions

- **Dynamic generation**: Auto-extends from line_master. mask_dict updates automatically when lines are added.
- **Prompt instruction to use codes**: "You must use the provided codes (LINE_A, etc.) in your response"

---

## Alert Routing

| Severity | Email | AI Call | Repeat |
|---|---|---|---|
| Critical | ✅ (includes AI analysis) | ✅ | Re-alert every 60min (next cycle) if unresolved |
| Moderate | ✅ (no analysis) | ❌ | Once per cycle |
| Low | ❌ (log only) | ❌ | Included in daily report |

### Email Structure

```
━━━ [DATA WARNING] ━━━ (only when present)
━━━ [CRITICAL] ━━━
  AI analysis included
━━━ [MODERATE] ━━━
━━━ Reference (Low) ━━━
```

---

## Duplicate Alert Prevention

### Storage

n8n Static Data (workflow-internal JSON)

### Format

```json
{"L03_ProductionDrop": "2026-03-23T11:00:00", ...}
```

### Rules

- Key: lineID + anomalyType (separate timer per line, per type)
- Critical: skip if same key exists within current cycle; re-alert next cycle (60min later) if unresolved
- Moderate: once per cycle
- Low: no email

---

## Error Handling (7 Error Points)

| # | Error Point | Response | Retry |
|---|---|---|---|
| 1 | Google Sheets read failure | error_log (with run_id) → terminate | - |
| 2 | Data validation failure | Separate problem lines + continue with valid lines | - |
| 3 | Detection calculation error | Skip that rule only | - |
| 4 | Google Sheets write failure | error_log, still send email | 2x (10s interval) |
| 5 | Claude API failure | Fallback message (template) | 1x (15s) |
| 6 | AI parse failure | Store full text | - |
| 7 | Gmail send failure | error_log (data already saved) | 2x (10s interval) |

### Principles

1. One stage failure → entire workflow must not stop
2. Data preservation > notification (save first, then email)
3. Log all errors to error_log

---

## AI Prompt Output Format

```json
{
  "anomalies": [
    {
      "id": 1,
      "summary": "...",
      "root_cause": "...",
      "action": "...",
      "pattern_verification": "agree/correction",
      "cross_impact": "..."
    }
  ],
  "overall_assessment": "Overall situation summary"
}
```

### AI Parse Strategy

1. Attempt JSON parse (after removing ```json wrapper)
2. Validate required fields (anomalies array exists, count matches)
3. Parse failure → store full text in ai_insight (fallback)
4. Track success/failure via ai_parsed column

### Enhancement (2026-06-16) — Evidence-Grounded AI Analysis `🚧 Code-complete, pending n8n test`

**Why:** Workflow B currently sends Claude only a one-line anomaly summary (no tools/context), so `root_cause` is an ungrounded guess. Goal: ground the AI in already-available sheet data and output a verifiable hypothesis with confidence.

**Evidence packet** (assembled in Code 4, masked before sending):
- Affected line's recent 6-hour trend (production / defect rate / operation rate)
- Recent 7-day history of the same anomaly type (dates, severity)
- Same-hour peer lines in the same team (isolate line-local vs shared cause)

**New output schema** (replaces the format above):

```json
{
  "anomalies": [{
    "id": 1, "summary": "...", "root_cause": "...",
    "confidence": "high/medium/low + one-line basis",
    "evidence": ["cited figure 1", "cited figure 2"],
    "alternatives": ["alternative hypothesis"],
    "ruled_out": ["excluded cause + reason"],
    "verify_first": "what to check first",
    "action": "...", "cross_impact": "..."
  }],
  "overall_assessment": "..."
}
```

**Output destination:** Email only (P3) — AI results are NOT written to `anomaly_log` (no schema/structural change). Dashboard-side confidence filtering, if needed later, can be added via a single Sheets "update" node (P1); this design does not block it.

**Files to modify** (src reference + deployed `workflow_b_monitor.json`):
- `Code 2` — output `productionRows`
- `Merge: anomaly+history` (JSON-only glue node) — carry `productionRows` through
- `Code 3` — pass through `productionRows` + `historicalLog`
- `Code 4` — build & mask evidence packet, new prompt + schema
- `Code 5` — parse new fields, render in email HTML (sheet write unchanged)

**Status:** Implemented in code (2026-06-16) — 4 src nodes (Code 2/3/4/5) + `Merge: anomaly+history` glue node updated and synced into deployed `workflow_b_monitor.json`. Pending n8n + Claude API runtime test. Phase 2 stays ✅ Completed (post-completion enhancement).

---

## Workflow B — n8n Node Structure (Separated by Function)

JavaScript logic is not placed in a single Code node but separated by function. Separation makes error location easier, allows checking node-by-node I/O in n8n UI, and ensures modifications to one stage don't affect others.

```
[Code Node 0] run_id generation (format: B_20260323_1110)
    ↓
[n8n Google Sheets node] Read production_week, line_master
    ↓ JSON
[Code Node 1] Data validation — null/blank check, line missing determination
    ↓ Valid line data + warning list
[Code Node 2] Anomaly detection + aggregation — 8-rule evaluation, hourly_summary generation
    ↓ Anomaly list + aggregation results
[n8n Google Sheets node] Save hourly_summary
    ↓
[n8n Google Sheets node] Read anomaly_log last 7 days
    ↓ JSON
[Code Node 3] Pattern classification + idempotency_key generation — new/recurring/worsening, duplicate check
    ↓ Classified anomaly list
[n8n Google Sheets node] Save all anomalies to anomaly_log (with run_id, idempotency_key, notification_status=pending)
    ↓
[IF node] Any critical or worsening?
    ├─ YES → [Code Node 4] Masking + prompt assembly (max 5 cases)
    │         ↓
    │        [Anthropic node] Claude API call
    │         ↓
    │        [Code Node 5] JSON parsing + unmasking
    │         ↓
    │        [n8n Google Sheets node] Update AI analysis in anomaly_log
    │         ↓
    │        [Gmail node] Alert email (critical+moderate+low included)
    │         ↓
    │        [n8n Google Sheets node] Update sent items notification_status → "sent"
    │
    ├─ Moderate only → [Gmail node] Alert email (moderate+low, no AI)
    │                    → notification_status → "sent"
    └─ Low only → notification_status → "skipped", end (log already saved)
```

---

## AI Agent — Workflow D (Daily Report, 07:40 Daily)

### What is an AI Agent?

The traditional approach is "code aggregates data → request summary from Claude once → done." An AI Agent is "give AI tools and a goal, and AI decides which tools to use, reviews results, and determines the next action."

| | Single Call (Workflow B) | AI Agent (Workflow D) |
|---|---|---|
| Planning | Developer fixes sequence in code | AI decides next step autonomously |
| Tools | None (text exchange only) | AI selects and uses needed tools |
| Iteration | 1 call → 1 response | Multiple tool uses → repeated judgment |
| Flexibility | Always same format output | Autonomously adjusts report depth by situation |

### Claude Code Skill `/agent-prompt` — System Prompt Management

The AI Agent's System Prompt is the core configuration that determines Agent behavior. Prompt generation/versioning/tuning is managed via a skill.

**Features**:
1. **Draft generation**: Generate System Prompt draft including report depth criteria, tool usage rules, output format
2. **Version management**: Store versions as `prompt_v1.md`, `prompt_v2.md`... in references/
3. **Tuning suggestions**: Review actual Agent output logs and suggest prompt improvements
4. **Change history**: Record what changed in each version

**Reason**: If the System Prompt is hardcoded in the code, the workflow JSON must be regenerated for every modification. Managing it as a separate file allows prompt-only replacement.

---

### Why Apply to Workflow D

- **Completely independent** from Workflow B (core monitor) → no impact on real-time alerts even if it fails
- Runs once daily → minimal cost increase (monthly +$0.2-0.5)
- Report writing is a "situational judgment" task → natural fit for the Agent pattern

### Tools (4)

| Tool | Function | When Agent Uses It |
|---|---|---|
| `get_anomaly_log` | Query anomaly history (date, severity, line filter) | "Let me check yesterday's critical cases only", "Check CNC 7-day history" |
| `get_daily_summary` | Query daily summary (date, team filter) | "Need to compare with last week" |
| `get_line_master` | Query line/team configuration | "Check this line's normal defect rate" |
| `get_hourly_detail` | Query hourly detail (date, line filter) | "Check CNC's hourly changes yesterday" |

### Agent Execution Loop (Pseudocode)

```javascript
const tools = [get_anomaly_log, get_daily_summary, get_line_master, get_hourly_detail];
const messages = [{ role: "user", content: `Please write yesterday's (${yesterday}) report.` }];
let toolCallCount = 0;

while (true) {
    const response = await claudeApi.call({ system: SYSTEM_PROMPT, tools, messages });

    if (response.stopReason === "tool_use") {
        toolCallCount++;
        if (toolCallCount > 8) break;  // Safety: max 8 calls
        const result = executeTool(response.toolCall);  // Execute JavaScript function
        messages.push(result);  // Pass result back to Agent
        continue;  // Agent decides again
    }

    if (response.stopReason === "end_turn") {
        const finalReport = response.text;  // Final report
        break;
    }
}
```

### Report Depth Criteria (Specified in System Prompt)

| Situation | Report Depth | Agent Behavior |
|---|---|---|
| 0 critical + 2 or fewer moderate | Brief (1-2 lines) | 1 tool call, quick finish |
| 1-2 critical or 3+ moderate | Standard (detailed analysis) | 3-4 tool calls, history comparison |
| 3+ critical or worsening trend | Detailed (trend + CC management) | 5-6 tool calls, 7-day trend analysis |

### Agent Output Format

```json
{
  "report_level": "brief/standard/detailed",
  "cc_management": true/false,
  "summary": "One-line summary",
  "sections": {
    "key_alerts": "...",
    "trend_analysis": "...",
    "other_anomalies": "...",
    "recommendations": "..."
  },
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}
```

### Safety Mechanisms

| Scenario | Response | Result |
|---|---|---|
| Tool calls exceed 8 | Force loop termination | Generate report with data collected so far |
| Claude API outage | try-catch → fallback | Send existing fixed-format report |
| Agent output parse failure | Use text as-is | Include text in email |
| Tool execution failure (Google Sheets outage) | Pass error message to Agent | Agent writes within possible scope |
| API timeout | 60-second limit | Send fallback report |

### Cost Impact

| | Single Call (Before) | Agent (After) |
|---|---|---|
| Calls/day | 1 | 2-6 (varies by situation) |
| Monthly cost (Workflow D only) | ~$0.1 | ~$0.3-0.8 |
| Total cost increase | - | +$0.2-0.5/month |

---

## Phase 2 Skill Classification

| Skill | Classification | Reason |
|---|---|---|
| `/rules-gen` | Project-specific | Only applicable to this project's rules.json structure |
| `/agent-prompt` | Project-specific | Only applicable to this project's AI Agent System Prompt |

---

## Prerequisites & Dependencies

- Phase 1 completion (n8n + Google Sheets + Workflow A/B)
- Claude API key activated
- Google Sheets sheet structure complete (line_master, rules.json, production_results)

---

## Development Order: Local First, n8n Later

Debugging directly in n8n Code nodes is inconvenient (poor error messages, difficult console log verification). Core logic is developed/tested in local JavaScript first, then transferred to n8n Code nodes after verification.

```
Stage 1: Local JavaScript Development
  ├─ /rules-gen skill → generate rules.json
  ├─ src/detection/engine.js local development
  ├─ Test with sample data created by data-gen locally
  └─ Unit test data validation, anomaly detection, pattern classification

Stage 2: n8n Integration
  ├─ Distribute verified code to Code Nodes 0-5
  ├─ Verify JSON transfer between n8n Google Sheets nodes ↔ Code nodes
  └─ Integration test Workflow A (simulator) + Workflow B

Stage 3: AI Integration
  ├─ /agent-prompt skill → generate System Prompt draft
  ├─ Workflow B Claude API integration (critical+worsening cases)
  ├─ Workflow D AI Agent loop implementation
  └─ Email send test
```

---

## Development Notes

- engine.js runs inside n8n JavaScript Code nodes — no external libraries needed
- Google Sheets read/write handled by n8n Google Sheets nodes — JavaScript handles JSON I/O only
- Workflow B JavaScript Code nodes separated into 6 (run_id generation → validation → detection → classification+idempotency_key → masking → parsing)
- Test core logic locally first, then transfer to n8n
- Compound rules support AND combination, 2 conditions, flat structure only (no OR, no recursion)
- Schedule Trigger fires at 10 minutes past each hour (08:10, 09:10...) — 10-minute offset after hourly data append
- First hour (08:00) only: no comparison target → save summary only → terminate
- Low/moderate classified as "worsening" get escalated to critical
- AI batch processing limited to max 5 cases — 6+ cases: top 5 get AI, rest get templates
- AI Agent (Workflow D) tool functions must apply masking before returning
- AI Agent loop must enforce max 8 tool call limit (cost + infinite loop prevention)
- Agent fallback uses existing fixed-format report — requires separate implementation

---

## Change Log

| Date | Description |
|---|---|
| 2026-03-25 | Initial creation (spec v2.3) |
| 2026-03-25 | AI Agent (Workflow D) design added — 4 tools, loop structure, safety mechanisms, fallback |
| 2026-03-25 | /rules-gen, /agent-prompt skills added |
| 2026-03-25 | Implementation decisions — n8n node division (Sheets read), 5 Code nodes separated, local-first development, AI max 5 cases |
| 2026-03-25 | Python → JavaScript transition (WSL2/Docker unavailable in dev environment, switched to n8n native JS Code nodes) |
| 2026-03-25 | SharePoint → OneDrive transition |
| 2026-05-02 | OneDrive Excel → Google Sheets transition: all Excel references changed to Google Sheets |
| 2026-05-02 | Spec v3.0: run_id/idempotency_key/notification_status added to anomaly_log, run_id added to error_log |
| 2026-05-02 | Workflow D execution time specified as 07:40, critical re-alert changed to 60min (next cycle) |
| 2026-05-08 | All 16 items completed: detection engine, validator, classifier, masker, n8n Code nodes 0-5, Workflow B (675 lines), AI Agent tools/loop/report, Workflow D (404 lines). Document restructured to bilingual format |
| 2026-06-16 | Implemented (code, pending n8n test): Workflow B AI analysis upgraded to evidence-grounded diagnosis (evidence packet + confidence/alternatives/verify); results in email only (P3, no anomaly_log schema change). Modified Code 2/3/4/5 + Merge glue node, synced to deployed JSON |

---
---

# Phase 2 — 핵심 엔진 `✅ 완료`

> Config-driven 이상 탐지 엔진을 구현하고, AI 해석/패턴 분류를 연동하여 핵심 분석 파이프라인을 완성한다. 일일 리포트(워크플로 D)에는 AI Agent 패턴을 적용하여 자율적 분석 리포트를 생성한다.

**완료일**: 2026-05-08
**상태**: ✅ 완료
**선행 조건**: Phase 1 완료 (n8n + Google Sheets + 워크플로 A/B 기본 구조)

---

## 개요

프로젝트의 핵심 비즈니스 로직을 구현하는 단계.
rules.json + engine.js 기반의 Config-driven 이상 탐지 엔진을 개발하고,
JavaScript 1차 패턴 분류 → Claude API 2차 검증/해석의 하이브리드 구조를 구현한다.
마스킹 처리, 중복 알림 방지, 에러 핸들링, 이메일 알림까지 포함하여
워크플로 B(모니터)를 완전한 형태로 업데이트한다.
또한 워크플로 D(일일 리포트)에 AI Agent 패턴을 적용하여,
AI가 도구(Tool Use)를 활용해 자율적으로 데이터를 조회하고
상황에 맞는 깊이의 리포트를 생성하는 구조를 구현한다.

---

## 완료 예정 항목

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | Claude Code Skill `/rules-gen` 개발 | ✅ 완료 | config/rules.json 직접 생성 (8룰 × 3레벨, 123줄) |
| 2 | Config-driven 이상 탐지 (rules.json + engine.js) | ✅ 완료 | src/detection/engine.js (294줄) + config/rules.json |
| 3 | 데이터 검증 로직 | ✅ 완료 | src/detection/validator.js (139줄) + src/n8n_nodes/code1_validate.js |
| 4 | JavaScript 패턴 1차 분류 | ✅ 완료 | src/detection/classifier.js (91줄) + src/n8n_nodes/code3_classify.js |
| 5 | 마스킹 처리 로직 | ✅ 완료 | src/detection/masker.js (50줄) + src/n8n_nodes/code4_mask_prompt.js |
| 6 | Claude API 해석 + 패턴 2차 검증 | ✅ 완료 | src/n8n_nodes/code4_mask_prompt.js + code5_parse_email.js |
| 7 | 이메일 알림 (심각도별 분기) | ✅ 완료 | src/n8n_nodes/code5_parse_email.js (심각도별 HTML) |
| 8 | 중복 알림 방지 (Static Data) | ✅ 완료 | src/n8n_nodes/code3_classify.js (n8n Static Data) |
| 9 | 에러 핸들링 (7개 에러 지점) | ✅ 완료 | 룰별 try-catch, 워크플로 노드에 재시도 로직 |
| 10 | Google Sheets 자동 저장 | ✅ 완료 | workflow_b_monitor.json (hourly_summary + anomaly_log 노드) |
| 11 | 워크플로 B 업데이트 JSON 재생성 | ✅ 완료 | n8n/workflow_b_monitor.json (675줄, 전체 파이프라인) |
| 12 | AI Agent 도구 함수 구현 (워크플로 D) | ✅ 완료 | src/n8n_nodes/d_code1_prepare.js (도구 4개 정의) |
| 13 | Claude Code Skill `/agent-prompt` 개발 | ✅ 완료 | config/agent_prompt.md 직접 생성 |
| 14 | AI Agent System Prompt + 루프 구현 | ✅ 완료 | src/n8n_nodes/d_code2_agent_loop.js (최대 8회) |
| 15 | AI Agent 안전장치 (폴백, 호출 제한) | ✅ 완료 | d_code2 (호출 제한) + d_code3_report.js (폴백) |
| 16 | 워크플로 D JSON 생성 | ✅ 완료 | n8n/workflow_d_report.json (404줄) |

---

## Claude Code Skill `/rules-gen` — rules.json 생성/검증

### 목적

rules.json(8개 룰 × 3레벨 심각도)의 구조가 복잡하므로, 초기 생성과 형식 검증을 스킬로 자동화한다.

### 기능

1. **초기 생성**: 명세서 기준값으로 rules.json 자동 생성
2. **형식 검증**: 기존 rules.json의 필수 필드 누락, 타입 오류, min/max 범위 겹침 체크
3. **룰 추가**: 새 룰 추가 시 기존 룰과 id 충돌/타입 중복 확인
4. **compound 검증**: compound 룰의 conditions 배열 구조, 참조 target 존재 여부 확인

### 검증 항목

| 검증 | 내용 |
|---|---|
| 필수 필드 | id, name, type, levels 존재 여부 |
| levels 구조 | 심각/중간/낮음 3단계 존재, min/max 범위 연속성 |
| type 유효성 | 7가지 비교 타입 중 하나인지 |
| compound 구조 | operator, conditions 배열, 참조 target 유효성 |
| id 중복 | 룰 간 id 충돌 없는지 |

---

## rules.json — 이상 탐지 룰 설정

### 목적

이상 탐지 기준을 코드 외부에 정의하여, 기준값 변경 시 코드 수정 없이 JSON만 수정하면 즉시 반영.

### 구조

```json
{
  "id": "rule_01",
  "name": "생산량 급감",
  "type": "drop_rate",
  "target": "hourly_production",
  "compare_with": "previous",
  "levels": [
    {"severity": "심각", "min": 40, "max": null},
    {"severity": "중간", "min": 20, "max": 40},
    {"severity": "낮음", "min": 5,  "max": 20}
  ],
  "message": "{line_name}: 생산량 {change}% 감소"
}
```

### 탐지 기준 8가지

| # | 탐지 항목 | 비교 타입 | 심각 | 중간 | 낮음 |
|---|---|---|---|---|---|
| 1 | 생산량 급감 | drop_rate | 40%+ 감소 | 20~40% | 5~20% |
| 2 | 가동률 저하 | below_threshold | 30% 미만 | 30~50% | 50~70% |
| 3 | 불량률 급등 | exceeds_baseline | 정상의 5배+ | 3~5배 | 2~3배 |
| 4 | 달성률 지연 | below_threshold | 갭 -30%p↓ | -15~-30%p | -5~-15%p |
| 5 | 생산 정체 | consecutive_zero | 3시간+ 연속 0 | 2시간 | 1시간 |
| 6 | 폐기 발생 | above_threshold | 폐기율 3%+ | 1~3% | 1% 미만 |
| 7 | 복합 이상 | compound (AND) | 30%↓+3배↑ | 15%↓+2배↑ | 5%↓+1.5배↑ |
| 8 | 가동률 급락 | drop_points | 50%p+ 하락 | 30~50%p | 15~30%p |

### 비교 타입 7가지

- `drop_rate`: 이전 대비 N% 감소
- `exceeds_baseline`: 기준값의 N배 초과
- `below_threshold`: 고정값 미만
- `above_threshold`: 고정값 초과
- `consecutive_zero`: 연속 N회 0
- `drop_points`: 이전 대비 N%p 하락
- `compound`: 두 조건 동시 충족 (AND만 지원)

---

## engine.js — 이상 탐지 범용 엔진

### 목적

rules.json을 읽어서 자동 실행하는 범용 코드. 룰 추가/수정 시 engine.js 변경 불필요.

### 데이터 입력 방식: n8n 노드 분업

engine.js는 Google Sheets를 직접 열지 않는다. n8n의 Google Sheets 노드가 시트를 읽어서 JSON으로 변환한 후, JavaScript Code 노드에 전달한다.

```
[n8n Google Sheets 노드] line_master 시트 읽기 → JSON 변환
[n8n Google Sheets 노드] production_week 시트 읽기 → JSON 변환
    ↓
[JavaScript Code 노드] JSON 입력 받아서 분석
    const lines = items[0].json.line_master;   // n8n이 이미 읽어서 넘겨줌
    const rows = items[0].json.production_week;
```

**이유**: n8n Google Sheets 노드가 읽기/쓰기를 담당하고, JavaScript Code 노드는 분석 로직에 집중한다. n8n이 Node.js 기반이므로 JavaScript Code 노드가 네이티브로 지원되어 호환성이 가장 안정적이다.

### 동작 순서

1. n8n Google Sheets 노드가 line_master, production_week을 읽어서 JSON으로 전달
2. JavaScript Code 노드가 JSON에서 라인 목록, 팀 목록, 기준값을 동적 파악
3. rules.json 로드 → 룰 목록
4. 마지막 2개 시간대 추출
5. 각 라인 × 각 룰 조합으로 이상 판정
6. 결과를 JSON으로 출력 → n8n Google Sheets 노드가 anomaly_log에 저장

### 설계 결정 사항

- **n8n 노드 분업**: Google Sheets 읽기/쓰기는 n8n 노드, 분석 로직은 JavaScript Code 노드. 외부 라이브러리 불필요.
- **이전 시간 비교**: production_week 시트에 모든 시간이 쌓여 있으므로 같은 시트에서 마지막 2개 시간대 추출. 별도 previous 탭 불필요.
- **하나의 룰 에러가 전체를 멈추면 안 됨**: 각 룰을 try-catch로 감싸서 해당 룰만 스킵.
- **나누기 0 처리**: 이전 값이 0이면 변화율 계산 불가이므로 해당 룰 스킵 (에러 아닌 정상 처리).

---

## 데이터 검증

### 목적

null/빈칸은 "데이터 전달 문제"이고, 값 0은 "실제 생산 이상"이므로 구분 처리.

### 검증 항목

| 검증 | 상황 | 대응 |
|---|---|---|
| 필드 null/빈칸 | MES 값 미전달 | 해당 라인 탐지 제외 + 안내 이메일 |
| 라인 행 누락 (목표 완료) | 누적생산 ≥ 일일목표 | 정상, 무시 |
| 라인 행 누락 (MES 오류) | 누적생산 < 일일목표 | 안내 이메일 + error_log |
| 라인 행 누락 (미가동) | 오늘 데이터 0건 | 정상, 무시 |
| 컬럼 누락/타입 오류 | 스키마 변경 | error_log → 워크플로 종료 |

### 설계 결정 사항

- **데이터 경고는 이메일 맨 위에 표시**: 이상보다 더 우선적으로 알아야 할 정보.
- **error_log에 저장** (anomaly_log 아님): Power BI에서 "이상 5건" 통계에 데이터 에러가 섞이지 않도록 분리.

---

## 패턴 분류: JavaScript + AI 하이브리드

### 1단계 — JavaScript (모든 이상, AI 호출 없음)

```
anomaly_log에서 최근 7일 이력 조회
동일 라인+유형 COUNT
  0회 → "신규"
  1~2회 → "반복"
  3회+ 또는 심각도 상승 → "악화"
```

### 2단계 — Claude API (심각 또는 악화 건만)

- JavaScript 1차 분류 결과 + 이력을 마스킹하여 전달
- AI가 1차 분류를 검증 ("동의" 또는 "보정 + 이유")
- 근본 원인 제언 생성

### 설계 결정 사항

- **하이브리드 이유**: 모든 건에 AI 호출 시 비용 3~5배 증가. 중요한 건만 AI가 검증.
- **동시 다발 일괄 처리**: 한 사이클에 심각+악화 여러 건이면 1번 API 호출로 묶어 비용 1/3 + 연관 분석 가능.
- **AI 일괄 처리 최대 5건**: 심각+악화 건이 5건 이하면 전부 묶어서 1회 호출. 6건 이상이면 상위 5건만 AI 분석하고, 나머지는 템플릿 메시지로 처리. 우선순위: 심각도(심각>중간) → 패턴(악화>반복>신규) → 변화량 큰 순. 이유: 건수가 많으면 AI 응답 품질이 떨어지고, 6건 이상은 시스템 전체 장애이므로 AI 분석보다 현장 점검이 우선.

---

## 마스킹 처리

### 목적

회사 데이터를 AI에 보낼 때 실제 이름을 코드로 치환하여 보안 확보.

### 방식

```javascript
// maskDict: line_master에서 동적 생성
const maskDict = {"CNC 1호기": "LINE_A", "샤프트 A": "PROD_01", ...};

// 마스킹: AI 호출 전
const maskedText = applyMask(text, maskDict);

// 언마스킹: AI 응답 후
const unmaskedText = applyUnmask(aiResponse, maskDict);
```

### 설계 결정 사항

- **동적 생성**: line_master에서 자동 확장. 라인 추가 시 mask_dict도 자동.
- **프롬프트에 코드 사용 지시**: "응답에서 반드시 제공된 코드(LINE_A 등)를 사용하세요"

---

## 알림 분기

| 심각도 | 이메일 | AI 호출 | 반복 |
|---|---|---|---|
| 심각 | ✅ (AI 분석 포함) | ✅ | 미해결 시 60분(다음 사이클)마다 |
| 중간 | ✅ (분석 없음) | ❌ | 사이클당 1회 |
| 낮음 | ❌ (로그만) | ❌ | 일일 리포트에 포함 |

### 이메일 구조

```
━━━ [데이터 경고] ━━━ (있을 때만)
━━━ [심각] ━━━
  AI 분석 포함
━━━ [중간] ━━━
━━━ 참고 (낮음) ━━━
```

---

## 중복 알림 방지

### 저장소

n8n Static Data (워크플로 내부 JSON)

### 형식

```json
{"L03_생산량급감": "2026-03-23T11:00:00", ...}
```

### 규칙

- 키: 라인ID + 이상유형 (라인마다, 유형마다 별도 타이머)
- 심각: 같은 키가 현재 사이클 내에 있으면 스킵, 다음 사이클(60분 후) + 미해결 → 재알림
- 중간: 사이클당 1회
- 낮음: 이메일 없음

---

## 에러 핸들링 (7개 에러 지점)

| # | 에러 지점 | 대응 | 재시도 |
|---|---|---|---|
| 1 | Google Sheets 읽기 실패 | error_log (run_id 포함) → 종료 | - |
| 2 | 데이터 검증 실패 | 문제 라인 분리 + 정상 라인 계속 | - |
| 3 | 이상 탐지 연산 에러 | 해당 룰만 스킵 | - |
| 4 | Google Sheets 쓰기 실패 | error_log, 이메일은 발송 | 2회 (10초 간격) |
| 5 | Claude API 실패 | 폴백 메시지 (템플릿) | 1회 (15초) |
| 6 | AI 파싱 실패 | 전체 텍스트 저장 | - |
| 7 | Gmail 발송 실패 | error_log (데이터는 저장됨) | 2회 (10초 간격) |

### 원칙

1. 하나의 단계 실패 → 전체 워크플로 멈추지 않음
2. 데이터 보존 > 알림 (먼저 저장, 그다음 이메일)
3. 모든 에러를 error_log에 기록

---

## AI 프롬프트 출력 형식

```json
{
  "anomalies": [
    {
      "id": 1,
      "summary": "...",
      "root_cause": "...",
      "action": "...",
      "pattern_verification": "동의/보정",
      "cross_impact": "..."
    }
  ],
  "overall_assessment": "전체 상황 종합"
}
```

### AI 파싱 전략

1. JSON 파싱 시도 (```json 래퍼 제거 후)
2. 필수 필드 검증 (anomalies 배열 존재, 건수 일치)
3. 파싱 실패 → 전체 텍스트를 ai_insight에 저장 (폴백)
4. ai_parsed 컬럼으로 성공/실패 기록

### 개선 (2026-06-16) — 근거 기반 AI 분석 `🚧 코드 반영 완료, n8n 테스트 전`

**배경:** 현재 워크플로 B는 Claude에게 이상 한 줄 요약만 전달(도구·컨텍스트 없음)하여 `root_cause`가 근거 없는 추측이다. 목표: 이미 시트에 있는 데이터로 AI에 근거를 제공하고, 신뢰도가 있는 검증 가능한 가설을 출력하게 한다.

**증거 패킷** (Code 4에서 조립, 전송 전 마스킹):
- 해당 라인 최근 6시간 추세 (생산 / 불량률 / 가동률)
- 동일 유형 최근 7일 이력 (날짜, 심각도)
- 동시간대 같은 팀 타 라인 (라인 국소 문제 vs 공통 원인 구분)

**새 출력 스키마** (위 형식을 대체):

```json
{
  "anomalies": [{
    "id": 1, "summary": "...", "root_cause": "...",
    "confidence": "높음/중간/낮음 + 한 줄 근거",
    "evidence": ["인용 수치 1", "인용 수치 2"],
    "alternatives": ["대안 가설"],
    "ruled_out": ["배제된 원인 + 이유"],
    "verify_first": "먼저 확인할 것",
    "action": "...", "cross_impact": "..."
  }],
  "overall_assessment": "..."
}
```

**결과 저장 위치:** 이메일 전용 (P3) — AI 결과를 `anomaly_log`에 쓰지 않음 (스키마·구조 변경 없음). 추후 대시보드에서 신뢰도 필터가 필요하면 Sheets "update" 노드 1개(P1)로 추가 가능하며, 본 설계가 이를 막지 않는다.

**수정 파일** (src 참조본 + 배포본 `workflow_b_monitor.json`):
- `Code 2` — `productionRows` 출력
- `Merge: 이상+이력` (JSON 전용 글루 노드) — `productionRows` 통과
- `Code 3` — `productionRows` + `historicalLog` 패스스루
- `Code 4` — 증거 패킷 조립·마스킹, 프롬프트·스키마 교체
- `Code 5` — 새 필드 파싱, 이메일 HTML 렌더링 (시트 쓰기 무변경)

**상태:** 코드 반영 완료 (2026-06-16) — src 노드 4개(Code 2/3/4/5) + `Merge: 이상+이력` 글루 노드 수정 및 배포본 `workflow_b_monitor.json` 동기화. n8n + Claude API 런타임 테스트 전. Phase 2는 ✅ 완료 유지 (완료 후 개선).

---

## 워크플로 B — n8n 노드 구조 (기능별 분리)

JavaScript 로직을 하나의 Code 노드에 넣지 않고, 기능별로 분리한다.
분리하면 에러 위치 특정이 쉽고, n8n UI에서 노드별 입출력을 바로 확인할 수 있으며, 특정 단계만 수정해도 다른 단계에 영향이 없다.

```
[Code 노드 0] run_id 생성 (형식: B_20260323_1110)
    ↓
[n8n Google Sheets 노드] production_week, line_master 읽기
    ↓ JSON
[Code 노드 1] 데이터 검증 — null/빈칸 체크, 라인 누락 판정
    ↓ 정상 라인 데이터 + 경고 목록
[Code 노드 2] 이상 탐지 + 집계 — 8룰 판정, hourly_summary 생성
    ↓ 이상 목록 + 집계 결과
[n8n Google Sheets 노드] hourly_summary 저장
    ↓
[n8n Google Sheets 노드] anomaly_log 최근 7일 읽기
    ↓ JSON
[Code 노드 3] 패턴 분류 + idempotency_key 생성 — 신규/반복/악화 판정, 중복 체크
    ↓ 분류된 이상 목록
[n8n Google Sheets 노드] anomaly_log에 전체 이상 저장 (run_id, idempotency_key, notification_status=pending 포함)
    ↓
[IF 노드] 심각 또는 악화 있는가?
    ├─ YES → [Code 노드 4] 마스킹 + 프롬프트 조합 (최대 5건)
    │         ↓
    │        [Anthropic 노드] Claude API 호출
    │         ↓
    │        [Code 노드 5] JSON 파싱 + 언마스킹
    │         ↓
    │        [n8n Google Sheets 노드] anomaly_log에 AI 해석 업데이트
    │         ↓
    │        [Gmail 노드] 알림 이메일 (심각+중간+낮음 포함)
    │         ↓
    │        [n8n Google Sheets 노드] 발송된 건 notification_status → "sent"
    │
    ├─ 중간만 → [Gmail 노드] 알림 이메일 (중간+낮음, AI 없음)
    │            → notification_status → "sent"
    └─ 낮음만 → notification_status → "skipped", 종료 (로그만 저장됨)
```

---

## AI Agent — 워크플로 D (일일 리포트, 매일 07:40)

### AI Agent란?

기존 방식은 "코드가 데이터 집계 → Claude에 요약 1회 요청 → 끝"이었다면,
AI Agent는 "AI에게 도구와 목표를 주면, AI가 스스로 어떤 도구를 쓸지 결정하고,
결과를 보고 다음 행동을 판단하는" 방식이다.

| | 단발 호출 (워크플로 B) | AI Agent (워크플로 D) |
|---|---|---|
| 계획 | 개발자가 코드로 순서 고정 | AI가 스스로 다음 단계 결정 |
| 도구 | 없음 (텍스트만 주고받음) | AI가 필요한 도구를 골라서 사용 |
| 반복 | 1회 호출 → 1회 응답 | 여러 번 도구 사용 → 판단 반복 |
| 유연성 | 항상 같은 포맷 출력 | 상황에 따라 리포트 깊이 자율 조절 |

### Claude Code Skill `/agent-prompt` — System Prompt 관리

AI Agent의 System Prompt는 Agent의 행동을 결정하는 핵심 설정이다. 프롬프트 생성/버전 관리/튜닝을 스킬로 관리한다.

**기능**:
1. **초안 생성**: 리포트 깊이 기준, 도구 사용 규칙, 출력 형식을 포함한 System Prompt 초안 생성
2. **버전 관리**: references/에 `prompt_v1.md`, `prompt_v2.md`... 형태로 버전별 보관
3. **튜닝 제안**: 실제 Agent 출력 로그를 보고 "이 부분이 부족하다" 같은 프롬프트 개선 제안
4. **변경 이력**: 어떤 버전에서 무엇을 바꿨는지 기록

**이유**: System Prompt를 코드 안에 하드코딩하면 수정할 때마다 워크플로 JSON을 재생성해야 한다. 별도 파일로 관리하면 프롬프트만 교체하면 된다.

---

### 왜 워크플로 D에 적용하는가

- 워크플로 B(핵심 모니터)와 **완전히 독립** → 실패해도 실시간 알림 영향 없음
- 하루 1회 실행 → 비용 증가 최소 (월 +$0.2~0.5)
- 리포트 작성은 "상황 판단" 업무 → Agent 패턴에 자연스러움

### 도구(Tool) 4가지

| 도구 | 기능 | Agent가 쓰는 상황 |
|---|---|---|
| `get_anomaly_log` | 이상 이력 조회 (날짜, 심각도, 라인 필터) | "어제 심각 건만 보자", "CNC 7일 이력 확인" |
| `get_daily_summary` | 일별 요약 조회 (날짜, 팀 필터) | "지난주와 비교해야겠다" |
| `get_line_master` | 라인/팀 구성 조회 | "이 라인의 정상 불량률 확인" |
| `get_hourly_detail` | 시간별 상세 조회 (날짜, 라인 필터) | "CNC의 어제 시간대별 변화 확인" |

### Agent 실행 루프 (의사코드)

```javascript
const tools = [get_anomaly_log, get_daily_summary, get_line_master, get_hourly_detail];
const messages = [{ role: "user", content: `어제(${yesterday}) 리포트를 작성해주세요.` }];
let toolCallCount = 0;

while (true) {
    const response = await claudeApi.call({ system: SYSTEM_PROMPT, tools, messages });

    if (response.stopReason === "tool_use") {
        toolCallCount++;
        if (toolCallCount > 8) break;  // 안전장치: 최대 8회
        const result = executeTool(response.toolCall);  // JavaScript 함수 실행
        messages.push(result);  // 결과를 Agent에게 전달
        continue;  // Agent가 다시 판단
    }

    if (response.stopReason === "end_turn") {
        const finalReport = response.text;  // 최종 리포트
        break;
    }
}
```

### 리포트 깊이 기준 (System Prompt에 명시)

| 상황 | 리포트 깊이 | Agent 행동 |
|---|---|---|
| 심각 0건 + 중간 2건 이하 | 간단 (1~2줄) | 도구 1회, 빠르게 종료 |
| 심각 1~2건 또는 중간 3건+ | 보통 (상세 분석) | 도구 3~4회, 이력 비교 |
| 심각 3건+ 또는 악화 추세 | 상세 (추세 + 경영진 CC) | 도구 5~6회, 7일 추이 분석 |

### Agent 출력 형식

```json
{
  "report_level": "간단/보통/상세",
  "cc_management": true/false,
  "summary": "한 줄 요약",
  "sections": {
    "핵심_경고": "...",
    "추세_분석": "...",
    "기타_이상": "...",
    "권장_조치": "..."
  },
  "recommendations": ["권장 조치 1", "권장 조치 2"]
}
```

### 안전장치

| 상황 | 대응 | 결과 |
|---|---|---|
| 도구 호출이 8회 초과 | 루프 강제 종료 | 지금까지 데이터로 리포트 생성 |
| Claude API 장애 | try-catch → 폴백 | 기존 고정 포맷 리포트 발송 |
| Agent 출력 파싱 실패 | 텍스트 그대로 사용 | 이메일에 텍스트 포함 |
| 도구 실행 실패 (Google Sheets 장애) | Agent에게 에러 메시지 전달 | Agent가 가능한 범위로 작성 |
| API 타임아웃 | 60초 제한 | 폴백 리포트 발송 |

### 비용 영향

| | 단발 호출 (기존) | Agent (변경 후) |
|---|---|---|
| 호출 횟수/일 | 1회 | 2~6회 (상황에 따라) |
| 월 비용 (워크플로 D만) | ~$0.1 | ~$0.3~0.8 |
| 전체 비용 증가 | - | 월 +$0.2~0.5 |

---

## Phase 2 스킬 범용/전용 분류

| 스킬 | 분류 | 이유 |
|---|---|---|
| `/rules-gen` | 프로젝트 전용 | 이 프로젝트의 rules.json 구조에만 적용 가능 |
| `/agent-prompt` | 프로젝트 전용 | 이 프로젝트의 AI Agent System Prompt에만 적용 가능 |

---

## 선행 조건 및 의존성

- Phase 1 완료 (n8n + Google Sheets + 워크플로 A/B)
- Claude API 키 활성화
- Google Sheets 시트 구조 완성 (line_master, rules.json, production_results)

---

## Phase 2 개발 순서: 로컬 먼저, n8n은 나중에

n8n Code 노드 안에서 직접 코딩하면 디버깅이 불편하다 (에러 메시지 빈약, 콘솔 로그 확인 어려움).
핵심 로직은 로컬 JavaScript에서 먼저 개발/테스트하고, 검증 완료 후 n8n Code 노드에 옮긴다.

```
1단계: 로컬 JavaScript 개발
  ├─ /rules-gen 스킬 → rules.json 생성
  ├─ src/detection/engine.js 로컬 개발
  ├─ data-gen으로 만든 샘플 데이터를 로컬에서 읽어 테스트
  └─ 데이터 검증, 이상 탐지, 패턴 분류 단위 테스트

2단계: n8n 통합
  ├─ 검증된 코드를 Code 노드 0~5에 분배
  ├─ n8n Google Sheets 노드 ↔ Code 노드 간 JSON 전달 확인
  └─ 워크플로 A(시뮬레이터) + 워크플로 B 연동 테스트

3단계: AI 연동
  ├─ /agent-prompt 스킬 → System Prompt 초안 생성
  ├─ 워크플로 B의 Claude API 연동 (심각+악화 건)
  ├─ 워크플로 D의 AI Agent 루프 구현
  └─ 이메일 발송 테스트
```

---

## 개발 시 주의사항

- engine.js는 n8n JavaScript Code 노드 안에 들어감 — 외부 라이브러리 불필요
- Google Sheets 읽기/쓰기는 n8n Google Sheets 노드가 담당 — JavaScript는 JSON 입출력만
- 워크플로 B의 JavaScript Code 노드는 6개로 분리 (run_id 생성 → 검증 → 탐지 → 분류+idempotency_key → 마스킹 → 파싱)
- 핵심 로직은 로컬에서 먼저 테스트 후 n8n에 옮기기
- compound 룰은 AND 조합, 2개 조건, flat 구조만 지원 (OR, 재귀 미지원)
- Schedule Trigger는 매시간 10분 (08:10, 09:10...) — 정각 데이터 append 후 10분 오프셋
- 첫 시간(08:00)만 있으면 비교 대상 없음 → summary만 저장 → 종료
- "악화"로 분류된 낮음/중간은 심각으로 에스컬레이션
- AI 일괄 처리 최대 5건 제한 — 6건 이상은 상위 5건만 AI, 나머지 템플릿
- AI Agent(워크플로 D)의 도구 함수는 마스킹 적용 후 반환해야 함
- AI Agent 루프에서 도구 호출 최대 8회 제한 필수 (비용 + 무한루프 방지)
- Agent 폴백은 기존 고정 포맷 리포트로 — 별도 구현 필요

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-03-25 | 최초 작성 (명세서 v2.3 기반) |
| 2026-03-25 | AI Agent (워크플로 D) 설계 추가 — 도구 4개, 루프 구조, 안전장치, 폴백 |
| 2026-03-25 | `/rules-gen`, `/agent-prompt` 스킬 추가 |
| 2026-03-25 | 구현 방식 결정 — n8n 노드 분업(Sheets 읽기), Code 노드 5개 분리, 로컬 먼저 개발, AI 최대 5건 |
| 2026-03-25 | Python → JavaScript 전환 (개발 환경에서 WSL2/Docker 사용 불가, n8n 네이티브 JS Code 노드로 변경) |
| 2026-03-25 | SharePoint → OneDrive 전환 |
| 2026-05-02 | OneDrive Excel → Google Sheets 전환: 모든 Excel 참조를 Google Sheets로 변경 |
| 2026-05-02 | 명세서 v3.0 반영: anomaly_log에 run_id/idempotency_key/notification_status 추가, error_log에 run_id 추가 |
| 2026-05-02 | 워크플로 D 실행 시각 07:40으로 명시, 심각 재알림 60분(다음 사이클)으로 변경 |
| 2026-05-08 | 전체 16항목 구현 완료: 탐지 엔진, 검증기, 분류기, 마스커, n8n Code 노드 0~5, 워크플로 B (675줄), AI Agent 도구/루프/리포트, 워크플로 D (404줄). 문서 이중 언어 구조로 재작성 |
| 2026-06-16 | 구현(코드, n8n 테스트 전): 워크플로 B AI 분석을 근거 기반 진단으로 개선 (증거 패킷 + 신뢰도/대안/검증); 결과는 이메일 전용 (P3, anomaly_log 스키마 변경 없음). Code 2/3/4/5 + Merge 글루 노드 수정, 배포 JSON 동기화 |
