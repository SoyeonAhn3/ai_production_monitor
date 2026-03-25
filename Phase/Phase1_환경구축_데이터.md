# Phase 1 — 환경 구축 + 데이터 `🚧 진행 중`

> n8n 셀프호스팅(npm) 환경을 구축하고, OneDrive 데이터 구조를 세팅하며, 테스트용 시뮬레이터 워크플로를 준비한다.

**상태**: 🚧 진행 중
**선행 조건**: 없음 (첫 번째 Phase)

---

## 개요

프로젝트의 인프라 기반을 구축하는 단계. npm으로 n8n 셀프호스팅을 설치하고,
OneDrive에 데이터 파일(production_week.xlsx, production_results.xlsx, line_master.xlsx)과
폴더 구조(/production/, /config/, /backup/, /simulator/)를 생성한다.
Claude Code Skill `/n8n-gen`을 개발하여 n8n 워크플로 JSON 템플릿을 자동 생성하고,
워크플로 A(테스트 시뮬레이터)와 워크플로 B(기본 구조)를 n8n에 Import하여 파이프라인의 뼈대를 완성한다.

---

## 완료 예정 항목

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | n8n 셀프호스팅 설치 (npm) | ✅ 완료 | npm install -g n8n, 포트 5678 |
| 2 | OneDrive 폴더 구조 생성 | ✅ 완료 | /production/, /config/, /backup/, /simulator/ |
| 3 | OneDrive 샘플 데이터 생성 | ✅ 완료 | line_master.xlsx (12라인), data_bank.xlsx (120행, 이상 시나리오 5개) |
| 4 | production_results.xlsx 생성 | ✅ 완료 | 4개 탭 헤더만 (hourly_summary, anomaly_log, daily_summary, error_log) |
| 5 | Claude Code Skill `/n8n-gen` 개발 | ✅ 완료 | references/에 워크플로 스펙 + 노드 템플릿 보관 |
| 6 | Claude Code Skill `/data-gen` 개발 | ⏸ 스킵 | scripts/generate_data_bank.js로 대체 |
| 7 | 워크플로 A (테스트 시뮬레이터) JSON 생성 + Import | 🚧 JSON 생성 완료 | n8n/workflow_a_simulator.json (12노드), Import 대기 |
| 8 | 워크플로 B 기본 구조 JSON 생성 + Import | 🔲 미시작 | Schedule 60분, 뼈대만 |
| 9 | Credential 연결 (OneDrive, Gmail, Claude) | 🔲 미시작 | Azure AD OAuth2, 수동 설정 |

---

## n8n 셀프호스팅 (npm)

### 목적
n8n을 셀프호스팅으로 설치하여 워크플로 자동화 파이프라인을 구축한다.

### 설치 명령
```bash
npm install -g n8n
n8n start
```

### 요구사항
- Node.js (v18 이상)
- 포트: 5678
- 브라우저에서 http://localhost:5678 접속

### 설계 결정 사항
- **npm 방식 선택 이유**: 개발 환경에서 WSL2 커널 설치가 차단되어 Docker Desktop 사용 불가. npm으로 설치하면 WSL2/Docker 없이 바로 실행 가능.
- **JavaScript Code 노드 사용**: Docker 없이 npm으로 설치 시 Python Code 노드 지원이 불안정할 수 있으므로, n8n이 네이티브로 지원하는 JavaScript Code 노드를 사용한다. 이상 탐지 로직은 표준 라이브러리 수준의 단순 비교/계산이므로 JavaScript로 동일하게 구현 가능.

---

## OneDrive 데이터 구조

### 목적
모든 데이터를 OneDrive for Business에 통일하여 n8n 및 Power BI Service와의 연결을 확보한다.

### 폴더 구조
```
OneDrive/AI_Production_Monitor/
├── /production/           # 운영 데이터 (Power BI가 읽는 파일)
│   ├── production_week.xlsx      # 이번 주 raw data (25개 컬럼, 최대 720행)
│   └── production_results.xlsx   # 분석 결과 (4개 탭)
├── /config/               # 설정 파일
│   ├── line_master.xlsx          # 라인/팀 구성 (SSOT)
│   └── rules.json                # 이상 탐지 룰
├── /backup/               # 주간 백업
│   └── production_YYYYMMDD_YYYYMMDD.xlsx
└── /simulator/            # 테스트 전용
    └── data_bank.xlsx            # 데모용 사전 데이터 (120행, 이상 시나리오 5개 포함)
```

### 설계 결정 사항
- **OneDrive 선택 이유**: 개발 환경에서 SharePoint 사이트 생성 권한이 없어 OneDrive for Business로 변경. n8n의 Microsoft Excel 365 노드가 OneDrive도 동일하게 지원하며, Power BI Service도 OneDrive for Business Excel을 직접 연결 가능.
- **M365 E3 포함**: 추가 비용 없음.

---

## line_master.xlsx

### 목적
라인/팀 구성의 Single Source of Truth. engine.js가 매 실행마다 이 테이블을 읽어 라인 수, 팀 수, 라인별 기준값을 동적으로 파악.

### 컬럼 구조
```
라인ID | 라인명 | 팀 | 상위라인ID | 계층 | 품목 | 시간당목표 | 정상불량률
```

### 데모 데이터
12라인, 3팀 구성 (프레스, CNC, 용접, 도장, 사출, 조립, 검사/포장)

### 설계 결정 사항
- **상위라인ID/계층 컬럼**: 하위 작업반 확장을 위한 스키마 준비. 데모에서는 전부 null/line.
- **동적 파악**: 라인 추가/삭제 시 line_master만 수정 → 코드 변경 없음.

---

## data_bank.xlsx (테스트 시뮬레이터용)

### 목적
데모용 사전 데이터. 5가지 이상 시나리오가 의도적으로 심어져 있어 이상 탐지가 실제로 작동하는지 확인.

### 이상 시나리오
| # | 시나리오 | 시간대 | 탐지 포인트 |
|---|---|---|---|
| 1 | CNC 1호기 설비 고장 | 11:00~14:00 | 생산량 급감 + 가동률 저하 + 연속 0 |
| 2 | 도장 라인 불량률 급등 | 09:00~12:00 | 불량률 정상의 8배 |
| 3 | 사출 1호기 금형 이상 | 13:00~15:00 | 생산량 급감 + 달성갭 마이너스 |
| 4 | 조립 2라인 작업자 교체 | 10:00~12:00 | 복합 이상 (생산↓ + 불량↑) |
| 5 | 프레스 1호기 자재 대기 | 15:00~17:00 | 가동률 급락 + 비가동시간 급증 |

---

## Claude Code Skill `/n8n-gen`

### 목적
n8n 워크플로 JSON 템플릿을 자동 생성하여 GUI 수동 설정 실수를 방지한다.

### 방식
- `references/` 디렉토리에 완성된 워크플로 JSON 템플릿 보관
- Credential은 placeholder로 처리 (`"id": "PLACEHOLDER"`)
- 사용자가 n8n UI에서 Import 후 Credential만 수동 연결

### 생성 대상
워크플로 A, B, C, D (4개)

---

## 워크플로 A: 테스트 시뮬레이터

### 목적
개발/데모 시 1시간을 기다리지 않고 즉시 테스트. Webhook 클릭 시 "다음 시간 데이터"가 production_week에 추가됨.

### 흐름
```
Webhook 클릭
  → Static Data: 카운터 읽기
  → OneDrive: data_bank.xlsx에서 해당 시간 N행 필터링
  → OneDrive: production_week.xlsx에 N행 append
  → 카운터 +1
  → 브라우저에 결과 반환
```

### 리셋 기능
`/webhook/reset` → 카운터 초기화 + production_week 재생성 + anomaly_log 비우기

---

## 워크플로 B: 기본 구조

### 목적
Phase 1에서는 워크플로 B의 뼈대(Schedule Trigger + OneDrive 읽기)만 구성. 이상 탐지 로직은 Phase 2에서 추가.

---

## Claude Code Skill `/data-gen` — 샘플 데이터 생성

### 목적
data_bank.xlsx(12라인 × 10시간 = 120행)를 자동 생성한다. 정상 데이터 위에 5가지 이상 시나리오가 정확한 시간대에 심어져 있어야 하므로, 수동으로 만들면 실수가 많고 시간이 오래 걸린다.

### 생성 로직
1. line_master.xlsx의 시간당목표/정상불량률을 기반으로 정상 범위 데이터 생성
2. 5개 시나리오를 해당 시간대에 오버라이드:
   - CNC 1호기 설비 고장 (11:00~14:00)
   - 도장 라인 불량률 급등 (09:00~12:00)
   - 사출 1호기 금형 이상 (13:00~15:00)
   - 조립 2라인 작업자 교체 (10:00~12:00)
   - 프레스 1호기 자재 대기 (15:00~17:00)
3. 25개 컬럼(식별 7 + 시간당 5 + 누적 5 + 진척 3 + 가동 4 + 기타 1) 전부 채움
4. 이상플래그 컬럼에 어떤 시나리오가 심어져 있는지 표시

### 설계 결정 사항
- **line_master 기반 동적 생성**: 라인이 추가/변경되어도 data-gen을 다시 실행하면 자동 반영
- **누적 지표 자동 계산**: 시간당 데이터를 먼저 생성하고, 누적생산/누적불량/달성률 등은 자동 합산

---

## Credential 연결

### 대상
| Credential | 인증 방식 | 용도 |
|---|---|---|
| Microsoft Excel 365 (OneDrive) | OAuth2 (Azure AD App Registration) | 데이터 읽기/쓰기 |
| Gmail | OAuth2 | 알림 이메일 발송 |
| Anthropic (Claude) | API Key | AI 해석 |

### 설계 결정 사항
- **수동 설정 필수**: 인증 토큰은 보안상 자동 삽입 불가. n8n UI에서 노드당 클릭 2번으로 완료.

---

## 선행 조건 및 의존성

- Node.js (v18 이상)
- Microsoft 365 E3 라이선스 (OneDrive for Business, Power BI Pro)
- Azure AD App Registration (Client ID, Secret, Tenant ID)
- Claude API 키 (Anthropic)
- Gmail 계정

---

## Phase 1 개발 순서

Phase 1 내에서 순서가 중요합니다. 워크플로 A가 데이터를 만들어주는 도구이므로, A가 동작해야 Phase 2 테스트가 가능합니다.

```
1단계: 인프라
  ├─ n8n 설치 (npm install -g n8n)
  └─ OneDrive 폴더 구조 생성 (/production/, /config/, /backup/, /simulator/)

2단계: 데이터 준비
  ├─ line_master.xlsx 수동 생성 (12행이라 스킬 불필요)
  ├─ /data-gen 스킬 개발 → data_bank.xlsx 생성
  └─ production_results.xlsx 빈 파일 생성 (4개 탭 헤더만)

3단계: 워크플로 A 완성
  ├─ /n8n-gen 스킬 개발 → 워크플로 A JSON 생성
  ├─ n8n Import + Credential 연결
  └─ ★ 시뮬레이터 10번 클릭 → production_week에 데이터 쌓이는지 확인

4단계: 워크플로 B 뼈대
  ├─ 워크플로 B JSON 생성 (Schedule + OneDrive 읽기만)
  └─ ★ 데이터 읽기 확인 → Phase 2로 넘어감
```

> Credential 연결(Azure AD OAuth2)은 예상보다 시간이 걸릴 수 있으므로 3단계에서 일찍 해결.

---

## 개발 시 주의사항

- n8n 셀프호스팅은 PC가 항시 켜져 있어야 함 (데모: 로컬 PC, 상시 운영: 클라우드 VM)
- OneDrive 파일 구조를 먼저 완성한 후 워크플로 Import 진행
- Credential 연결 전에는 워크플로 실행 불가 — Import만 먼저 해두고 Credential은 마지막에 설정

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-03-25 | 최초 작성 (명세서 v2.3 기반) |
| 2026-03-25 | `/data-gen` 스킬 추가 — 샘플 데이터 자동 생성 |
| 2026-03-25 | 개발 순서 4단계 추가 (인프라 → 데이터 → 워크플로 A 완성 → B 뼈대) |
| 2026-03-25 | Docker → npm, Python → JavaScript 전환 (개발 환경에서 WSL2/Docker 사용 불가) |
| 2026-03-25 | SharePoint → OneDrive 전환 (개발 환경에서 SharePoint 사이트 생성 권한 없음) |
| 2026-03-25 | 1~5번 항목 완료: n8n 설치, 폴더 생성, 데이터 파일 생성, /n8n-gen 스킬 개발, 워크플로 A JSON 생성 |
