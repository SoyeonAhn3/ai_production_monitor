---
name: ai-multi-discussion
type: general
version: 1.0
description: 주어진 주제에 대해 Codex CLI, Gemini CLI, Claude 세 AI의 의견을 수집·비교하고 베스트 안을 도출한 뒤 사용자가 선택한 안을 최종 실행 계획(To-do)으로 확정합니다. 사용자가 "A에 대해 다른 AI와 논의해 협의해 와" 또는 "ai-multi-discussion" 명령을 사용할 때 트리거합니다.
required_environment:
  - Python 3.8+
  - Codex CLI (optional — 미설치 시 Fallback 모드)
  - Gemini CLI (optional — 미설치 시 Fallback 모드)
depends_on: []
produces:
  - AI 3자 의견 비교 테이블 (출력)
  - 최종 실행 계획 To-do (출력)
---

# AI Multi-Discussion

사용자가 제시한 주제에 대해 **Codex CLI**, **Gemini CLI**, **Claude** 세 AI의 의견을 병렬 수집하고, 비교 분석 후 최적안을 도출합니다.

## 논의 주제
$ARGUMENTS

---

## 실행 절차

아래 단계를 순서대로 실행하세요.

### STEP 1 — 도구 버전 자동 감지

Bash 도구로 아래 명령을 실행해 현재 설치된 최신 버전을 확인합니다:

```bash
codex --version 2>/dev/null || echo "codex: 미설치"
gemini --version 2>/dev/null || echo "gemini: 미설치"
```

- Codex CLI: `codex exec` 사용 (OpenAI 최신 모델 자동 선택)
- Gemini CLI: `gemini -p` 사용 (Google Gemini 최신 모델 자동 선택)
- Claude: 현재 세션의 모델(claude-sonnet-4-6 이상)

### STEP 2 — 세 AI 의견 수집

#### 2-A. Codex CLI 호출
Bash 도구로 실행합니다 (타임아웃 120초):

```bash
codex exec "$ARGUMENTS 에 대해 다음을 답해줘: 1) 핵심 접근법 2) 구체적 구현 방안 3) 예상 리스크 4) 추천 이유. 한국어로 답변하되 300자 이내로 간결하게."
```

출력을 `CODEX_RESPONSE` 변수로 저장합니다.

#### 2-B. Gemini CLI 호출
Bash 도구로 실행합니다 (타임아웃 120초).
Gemini는 settings.json을 직접 읽지 않으므로 반드시 아래처럼 API 키를 환경변수로 전달합니다:

```bash
GEMINI_API_KEY=$(py -c "import json,os; d=json.load(open(os.path.expanduser('~/.gemini/settings.json'))); print(d.get('GEMINI_API_KEY',''))" 2>/dev/null || python3 -c "import json,os; d=json.load(open(os.path.expanduser('~/.gemini/settings.json'))); print(d.get('GEMINI_API_KEY',''))" 2>/dev/null) && \
GEMINI_API_KEY="$GEMINI_API_KEY" gemini -p "$ARGUMENTS 에 대해 다음을 답해줘: 1) 핵심 접근법 2) 구체적 구현 방안 3) 예상 리스크 4) 추천 이유. 한국어로 답변하되 300자 이내로 간결하게."
```

출력을 `GEMINI_RESPONSE` 변수로 저장합니다.

#### 2-C. Claude 자체 의견 수립
Claude가 직접 주제를 분석하여 아래 형식으로 의견을 작성합니다:
- 핵심 접근법
- 구체적 구현 방안
- 예상 리스크
- 추천 이유

### STEP 3 — 세 의견 비교 요약 출력

아래 형식으로 비교 테이블을 출력합니다:

```
---
## 🤖 AI 3자 의견 비교: [논의 주제]

### 사용 모델
| AI | 도구 | 버전/모델 |
|---|---|---|
| Codex | Codex CLI | [codex --version 결과] |
| Gemini | Gemini CLI | [gemini --version 결과] |
| Claude | Claude Code | claude-sonnet-4-6 |

---

| 항목 | Codex | Gemini | Claude |
|---|---|---|---|
| 핵심 접근법 | ... | ... | ... |
| 구현 방안 | ... | ... | ... |
| 예상 리스크 | ... | ... | ... |
| 특이점 | ... | ... | ... |

---
```

### STEP 4 — 베스트 조합안 도출

세 의견의 공통점과 차별점을 분석해 최적 조합을 도출합니다:

```
## ✅ 베스트 안 (권장)
**제목**: [조합안 이름]
**근거**: [세 AI 의견 중 어떤 요소를 조합했는지 명시]
**핵심 내용**: (3~5줄)
```

### STEP 5 — 사용자 선택지 제시

반드시 아래 선택지를 출력하고 **사용자 응답을 기다립니다** (자동 진행 금지):

```
---
## ❓ 어떤 안으로 진행할까요?

1. ✅ 베스트 안 (권장) — [베스트 안 제목]
2. 🤖 Codex 의견으로 진행
3. 🤖 Gemini 의견으로 진행
4. 🤖 Claude 의견으로 진행
5. 🔀 직접 설정 (원하는 내용을 자유롭게 말씀해주세요)

번호 또는 자유 텍스트로 답변해주세요.
---
```

### STEP 6 — 최종 실행 계획(To-do) 확정

사용자가 선택하면, 선택된 안을 기반으로 아래 형식의 To-do를 작성합니다:

```
---
## 📋 최종 실행 계획 (To-do)

**채택 안**: [선택된 안 이름]
**기반 의견**: [어떤 AI 의견을 참고했는지]

### 실행 단계
- [ ] 1. [구체적 액션 1]
- [ ] 2. [구체적 액션 2]
- [ ] 3. [구체적 액션 3]
- [ ] ...

### 예상 리스크 및 대응
- 리스크: [내용] → 대응: [방법]

### 성공 기준
- [측정 가능한 완료 기준]
---
```

---

## 실패 처리

| 실패 유형 | 처리 방법 |
|---|---|
| Codex CLI 미설치 | "codex: 미설치" 표시 후 Gemini + Claude 2자 비교로 Fallback 진행 |
| Gemini CLI 미설치 | "gemini: 미설치" 표시 후 Codex + Claude 2자 비교로 Fallback 진행 |
| Codex CLI 호출 타임아웃 (120초 초과) | Fallback 모드 전환 + 에러 내용 명시 + 나머지 AI 의견으로만 진행 |
| Gemini API Key 없음 / 인증 실패 | Fallback 모드 전환 + 에러 내용 명시 + 나머지 AI 의견으로만 진행 |
| 전체 외부 CLI 실패 | Claude 단독 의견으로만 진행 + 사용자 알림 |

---

## 주의사항
- STEP 5에서 사용자가 선택하기 전까지 STEP 6을 절대 실행하지 말 것
- Codex 또는 Gemini CLI 호출이 실패할 경우 에러 내용을 명시하고 나머지 AI 의견으로만 진행
- 응답이 너무 길면 핵심만 요약해 비교 테이블에 반영
- 모든 출력은 한국어로 작성
