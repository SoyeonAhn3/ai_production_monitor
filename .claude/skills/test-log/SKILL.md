---
name: test-log
version: 1.0
description: 스킬 실제 실행 테스트 중 발견된 관찰사항, 버그, 개선 필요 사항을 JSONL 형식으로 기록하고 조회한다. "테스트 관찰 기록해줘", "테스트 이력 보여줘", "관찰사항 정리해줘" 등의 요청 시 트리거한다.
depends_on: []
produces:
  - logs/test/test_YYYYMMDD.jsonl
---

# Test Log Skill

스킬 테스트 실행 중 발견된 관찰사항을 JSONL 파일에 기록하고 조회한다.
개발 개선 작업의 근거 데이터로 활용한다.
스키마 및 포맷 상세는 `references/schema.md`를 참고한다.

---

## STEP 0 — 스키마 로드

기록 또는 조회 전 반드시 먼저 실행:

```
Read(".claude/skills/test-log/references/schema.md")
```

→ 필드 정의, 이벤트 타입별 스키마, 출력 포맷 확인

---

## 이벤트 타입

| 타입 | 의미 |
|---|---|
| `OBSERVATION` | 테스트 중 발견된 모호함 / 미명시 사항 |
| `BUG` | 실제 오동작 발생 |
| `IMPROVEMENT` | 사용자 요청 또는 테스트에서 도출된 개선 요청 |
| `CONFIRMED` | 정상 동작 확인 |

---

## STEP 1 — 기록

1. 오늘 날짜 기준 파일 경로: `logs/test/test_YYYYMMDD.jsonl`
2. `logs/` 없으면 Bash로 `mkdir -p logs`
3. 파일 없으면 Write로 생성, 있으면 Edit으로 마지막 줄 뒤에 추가

### 스키마

```json
{
  "timestamp": "YYYY-MM-DDTHH:MM:SS+09:00",
  "session_id": "consult_YYYYMMDD_NNN",
  "test_no": 1,
  "skill_tested": "스킬명",
  "step_tested": "STEP N 또는 설명",
  "event_type": "OBSERVATION | BUG | IMPROVEMENT | CONFIRMED",
  "observation": "발견 내용 요약",
  "action_required": "수정 필요 내용 또는 null"
}
```

---

## STEP 2 — 조회

1. 해당 날짜 JSONL 파일 Read
2. 필터 적용 (skill_tested / event_type / session_id)
3. 아래 형식으로 출력

### 출력 포맷

```
=== 테스트 관찰 이력 [YYYYMMDD] ===

[#N] skill_tested — step_tested
  타입        : OBSERVATION / BUG / IMPROVEMENT / CONFIRMED
  발견 내용   : ...
  조치 필요   : ...

총 N건 (OBSERVATION: N | BUG: N | IMPROVEMENT: N | CONFIRMED: N)
```

---

## 실패 처리

| 실패 유형 | 처리 방법 |
|---|---|
| `logs/` 없음 | Bash로 `mkdir -p logs` 후 재시도 |
| 파일 쓰기 실패 | 사용자에게 내용 직접 출력 후 중단 |

---

## 주의사항

- JSONL 특성상 JSON 한 줄로 기록 — 줄바꿈 없이 작성
- `test_no`는 해당 날짜 파일 내 순번 (1부터 시작)
- `action_required`가 null이면 CONFIRMED 타입에만 허용
