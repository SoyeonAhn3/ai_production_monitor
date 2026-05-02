# AI 확장 전략 — Agent / Sub-Agent / 오케스트레이션

> 현재 설계서(pre-requirement.txt) 기반으로 AI 활용을 확장할 수 있는 방안을 분석한 문서.
> 추가 스킬 개발, AI Agent 패턴, 오케스트레이션 구현 가능성을 정리한다.

작성일: 2026-03-24

---

## 1. 추가 개발 필요 스킬

### 1-1. 이미 계획된 스킬

| 스킬 | 상태 | Phase | 설명 |
|---|---|---|---|
| `/n8n-gen` | 🔲 미개발 | Phase 1 | 워크플로 A/B/C/D JSON 템플릿 자동 생성 |

### 1-2. 추가 제안 스킬

| 스킬 | 목적 | 우선순위 | 필요 Phase | 근거 |
|---|---|---|---|---|
| `/data-gen` | SharePoint용 Excel 샘플 데이터 자동 생성 | 높음 | Phase 1 | line_master(12라인 8컬럼), data_bank(120행, 이상 시나리오 5가지), production_results(4탭 빈 구조)를 수동 생성하면 시간 소모 + 실수 발생. Python 스크립트로 자동 생성하면 리셋 후 재생성도 가능 |
| `/rule-validator` | rules.json 문법 검증 + 탐지 시뮬레이션 | 중간 | Phase 2 | 룰 8가지 x 3레벨 JSON을 수동 작성하면 오타/누락 가능. 검증 + "이 데이터에 이 룰을 적용하면 결과가 이렇다" 미리보기 제공 |
| `/masking-config` | mask_dict 자동 생성 + 검증 | 낮음 | Phase 2 | line_master에서 동적으로 마스킹 사전을 생성하는 Python 코드 자동 생성. 라인 추가 시 마스킹 누락 방지 |
| `/email-template` | 이메일 HTML 템플릿 생성 | 낮음 | Phase 2 | 심각도별 분기(데이터 경고/심각/중간/낮음), 일일 리포트 등 3~4종의 HTML 템플릿 자동 생성 |

### 1-3. 추천 구현 순서

```
/n8n-gen (필수, Phase 1)
  → /data-gen (높음, Phase 1에서 함께)
  → /rule-validator (중간, Phase 2 초반)
  → /masking-config, /email-template (선택, Phase 2 중후반)
```

---

## 2. 현재 AI 사용 방식 분석

### 현재 설계 (Single-shot 호출)

```
Python 이상 탐지 완료
  → 심각/악화 건 필터링
  → 마스킹 처리
  → Claude API 1회 호출 (모든 건을 한 프롬프트에 묶어서)
  → JSON 응답 파싱
  → 끝
```

이것은 "AI Tool" (도구로서의 AI)이지 "AI Agent" (자율적 판단 주체)가 아님.

### 한계점

| 항목 | 현재 방식의 한계 |
|---|---|
| 데이터 범위 | AI에게 미리 정해진 데이터만 전달. AI가 "이 라인의 지난주 이력도 보고 싶다"고 판단할 수 없음 |
| 분석 깊이 | 1단계 분석만 가능. "가설 → 추가 데이터 조회 → 검증" 루프 없음 |
| 교차 분석 | 같은 사이클의 건만 비교. AI가 "같은 팀의 다른 라인도 영향 받았는지" 스스로 확인 불가 |
| 포트폴리오 어필 | "Claude API를 호출했다" 수준 → 차별화 약함 |

---

## 3. AI Agent 패턴 — 구현 가능한 3가지 방안

### 3-A. Multi-step Reasoning Agent (n8n 노드 기반)

**개념**: n8n의 IF/Switch/Loop 노드를 활용하여 Claude API를 조건부로 다단계 호출

**흐름**:
```
이상 데이터
  → Claude API [Step 1: 분류 검증 + "추가 조회 필요?" 판단]
  → IF 추가 조회 필요
      → SharePoint에서 이력 데이터 추가 조회
      → Claude API [Step 2: 이력 포함 근본 원인 분석]
  → IF 확신도 낮음
      → Claude API [Step 3: 대안 가설 생성]
  → 최종 응답 조합
```

**장점**: n8n 노드 구성만으로 구현. 별도 프레임워크 불필요.
**단점**: AI가 "무엇을 조회할지" 결정하는 게 아니라 사전 정의된 분기만 따름. 진정한 Agent라기보다는 조건부 파이프라인.
**난이도**: 중간
**어필력**: ★★☆ — "다단계 AI 분석"으로 어필 가능하지만 Agent라고 하기엔 약함

---

### 3-B. Claude Tool Use Agent (★ 추천)

**개념**: Claude API의 `tool_use` 기능을 활용하여 AI가 스스로 필요한 데이터를 요청하는 자율적 Agent

**핵심 차이**: AI가 "어떤 데이터를 추가로 볼지"를 스스로 판단

**Tool 정의**:
```python
tools = [
    {
        "name": "query_anomaly_history",
        "description": "특정 라인의 최근 N일간 이상 탐지 이력을 조회합니다. "
                       "반복 패턴, 심각도 변화 추이를 확인할 때 사용하세요.",
        "input_schema": {
            "type": "object",
            "properties": {
                "line_id": {"type": "string", "description": "라인 코드 (예: LINE_A)"},
                "days": {"type": "integer", "description": "조회 기간 (일)", "default": 7}
            },
            "required": ["line_id"]
        }
    },
    {
        "name": "query_line_performance",
        "description": "특정 라인의 최근 N시간 생산 실적 추이를 조회합니다. "
                       "생산량, 가동률, 불량률의 시간별 변화를 확인할 때 사용하세요.",
        "input_schema": {
            "type": "object",
            "properties": {
                "line_id": {"type": "string"},
                "hours": {"type": "integer", "default": 8}
            },
            "required": ["line_id"]
        }
    },
    {
        "name": "compare_team_lines",
        "description": "같은 팀에 속한 다른 라인들의 현재 상태를 비교합니다. "
                       "연쇄 영향(한 라인 고장이 다른 라인에 영향)을 분석할 때 사용하세요.",
        "input_schema": {
            "type": "object",
            "properties": {
                "line_id": {"type": "string", "description": "기준 라인 코드"},
                "metric": {"type": "string", "enum": ["production", "defect_rate", "operation_rate"]}
            },
            "required": ["line_id", "metric"]
        }
    }
]
```

**Agent 루프 (Python Code 노드 내 구현)**:
```python
import json
# anthropic SDK 사용 (커스텀 Docker 이미지 필요)

def run_analysis_agent(anomaly_data, masked_context):
    """
    Tool Use Agent 루프:
    1. 이상 데이터 + 컨텍스트를 Claude에 전달
    2. Claude가 tool_use로 추가 데이터 요청 → 실행 → 결과 반환
    3. Claude가 "충분하다"고 판단할 때까지 반복
    4. 최종 분석 결과 반환
    """
    messages = [
        {
            "role": "user",
            "content": f"""다음 생산 이상을 분석해주세요.
            필요하다면 도구를 사용하여 추가 데이터를 조회하세요.

            [감지된 이상]
            {json.dumps(anomaly_data, ensure_ascii=False)}

            [현재 컨텍스트]
            {masked_context}
            """
        }
    ]

    max_iterations = 5  # 무한 루프 방지
    iteration = 0

    while iteration < max_iterations:
        response = client.messages.create(
            model="claude-sonnet-4-6",  # 비용 효율
            max_tokens=2048,
            system=ANALYSIS_AGENT_SYSTEM_PROMPT,
            tools=tools,
            messages=messages
        )

        # tool_use가 없으면 (AI가 분석 완료) → 최종 응답 반환
        if response.stop_reason == "end_turn":
            return extract_final_response(response)

        # tool_use가 있으면 → 도구 실행 → 결과를 대화에 추가
        for block in response.content:
            if block.type == "tool_use":
                tool_result = execute_tool(block.name, block.input)
                messages.append({"role": "assistant", "content": response.content})
                messages.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(tool_result, ensure_ascii=False)
                    }]
                })

        iteration += 1

    # max_iterations 도달 시 폴백
    return extract_final_response(response)


def execute_tool(tool_name, tool_input):
    """
    AI가 요청한 Tool을 실행하여 데이터를 반환.
    실제 구현에서는 n8n의 SharePoint 노드 결과를 참조하거나,
    미리 읽어둔 데이터에서 필터링.
    """
    if tool_name == "query_anomaly_history":
        return query_anomaly_log(
            line_id=tool_input["line_id"],
            days=tool_input.get("days", 7)
        )
    elif tool_name == "query_line_performance":
        return query_production_week(
            line_id=tool_input["line_id"],
            hours=tool_input.get("hours", 8)
        )
    elif tool_name == "compare_team_lines":
        return compare_lines_in_team(
            line_id=tool_input["line_id"],
            metric=tool_input["metric"]
        )
    return {"error": f"Unknown tool: {tool_name}"}
```

**AI의 자율적 판단 예시**:
```
[입력] LINE_A: 생산량 91.7% 급감, LINE_D: 불량률 8배 급등

[AI Step 1] "LINE_A의 이력을 확인해보겠습니다"
  → tool_use: query_anomaly_history(line_id="LINE_A", days=7)
  → 결과: "최근 7일 내 2회 생산량 급감 발생"

[AI Step 2] "같은 팀의 다른 라인도 영향받았는지 확인합니다"
  → tool_use: compare_team_lines(line_id="LINE_A", metric="production")
  → 결과: "LINE_B 정상, LINE_C 10% 감소, LINE_D 정상"

[AI Step 3] "LINE_D의 불량률 추이도 확인합니다"
  → tool_use: query_line_performance(line_id="LINE_D", hours=8)
  → 결과: "09시부터 불량률 지속 상승 (3%→12%→24%)"

[AI 최종 응답]
{
  "anomalies": [
    {
      "id": 1,
      "summary": "LINE_A 설비 고장 추정 (3회째 반복)",
      "root_cause": "CNC 주축 베어링 마모 가능성. 7일 내 3회 반복은 임시 수리의 한계.",
      "action": "베어링 교체 또는 정밀 점검 필요. 임시 수리로는 재발 불가피.",
      "pattern_verification": "보정: 반복→악화 (빈도 증가 + 심각도 유지)",
      "cross_impact": "LINE_C 10% 감소는 LINE_A 정체로 인한 후공정 대기 가능성"
    },
    {
      "id": 2,
      "summary": "LINE_D 원자재 품질 이상",
      "root_cause": "09시부터 점진적 상승은 원자재 로트 변경 시점과 일치 가능성",
      "action": "현재 사용 중인 원자재 로트 번호 확인 + 이전 로트 대비 품질 검사",
      "pattern_verification": "동의: 신규",
      "cross_impact": "LINE_A 고장과 직접 연관 없음 (다른 팀)"
    }
  ],
  "overall_assessment": "LINE_A는 반복 고장으로 근본 수리 필요, LINE_D는 원자재 확인 우선"
}
```

**장점**:
- AI가 자율적으로 판단 → 진정한 Agent
- 필요한 만큼만 조회 → 불필요한 데이터 전달 없음
- 교차 분석이 AI 주도로 이루어짐
- 포트폴리오에서 "AI Agent 설계/구현" 강력 어필

**단점**:
- anthropic SDK pip install 필요 → 커스텀 Dockerfile
- Tool 실행 함수 구현 필요 (데이터 조회 로직)
- 호출 횟수 증가 → 비용 +1~3달러/월 (심각/악화 건만이므로 관리 가능)

**난이도**: 중상 — Python tool_use 루프 직접 구현
**어필력**: ★★★ — "AI Agent를 설계하고 Tool Use 패턴으로 구현했다"

---

### 3-C. Sub-Agent 패턴 (역할 분리)

**개념**: 분석을 역할별로 분리하여 전문화된 에이전트가 각각 담당

**구조**:
```
[Orchestrator Agent] — 전체 판단 + 최종 응답 조합
   │
   ├── [Detection Verifier] — Python 1차 분류 결과 검증 (동의/보정)
   │     "이 이상이 정말 심각인지, 반복인지 검증해줘"
   │
   ├── [Root Cause Analyzer] — 근본 원인 추정 + 권장 액션
   │     "이력 데이터를 보고 왜 이런 이상이 발생했는지 분석해줘"
   │
   └── [Cross Impact Analyzer] — 라인 간 연쇄 영향 분석
         "이 라인의 문제가 다른 라인에 영향을 줬는지 분석해줘"
```

**구현 방법 2가지**:

**(1) 경량 — 단일 프롬프트 내 역할 분리 (비용 동일)**
```python
system_prompt = """
당신은 생산 이상 분석 오케스트레이터입니다.
다음 3가지 역할을 순서대로 수행하세요:

<role name="detection_verifier">
Python이 1차 분류한 결과(신규/반복/악화)를 검증합니다.
동의하면 "동의", 보정이 필요하면 "보정: [이유]"를 출력합니다.
</role>

<role name="root_cause_analyzer">
각 이상의 근본 원인을 추정하고 권장 액션을 생성합니다.
이력 데이터가 제공되면 반복 패턴을 고려합니다.
</role>

<role name="cross_impact_analyzer">
여러 이상 간의 연관성을 분석합니다.
한 라인의 문제가 다른 라인에 영향을 줬을 가능성을 평가합니다.
</role>

각 역할의 분석 결과를 종합하여 최종 JSON 응답을 생성하세요.
"""
```

**(2) 본격 — 3개 별도 API 호출 + 조합**
```python
# 1. Detection Verifier (빠른 모델)
verify_response = client.messages.create(
    model="claude-haiku-4-5-20251001",  # 비용 최소
    system="당신은 이상 탐지 분류 검증 전문가입니다...",
    messages=[{"role": "user", "content": verification_prompt}]
)

# 2. Root Cause Analyzer (정밀 모델)
rootcause_response = client.messages.create(
    model="claude-sonnet-4-6",  # 비용 효율 + 품질
    system="당신은 제조 공정 근본 원인 분석 전문가입니다...",
    messages=[{"role": "user", "content": rootcause_prompt}]
)

# 3. Cross Impact Analyzer (빠른 모델)
cross_response = client.messages.create(
    model="claude-haiku-4-5-20251001",
    system="당신은 생산 라인 간 연쇄 영향 분석 전문가입니다...",
    messages=[{"role": "user", "content": cross_prompt}]
)

# 4. Orchestrator — 3개 결과 조합
final_response = client.messages.create(
    model="claude-sonnet-4-6",
    system="당신은 분석 결과를 종합하는 오케스트레이터입니다...",
    messages=[{"role": "user", "content": combine_prompt}]
)
```

**장점**: 역할별 전문화 → 분석 품질 향상 + "Sub-Agent 아키텍처" 어필
**단점**: API 호출 3~4회 → 비용 증가 / 경량 버전은 실제로 분리된 게 아님
**난이도**: 경량은 낮음 / 본격은 중상
**어필력**: 경량 ★★☆ / 본격 ★★★

---

## 4. 오케스트레이션 구현 여건 분석

### 4-1. 현재 인프라 평가

| 요소 | 현재 상태 | Agent 적합성 | 비고 |
|---|---|---|---|
| n8n 셀프호스팅 | Python Code 노드 사용 가능 | ✅ 적합 | tool_use 루프를 Python으로 구현 가능 |
| Claude API | Anthropic SDK 사용 예정 | ✅ 적합 | tool_use, multi-turn 모두 지원 |
| 데이터 접근 | SharePoint Excel (n8n 노드) | ✅ 적합 | Tool 실행 시 데이터 조회 가능 |
| Python 환경 | 순수 표준 라이브러리만 | ⚠ 제약 | anthropic SDK는 pip 필요 → 커스텀 Dockerfile |
| 비용 | 월 1~3달러 목표 | ⚠ 주의 | multi-step은 호출 증가. 심각/악화 건만 적용하면 관리 가능 |
| 포트폴리오 목적 | 기술 어필 중요 | ✅ 매우 적합 | Agent 패턴은 강력한 차별화 포인트 |

### 4-2. Dockerfile 수정 (Agent 구현 시 필수)

현재 설계서에서는 "순수 Python 표준 라이브러리만"으로 명시되어 있지만,
Agent 패턴 구현 시 anthropic SDK가 필요하다.

```dockerfile
FROM n8nio/n8n
USER root
RUN pip install anthropic
USER node
```

설계서 영향:
- 12장(기술 스택)의 "순수 Python(표준 라이브러리만)" 문구를 수정 필요
- "데모 규모에서 anthropic SDK만 추가, 나머지는 표준 라이브러리"로 변경
- 또는: n8n Anthropic 노드를 1차 호출에 사용하고, tool_use 루프만 Python Code 노드에서 구현하는 하이브리드 방식

### 4-3. n8n 내 Agent 배치 방안

```
워크플로 B (모니터) — 수정된 5단계 파이프라인
──────────────────────────────────────────────

[1단계] 파일 확인 (변경 없음)
[2단계] 데이터 읽기 + 검증 (변경 없음)
[3단계] 이상 탐지 + 집계 (변경 없음)
[4단계] 패턴 분류 + 로그 저장 (변경 없음)

[5단계] 알림 분기 (★ Agent로 교체)
  ├── 심각/악화 있음
  │     ├── [기존] 마스킹 → Claude 1회 호출 → 파싱
  │     └── [Agent] 마스킹 → Tool Use Agent 루프 → 파싱
  │           ※ 데이터 사전 로드: anomaly_log 7일 + production_week 전체 + line_master
  │           ※ AI가 Tool 호출 시 사전 로드된 데이터에서 필터링 (추가 API 불필요)
  │
  ├── 중간만 → 이메일 (변경 없음)
  └── 낮음만 → 로그만 (변경 없음)
```

핵심: "5단계의 AI 호출 부분만 Agent로 교체". 나머지 파이프라인은 동일.

### 4-4. 데이터 사전 로드 전략

Agent가 Tool을 호출할 때마다 SharePoint에 API를 날리면 느리고 비효율적.
해결: 5단계 진입 전에 필요한 데이터를 미리 전부 읽어둔다.

```
[4단계 완료 후, 5단계 진입 전]
  → SharePoint: anomaly_log 최근 7일 읽기 (이미 4단계에서 읽음, 재사용)
  → SharePoint: production_week 전체 읽기 (이미 2단계에서 읽음, 재사용)
  → SharePoint: line_master 읽기 (이미 2단계에서 읽음, 재사용)

[Agent Tool 실행]
  query_anomaly_history → 메모리 내 anomaly_log에서 필터링
  query_line_performance → 메모리 내 production_week에서 필터링
  compare_team_lines → 메모리 내 line_master + production_week에서 필터링
```

추가 SharePoint API 호출 0건. Tool 실행은 순수 Python 필터링만.

### 4-5. 비용 시뮬레이션

| 시나리오 | API 호출 | 예상 비용/건 | 월간 예상 |
|---|---|---|---|
| 현재 (Single-shot) | 1회/사이클 | ~$0.01 | $1~3 |
| Agent (Tool Use, 평균 3회 반복) | 3~4회/사이클 | ~$0.03 | $3~5 |
| Sub-Agent 본격 (4개 호출) | 4회/사이클 | ~$0.04 | $4~6 |

※ 심각/악화 건에만 적용 (하루 2~5건 정도) 기준
※ Sonnet 모델 사용 시. Haiku 혼용하면 30~50% 절감

### 4-6. 비용 최적화 전략

| 전략 | 절감 | 설명 |
|---|---|---|
| 심각/악화 건만 Agent 적용 | 기본 | 중간/낮음은 기존대로 단순 처리 |
| max_iterations 제한 | 안전장치 | Tool Use 루프 최대 5회로 제한 |
| Haiku로 검증, Sonnet으로 분석 | 30~50% | Sub-Agent 시 역할별 모델 분리 |
| 사전 로드 데이터 캐싱 | API 절감 | SharePoint 추가 호출 0건 |

---

## 5. 추천 구현 방안

### 5-1. 임팩트 vs 난이도 매트릭스

```
높은      ┃  3-B. Tool Use Agent    3-C. Sub-Agent (본격)
포트폴리오 ┃     (★★★ 추천)
임팩트    ┃
          ┃  3-A. Multi-step        3-C. Sub-Agent (경량)
          ┃
낮은      ┃  추가 스킬만 개발
임팩트    ┃
          ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            낮은 난이도                높은 난이도
```

### 5-2. 추천안: Tool Use Agent (3-B) + 경량 Sub-Agent (3-C-1) 조합

```
[Orchestrator + Tool Use Agent]
  │
  ├── Tool: query_anomaly_history    → 이력 조회
  ├── Tool: query_line_performance   → 실적 추이
  ├── Tool: compare_team_lines       → 팀 내 라인 비교
  │
  └── System Prompt 내 역할 분리 (경량 Sub-Agent)
        ├── Detection Verifier 역할
        ├── Root Cause Analyzer 역할
        └── Cross Impact Analyzer 역할
```

이유:
- Tool Use로 "자율적 데이터 조회" 어필 (Agent 핵심)
- 경량 Sub-Agent로 "역할 분리 설계" 어필 (오케스트레이션)
- 단일 API 호출 루프 안에서 둘 다 구현 → 비용 최소
- 포트폴리오에서 "AI Agent + Sub-Agent 오케스트레이션" 동시 어필

### 5-3. 구현 로드맵

```
Phase 1: 환경 구축
  → /n8n-gen + /data-gen 스킬 개발
  → 커스텀 Dockerfile (anthropic SDK 포함) 준비

Phase 2 전반: 기본 구현
  → engine.py + rules.json 이상 탐지
  → 단순 Claude API 1회 호출로 먼저 동작 확인 (빠른 검증)

Phase 2 후반: Agent 전환 (★)
  → 기존 1회 호출 코드를 Tool Use Agent 루프로 교체
  → Tool 3개 정의 + 실행 함수 구현
  → System Prompt에 역할 분리 추가
  → max_iterations + 폴백 처리

Phase 4: 검증 + 문서화
  → 시뮬레이터로 Agent 동작 검증
  → 포트폴리오에 Agent 아키텍처 다이어그램 포함
  → "AI가 스스로 추가 데이터를 조회하여 분석한 사례" 시연
```

---

## 6. 설계서 영향 범위

Agent 패턴을 적용할 경우, 기존 설계서(pre-requirement.txt)에서 수정이 필요한 부분:

| 섹션 | 현재 내용 | 변경 필요 |
|---|---|---|
| 6장 (이상 탐지) AI 프롬프트 | 1회 호출, JSON 출력 | Tool Use Agent 루프 + Tool 정의 추가 |
| 8장 (워크플로 B) 5단계 | Claude API 1회 호출 | Agent 루프로 교체 (사전 데이터 로드 포함) |
| 9장 (에러 핸들링) 에러 지점 5 | Claude API 실패 대응 | Agent 루프 실패 대응 추가 (max_iterations, Tool 실행 에러) |
| 12장 (기술 스택) | 순수 Python 표준 라이브러리 | anthropic SDK 추가, 커스텀 Dockerfile 명시 |
| 14장 (스킬셋) | AI/LLM 활용 | "AI Agent 설계 (Tool Use 패턴)" 추가 |

※ 핵심 파이프라인 구조(1~4단계)와 Config-driven 설계는 변경 없음.
※ Agent는 5단계의 AI 호출 부분만 교체하는 것이므로 영향 범위가 제한적.

---

## 7. 포트폴리오 어필 포인트 (Agent 적용 시)

### 기존 어필

> "Config-driven 설계로 설정만 바꾸면 다른 공장에도 적용 가능합니다."

### Agent 적용 후 추가 어필

> "AI가 단순히 주어진 데이터를 분석하는 것이 아니라,
> 스스로 필요한 데이터를 판단하고 조회하여 다단계로 분석합니다.
> 예를 들어 CNC 1호기 고장이 감지되면, AI가 자율적으로
> 최근 7일 이력을 조회하고, 같은 팀의 다른 라인 상태를 비교하여
> '반복 고장이므로 베어링 교체 필요' + '후공정 라인에 연쇄 영향'까지
> 한 번에 분석합니다."

### 면접 대비 키워드

- AI Agent (Tool Use 패턴)
- Multi-step Reasoning
- Sub-Agent 역할 분리
- 자율적 데이터 조회 (Agentic RAG)
- 비용 최적화 (심각/악화 건만, max_iterations 제한, 사전 로드)
- 폴백 전략 (Agent 실패 시 Single-shot으로 폴백)
