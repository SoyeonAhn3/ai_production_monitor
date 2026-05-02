# Phase 1 — 환경 구축 + 데이터 `🚧 진행 중`

> n8n 셀프호스팅(npm) 환경을 구축하고, Google Sheets 데이터 구조를 세팅하며, 테스트용 시뮬레이터 워크플로를 준비한다.

**상태**: 🚧 진행 중
**선행 조건**: 없음 (첫 번째 Phase)

---

## 개요

프로젝트의 인프라 기반을 구축하는 단계. npm으로 n8n 셀프호스팅을 설치하고,
Google Sheets에 데이터 시트(production_week, production_results, line_master)를 생성한다.
Claude Code Skill `/n8n-gen`을 개발하여 n8n 워크플로 JSON 템플릿을 자동 생성하고,
워크플로 A(테스트 시뮬레이터)와 워크플로 B(기본 구조)를 n8n에 Import하여 파이프라인의 뼈대를 완성한다.

---

## 완료 예정 항목

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | n8n 셀프호스팅 설치 (npm) | ✅ 완료 | npm install -g n8n, 포트 5678 |
| 2 | 로컬 프로젝트 구조 생성 | ✅ 완료 | /config/, /scripts/, /n8n/, package.json |
| 3 | 데이터 생성 스크립트 개발 (googleapis) | ✅ 완료 | generate_line_master/data_bank/empty_files.js (Google Sheets API) |
| 4 | Google Cloud 서비스 계정 설정 | ✅ 완료 | config/credentials.json 발급 완료 |
| 5 | Google Sheets 4개 생성 + 서비스 계정 공유 | ✅ 완료 | sheets_config.json에 Spreadsheet ID 입력 완료 |
| 6 | 데이터 생성 스크립트 실행 | ✅ 완료 | line_master(12행), data_bank(120행), production_week/results(헤더) |
| 7 | Claude Code Skill `/n8n-gen` 개발 | ✅ 완료 | references/에 워크플로 스펙 + 노드 템플릿 보관 |
| 8 | 워크플로 A JSON 생성 | ✅ 완료 | n8n/workflow_a_simulator.json (12노드, Sheet ID 반영) |
| 9 | n8n Google Sheets OAuth2 credential 설정 | ✅ 완료 | OAuth2 Client ID + Secret 등록, 계정 연결 |
| 10 | 워크플로 A Import + credential 연결 + 테스트 | ✅ 완료 | 시뮬레이터 5회 실행 성공 (08:00~12:00) |
| 11 | 워크플로 B 기본 구조 JSON 생성 + Import | 🔲 미시작 | Schedule 60분 + Google Sheets 읽기 뼈대 |

> **현재 상태**: Google Sheets 연결 완료. 워크플로 B는 Phase 2 이상 탐지 로직과 함께 개발 예정.

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

## Google Sheets 데이터 구조

### 목적
모든 데이터를 Google Sheets에 통일하여 n8n Google Sheets 노드 및 Power BI (CSV Publish)와의 연결을 확보한다.

### 시트 구성
| Google Sheets | 탭(시트) | 용도 |
|---|---|---|
| production_week | production_week | 이번 주 raw data (25개 컬럼, 최대 720행) |
| production_results | hourly_summary, anomaly_log, daily_summary, error_log | 분석 결과 (4개 탭) |
| line_master | line_master | 라인/팀 구성 (SSOT) |
| data_bank | data_bank | 데모용 사전 데이터 (120행, 이상 시나리오 5개) |

### Sheet ID 관리
`config/sheets_config.json`에 각 시트의 Spreadsheet ID와 시트명을 매핑하여 관리.
스크립트와 워크플로에서 이 설정 파일을 참조.

### 설계 결정 사항
- **Google Sheets 전환 이유**: OneDrive Excel OAuth2 credential 연결 문제 (Azure AD App Registration 과정에서 차단). Google Sheets는 서비스 계정으로 간단히 인증 가능.
- **Power BI 연결**: Google Sheets "Publish to web" 기능으로 CSV 링크 생성 → Power BI Web connector로 연결. 포트폴리오/데모 데이터이므로 공개 링크 보안 이슈 허용.
- **비용**: Google Sheets + Google Sheets API 모두 무료.
- **Excel 전환 가능**: 추후 OneDrive Excel credential 문제 해결 시 xlsx 라이브러리 + Microsoft Excel 노드로 복원 가능 (README 데이터 소스 전환 가이드 참조).

---

## line_master (Google Sheets)

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

## data_bank (테스트 시뮬레이터용, Google Sheets)

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
  → Google Sheets: data_bank에서 해당 시간 N행 필터링
  → Google Sheets: production_week에 N행 append
  → 카운터 +1
  → 브라우저에 결과 반환
```

### 리셋 기능
`/webhook/reset` → 카운터 초기화 + production_week 재생성 + anomaly_log 비우기

---

## 워크플로 B: 기본 구조

### 목적
Phase 1에서는 워크플로 B의 뼈대(Schedule Trigger + Google Sheets 읽기)만 구성. 이상 탐지 로직은 Phase 2에서 추가.

---

## 샘플 데이터 생성 스크립트

### 목적
Google Sheets에 데모용 데이터를 자동 생성한다. 정상 데이터 위에 5가지 이상 시나리오가 정확한 시간대에 심어져 있어야 하므로, 수동으로 만들면 실수가 많고 시간이 오래 걸린다.

### 스크립트 구성
| 스크립트 | 대상 시트 | 내용 |
|---|---|---|
| `scripts/generate_line_master.js` | line_master | 12라인 × 3팀 마스터 데이터 |
| `scripts/generate_data_bank.js` | data_bank | 120행 (12라인 × 10시간) + 이상 시나리오 5개 |
| `scripts/generate_empty_files.js` | production_week, production_results | 헤더만 생성 (빈 시트 초기화) |
| `scripts/google_auth.js` | (공통) | Google Sheets API 인증 헬퍼 |

### 생성 로직 (data_bank)
1. line_master의 시간당목표/정상불량률을 기반으로 정상 범위 데이터 생성
2. 5개 시나리오를 해당 시간대에 오버라이드
3. 25개 컬럼(식별 7 + 시간당 5 + 누적 5 + 진척 3 + 가동 4 + 기타 1) 전부 채움
4. 이상플래그 컬럼에 어떤 시나리오가 심어져 있는지 표시

### 설계 결정 사항
- **스킬 대신 스크립트**: 원래 `/data-gen` Claude Code Skill로 계획했으나, `node scripts/generate_data_bank.js` 직접 실행으로 동일 결과를 얻으므로 스킬 래핑은 스킵. 데이터 재생성이 빈번해지면 추후 스킬화 가능.
- **line_master 기반 동적 생성**: 라인이 추가/변경되어도 스크립트를 다시 실행하면 자동 반영
- **누적 지표 자동 계산**: 시간당 데이터를 먼저 생성하고, 누적생산/누적불량/달성률 등은 자동 합산

---

## Credential 연결

### 대상
| Credential | 인증 방식 | 용도 |
|---|---|---|
| Google Sheets | OAuth2 (Google Cloud Console) | 데이터 읽기/쓰기 (n8n) |
| Google 서비스 계정 | 서비스 계정 JSON 키 | 데이터 생성 스크립트 (googleapis) |
| Gmail | OAuth2 | 알림 이메일 발송 |
| Anthropic (Claude) | API Key | AI 해석 |

### 설계 결정 사항
- **수동 설정 필수**: 인증 토큰은 보안상 자동 삽입 불가. n8n UI에서 노드당 클릭 2번으로 완료.
- **서비스 계정 키**: `config/credentials.json`에 저장, `.gitignore`에 포함하여 git에 올라가지 않음.

---

## 선행 조건 및 의존성

- Node.js (v18 이상)
- Google 계정 (Google Sheets, Google Cloud Console)
- Google Cloud 서비스 계정 키 (config/credentials.json)
- Claude API 키 (Anthropic)
- Gmail 계정
- Power BI Pro 라이선스 (대시보드용, Phase 3)

---

## Phase 1 개발 순서

Phase 1 내에서 순서가 중요합니다. 워크플로 A가 데이터를 만들어주는 도구이므로, A가 동작해야 Phase 2 테스트가 가능합니다.

```
1단계: 인프라 ✅ 완료
  ├─ n8n 설치 (npm install -g n8n)
  └─ 로컬 프로젝트 구조 생성 (/config/, /scripts/, /n8n/)

2단계: Google Cloud 서비스 계정 설정
  ├─ Google Cloud Console (console.cloud.google.com) 접속
  ├─ 프로젝트 생성 (예: ai-production-monitor)
  ├─ Google Sheets API 활성화
  │     APIs & Services → Library → "Google Sheets API" 검색 → Enable
  ├─ 서비스 계정 생성
  │     APIs & Services → Credentials → Create Credentials → Service Account
  │     이름: ai-prod-monitor-sa
  │     역할: 없음 (Google Sheets 공유로 권한 부여)
  ├─ JSON 키 다운로드
  │     서비스 계정 클릭 → Keys → Add Key → Create new key → JSON
  └─ 키 파일을 config/credentials.json으로 저장

3단계: Google Sheets 생성 + 연결
  ├─ Google Sheets 4개 수동 생성
  │     ① production_week (시트명: production_week)
  │     ② production_results (탭 4개 수동 추가: hourly_summary, anomaly_log, daily_summary, error_log)
  │     ③ line_master (시트명: line_master)
  │     ④ data_bank (시트명: data_bank)
  ├─ 각 시트에 서비스 계정 이메일을 편집자로 공유
  │     서비스 계정 이메일: credentials.json의 "client_email" 값
  │     각 시트 → 공유 → 이메일 추가 → 편집자
  └─ 각 시트의 Spreadsheet ID를 config/sheets_config.json에 기입
        URL에서 추출: https://docs.google.com/spreadsheets/d/{이 부분이 ID}/edit

4단계: 데이터 생성 스크립트 실행
  ├─ npm install (googleapis, google-auth-library)
  ├─ node scripts/generate_line_master.js → line_master 시트에 12행 생성 확인
  ├─ node scripts/generate_data_bank.js → data_bank 시트에 120행 생성 확인
  └─ node scripts/generate_empty_files.js → production_week, production_results 헤더 생성 확인

5단계: n8n Credential 설정 + 워크플로 A 완성
  ├─ n8n start → http://localhost:5678 접속
  ├─ n8n에서 Google Sheets OAuth2 credential 생성
  │     Settings → Credentials → Add Credential → Google Sheets
  │     (Google Cloud Console에서 OAuth2 Client ID 생성 필요 — 서비스 계정과 별도)
  ├─ 워크플로 A JSON import (n8n/workflow_a_simulator.json)
  ├─ Read DataBank, Append to Production Week 노드에 credential 연결
  ├─ documentId에 실제 Sheet ID 입력
  └─ ★ 시뮬레이터 10번 클릭 → production_week에 데이터 쌓이는지 확인

6단계: 워크플로 B 뼈대
  ├─ 워크플로 B JSON 생성 (Schedule + Google Sheets 읽기만)
  └─ ★ 데이터 읽기 확인 → Phase 2로 넘어감
```

> 2~3단계(Google Cloud 설정)가 처음이면 시간이 걸릴 수 있으므로 차근차근 진행.
> n8n OAuth2 credential(5단계)은 서비스 계정 JSON 키(2단계)와 별도로 설정해야 함에 주의.

---

## 개발 시 주의사항

- n8n 셀프호스팅은 PC가 항시 켜져 있어야 함 (데모: 로컬 PC, 상시 운영: 클라우드 VM)
- Google Sheets 생성 + 서비스 계정 공유를 먼저 완성한 후 스크립트 실행
- Credential 연결 전에는 워크플로 실행 불가 — Import만 먼저 해두고 Credential은 마지막에 설정
- `config/credentials.json`은 절대 git에 올리지 말 것 (.gitignore에 포함됨)

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
| 2026-04-13 | OneDrive Excel → Google Sheets 전환: 스크립트 googleapis 전환, n8n 워크플로 Google Sheets 노드, sheets_config.json 추가 |
| 2026-05-02 | Google Sheets 4개 생성 + 서비스 계정 공유 완료, sheets_config.json ID 입력, 데이터 스크립트 실행(line_master 12행, data_bank 120행, production_week/results 헤더), n8n OAuth2 credential 등록, 워크플로 A Import + 시뮬레이터 테스트 성공 (08:00~12:00) |
