# AI BI Assistant

생산 실적 이상 탐지 + AI 자동 해석 + Power BI 대시보드

> 생산 현장의 실적 데이터를 1시간 간격으로 자동 모니터링하고, 이상이 감지되면 AI가 원인을 분석하여 담당자에게 이메일로 즉시 알림을 보내고, Power BI 대시보드에서 상세 분석을 확인할 수 있는 완전 자동화 시스템

---

## 시스템 아키텍처

```
Google Sheets (원본 데이터 입력 / 시뮬레이터)
  → n8n 셀프호스팅 Docker (60분 스케줄 / 테스트 시 Webhook)
  → Python 이상 탐지 (Config-driven Rules: rules.json + engine.py)
  → Claude API (AI 해석, 마스킹된 집계 데이터만 전달)
  → Gmail 알림 (이상 발견 시 즉시)
  → SharePoint Excel 결과 저장
  → Power BI Service 대시보드 (자동 새로고침 하루 8회)
```

---

## 핵심 기능

| 기능 | 설명 |
|---|---|
| 이상 탐지 | Config-driven 룰 기반 8가지 탐지 (생산량 급감, 불량률 급등, 가동률 저하 등) |
| AI 자동 해석 | Claude API로 마스킹된 데이터 분석 → 원인 추정 + 권장 액션 생성 |
| AI 이상 패턴 분류 | Python 1차 규칙 분류 → AI 2차 검증/보정 (하이브리드) |
| 이메일 알림 | 심각도 "높음" 감지 시 즉시 발송, 반복 경고 태그, 30분 중복 억제 |
| Power BI 대시보드 | 실시간 현황 / 이상 탐지 & AI 인사이트 / 장기 트렌드 (3페이지) |
| Power BI AI 시각화 | Key Influencers, Decomposition Tree, Smart Narrative (빌트인) |
| n8n 워크플로 자동 생성 | Claude Code Skill(/n8n-gen)으로 워크플로 JSON 자동 생성 |

---

## 기술 스택

| 역할 | 도구 | 비용 |
|---|---|---|
| 데이터 입력 | Google Sheets | 무료 |
| 분석 결과 저장 | SharePoint Excel (E3 포함) | 0원 |
| 파이프라인 | n8n 셀프호스팅 (Docker) | 무료 |
| 이상 탐지 + 패턴 1차 분류 | Python (Config-driven Rules) | 무료 |
| AI 해석 + 분류 검증 | Claude API (Anthropic) | 월 1~3달러 |
| 이메일 알림 | n8n Gmail 노드 | 무료 |
| n8n 워크플로 생성 | Claude Code Skill (/n8n-gen) | 무료 |
| 대시보드 + AI 시각화 | Power BI Pro (E3 포함) | 0원 |
| 대시보드 (추후) | Tableau Public | 무료 |

---

## 프로젝트 구조

```
ai_production_monitor/
├── .claude/
│   └── skills/                  # Claude Code 스킬
│       ├── n8n-gen/             # n8n 워크플로 JSON 자동 생성 (예정)
│       ├── dev-log/             # 개발 로그 기록
│       ├── github-push/         # GitHub 커밋/푸시
│       ├── phase-doc/           # Phase 문서화
│       ├── readme-update/       # README 갱신
│       ├── test-log/            # 테스트 로그
│       ├── test-scenario/       # 테스트 시나리오
│       └── ...
├── pre-requirement/
│   └── pre-requirement.txt      # 프로젝트 명세서 (v2.3)
├── src/                         # (예정) 소스 코드
│   ├── detection/
│   │   ├── engine.py            # 이상 탐지 범용 엔진
│   │   └── rules.json           # 탐지 룰 설정 파일
│   ├── masking/                 # 데이터 마스킹 처리
│   └── templates/               # 이메일 HTML 템플릿
├── n8n/                         # (예정) n8n 워크플로 JSON
│   ├── workflow_a_simulator.json
│   └── workflow_b_monitor.json
├── data/                        # (예정) 샘플 데이터
│   └── production_sample_data.xlsx
└── README.md
```

---

## 이상 탐지 룰 (Config-driven)

룰을 `rules.json`에 정의하고, `engine.py`가 범용으로 실행합니다.
새 데이터 적용 시 `rules.json`만 수정하면 됩니다.

| # | 탐지 항목 | 비교 타입 | 기준 | 심각도 |
|---|---|---|---|---|
| 1 | 생산량 급감 | drop_rate | 이전 대비 40% 감소 | 높음 |
| 2 | 가동률 저하 | below_threshold | 가동률 < 50% | 높음 |
| 3 | 불량률 급등 | exceeds_baseline | 정상의 3배 초과 | 높음 |
| 4 | 달성률 지연 | below_threshold | 달성갭 < -15%p | 중간 |
| 5 | 생산 정체 | consecutive_zero | 2시간 연속 0 | 높음 |
| 6 | 폐기 발생 | above_threshold | 폐기 > 0 | 중간 |
| 7 | 복합 이상 | compound | 생산 감소 + 불량 상승 | 높음 |
| 8 | 가동률 급락 | drop_points | 이전 대비 30%p 하락 | 높음 |

> 위 7가지 비교 타입은 제조 생산 데이터 기준 개발/데모용입니다.
> 실무에서 다른 도메인 적용 시 engine.py에 새 type 추가가 필요할 수 있습니다.

---

## 보안 전략

| 레벨 | 방식 | 외부 데이터 전송 |
|---|---|---|
| 레벨 1 (기본) | 집계 데이터만 AI에 전달 | 요약 통계만 |
| 레벨 1+ (권장) | 마스킹 처리 후 전달 | 코드로 치환된 데이터 |
| 레벨 2 (옵션) | LLM 없이 템플릿 모드 | 0건 |
| 레벨 3 (확장) | 로컬 LLM (Ollama) | 0건 |

> **AI 기능별 보안**: Python 패턴 1차 분류는 로컬 처리(외부 전송 없음). Claude API(해석 + 분류 검증)는 심각도 "높음" 또는 "악화" 시에만 마스킹된 데이터 전달, 학습 미사용 약관 적용. Power BI AI 시각화는 Microsoft 테넌트 내 처리로 외부 전송 없음.

---

## 개발 진행 현황

### Phase 1: 환경 구축 + 데이터 [미시작]

| # | 항목 | 상태 |
|---|---|---|
| 1 | Docker + n8n 셀프호스팅 설치 | 🔲 미시작 |
| 2 | Google Sheets 샘플 데이터 업로드 | 🔲 미시작 |
| 3 | SharePoint production_results.xlsx 생성 | 🔲 미시작 |
| 4 | Claude Code Skill "/n8n-gen" 개발 | 🔲 미시작 |
| 5 | 워크플로 A (테스트 시뮬레이터) JSON 생성 + Import | 🔲 미시작 |
| 6 | 워크플로 B 기본 구조 JSON 생성 + Import | 🔲 미시작 |
| 7 | Credential 연결 (Google Sheets, Gmail) | 🔲 미시작 |

### Phase 2: 이상 탐지 + AI 연동 [미시작]

| # | 항목 | 상태 |
|---|---|---|
| 1 | Config-driven 이상 탐지 (rules.json + engine.py) | 🔲 미시작 |
| 2 | Python 패턴 1차 분류 + Claude API 해석/검증 | 🔲 미시작 |
| 3 | 마스킹 처리 로직 | 🔲 미시작 |
| 4 | SharePoint Excel 자동 저장 | 🔲 미시작 |
| 5 | 중복 알림 방지 (Static Data) | 🔲 미시작 |
| 6 | 실패 안전 로직 (previous 복사 순서) | 🔲 미시작 |
| 7 | 워크플로 B 업데이트 JSON 재생성 | 🔲 미시작 |

### Phase 3: Power BI 대시보드 [미시작]

| # | 항목 | 상태 |
|---|---|---|
| 1 | Power BI Desktop → SharePoint Excel 연결 | 🔲 미시작 |
| 2 | 3개 페이지 대시보드 제작 | 🔲 미시작 |
| 3 | Power BI AI 시각화 배치 (Key Influencers, Decomp. Tree, Smart Narrative) | 🔲 미시작 |
| 4 | Power BI Service 게시 + 자동 새로고침 | 🔲 미시작 |
| 5 | 이메일에 Power BI 링크 포함 | 🔲 미시작 |

### Phase 4: 통합 테스트 + 완성 [미시작]

| # | 항목 | 상태 |
|---|---|---|
| 1 | 시뮬레이터 10시간 시나리오 전체 테스트 | 🔲 미시작 |
| 2 | 데이터 수명주기 관리 스크립트 | 🔲 미시작 |
| 3 | 리셋 기능 확인 | 🔲 미시작 |
| 4 | 포트폴리오 문서화 | 🔲 미시작 |

### 추후 확장 [보류]

| # | 항목 | 상태 |
|---|---|---|
| 1 | Tableau Public 분석용 대시보드 | ⏸ 보류 |
| 2 | n8n MCP 서버 (API 직접 제어) | ⏸ 보류 |
| 3 | Supabase 전환 | ⏸ 보류 |

---

## 프로젝트 성격

이 프로젝트는 **포트폴리오/데모 목적**으로 제작됩니다.
핵심 로직(이상 탐지, AI 해석, 알림, 대시보드)은 실무에서 동일하게 사용할 수 있으나,
실제 현장 적용에는 인증 체계, 에러 핸들링, 멀티 사용자 지원, 네트워크 보안 등 추가 레이어가 필요합니다.

---

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-03-23 | 프로젝트 기획 완료, 명세서 v2.1 작성 |
| 2026-03-23 | README.md 초기 생성 |
| 2026-03-24 | v2.2: AI 활용 확대 (Power BI AI 시각화 + 이상 패턴 분류) + 보안 정리 |
| 2026-03-24 | v2.3: 패턴 분류 Python+AI 하이브리드, n8n-gen 템플릿 방식 명확화 |
