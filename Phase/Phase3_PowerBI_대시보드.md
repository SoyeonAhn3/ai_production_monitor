# Phase 3 — Power BI 대시보드 `🔲 미시작`

> Power BI Desktop에서 Google Sheets(CSV Publish)를 Web connector로 연결하고, 3개 페이지 대시보드 + AI 시각화를 제작하여 Power BI Service에 게시한다.

**상태**: 🔲 미시작
**선행 조건**: Phase 2 완료 (이상 탐지 + AI 연동으로 데이터가 쌓이기 시작)

---

## 개요

Google Sheets에 저장된 분석 결과(production_results, production_week)를
"Publish to web" 기능으로 CSV 링크를 생성하고, Power BI Desktop에서 Web connector로 연결한다.
3개 페이지 대시보드를 제작하고, Power BI 내장 AI 시각화(Key Influencers, Decomposition Tree, Smart Narrative)를 배치하고,
Power BI Service에 게시하여 자동 새로고침(하루 8회, Gateway 필요)을 설정한다.
이상 탐지 이메일에 Power BI 대시보드 링크를 포함한다.

---

## 완료 예정 항목

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | Power BI Desktop → Google Sheets CSV Publish 연결 (Web connector) | 🔲 미시작 | production_week, production_results, line_master |
| 2 | 페이지 1: 실시간 현황 | 🔲 미시작 | hourly_summary + production_week |
| 3 | 페이지 2: 이상 탐지 & AI 인사이트 | 🔲 미시작 | anomaly_log |
| 4 | 페이지 3: 장기 트렌드 | 🔲 미시작 | daily_summary |
| 5 | Power BI AI 시각화 배치 | 🔲 미시작 | Key Influencers, Decomp. Tree, Smart Narrative |
| 6 | Power BI Service 게시 + 자동 새로고침 | 🔲 미시작 | 하루 8회, On-premises Gateway 필요 |
| 7 | 이메일에 Power BI 링크 포함 | 🔲 미시작 | 워크플로 B 이메일 템플릿 수정 |

---

## 페이지 1: 실시간 현황

### 데이터 소스
- hourly_summary (팀별 시간대별 집계)
- production_week.xlsx (라인별 상세)

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
- **필터**: "반복만" / "심각만" / 특정 라인
- **Decomposition Tree**: 이상건수 → severity → type → 라인 → pattern 드릴다운
- **AI 해석 표시**: 선택 건의 ai_insight 텍스트 (드릴스루 또는 툴팁)

---

## 페이지 3: 장기 트렌드

### 데이터 소스
- daily_summary

### 시각화 구성
- **추이 차트**: 일별/주별 달성률, 불량률, 이상 빈도
- **Smart Narrative**: 주간/월간 추이 AI 텍스트 요약
- 용도: 경영진용 — "이번 주가 지난 주보다 나아졌는지" 추세 확인

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
- Power BI는 "더 자세히 보고 싶을 때" 여는 상세 분석 도구

### 데이터 연결
- Google Sheets "Publish to web" → CSV URL 생성 (시트별)
- Power BI Desktop → Get Data → Web connector → CSV URL 입력
- Power BI Service 자동 새로고침: On-premises Data Gateway 설치 필요
- 대상 시트: production_week, production_results(4탭), line_master

### CSV Publish URL 형식
```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={SHEET_NAME}
```

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
