🌐 [한국어](./README_ko.md) | [English](./README.md)

# AI BI Assistant

> 생산 실적 이상 탐지 자동화 + AI 원인 분석 + Power BI 대시보드

## 개요

제조 현장에서는 생산 이상(지연, 불량 급증, 설비 고장)을 사람이 수동으로 발견하는 경우가 많아, 대응이 늦어지는 문제가 있습니다. 이 시스템은 전체 루프를 자동화합니다: Google Sheets의 시간별 생산 데이터를 모니터링하고, Config-driven 룰 기반으로 이상을 탐지하고, 패턴을 분류(신규/반복/악화)하고, 심각한 건에 대해 Claude API로 근본 원인을 분석하고, 심각도별 이메일 알림을 발송하고, Power BI 대시보드에서 상세 분석을 확인할 수 있습니다.

포트폴리오/데모 목적으로 제작. 핵심 로직(이상 탐지, AI 해석, 알림, 대시보드)은 실무 수준으로 설계. 인증, 멀티 사용자, 운영 레이어는 문서화되었으나 미구현 ([실제 현장 적용 가이드](#문서) 참조).

## 목차

- [동작 흐름](#동작-흐름)
- [기술 스택](#기술-스택)
- [AI 구성 요소](#ai-구성-요소)
- [신뢰성](#신뢰성)
- [빠른 시작](#빠른-시작)
- [프로젝트 구조](#프로젝트-구조)
- [현재 상태](#현재-상태)
- [문서](#문서)
- [한계점](#한계점)
- [향후 계획](#향후-계획)

## 동작 흐름

```
Google Sheets (시간별 생산 데이터, 외부에서 추가)
  → n8n 셀프호스팅 npm (60분 스케줄 / 테스트 시 Webhook)
    → JavaScript 이상 탐지 (Config-driven: rules.json + engine.js)
      → JavaScript 패턴 1차 분류 (규칙 기반, 로컬)
        → Claude API (심각/악화 건만, 마스킹 데이터)
          → Gmail 알림 (심각+중간: 즉시 / 전체: 매일 07:40 일일 리포트)
            → Google Sheets 결과 저장
              → Power BI Service 대시보드 (CSV Publish + Web connector, 하루 8회 자동 새로고침)
```

## 기술 스택

| 기술 | 역할 | 선택 이유 |
|---|---|---|
| Google Sheets | 데이터 저장 (입력/출력 전체) | 무료, 서비스 계정 API 연동 안정적; OneDrive Excel OAuth2 credential 문제로 전환 |
| n8n (npm 셀프호스팅) | 워크플로 오케스트레이션 | 무료, Docker/WSL2 없이 실행; 워크플로 4개 (시뮬레이터, 모니터, 주간 백업, 일일 리포트) |
| JavaScript (n8n Code 노드) | 이상 탐지 + 패턴 분류 | npm 설치 n8n은 JS 네이티브 지원; 데모 규모에서 표준 연산으로 충분 |
| Claude API (Anthropic) | AI 근본 원인 분석 + 패턴 검증 | 심각/악화 건만 호출; 마스킹 처리로 보안 확보; 월 약 $1-3 |
| Claude API Tool Use | AI Agent 일일 리포트 (워크플로 D) | Agent가 자율적으로 데이터 조회하고 심각도에 따라 리포트 깊이 조절; 월 +$0.2-0.5 |
| Gmail (n8n 노드) | 이메일 알림 (즉시 + 일일 리포트) | 무료, n8n 네이티브 통합 |
| Power BI Pro (E3) | 대시보드 + AI 시각화 | Key Influencers, Decomposition Tree, Smart Narrative; CSV Publish + Web connector 연결 |
| googleapis + google-auth-library | 데이터 생성 스크립트 | 서비스 계정 인증으로 초기 데이터 설정 |

## AI 구성 요소

이 프로젝트는 3개 레이어에서 AI를 활용하며, 각각 역할이 다릅니다:

### 레이어 1 — JavaScript 이상 탐지 (로컬, AI 없음)

Config-driven 엔진 (`rules.json` + `engine.js`)이 8가지 탐지 룰 × 3단계 심각도로 시간별 생산 데이터를 평가합니다. n8n Code 노드 내에서 실행되며, 외부 API 호출 없이 비용 0원입니다.

| # | 탐지 항목 | 비교 타입 | 심각 | 중간 | 낮음 |
|---|---|---|---|---|---|
| 1 | 생산량 급감 | drop_rate | 40%+ 감소 | 20-40% | 5-20% |
| 2 | 가동률 저하 | below_threshold | 30% 미만 | 30-50% | 50-70% |
| 3 | 불량률 급등 | exceeds_baseline | 정상의 5배+ | 3-5배 | 2-3배 |
| 4 | 달성률 지연 | below_threshold | 갭 -30%p 이하 | -15~-30%p | -5~-15%p |
| 5 | 생산 정체 | consecutive_zero | 3시간+ 연속 0 | 2시간 | 1시간 |
| 6 | 폐기 발생 | above_threshold | 폐기율 3%+ | 1-3% | 1% 미만 |
| 7 | 복합 이상 | compound (AND) | 30%↓+3배↑ | 15%↓+2배↑ | 5%↓+1.5배↑ |
| 8 | 가동률 급락 | drop_points | 50%p+ 하락 | 30-50%p | 15-30%p |

### 레이어 2 — JavaScript 패턴 분류 (로컬, AI 없음)

`anomaly_log`에서 최근 7일 이력을 조회하여 각 이상을 분류:
- **신규**: 동일 라인+유형 이전 기록 0회
- **반복**: 1-2회 이전 발생
- **악화**: 3회+ 발생 또는 심각도 상승 추세

"악화"로 분류된 낮음 심각도 건은 심각으로 에스컬레이션됩니다.

### 레이어 3 — Claude API 분석 (심각/악화 건만)

- 동시 발생한 심각+악화 건을 1회 API 호출로 묶어 처리
- 마스킹 처리 후 전송 (라인명 → `LINE_A`, 품목 → `PROD_01`)
- AI가 패턴 분류를 검증 ("동의" 또는 "보정 + 이유")
- AI가 근본 원인 제언 및 라인 간 교차 영향 분석 생성
- JSON 응답 파싱; 실패 시 원문 텍스트 저장 (폴백, `ai_parsed` 컬럼으로 추적)

### 레이어 4 — AI Agent 일일 리포트 (워크플로 D, Tool Use)

Claude API Agent에게 4개 도구를 제공하여 자율적으로 데이터를 조회하고 일일 리포트를 생성:
- `get_anomaly_log`: 날짜/심각도/라인별 이상 이력 조회
- `get_daily_summary`: 날짜/팀별 일일 요약 조회
- `get_line_master`: 라인/팀 구성 정보 조회
- `get_hourly_detail`: 날짜/라인별 시간대별 상세 조회

Agent가 심각도에 따라 리포트 깊이를 자율 조절: 간단 (심각 0건) → 보통 (심각 1-2건) → 상세 + 추세 분석 (심각 3건+ 또는 악화 추세). 도구 호출 최대 8회, 실패 시 고정 포맷 리포트로 폴백.

### 데이터 보안

| 레벨 | 설명 | 외부 전송 데이터 |
|---|---|---|
| 레벨 1 (기본) | 집계 데이터만 전달 | 숫자만, 이름 미포함 |
| 레벨 1+ (권장) | 마스킹 처리 — 이름을 코드로 치환 | 마스킹된 코드만 |
| 레벨 2 (옵션) | 템플릿 모드 — LLM 미사용 | 없음 |
| 레벨 3 (확장) | Ollama 로컬 LLM | 없음 |

## 신뢰성

### 중복 방지

- **idempotency_key**: `{라인ID}_{룰ID}_{날짜}_{시간}` — 재실행 시 동일 이상의 중복 저장 방지
- **run_id**: `B_{날짜}_{시각}` — 단일 워크플로 실행의 모든 기록을 추적; anomaly_log와 error_log 조인 가능

### 알림 중복 방지

- **심각**: 미해결 시 다음 사이클(60분 후)에 재알림
- **중간**: 사이클당 1회만
- **낮음**: 이메일 없음 (로그만, 일일 리포트에 포함)
- n8n Static Data에 `{라인ID}_{이상유형}` 키로 관리

### 알림 상태 추적

anomaly_log의 `notification_status` 컬럼: `pending` → `sent` / `failed` / `skipped`
- Power BI에서 미발송 건(`failed`) 필터링하여 수동 확인 가능

### 에러 핸들링 (7개 에러 지점)

| 에러 지점 | 대응 |
|---|---|
| Google Sheets 읽기 실패 | error_log 기록 → 종료 (다음 사이클에서 재시도) |
| 데이터 검증 (null/라인 누락) | 문제 라인 분리 → 사용자 안내 → 정상 라인만 계속 진행 |
| 탐지 연산 에러 | 해당 룰만 스킵 → 나머지 룰 계속 진행 |
| Google Sheets 쓰기 실패 | 2회 재시도 (10초 간격) → 쓰기 실패해도 이메일은 발송 |
| Claude API 실패 | 1회 재시도 (15초) → 폴백 템플릿 메시지 생성 |
| AI 응답 파싱 실패 | 원문 텍스트를 ai_insight에 저장, ai_parsed=false 기록 |
| Gmail 발송 실패 | 2회 재시도 (10초) → notification_status를 "failed"로 업데이트 |

## 빠른 시작

### 사전 요구사항

- Node.js v18+
- Google 계정 (Google Sheets, Google Cloud Console)
- Google Cloud 서비스 계정 키 (`config/credentials.json`)
- n8n (`npm install -g n8n`)

### 설치

```bash
git clone https://github.com/SoyeonAhn3/ai_production_monitor.git
cd ai_production_monitor
npm install
```

### Google Sheets 설정

1. Google Sheets 4개 생성:
   - `production_week` (탭 1개)
   - `production_results` (탭 4개: hourly_summary, anomaly_log, daily_summary, error_log)
   - `line_master` (탭 1개)
   - `data_bank` (탭 1개)
2. 각 시트에 서비스 계정 이메일 (`credentials.json` → `client_email`)을 편집자로 공유
3. 각 시트의 Spreadsheet ID를 `config/sheets_config.json`에 입력

### 데이터 생성

```bash
node scripts/generate_line_master.js    # 12라인, 3팀
node scripts/generate_data_bank.js      # 120행 (12라인 × 10시간) + 이상 시나리오 5개
node scripts/generate_empty_files.js    # production_week + production_results 헤더
```

### n8n 설정

```bash
n8n start    # http://localhost:5678
```

1. n8n에서 Google Sheets OAuth2 credential 생성 (서비스 계정과 별도)
2. `n8n/workflow_a_simulator.json` Import
3. Google Sheets 노드에 credential 연결
4. 워크플로 활성화 → `http://localhost:5678/webhook/simulate` 접속하여 테스트

## 프로젝트 구조

```
ai_production_monitor/
├── config/
│   ├── credentials.json          # Google 서비스 계정 키 (.gitignore)
│   └── sheets_config.json        # 4개 시트의 Spreadsheet ID 매핑
├── scripts/
│   ├── google_auth.js            # Google Sheets API 인증 헬퍼 (서비스 계정)
│   ├── generate_line_master.js   # 라인/팀 마스터 데이터 (12라인, 3팀)
│   ├── generate_data_bank.js     # 데모 데이터 + 이상 시나리오 5개 (120행)
│   └── generate_empty_files.js   # production_week + production_results 헤더
├── n8n/
│   └── workflow_a_simulator.json # 테스트 시뮬레이터 워크플로 (12노드)
├── Phase/
│   ├── Phase1_환경구축_데이터.md    # 환경 구축 + 데이터 (Phase 1)
│   ├── Phase2_이상탐지_AI연동.md   # 이상 탐지 + AI 연동 (Phase 2)
│   ├── Phase3_PowerBI_대시보드.md  # Power BI 대시보드 (Phase 3)
│   └── Phase4_통합테스트_완성.md    # 통합 테스트 + 완성 (Phase 4)
├── pre-requirement/
│   ├── pre-requirement.txt       # 프로젝트 설계서 v3.0
│   └── ai.md                     # AI 확장 전략 문서
├── package.json
└── README.md
```

### Google Sheets 구조

| 시트 | 탭 | 용도 |
|---|---|---|
| production_week | production_week | 주간 raw data (25개 컬럼, 최대 ~720행) |
| production_results | hourly_summary, anomaly_log, daily_summary, error_log | 분석 결과 (4개 탭) |
| line_master | line_master | 라인/팀 구성 — 단일 진실 소스 (SSOT) |
| data_bank | data_bank | 데모 데이터 (12라인 × 10시간, 이상 시나리오 5개) |

## 현재 상태

| Phase | 상태 | 산출물 |
|---|---|---|
| Phase 1 — 환경 구축 + 데이터 | ✅ 완료 | n8n 셀프호스팅, Google Sheets 4개, 데이터 스크립트, 워크플로 A 시뮬레이터 테스트 완료 |
| Phase 2 — 이상 탐지 + AI 연동 | ✅ 완료 | rules.json + engine.js, validator, classifier, masker, Claude API 연동, 이메일 알림, 워크플로 B/D, AI Agent 일일 리포트, 단위 테스트 |
| Phase 3 — Power BI 대시보드 | 📋 예정 | 3페이지 대시보드 + AI 시각화 (Key Influencers, Decomposition Tree, Smart Narrative) |
| Phase 4 — 통합 테스트 + 완성 | 📋 예정 | 10시간 시나리오 테스트, 주간 백업 (워크플로 C), 포트폴리오 문서화 |

## 문서

| 문서 | 설명 |
|---|---|
| [pre-requirement.txt](pre-requirement/pre-requirement.txt) | 프로젝트 설계서 v3.0 — 아키텍처, 데이터 구조, 탐지 룰, 워크플로, 에러 핸들링 |
| [ai.md](pre-requirement/ai.md) | AI 확장 전략 — Agent 패턴, Sub-Agent 아키텍처, 비용 분석 |
| [Phase 1](Phase/Phase1_환경구축_데이터.md) | 환경 구축 + 데이터 생성 상세 |
| [Phase 2](Phase/Phase2_이상탐지_AI연동.md) | 이상 탐지 + AI 연동 계획 |
| [Phase 3](Phase/Phase3_PowerBI_대시보드.md) | Power BI 대시보드 설계 |
| [Phase 4](Phase/Phase4_통합테스트_완성.md) | 통합 테스트 + 완성 계획 |

## 한계점

- **로컬 전용**: n8n이 localhost:5678에서 실행 (클라우드 배포 없음)
- **테스트 없음**: 자동화된 테스트 스위트 없음; 시뮬레이터를 통한 수동 검증
- **데모 데이터**: 12라인 3팀, 1일치 data_bank; 실제 MES/ERP 미연결
- **인증 없음**: n8n UI, Google Sheets 접근이 보호되지 않음
- **단일 사용자**: 멀티 사용자/멀티 공장 미지원
- **공개 CSV 링크**: Power BI 연결을 위한 Google Sheets "웹에 게시"가 데이터 URL을 노출 (데모/포트폴리오 데이터이므로 허용)

## 향후 계획

- **Phase 3**: Power BI 3페이지 대시보드 + AI 시각화, Gateway를 통한 하루 8회 자동 새로고침
- **Phase 4**: 10시간 시나리오 엔드투엔드 테스트, 주간 백업 자동화, 포트폴리오 문서화
- **데이터 소스 전환**: 엔터프라이즈 배포를 위한 OneDrive Excel 전환 가이드 포함 (명세서 16장)

---

<p align="center">Made with AI-assisted development</p>
