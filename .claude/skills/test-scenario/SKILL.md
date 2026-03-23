---
name: test-scenario
version: 1.1
description: 개발 완료 후 사용자가 수행해야 할 테스트 시나리오를 자동 생성하고 파일로 저장한다. "테스트 시나리오 만들어줘", "어떤 테스트 해야 해", "테스트 케이스 생성해줘", "무슨 걸 확인해야 해", "테스트 뭐 해야 돼" 등의 요청 시 트리거한다.
depends_on: []
produces:
  - test-scenarios/YYYYMMDD_기능명.md
---

# Test Scenario Generator Skill

개발 완료 시점에 맞는 사용자 테스트 시나리오를 생성하고 파일로 저장한다.
생성 규칙은 `references/rules.md`, 파일 형식은 `references/template.md`를 참고한다.

---

## STEP 0 — 레퍼런스 로드

시나리오 생성 전 반드시 먼저 실행:

```
Read(".claude/skills/test-scenario/references/rules.md")
Read(".claude/skills/test-scenario/references/template.md")
```

→ 3축 구성 비율, 필수 항목, 파일 경로 규칙, 출력 포맷 확인

---

## STEP 1 — 입력 수집

사용자 설명에서 아래 3가지가 파악되면 바로 STEP 2 진행:
- 구현한 기능이 무엇인지
- 사용자가 하는 주요 동작
- 어디에 저장되거나 어떤 결과가 나오는지

파악이 부족하면 한 번만 질문:
```
"어떤 기능을 구현하셨나요? 간단히 알려주시면 바로 생성합니다:
1. 구현한 기능 요약
2. 사용자가 하는 주요 동작
3. 저장 위치 또는 결과물"
```

---

## STEP 2 — 시나리오 생성

`references/rules.md`의 3축 구성 비율과 필수 항목 기준으로 시나리오 작성.

---

## STEP 3 — 파일 저장

`references/template.md`의 파일 경로 규칙과 내용 구조에 맞게 저장.

1. `test-scenarios/` 폴더 없으면 생성: `mkdir -p test-scenarios`
2. `template.md`의 파일 내용 구조로 마크다운 작성
3. Write 도구로 저장

---

## STEP 4 — 채팅 출력

`references/template.md`의 채팅 출력 포맷에 맞게 저장 결과 + 전체 내용 출력.

---

## 실패 처리

| 실패 유형 | 처리 방법 |
|----------|----------|
| 기능 설명 부족 | STEP 1 질문 1회 실행 |
| 폴더 생성 실패 | Bash 재시도 → 실패 시 채팅에만 출력 |
| 파일 저장 실패 | 채팅에만 출력 후 저장 실패 안내 |
| references 로드 실패 | 경로 재확인 후 사용자에게 알림 |
