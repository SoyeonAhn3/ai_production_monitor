---
name: [스킬명]
type: general | project-specific
version: 1.0
description: [트리거 조건 포함 설명. 예: "X를 수행한다. 'Y해줘', 'Z해줘' 등의 요청 시 트리거한다."]
required_environment:
  - Python 3.8+
  # - Codex CLI (optional)
  # - Gemini CLI (optional)
depends_on: []          # 이 스킬 실행 전 필요한 스킬 목록
produces: []            # 이 스킬이 생성하는 결과물 목록
references:             # 아래 판단 기준으로 필요 시 작성, 불필요하면 [] 또는 항목 삭제
  # - references/[파일명].md   # [용도 한 줄 설명]
---

# [스킬명] Skill

[한 줄 설명 — 이 스킬이 무엇을 하는지 명확하게]

---

## References 결정 (스킬 생성 시 체크)

아래 항목 중 하나라도 해당하면 `references/` 폴더와 파일을 함께 생성한다.

| 체크 | 조건 | 예시 |
|---|---|---|
| ☐ | SKILL.md에 넣기엔 너무 큰 데이터/목록 | solutions.md, blocklist.md |
| ☐ | 스킬 로직과 독립적으로 업데이트될 기준표 | risk-evaluation-guide.md, reconsult-guide.md |
| ☐ | AI 프롬프트에 주입할 컨텍스트 데이터 | parsing-guide.md |
| ☐ | 다른 스킬과 공유하는 스키마/포맷 정의 | schema.md |

해당 없으면 `references/` 폴더 생성하지 않는다.

### References 생성 시 파일 구조

```
.claude/skills/[스킬명]/
  ├── SKILL.md
  └── references/
      └── [파일명].md    # 판단 기준표 / 데이터 / 스키마
```

### References 파일 내용 원칙

- **SKILL.md** → 실행 흐름, 조건 분기, 오류 처리 (로직)
- **references/** → 판단 기준, 정적 데이터, 스키마 (데이터)
- 변경 빈도가 높거나 부피가 크면 references로 분리
- SKILL.md에서 참조 시: `Read("references/[파일명].md")`

---

## 사전 조건

- [필요한 파일 / 모듈 / 환경 변수 목록]
- `src/modules/[module].py` 존재 여부 확인

---

## STEP 1 — [첫 번째 주요 단계 이름]

[단계 설명]

```python
# 예시 코드
```

---

## STEP 2 — [두 번째 주요 단계 이름]

[단계 설명]

```bash
# 예시 명령
```

---

## 출력 형식

```
[출력 예시]
```

---

## 실패 처리

| 실패 유형 | 처리 방법 |
|---|---|
| Python 모듈 import 실패 | 에러 메시지 출력 + `pip install [패키지]` 안내 후 중단 |
| 파일 I/O 실패 (읽기) | 경로 재확인 요청 후 중단 |
| 파일 I/O 실패 (쓰기) | `logs/error_YYYYMMDD.jsonl`에 기록 후 중단 |
| 외부 CLI 호출 실패 (Codex/Gemini) | Fallback 모드 전환 + 사용자 알림 |
| [스킬 전용 실패 유형] | [처리 방법] |

---

## 주의사항

- [주의사항 1]
- [주의사항 2]
