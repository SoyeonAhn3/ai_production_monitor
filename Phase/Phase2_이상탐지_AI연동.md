# Phase 2 — 이상 탐지 + AI 연동 `🔲 미시작`

> Config-driven 이상 탐지 엔진을 구현하고, AI 해석/패턴 분류를 연동하여 핵심 분석 파이프라인을 완성한다. 일일 리포트(워크플로 D)에는 AI Agent 패턴을 적용하여 자율적 분석 리포트를 생성한다.

**상태**: 🔲 미시작
**선행 조건**: Phase 1 완료 (n8n + OneDrive + 워크플로 A/B 기본 구조)

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
| 1 | Claude Code Skill `/rules-gen` 개발 | 🔲 미시작 | rules.json 생성 + 형식 검증 |
| 2 | Config-driven 이상 탐지 (rules.json + engine.js) | 🔲 미시작 | 8가지 룰 × 3레벨 심각도 |
| 3 | 데이터 검증 로직 | 🔲 미시작 | null/빈칸, 라인 누락, 컬럼 검증 |
| 4 | JavaScript 패턴 1차 분류 | 🔲 미시작 | 신규/반복/악화 (로컬, AI 없음) |
| 5 | 마스킹 처리 로직 | 🔲 미시작 | mask_dict 동적 생성, 언마스킹 |
| 6 | Claude API 해석 + 패턴 2차 검증 | 🔲 미시작 | 심각/악화 건만 호출 |
| 7 | 이메일 알림 (심각도별 분기) | 🔲 미시작 | 심각: AI+이메일, 중간: 이메일만, 낮음: 로그만 |
| 8 | 중복 알림 방지 (Static Data) | 🔲 미시작 | 심각 30분 반복, 중간 1회 |
| 9 | 에러 핸들링 (7개 에러 지점) | 🔲 미시작 | 재시도/폴백/error_log |
| 10 | OneDrive Excel 자동 저장 | 🔲 미시작 | hourly_summary, anomaly_log |
| 11 | 워크플로 B 업데이트 JSON 재생성 | 🔲 미시작 | 전체 로직 반영 |
| 12 | AI Agent 도구 함수 구현 (워크플로 D) | 🔲 미시작 | get_anomaly_log, get_daily_summary 등 4개 |
| 13 | Claude Code Skill `/agent-prompt` 개발 | 🔲 미시작 | System Prompt 생성/버전 관리/튜닝 |
| 14 | AI Agent System Prompt + 루프 구현 | 🔲 미시작 | Claude Tool Use 기반, 최대 8회 |
| 15 | AI Agent 안전장치 (폴백, 호출 제한) | 🔲 미시작 | 실패 시 고정 포맷 리포트 대체 |
| 16 | 워크플로 D JSON 생성 | 🔲 미시작 | AI Agent 로직 포함 |

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

engine.js는 Excel 파일을 직접 열지 않는다. n8n의 Microsoft Excel 365 노드가 파일을 읽어서 JSON으로 변환한 후, JavaScript Code 노드에 전달한다.

```
[n8n Excel 노드] line_master.xlsx 읽기 → JSON 변환
[n8n Excel 노드] production_week.xlsx 읽기 → JSON 변환
    ↓
[JavaScript Code 노드] JSON 입력 받아서 분석
    const lines = items[0].json.line_master;   // n8n이 이미 읽어서 넘겨줌
    const rows = items[0].json.production_week;
```

**이유**: n8n Excel 노드가 읽기/쓰기를 담당하고, JavaScript Code 노드는 분석 로직에 집중한다. n8n이 Node.js 기반이므로 JavaScript Code 노드가 네이티브로 지원되어 호환성이 가장 안정적이다.

### 동작 순서
1. n8n Excel 노드가 line_master, production_week을 읽어서 JSON으로 전달
2. JavaScript Code 노드가 JSON에서 라인 목록, 팀 목록, 기준값을 동적 파악
3. rules.json 로드 → 룰 목록
4. 마지막 2개 시간대 추출
5. 각 라인 × 각 룰 조합으로 이상 판정
6. 결과를 JSON으로 출력 → n8n Excel 노드가 anomaly_log에 저장

### 설계 결정 사항
- **n8n 노드 분업**: Excel 읽기/쓰기는 n8n 노드, 분석 로직은 JavaScript Code 노드. 외부 라이브러리 불필요.
- **이전 시간 비교**: production_week.xlsx에 모든 시간이 쌓여 있으므로 같은 파일에서 마지막 2개 시간대 추출. 별도 previous 탭 불필요.
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

## 패턴 분류: Python + AI 하이브리드

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
| 심각 | ✅ (AI 분석 포함) | ✅ | 미해결 시 30분마다 |
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
- 심각: 같은 키 30분 이내 → 스킵, 30분 경과 + 미해결 → 에스컬레이션
- 중간: 사이클당 1회
- 낮음: 이메일 없음

---

## 에러 핸들링 (7개 에러 지점)

| # | 에러 지점 | 대응 | 재시도 |
|---|---|---|---|
| 1 | OneDrive 파일 읽기 실패 | error_log → 종료 | - |
| 2 | 데이터 검증 실패 | 문제 라인 분리 + 정상 라인 계속 | - |
| 3 | 이상 탐지 연산 에러 | 해당 룰만 스킵 | - |
| 4 | OneDrive 쓰기 실패 | error_log, 이메일은 발송 | 2회 (10초 간격) |
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

---

## AI Agent — 워크플로 D (일일 리포트)

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
| Claude API 장애 | try-except → 폴백 | 기존 고정 포맷 리포트 발송 |
| Agent 출력 파싱 실패 | 텍스트 그대로 사용 | 이메일에 텍스트 포함 |
| 도구 실행 실패 (OneDrive 장애) | Agent에게 에러 메시지 전달 | Agent가 가능한 범위로 작성 |
| API 타임아웃 | 60초 제한 | 폴백 리포트 발송 |

### 비용 영향

| | 단발 호출 (기존) | Agent (변경 후) |
|---|---|---|
| 호출 횟수/일 | 1회 | 2~6회 (상황에 따라) |
| 월 비용 (워크플로 D만) | ~$0.1 | ~$0.3~0.8 |
| 전체 비용 증가 | - | 월 +$0.2~0.5 |

---

## 선행 조건 및 의존성

- Phase 1 완료 (n8n + OneDrive + 워크플로 A/B)
- Claude API 키 활성화
- OneDrive 파일 구조 완성 (line_master, rules.json, production_results)

---

## 워크플로 B — n8n 노드 구조 (기능별 분리)

JavaScript 로직을 하나의 Code 노드에 넣지 않고, 기능별로 분리한다.
분리하면 에러 위치 특정이 쉽고, n8n UI에서 노드별 입출력을 바로 확인할 수 있으며, 특정 단계만 수정해도 다른 단계에 영향이 없다.

```
[n8n Excel 노드] OneDrive에서 production_week, line_master 읽기
    ↓ JSON
[Code 노드 1] 데이터 검증 — null/빈칸 체크, 라인 누락 판정
    ↓ 정상 라인 데이터 + 경고 목록
[Code 노드 2] 이상 탐지 + 집계 — 8룰 판정, hourly_summary 생성
    ↓ 이상 목록 + 집계 결과
[n8n Excel 노드] hourly_summary 저장
    ↓
[n8n Excel 노드] anomaly_log 최근 7일 읽기
    ↓ JSON
[Code 노드 3] 패턴 분류 — 신규/반복/악화 판정
    ↓ 분류된 이상 목록
[n8n Excel 노드] anomaly_log에 전체 이상 저장
    ↓
[IF 노드] 심각 또는 악화 있는가?
    ├─ YES → [Code 노드 4] 마스킹 + 프롬프트 조합 (최대 5건)
    │         ↓
    │        [Anthropic 노드] Claude API 호출
    │         ↓
    │        [Code 노드 5] JSON 파싱 + 언마스킹
    │         ↓
    │        [n8n Excel 노드] anomaly_log에 AI 해석 업데이트
    │         ↓
    │        [Gmail 노드] 알림 이메일 (심각+중간+낮음 포함)
    │
    ├─ 중간만 → [Gmail 노드] 알림 이메일 (중간+낮음, AI 없음)
    └─ 낮음만 → 종료 (로그만 저장됨)
```

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
  ├─ 검증된 코드를 Code 노드 1~5에 분배
  ├─ n8n Excel 노드 ↔ Code 노드 간 JSON 전달 확인
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
- Excel 읽기/쓰기는 n8n Excel 노드가 담당 — JavaScript는 JSON 입출력만
- 워크플로 B의 JavaScript Code 노드는 5개로 분리 (검증 → 탐지 → 분류 → 마스킹 → 파싱)
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
| 2026-03-25 | 구현 방식 결정 — n8n 노드 분업(Excel 읽기), Code 노드 5개 분리, 로컬 먼저 개발, AI 최대 5건 |
| 2026-03-25 | Python → JavaScript 전환 (개발 환경에서 WSL2/Docker 사용 불가, n8n 네이티브 JS Code 노드로 변경) |
| 2026-03-25 | SharePoint → OneDrive 전환 |
