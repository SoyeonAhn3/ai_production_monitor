# Phase 3 — Power BI Dashboard `🔲 Not Started`

> Connect Google Sheets data via CSV Publish to Power BI, build a 2-page dashboard, and publish to Power BI Service with auto-refresh.

**Completed**: —
**Status**: 🔲 Not Started
**Prerequisites**: Phase 2 completion (anomaly detection + AI integration producing data in Google Sheets)

---

## Overview

This phase connects analysis results stored in Google Sheets (production_results, production_week) to Power BI Desktop using Google Sheets "Publish to web" CSV URLs and the Web connector. A 2-page dashboard is built, then published to Power BI Service with auto-refresh (8x/day via On-premises Data Gateway). Alert emails from Workflow B include a link to the Power BI dashboard for detailed drill-down.

> **Note**: Power BI AI visualizations (Smart Narrative, Key Influencers) are unavailable in the current tenant. The dashboard uses standard visuals only. Key Influencers can be added later when the tenant enables AI visuals and sufficient data (~300 rows) is accumulated.

---

## Deliverables

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Power BI Desktop → Google Sheets CSV Publish connection (Web connector) | 🔲 Not Started | production_week, production_results, line_master |
| 2 | Page 1: Production Overview | 🔲 Not Started | hourly_summary + production_week |
| 3 | Page 2: Anomaly Detection & AI Insights | 🔲 Not Started | anomaly_log |
| 4 | Power BI Service publish + auto-refresh | 🔲 Not Started | 8x/day, On-premises Data Gateway required |
| 5 | Include Power BI link in alert emails | 🔲 Not Started | Modify Workflow B email template |

---

## Data Connection

### Method

Google Sheets "Publish to web" → CSV URL → Power BI Desktop Web connector

### CSV Publish URL Format

```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={SHEET_NAME}
```

### Connected Sheets

| Google Sheet | Tab(s) | Purpose |
|---|---|---|
| production_week | production_week | Weekly raw data (25 columns, up to ~720 rows) |
| production_results | hourly_summary, anomaly_log, daily_summary, error_log | Analysis results (4 tabs) |
| line_master | line_master | Line/team configuration — Single Source of Truth |

---

## Page 1: Production Overview

### Data Sources

- hourly_summary (team-level hourly aggregation)
- production_week (per-line detail)

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  ■ Production Overview                [Date▼]  [Team▼]  │
├────────────┬────────────┬────────────┬───────────────────┤
│ Achievement│ Defect Rate│ Op. Rate   │ Lowest Op. Line   │
│   87.3%    │   2.1%     │   91.5%    │   L07 — 78%      │
├────────────┴────────────┴────────────┴───────────────────┤
│                          │                               │
│  Hourly Production       │  Operation Rate by Line       │
│  by Team (Line Chart)    │  (Line Chart)                 │
│                          │                               │
└──────────────────────────┴───────────────────────────────┘
```

### Visualizations

| # | Visual | Type | Field | Notes |
|---|---|---|---|---|
| 1 | Achievement Rate | Card | `hourly_summary.달성률(%)` AVG | Color: teal `#00897b` |
| 2 | Defect Rate | Card | Measure: 불량합계/실적합계×100 | Color: amber `#f9a825` |
| 3 | Operation Rate | Card | `hourly_summary.평균가동률(%)` AVG | Color: navy `#1a237e` |
| 4 | Lowest Op. Line | Card | Measure: MIN 시간당가동률(%) line | Color: red `#d32f2f` |
| 5 | Hourly Production by Team | Line Chart | X: 시간, Y: 실적합계, Legend: 팀 | Left 60% |
| 6 | Operation Rate by Line | Line Chart | X: 시간, Y: 시간당가동률(%), Legend: 라인명 | Right 40% |
| 7 | Date Slicer | Slicer (dropdown) | 날짜 | Top-right |
| 8 | Team Slicer | Slicer (dropdown) | 팀 | Top-right |

---

## Page 2: Anomaly Detection & AI Insights

### Data Source

- anomaly_log

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  ■ Anomaly Detection & AI   [Severity▼] [Pattern▼] [Line▼]│
├──────────┬──────────┬──────────┬─────────────────────────┤
│ Critical │ Warning  │ Failed   │                         │
│    3     │    7     │    1     │  Anomalies by Line      │
├──────────┴──────────┴──────────┤  (Stacked Bar Chart)    │
│                                │                         │
│  Anomaly Log Table             ├─────────────────────────┤
│  날짜|시간|라인|유형|심각도|패턴  │                         │
│  ───────────────────────────── │  AI Root Cause Analysis  │
│  (rows...)                     │  (Card — ai_insight)    │
│                                │                         │
└────────────────────────────────┴─────────────────────────┘
```

### Visualizations

| # | Visual | Type | Field | Notes |
|---|---|---|---|---|
| 1 | Critical Count | Card | CALCULATE COUNT severity="critical" | Color: red `#d32f2f` |
| 2 | Warning Count | Card | CALCULATE COUNT severity="warning" | Color: amber `#f9a825` |
| 3 | Alerts Failed | Card | CALCULATE COUNT notification_status="failed" | Color: red outline |
| 4 | Anomalies by Line | Stacked Bar (horizontal) | Y: 라인명, X: COUNT, Legend: severity | critical=red, warning=amber, info=gray |
| 5 | Anomaly Log | Table | 날짜, 시간, 라인명, type, severity, pattern_type, detail | Header: navy bg, white text. Conditional formatting on severity |
| 6 | AI Root Cause Analysis | Card (large) | ai_insight (First value) | Background: `#e3f2fd`. Cross-filtered by table row selection |
| 7 | Severity Slicer | Slicer (dropdown) | severity | Top-right |
| 8 | Pattern Slicer | Slicer (dropdown) | pattern_type | Top-right |
| 9 | Line Slicer | Slicer (dropdown) | 라인명 | Top-right |

### AI Insight Display

- `ai_insight` column contains pre-generated text from Claude API (Phase 2)
- Power BI does NOT run AI — it simply displays stored text via a Card visual
- When user clicks a row in the Anomaly Log table → cross-filter → Card shows that row's ai_insight

---

## Design System

| Property | Value |
|---|---|
| Primary (navy) | `#1a237e` |
| Accent (teal) | `#00897b` |
| Danger (red) | `#d32f2f` |
| Warning (amber) | `#f9a825` |
| Background (light gray) | `#f5f5f5` |
| AI card background | `#e3f2fd` |
| Font | Segoe UI / Segoe UI Semibold |
| Card value size | 36–40pt |
| Chart title size | 14pt |
| Border radius | 8px |

---

## Power BI Service Publishing

### Auto-refresh

- 8x/day (Power BI Pro, included in E3 license)
- Urgent alerts arrive via email within 60 minutes — Power BI is for detailed analysis, not real-time alerting
- On-premises Data Gateway installation required for Service auto-refresh

### Email Integration

- Include Power BI dashboard link in Workflow B alert emails
- Users can click through from email to dashboard for drill-down analysis

---

## Design Decisions

- **2-page structure**: Page 3 (long-term trends) deferred until daily_summary accumulates 2+ weeks of data. Date slicer on Page 1 provides basic date comparison in the meantime.
- **No AI visualizations (Smart Narrative, Key Influencers)**: Tenant does not enable Power BI AI visuals. Replaced with additional KPI cards (Lowest Op. Line, Target Gap). Key Influencers can be added later when enabled and ~300 rows accumulated.
- **AI Insight = stored text, not live AI**: The ai_insight field in anomaly_log is pre-generated by Claude API in Phase 2. Power BI displays it as a simple Card visual with cross-filtering.
- **hourly_summary pre-aggregation**: production_week has per-line detail, but "team-wide achievement rate trends" require line-level aggregation every time. Pre-aggregating improves Power BI performance and simplifies chart configuration.
- **Date/time column separation**: enables date-based slicer + time-based X-axis independently, and allows "compare same time slot across different days."
- **8x/day refresh frequency**: real-time alerts are handled by email; Power BI serves as the detailed analysis tool. 8x/day is sufficient.

---

## Prerequisites & Dependencies

- Phase 2 completion (anomaly_log, hourly_summary, daily_summary populated with data)
- Power BI Desktop installed
- Power BI Pro license (included in E3)
- Google Sheets "Publish to web" configured for each sheet
- On-premises Data Gateway installed (for Service auto-refresh)

---

## Development Notes

- ai_parsed=false records should be filterable via a dedicated filter
- Join line_master as a lookup table to display line master information
- error_log tab Power BI connection is optional (include if error monitoring is needed)
- When tenant enables AI visuals in the future: add Key Influencers to Page 1, Decomposition Tree to Page 2

---

## Future Enhancements (Post-MVP)

| Item | Trigger | Notes |
|---|---|---|
| Page 3: Long-term Trends | daily_summary has 2+ weeks of data | daily/weekly achievement, defect, anomaly trends |
| Key Influencers | Tenant enables AI visuals + 300 rows | "factors most impacting low achievement rate" |
| Decomposition Tree | Tenant enables AI visuals | anomaly count → severity → type → line drill-down |
| Smart Narrative | Tenant enables AI visuals | Chart-based AI text summary |

---

## Change Log

| Date | Description |
|---|---|
| 2026-03-25 | Initial creation (spec v2.3) |
| 2026-04-13 | OneDrive Excel → Google Sheets CSV Publish, Gateway requirement added |
| 2026-05-02 | Spec v3.0: notification_status visualization added (unsent alert KPI, slicer) |
| 2026-05-08 | Document restructured to bilingual format (EN/KO) |
| 2026-05-11 | 3-page → 2-page simplification. Smart Narrative removed (tenant restriction). Layout specs and design system added |

---
---

# Phase 3 — Power BI 대시보드 `🔲 미시작`

> Google Sheets 데이터를 CSV Publish로 Power BI에 연결하고, 2개 페이지 대시보드를 제작하여 Power BI Service에 게시한다.

**완료일**: —
**상태**: 🔲 미시작
**선행 조건**: Phase 2 완료 (이상 탐지 + AI 연동으로 Google Sheets에 데이터가 쌓이기 시작)

---

## 개요

Google Sheets에 저장된 분석 결과(production_results, production_week)를 "Publish to web" 기능으로 CSV 링크를 생성하고, Power BI Desktop에서 Web connector로 연결한다. 2개 페이지 대시보드를 제작하고, Power BI Service에 게시하여 자동 새로고침(하루 8회, On-premises Data Gateway 필요)을 설정한다. 이상 탐지 이메일에 Power BI 대시보드 링크를 포함한다.

> **참고**: 현재 테넌트에서 Power BI AI 시각화(Smart Narrative, Key Influencers)가 비활성화 상태. 표준 시각화만 사용한다. 테넌트 활성화 및 데이터 축적(~300행) 이후 Key Influencers 추가 가능.

---

## 완료 예정 / 완료 항목

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | Power BI Desktop → Google Sheets CSV Publish 연결 (Web connector) | 🔲 미시작 | production_week, production_results, line_master |
| 2 | 페이지 1: 생산 현황 | 🔲 미시작 | hourly_summary + production_week |
| 3 | 페이지 2: 이상 탐지 & AI 인사이트 | 🔲 미시작 | anomaly_log |
| 4 | Power BI Service 게시 + 자동 새로고침 | 🔲 미시작 | 하루 8회, On-premises Data Gateway 필요 |
| 5 | 이메일에 Power BI 링크 포함 | 🔲 미시작 | 워크플로 B 이메일 템플릿 수정 |

---

## 데이터 연결

### 방식

Google Sheets "Publish to web" → CSV URL → Power BI Desktop Web connector

### CSV Publish URL 형식

```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={SHEET_NAME}
```

### 연결 대상 시트

| Google Sheets | 탭(시트) | 용도 |
|---|---|---|
| production_week | production_week | 이번 주 raw data (25개 컬럼, 최대 720행) |
| production_results | hourly_summary, anomaly_log, daily_summary, error_log | 분석 결과 (4개 탭) |
| line_master | line_master | 라인/팀 구성 (SSOT) |

---

## 페이지 1: 생산 현황

### 데이터 소스

- hourly_summary (팀별 시간대별 집계)
- production_week (라인별 상세)

### 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│  ■ 생산 현황                          [날짜▼]  [팀▼]    │
├────────────┬────────────┬────────────┬───────────────────┤
│  달성률     │  불량률     │  가동률    │  최저가동라인      │
│  87.3%     │  2.1%      │  91.5%     │  L07 — 78%       │
├────────────┴────────────┴────────────┴───────────────────┤
│                          │                               │
│  시간별 팀 생산량         │  라인별 가동률 추이             │
│  (꺾은선 차트)            │  (꺾은선 차트)                 │
│                          │                               │
└──────────────────────────┴───────────────────────────────┘
```

### 시각화 구성

| # | 시각화 | 타입 | 필드 | 비고 |
|---|---|---|---|---|
| 1 | 달성률 | 카드 | `hourly_summary.달성률(%)` 평균 | 색상: teal `#00897b` |
| 2 | 불량률 | 카드 | Measure: 불량합계/실적합계×100 | 색상: amber `#f9a825` |
| 3 | 가동률 | 카드 | `hourly_summary.평균가동률(%)` 평균 | 색상: navy `#1a237e` |
| 4 | 최저가동라인 | 카드 | Measure: MIN 시간당가동률(%) 라인 | 색상: red `#d32f2f` |
| 5 | 시간별 팀 생산량 | 꺾은선 차트 | X축: 시간, Y축: 실적합계, 범례: 팀 | 좌측 60% |
| 6 | 라인별 가동률 추이 | 꺾은선 차트 | X축: 시간, Y축: 시간당가동률(%), 범례: 라인명 | 우측 40% |
| 7 | 날짜 슬라이서 | 슬라이서 (드롭다운) | 날짜 | 우상단 |
| 8 | 팀 슬라이서 | 슬라이서 (드롭다운) | 팀 | 우상단 |

---

## 페이지 2: 이상 탐지 & AI 인사이트

### 데이터 소스

- anomaly_log

### 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│  ■ 이상 탐지 & AI            [심각도▼] [패턴▼] [라인▼]   │
├──────────┬──────────┬──────────┬─────────────────────────┤
│ Critical │ Warning  │ 미발송    │                         │
│    3     │    7     │    1     │  라인별 이상 건수         │
├──────────┴──────────┴──────────┤  (가로 막대 차트)        │
│                                │                         │
│  이상 이력 테이블               ├─────────────────────────┤
│  날짜|시간|라인|유형|심각도|패턴  │                         │
│  ───────────────────────────── │  AI 분석 결과            │
│  (행들...)                     │  (카드 — ai_insight)     │
│                                │                         │
└────────────────────────────────┴─────────────────────────┘
```

### 시각화 구성

| # | 시각화 | 타입 | 필드 | 비고 |
|---|---|---|---|---|
| 1 | Critical 건수 | 카드 | CALCULATE COUNT severity="critical" | 색상: red `#d32f2f` |
| 2 | Warning 건수 | 카드 | CALCULATE COUNT severity="warning" | 색상: amber `#f9a825` |
| 3 | 알림 미발송 | 카드 | CALCULATE COUNT notification_status="failed" | 색상: red 테두리 |
| 4 | 라인별 이상 건수 | 누적 가로 막대 | Y축: 라인명, X축: COUNT, 범례: severity | critical=빨강, warning=주황, info=회색 |
| 5 | 이상 이력 | 테이블 | 날짜, 시간, 라인명, type, severity, pattern_type, detail | 머리글: navy 배경 흰색 텍스트. severity 조건부 서식 |
| 6 | AI 분석 결과 | 카드 (대형) | ai_insight (첫 번째 값) | 배경: `#e3f2fd`. 테이블 행 선택 시 cross-filter로 표시 |
| 7 | 심각도 슬라이서 | 슬라이서 (드롭다운) | severity | 우상단 |
| 8 | 패턴 슬라이서 | 슬라이서 (드롭다운) | pattern_type | 우상단 |
| 9 | 라인 슬라이서 | 슬라이서 (드롭다운) | 라인명 | 우상단 |

### AI Insight 표시 방식

- `ai_insight` 컬럼은 Claude API가 Phase 2에서 미리 생성한 텍스트
- Power BI가 AI를 돌리는 것이 아님 — 저장된 텍스트를 카드 시각화로 읽어오는 것
- 이상 이력 테이블에서 행 클릭 → cross-filter → 카드에 해당 건의 ai_insight만 표시

---

## 디자인 시스템

| 속성 | 값 |
|---|---|
| Primary (navy) | `#1a237e` |
| Accent (teal) | `#00897b` |
| Danger (red) | `#d32f2f` |
| Warning (amber) | `#f9a825` |
| 배경 (light gray) | `#f5f5f5` |
| AI 카드 배경 | `#e3f2fd` |
| 글꼴 | Segoe UI / Segoe UI Semibold |
| 카드 값 크기 | 36–40pt |
| 차트 제목 크기 | 14pt |
| 모서리 반경 | 8px |

---

## Power BI Service 게시

### 자동 새로고침

- 하루 8회 (Power BI Pro, E3 포함)
- 긴급 알림은 이메일로 60분 이내 도착하므로 새로고침 주기와 무관
- On-premises Data Gateway 설치 필요

### 이메일 연계

- 워크플로 B 알림 이메일에 Power BI 대시보드 링크 포함
- 이메일에서 클릭하면 대시보드로 이동하여 상세 분석 가능

---

## 설계 결정 사항

- **2페이지 구조**: 페이지 3(장기 트렌드)은 daily_summary가 2주 이상 쌓인 후 추가 예정. 페이지 1의 날짜 슬라이서로 기본적인 날짜 비교 가능.
- **AI 시각화 미사용 (Smart Narrative, Key Influencers)**: 현재 테넌트에서 Power BI AI 시각화 비활성화 상태. KPI 카드(최저가동라인, 목표갭)로 대체. 테넌트 활성화 및 ~300행 축적 후 Key Influencers 추가 가능.
- **AI Insight = 저장된 텍스트, 실시간 AI 아님**: anomaly_log의 ai_insight 필드는 Phase 2에서 Claude API가 미리 생성한 텍스트. Power BI는 단순 카드 시각화로 cross-filter 표시.
- **hourly_summary 별도 저장 이유**: production_week에 라인별 상세가 있지만, "팀 전체 달성률 추이"를 보려면 매번 라인 합산 필요. 미리 집계하면 Power BI 성능 향상 + 차트 설정 간편.
- **날짜/시간 컬럼 분리**: 날짜별 슬라이서 + 시간대별 X축 별도 활용, "같은 시간대의 요일별 비교" 가능.
- **Power BI 새로고침 주기**: 실시간 알림은 이메일 담당, Power BI는 상세 분석용. 하루 8회면 충분.

---

## 선행 조건 및 의존성

- Phase 2 완료 (anomaly_log, hourly_summary, daily_summary에 데이터 존재)
- Power BI Desktop 설치
- Power BI Pro 라이선스 (E3 포함)
- Google Sheets "Publish to web" 설정 완료
- On-premises Data Gateway 설치 (Service 자동 새로고침용)

---

## 개발 시 주의사항

- ai_parsed=false 건은 별도 필터로 확인 가능하도록 설계
- line_master를 조인용으로 연결하여 라인 마스터 정보 표시
- error_log 탭의 Power BI 연결은 선택적 (에러 모니터링 필요 시)
- 테넌트에서 AI 시각화 활성화 시: 페이지 1에 Key Influencers, 페이지 2에 Decomposition Tree 추가

---

## 향후 확장 (MVP 이후)

| 항목 | 트리거 | 비고 |
|---|---|---|
| 페이지 3: 장기 트렌드 | daily_summary 2주 이상 축적 | 일별/주별 달성률, 불량률, 이상 빈도 추이 |
| Key Influencers | 테넌트 AI 시각화 활성화 + 300행 | "달성률이 낮아지는 데 가장 큰 영향을 주는 요인" |
| Decomposition Tree | 테넌트 AI 시각화 활성화 | 이상건수 → severity → type → 라인 드릴다운 |
| Smart Narrative | 테넌트 AI 시각화 활성화 | 차트 기반 AI 텍스트 요약 |

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-03-25 | 최초 작성 (명세서 v2.3 기반) |
| 2026-04-13 | OneDrive Excel → Google Sheets CSV Publish 전환, Gateway 요구사항 추가 |
| 2026-05-02 | 명세서 v3.0 반영: notification_status 활용 시각화 추가 (알림 미발송 KPI, 슬라이서) |
| 2026-05-08 | 문서 구조 이중 언어(EN/KO) 형식으로 재편 |
| 2026-05-11 | 3페이지 → 2페이지 간소화. Smart Narrative 제거 (테넌트 제한). 레이아웃 명세 및 디자인 시스템 추가 |
