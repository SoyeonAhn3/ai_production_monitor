# Phase 3 — Power BI Dashboard `🔲 Not Started`

> Connect Google Sheets data via CSV Publish to Power BI, build a 3-page dashboard with AI visualizations, and publish to Power BI Service with auto-refresh.

**Completed**: —
**Status**: 🔲 Not Started
**Prerequisites**: Phase 2 completion (anomaly detection + AI integration producing data in Google Sheets)

---

## Overview

This phase connects analysis results stored in Google Sheets (production_results, production_week) to Power BI Desktop using Google Sheets "Publish to web" CSV URLs and the Web connector. A 3-page dashboard is built with built-in AI visualizations (Key Influencers, Decomposition Tree, Smart Narrative), then published to Power BI Service with auto-refresh (8x/day via On-premises Data Gateway). Alert emails from Workflow B include a link to the Power BI dashboard for detailed drill-down.

---

## Deliverables

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Power BI Desktop → Google Sheets CSV Publish connection (Web connector) | 🔲 Not Started | production_week, production_results, line_master |
| 2 | Page 1: Real-time Status | 🔲 Not Started | hourly_summary + production_week |
| 3 | Page 2: Anomaly Detection & AI Insights | 🔲 Not Started | anomaly_log |
| 4 | Page 3: Long-term Trends | 🔲 Not Started | daily_summary |
| 5 | Power BI AI visualizations | 🔲 Not Started | Key Influencers, Decomposition Tree, Smart Narrative |
| 6 | Power BI Service publish + auto-refresh | 🔲 Not Started | 8x/day, On-premises Data Gateway required |
| 7 | Include Power BI link in alert emails | 🔲 Not Started | Modify Workflow B email template |

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

## Page 1: Real-time Status

### Data Sources

- hourly_summary (team-level hourly aggregation)
- production_week (per-line detail)

### Visualizations

- **KPI Cards**: team achievement rate, operation rate
- **Line Charts**: per-line hourly production/operation rate trends
- **Key Influencers**: "factors most impacting low achievement rate" — automatic factor analysis
  - Requires ~300 rows minimum for stable results (~3 days of data)
- **Smart Narrative**: AI text summary referencing charts on the same page

---

## Page 2: Anomaly Detection & AI Insights

### Data Source

- anomaly_log

### Visualizations

- **KPI Cards**: anomaly count by severity
- **Distribution Chart**: anomalies by line
- **Timeline**: anomaly history with pattern_type (new / recurring / worsening)
- **Filters**: "recurring only" / "critical only" / specific line / "unsent alerts" (notification_status = "failed")
- **Alert Status KPI**: notification_status utilization — unsent alert count card + sent/failed/skipped slicer
- **Decomposition Tree**: anomaly count → severity → type → line → pattern drill-down
- **AI Insight Display**: selected item's ai_insight text (via drillthrough or tooltip)

---

## Page 3: Long-term Trends

### Data Source

- daily_summary

### Visualizations

- **Trend Charts**: daily/weekly achievement rate, defect rate, anomaly frequency
- **Smart Narrative**: weekly/monthly trend AI text summary
- **Purpose**: executive view — "is this week better than last week?"

---

## Power BI AI Visualizations

| Visualization | Page | Purpose |
|---|---|---|
| Key Influencers | 1 | Achievement rate decline factor analysis |
| Decomposition Tree | 2 | Multi-dimensional anomaly drill-down |
| Smart Narrative | 1, 3 | Chart-based AI text summary |

### Security

- Built-in Power BI feature, Microsoft ML.NET-based
- Processed within Microsoft tenant, no data sent to external AI services
- E3 terms: "Customer data is not used for AI training"

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

- Key Influencers requires ~300 rows minimum for stable results — early on, results may be sparse
- ai_parsed=false records should be filterable via a dedicated filter
- Join line_master as a lookup table to display line master information
- error_log tab Power BI connection is optional (include if error monitoring is needed)

---

## Change Log

| Date | Description |
|---|---|
| 2026-03-25 | Initial creation (spec v2.3) |
| 2026-04-13 | OneDrive Excel → Google Sheets CSV Publish, Gateway requirement added |
| 2026-05-02 | Spec v3.0: notification_status visualization added (unsent alert KPI, slicer) |
| 2026-05-08 | Document restructured to bilingual format (EN/KO) |

---
---

# Phase 3 — Power BI 대시보드 `🔲 미시작`

> Google Sheets 데이터를 CSV Publish로 Power BI에 연결하고, 3개 페이지 대시보드 + AI 시각화를 제작하여 Power BI Service에 게시한다.

**완료일**: —
**상태**: 🔲 미시작
**선행 조건**: Phase 2 완료 (이상 탐지 + AI 연동으로 Google Sheets에 데이터가 쌓이기 시작)

---

## 개요

Google Sheets에 저장된 분석 결과(production_results, production_week)를 "Publish to web" 기능으로 CSV 링크를 생성하고, Power BI Desktop에서 Web connector로 연결한다. 3개 페이지 대시보드를 제작하고, Power BI 내장 AI 시각화(Key Influencers, Decomposition Tree, Smart Narrative)를 배치하고, Power BI Service에 게시하여 자동 새로고침(하루 8회, On-premises Data Gateway 필요)을 설정한다. 이상 탐지 이메일에 Power BI 대시보드 링크를 포함한다.

---

## 완료 예정 / 완료 항목

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | Power BI Desktop → Google Sheets CSV Publish 연결 (Web connector) | 🔲 미시작 | production_week, production_results, line_master |
| 2 | 페이지 1: 실시간 현황 | 🔲 미시작 | hourly_summary + production_week |
| 3 | 페이지 2: 이상 탐지 & AI 인사이트 | 🔲 미시작 | anomaly_log |
| 4 | 페이지 3: 장기 트렌드 | 🔲 미시작 | daily_summary |
| 5 | Power BI AI 시각화 배치 | 🔲 미시작 | Key Influencers, Decomposition Tree, Smart Narrative |
| 6 | Power BI Service 게시 + 자동 새로고침 | 🔲 미시작 | 하루 8회, On-premises Data Gateway 필요 |
| 7 | 이메일에 Power BI 링크 포함 | 🔲 미시작 | 워크플로 B 이메일 템플릿 수정 |

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

## 페이지 1: 실시간 현황

### 데이터 소스

- hourly_summary (팀별 시간대별 집계)
- production_week (라인별 상세)

### 시각화 구성

- **KPI 카드**: 팀별 달성률, 가동률
- **꺾은선 차트**: 라인별 시간대별 생산량/가동률 추이
- **Key Influencers**: "달성률이 낮아지는 데 가장 큰 영향을 주는 요인" 자동 분석
  - 최소 300행 축적 후 안정적 결과 (약 3일치)
- **Smart Narrative**: 같은 페이지 차트 참조 AI 텍스트 요약

---

## 페이지 2: 이상 탐지 & AI 인사이트

### 데이터 소스

- anomaly_log

### 시각화 구성

- **KPI 카드**: 심각도별 건수
- **분포 차트**: 라인별 이상 분포
- **타임라인**: 이상 이력 + pattern_type(신규/반복/악화) 표시
- **필터**: "반복만" / "심각만" / 특정 라인 / "알림 미발송만" (notification_status = "failed")
- **알림 상태 KPI**: notification_status 활용 — "알림 미발송" 건수 카드 + sent/failed/skipped 슬라이서
- **Decomposition Tree**: 이상건수 → severity → type → 라인 → pattern 드릴다운
- **AI 해석 표시**: 선택 건의 ai_insight 텍스트 (드릴스루 또는 툴팁)

---

## 페이지 3: 장기 트렌드

### 데이터 소스

- daily_summary

### 시각화 구성

- **추이 차트**: 일별/주별 달성률, 불량률, 이상 빈도
- **Smart Narrative**: 주간/월간 추이 AI 텍스트 요약
- **용도**: 경영진용 — "이번 주가 지난 주보다 나아졌는지" 추세 확인

---

## Power BI AI 시각화

| 시각화 | 페이지 | 용도 |
|---|---|---|
| Key Influencers | 1 | 달성률 저하 영향 요인 자동 분석 |
| Decomposition Tree | 2 | 이상건수 다차원 드릴다운 |
| Smart Narrative | 1, 3 | 차트 기반 AI 텍스트 요약 |

### 보안

- Power BI 내장 기능, Microsoft ML.NET 기반
- Microsoft 테넌트 내에서 처리, 외부 AI 서비스에 데이터 미전송
- E3 약관: "고객 데이터를 AI 학습에 사용하지 않음"

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

- Key Influencers는 최소 300행 축적 후 안정적 결과 — 초기에는 데이터 부족으로 결과가 빈약할 수 있음
- ai_parsed=false 건은 별도 필터로 확인 가능하도록 설계
- line_master를 조인용으로 연결하여 라인 마스터 정보 표시
- error_log 탭의 Power BI 연결은 선택적 (에러 모니터링 필요 시)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-03-25 | 최초 작성 (명세서 v2.3 기반) |
| 2026-04-13 | OneDrive Excel → Google Sheets CSV Publish 전환, Gateway 요구사항 추가 |
| 2026-05-02 | 명세서 v3.0 반영: notification_status 활용 시각화 추가 (알림 미발송 KPI, 슬라이서) |
| 2026-05-08 | 문서 구조 이중 언어(EN/KO) 형식으로 재편 |
