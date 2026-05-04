# Phase 3 — Power BI 대시보드 `🔲 미시작`

> Power BI Desktop에서 Google Sheets(CSV Publish)를 Web connector로 연결하고, 2개 페이지 대시보드를 제작하여 Power BI Service에 게시한다.

**상태**: 🔲 미시작
**선행 조건**: Phase 2 완료 (이상 탐지 + AI 연동으로 데이터가 쌓이기 시작)

---

## 개요

Google Sheets에 저장된 분석 결과(production_results, production_week)를
"Publish to web" 기능으로 CSV 링크를 생성하고, Power BI Desktop에서 Web connector로 연결한다.
2개 페이지 대시보드를 제작하고, Power BI 내장 AI 시각화(Decomposition Tree)를 배치하고,
Power BI Service에 게시하여 자동 새로고침(하루 8회, Gateway 필요)을 설정한다.
이상 탐지 이메일에 Power BI 대시보드 링크를 포함한다.

---

## 완료 예정 항목

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | Power BI Desktop → Google Sheets CSV Publish 연결 (Web connector) | 🔲 미시작 | production_week, anomaly_log, line_master |
| 2 | 페이지 1: 생산 현황 Overview | 🔲 미시작 | production_week + line_master |
| 3 | 페이지 2: 이상 탐지 & AI 인사이트 | 🔲 미시작 | anomaly_log |
| 4 | Power BI AI 시각화 배치 | 🔲 미시작 | Decomposition Tree |
| 5 | Power BI Service 게시 + 자동 새로고침 | 🔲 미시작 | 하루 8회, On-premises Gateway 필요 |
| 6 | 이메일에 Power BI 링크 포함 | 🔲 미시작 | 워크플로 B 이메일 템플릿 수정 |

---

## 페이지 1: 생산 현황 Overview

### 데이터 소스
- production_week (라인별 상세)
- line_master (라인/팀 조인)

### 시각화 구성 (5개)

| # | 시각화 | 용도 |
|---|---|---|
| 1 | KPI 카드 — 평균 달성률 | 전체 생산 목표 대비 현황 |
| 2 | KPI 카드 — 평균 가동률 | 설비 활용 수준 |
| 3 | KPI 카드 — 총 생산량 | 당일 총 생산 규모 |
| 4 | 꺾은선 차트 — 라인별 시간대별 생산량 | 정상 vs 이상 구간 대비, 시간 흐름에 따른 변화 |
| 5 | 막대 차트 — 팀별 달성률 비교 | 팀 간 성과 차이 시각화 |

---

## 페이지 2: 이상 탐지 & AI 인사이트

### 데이터 소스
- anomaly_log

### 시각화 구성 (5개)

| # | 시각화 | 용도 |
|---|---|---|
| 1 | KPI 카드 — 심각 건수 | 즉시 대응 필요 건 파악 |
| 2 | KPI 카드 — 중간 건수 | 주의 필요 건 파악 |
| 3 | KPI 카드 — 낮음 건수 | 모니터링 대상 건 파악 |
| 4 | Decomposition Tree | severity → type → line → pattern 드릴다운 (AI 시각화) |
| 5 | 테이블 (조건부 서식) | 이상 목록 + ai_insight 컬럼으로 Claude AI 분석 결과 직접 표시 |

### 테이블 컬럼 구성
- date, hour, line_id, anomaly_type, severity (조건부 서식: 심각=빨강, 중간=노랑, 낮음=초록)
- pattern_type (신규/반복/악화)
- ai_insight (AI 근본 원인 분석 텍스트)

---

## Power BI AI 시각화

| 시각화 | 페이지 | 용도 |
|---|---|---|
| Decomposition Tree | 2 | 이상건수 다차원 드릴다운 |

### 보안
- Power BI 내장 기능, Microsoft ML.NET 기반
- Microsoft 테넌트 내에서 처리, 외부 AI 서비스에 데이터 미전송
- E3 약관: "고객 데이터를 AI 학습에 사용하지 않음"

---

## 간소화 결정 사항

| 삭제 항목 | 이유 |
|---|---|
| 페이지 3 (장기 트렌드) | 1일치 데모 데이터로 트렌드 분석 무의미 |
| Key Influencers | 300행 미만이면 결과 빈약 → 포트폴리오 퀄리티 저하 |
| Smart Narrative | 핵심 전달에 불필요 |
| notification_status 슬라이서 | 운영 모니터링용 — 포트폴리오에서 불필요 |
| hourly_summary 연결 | production_week에서 직접 집계 가능 |

---

## Power BI Service 게시

### 자동 새로고침
- 하루 8회 (Power BI Pro, E3 포함)
- 긴급 알림은 이메일로 60분 이내 도착하므로 새로고침 주기와 무관
- Power BI는 "더 자세히 보고 싶을 때" 여는 상세 분석 도구

### 데이터 연결
- Google Sheets "Publish to web" → CSV URL 생성 (시트별)
- Power BI Desktop → Get Data → Web connector → CSV URL 입력
- Power BI Service 자동 새로고침: On-premises Data Gateway 설치 필요
- 대상 시트: production_week, anomaly_log, line_master

### CSV Publish URL 형식
```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={SHEET_NAME}
```

---

## 설계 결정 사항

- **2페이지 구성 이유**: 페이지 1은 생산 현황 맥락 제공, 페이지 2는 AI 가치 증명. 포트폴리오 핵심 메시지인 "AI가 이상을 감지하고 원인을 분석"에 집중.
- **Decomposition Tree 선택 이유**: 데이터 행수 제약 없이 작동하며, 드릴다운 인터랙션이 포트폴리오 시연에 효과적.
- **날짜/시간 컬럼 분리**: 날짜별 슬라이서 + 시간대별 X축 별도 활용.
- **Power BI 새로고침 주기**: 실시간 알림은 이메일 담당, Power BI는 상세 분석용. 하루 8회면 충분.

---

## 선행 조건 및 의존성

- Phase 2 완료 (anomaly_log에 데이터 존재)
- Power BI Desktop 설치
- Power BI Pro 라이선스 (E3 포함)
- Google Sheets "Publish to web" 설정 완료
- On-premises Data Gateway 설치 (Service 자동 새로고침용)

---

## 개발 시 주의사항

- ai_parsed=false 건은 테이블에서 별도 표시 가능하도록 설계
- line_master를 조인용으로 연결하여 라인 마스터 정보 표시
- 테이블 조건부 서식: severity 기준 색상 구분 필수

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-03-25 | 최초 작성 (명세서 v2.3 기반) |
| 2026-04-13 | OneDrive Excel → Google Sheets CSV Publish 전환, Gateway 요구사항 추가 |
| 2026-05-02 | 명세서 v3.0 반영: notification_status 활용 시각화 추가 |
| 2026-05-04 | 3페이지 → 2페이지 간소화: Key Influencers/Smart Narrative/장기 트렌드 제거, 핵심 시각화 10개로 축소 |
