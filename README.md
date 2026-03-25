# AI BI Assistant

생산 실적 이상 탐지 + AI 자동 해석 + Power BI 대시보드

> 생산 현장의 실적 데이터를 1시간 간격으로 자동 모니터링하고, 이상이 감지되면 AI가 원인을 분석하여 담당자에게 이메일로 즉시 알림을 보내고, Power BI 대시보드에서 상세 분석을 확인할 수 있는 완전 자동화 시스템

---

## 시스템 아키텍처

```
OneDrive Excel (주간 raw data, 외부에서 시간별 행 추가)
  → n8n 셀프호스팅 npm (60분 스케줄 / 테스트 시 Webhook)
  → JavaScript 이상 탐지 (Config-driven Rules: rules.json + engine.js)
  → JavaScript 패턴 1차 분류 (규칙 기반, 로컬)
  → Claude API (심각/악화 건만, 마스킹 데이터)
  → Gmail 알림 (심각+중간: 즉시 / 전체: 다음날 08:00 일일 리포트)
  → OneDrive Excel 결과 저장
  → Power BI Service 대시보드 (OneDrive 연결, 자동 새로고침 하루 8회)
```

---

## 핵심 기능

| 기능 | 설명 |
|---|---|
| 이상 탐지 | Config-driven 룰 기반 8가지 탐지 × 3레벨 심각도 (rules.json + engine.js) |
| AI 자동 해석 | Claude API로 마스킹된 데이터 분석 → 원인 추정 + 권장 액션 생성 |
| AI 이상 패턴 분류 | JavaScript 1차 규칙 분류 → AI 2차 검증/보정 (하이브리드) |
| 데이터 검증 | null/빈칸 vs 값 0 구분, 라인 누락 3가지 상황 판정 |
| 이메일 알림 | 심각도별 분기, 반복 경고 태그, 30분 중복 억제 |
| AI Agent 일일 리포트 | AI Agent(Tool Use)가 자율적으로 데이터 조회 → 상황별 리포트 깊이 조절 (매일 08:00) |
| Power BI 대시보드 | 실시간 현황 / 이상 탐지 & AI 인사이트 / 장기 트렌드 (3페이지) |
| Power BI AI 시각화 | Key Influencers, Decomposition Tree, Smart Narrative (빌트인) |
| 에러 핸들링 | 7개 에러 지점 대응 (재시도, 폴백, error_log) |
| n8n 워크플로 자동 생성 | Claude Code Skill(/n8n-gen)으로 워크플로 JSON 자동 생성 |

---

## 기술 스택

| 역할 | 도구 | 비용 |
|---|---|---|
| 데이터 저장 (전체) | OneDrive for Business (E3) | 0원 |
| 파이프라인 | n8n 셀프호스팅 (npm) | 무료 |
| 이상 탐지 + 패턴 분류 | JavaScript (n8n Code 노드) | 무료 |
| AI 해석 + 분류 검증 | Claude API (Anthropic) | 월 1~3달러 |
| AI Agent 일일 리포트 | Claude API Tool Use (Anthropic) | 월 +0.2~0.5달러 |
| 이메일 (즉시 + 일일 리포트) | n8n Gmail 노드 | 무료 |
| 워크플로 JSON 생성 | Claude Code Skill (/n8n-gen) | 무료 |
| 대시보드 + AI 시각화 | Power BI Pro (E3) | 0원 |
| 대시보드 (추후) | Tableau Public | 무료 |

> 총 추가 비용: **월 1~3달러** (Claude API만)

---

## 프로젝트 구조

```
ai_production_monitor/
├── .claude/
│   └── skills/                  # Claude Code 스킬
│       ├── n8n-gen/             # n8n 워크플로 JSON 자동 생성 ✅
│       ├── data-gen/            # 테스트용 샘플 데이터 자동 생성 (예정)
│       ├── rules-gen/           # rules.json 생성 + 형식 검증 (예정)
│       ├── agent-prompt/        # AI Agent System Prompt 관리 (예정)
│       ├── dev-log/             # 개발 로그 기록
│       ├── github-push/         # GitHub 커밋/푸시
│       ├── phase-doc/           # Phase 문서화
│       ├── readme-update/       # README 갱신
│       ├── test-log/            # 테스트 로그
│       ├── test-scenario/       # 테스트 시나리오
│       ├── gen-manual/          # Word 사용자 매뉴얼 생성
│       ├── interview-prep/      # 면접 예상 질문 생성
│       └── ai-multi-discussion/ # AI 다중 의견 비교
│
├── Phase/                       # Phase별 상세 개발 문서
│   ├── Phase1_환경구축_데이터.md       # 🚧 진행 중
│   ├── Phase2_이상탐지_AI연동.md       # 🔲 미시작
│   ├── Phase3_PowerBI_대시보드.md      # 🔲 미시작
│   └── Phase4_통합테스트_완성.md       # 🔲 미시작
├── pre-requirement/
│   └── pre-requirement.txt      # 프로젝트 명세서 (v2.3)
├── production/                  # 운영 데이터
│   ├── production_week.xlsx     # 이번 주 raw data (헤더만, 시뮬레이터가 채움)
│   └── production_results.xlsx  # 분석 결과 (4개 탭 헤더만)
├── config/                      # 설정 파일
│   └── line_master.xlsx         # 라인/팀 구성 (12라인, 3팀)
├── simulator/                   # 테스트 전용
│   └── data_bank.xlsx           # 데모용 사전 데이터 (120행, 이상 시나리오 5개)
├── backup/                      # 주간 백업용
├── scripts/                     # 데이터 생성 스크립트
│   ├── generate_line_master.js
│   ├── generate_data_bank.js
│   └── generate_empty_files.js
├── n8n/                         # n8n 워크플로 JSON
│   └── workflow_a_simulator.json  # ✅ 생성 완료
├── src/                         # (예정) 소스 코드
│   ├── detection/
│   │   ├── engine.js            # 이상 탐지 범용 엔진
│   │   └── rules.json           # 탐지 룰 설정 파일
│   ├── masking/                 # 데이터 마스킹 처리
│   └── templates/               # 이메일 HTML 템플릿
└── README.md
```

### 프로젝트 전용 스킬

| 스킬 | Phase | 용도 |
|---|---|---|
| `/n8n-gen` | 1 | n8n 워크플로 A/B/C/D의 JSON 템플릿 자동 생성. Credential은 placeholder 처리, n8n에서 Import 후 수동 연결 |
| `/data-gen` | 1 | data_bank.xlsx(12라인 × 10시간 = 120행) 자동 생성. line_master 기반 정상 데이터 + 5가지 이상 시나리오를 정확한 시간대에 삽입 |
| `/rules-gen` | 2 | rules.json 초기 생성(8개 룰 × 3레벨) + 형식 검증(필수 필드, min/max 범위 연속성, compound 구조, id 중복 체크) |
| `/agent-prompt` | 2 | AI Agent(워크플로 D)의 System Prompt 초안 생성, 버전별 보관(prompt_v1, v2...), 테스트 결과 기반 튜닝 제안 |

---

## n8n 워크플로 (4개)

| 워크플로 | 트리거 | 목적 |
|---|---|---|
| A: 테스트 시뮬레이터 | Webhook (수동) | data_bank → production_week append, 10번 클릭으로 하루 빨리감기 |
| B: 모니터 | Schedule 60분 | 이상 탐지 → 패턴 분류 → AI 해석 → 알림 (핵심 워크플로) |
| C: 주간 백업 | Cron 월요일 07:50 | production_week → /backup/ 이동, daily_summary 생성 |
| D: 일일 리포트 (AI Agent) | Cron 매일 08:00 | AI Agent가 도구(Tool Use)로 자율 분석 → 상황별 리포트 깊이 조절 |

---

## AI Agent — 일일 리포트 (워크플로 D)

워크플로 D는 단순 API 호출이 아닌 **AI Agent(Tool Use)** 패턴을 적용합니다.

**기존 방식**: 코드가 데이터 집계 → Claude에 "요약해줘" 1회 호출 → 항상 같은 포맷
**Agent 방식**: AI에게 도구 4개를 주고 목표만 전달 → AI가 스스로 조회/판단/반복 → 상황에 맞는 리포트

| 도구 | 기능 |
|---|---|
| `get_anomaly_log` | 이상 이력 조회 (날짜, 심각도, 라인 필터) |
| `get_daily_summary` | 일별 요약 조회 |
| `get_line_master` | 라인/팀 구성 조회 |
| `get_hourly_detail` | 시간별 상세 조회 |

**리포트 깊이 자율 조절**:
- 조용한 날 (낮음만) → 도구 1~2회, 간단 요약
- 심각 건 있는 날 → 도구 3~4회, 지난주 비교 포함
- 심각 3건+ / 악화 추세 → 도구 5~6회, 상세 분석 + 경영진 CC

**안전장치**: 도구 호출 최대 8회 제한, API 실패 시 고정 포맷 폴백, 파싱 실패 시 텍스트 그대로 사용

---

## 이상 탐지 룰 (Config-driven)

룰을 `rules.json`에 정의하고, `engine.js`가 범용으로 실행합니다.
새 데이터 적용 시 `rules.json`만 수정하면 됩니다.

| # | 탐지 항목 | 비교 타입 | 심각 | 중간 | 낮음 |
|---|---|---|---|---|---|
| 1 | 생산량 급감 | drop_rate | 40%+ | 20~40% | 5~20% |
| 2 | 가동률 저하 | below_threshold | <30% | 30~50% | 50~70% |
| 3 | 불량률 급등 | exceeds_baseline | 5배+ | 3~5배 | 2~3배 |
| 4 | 달성률 지연 | below_threshold | -30%p↓ | -15~-30%p | -5~-15%p |
| 5 | 생산 정체 | consecutive_zero | 3시간+ | 2시간 | 1시간 |
| 6 | 폐기 발생 | above_threshold | 3%+ | 1~3% | <1% |
| 7 | 복합 이상 | compound (AND) | 30%↓+3배↑ | 15%↓+2배↑ | 5%↓+1.5배↑ |
| 8 | 가동률 급락 | drop_points | 50%p+ | 30~50%p | 15~30%p |

---

## 보안 전략

| 레벨 | 방식 | 외부 데이터 전송 |
|---|---|---|
| 레벨 1 (기본) | 집계 데이터만 AI에 전달 | 요약 통계만 |
| 레벨 1+ (권장) | 마스킹 처리 후 전달 | 코드로 치환된 데이터 |
| 레벨 2 (옵션) | LLM 없이 템플릿 모드 | 0건 |
| 레벨 3 (확장) | 로컬 LLM (Ollama) | 0건 |

> **AI 기능별 보안**: JavaScript 패턴 1차 분류는 로컬 처리(외부 전송 없음). Claude API(해석 + 분류 검증)는 심각도 "높음" 또는 "악화" 시에만 마스킹된 데이터 전달, 학습 미사용 약관 적용. Power BI AI 시각화는 Microsoft 테넌트 내 처리로 외부 전송 없음.

---

## 개발 진행 현황

### Phase 1: 환경 구축 + 데이터 `🚧 진행 중`

| # | 항목 | 상태 |
|---|---|---|
| 1 | n8n 셀프호스팅 설치 (npm) | ✅ 완료 |
| 2 | OneDrive 폴더 구조 + 샘플 데이터 생성 | ✅ 완료 |
| 3 | production_results.xlsx 생성 (4개 탭) | ✅ 완료 |
| 4 | Claude Code Skill "/n8n-gen" 개발 | ✅ 완료 |
| 5 | 워크플로 A (테스트 시뮬레이터) JSON 생성 + Import | 🚧 JSON 생성 완료, Import 대기 |
| 6 | 워크플로 B 기본 구조 JSON 생성 + Import | 🔲 미시작 |
| 7 | Credential 연결 (OneDrive, Gmail, Claude) | 🔲 미시작 |

> 상세: [Phase/Phase1_환경구축_데이터.md](Phase/Phase1_환경구축_데이터.md)

### Phase 2: 이상 탐지 + AI 연동 `🔲 미시작`

| # | 항목 | 상태 |
|---|---|---|
| 1 | Config-driven 이상 탐지 (rules.json + engine.js) | 🔲 미시작 |
| 2 | 데이터 검증 로직 (null vs 0, 라인 누락 판정) | 🔲 미시작 |
| 3 | JavaScript 패턴 1차 분류 + Claude API 2차 검증 | 🔲 미시작 |
| 4 | 마스킹 처리 로직 | 🔲 미시작 |
| 5 | 이메일 알림 (심각도별 분기) | 🔲 미시작 |
| 6 | 중복 알림 방지 + 에러 핸들링 | 🔲 미시작 |
| 7 | AI Agent 일일 리포트 (워크플로 D, Tool Use) | 🔲 미시작 |
| 8 | 워크플로 B/D JSON 재생성 | 🔲 미시작 |

> 상세: [Phase/Phase2_이상탐지_AI연동.md](Phase/Phase2_이상탐지_AI연동.md)

### Phase 3: Power BI 대시보드 `🔲 미시작`

| # | 항목 | 상태 |
|---|---|---|
| 1 | Power BI Desktop → OneDrive Excel 연결 | 🔲 미시작 |
| 2 | 3개 페이지 대시보드 제작 | 🔲 미시작 |
| 3 | Power BI AI 시각화 배치 (Key Influencers, Decomp. Tree, Smart Narrative) | 🔲 미시작 |
| 4 | Power BI Service 게시 + 자동 새로고침 | 🔲 미시작 |
| 5 | 이메일에 Power BI 링크 포함 | 🔲 미시작 |

> 상세: [Phase/Phase3_PowerBI_대시보드.md](Phase/Phase3_PowerBI_대시보드.md)

### Phase 4: 통합 테스트 + 완성 `🔲 미시작`

| # | 항목 | 상태 |
|---|---|---|
| 1 | 시뮬레이터 10시간 시나리오 전체 테스트 | 🔲 미시작 |
| 2 | 워크플로 C/D 테스트 (주간 백업 + AI Agent 일일 리포트) | 🔲 미시작 |
| 3 | 데이터 수명주기 관리 스크립트 | 🔲 미시작 |
| 4 | 리셋 기능 확인 | 🔲 미시작 |
| 5 | 포트폴리오 문서화 | 🔲 미시작 |

> 상세: [Phase/Phase4_통합테스트_완성.md](Phase/Phase4_통합테스트_완성.md)

### 추후 확장 `⏸ 보류`

| # | 항목 | 상태 |
|---|---|---|
| 1 | Tableau Public 분석용 대시보드 | ⏸ 보류 |
| 2 | n8n MCP 서버 (API 직접 제어) | ⏸ 보류 |
| 3 | Supabase 전환 | ⏸ 보류 |
| 4 | `/plan-check` 스킬 개발 — 기획 단계 검증 체크리스트 (환경/인프라, 외부 서비스, 데이터, 기술 스택, 보안/규정) | ⏸ Phase 4 이후 |

---

## 프로젝트 성격

이 프로젝트는 **포트폴리오/데모 목적**으로 제작됩니다.
핵심 로직(이상 탐지, AI 해석, 알림, 대시보드)은 실무에서 동일하게 사용할 수 있으나,
실제 현장 적용에는 인증 체계, 에러 핸들링 고도화, 멀티 사용자 지원, 네트워크 보안 등 추가 레이어가 필요합니다.

---

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-03-23 | 프로젝트 기획 완료, 명세서 v2.1 작성 |
| 2026-03-23 | README.md 초기 생성 |
| 2026-03-24 | v2.2: AI 활용 확대 (Power BI AI 시각화 + 이상 패턴 분류) + 보안 정리 |
| 2026-03-24 | v2.3: 패턴 분류 Python+AI 하이브리드, n8n-gen 템플릿 방식 명확화 |
| 2026-03-25 | Phase 문서 4개 생성, README 구조 개편 (Phase 상세 링크, 워크플로 4개 정리) |
| 2026-03-25 | v2.4: AI Agent(Tool Use) 워크플로 D 적용 — 자율 분석 리포트, 안전장치 |
| 2026-03-25 | v2.5: Docker → npm, Python → JavaScript 전환 (개발 환경에서 WSL2/Docker 사용 불가, n8n 네이티브 JavaScript Code 노드로 변경) |
| 2026-03-25 | v2.6: SharePoint → OneDrive 전환 (개발 환경에서 SharePoint 사이트 생성 권한 없음, OneDrive for Business로 변경) |
| 2026-03-25 | Phase 1 진행: n8n 설치, 데이터 파일 생성 (line_master, data_bank, production_week, production_results), /n8n-gen 스킬 개발, 워크플로 A JSON 생성 |
