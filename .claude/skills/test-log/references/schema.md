# Test Log Event Schema

test-log 스킬이 기록/조회 시 참조하는 이벤트 타입별 스키마 및 출력 포맷.

---

## 이벤트 타입

| 타입 | 의미 |
|---|---|
| `OBSERVATION` | 테스트 중 발견된 모호함 / 미명시 사항 |
| `BUG` | 실제 오동작 발생 |
| `IMPROVEMENT` | 사용자 요청 또는 테스트에서 도출된 개선 요청 |
| `CONFIRMED` | 정상 동작 확인 |

---

## 스키마

```json
{
  "timestamp": "2026-03-09T10:00:00+09:00",
  "session_id": "consult_20260309_001",
  "test_no": 1,
  "skill_tested": "generate-output",
  "step_tested": "STEP 3 본문 구성",
  "event_type": "OBSERVATION",
  "observation": "사용자 요구사항 섹션이 산출물에 포함되지 않음",
  "action_required": "parsed_requirement 파라미터 추가 및 요구사항 요약 섹션 신설"
}
```

### 필드 설명

| 필드 | 타입 | 설명 |
|---|---|---|
| `timestamp` | string | ISO 8601 형식 |
| `session_id` | string | 해당 테스트 세션 ID |
| `test_no` | number | 해당 날짜 파일 내 순번 (1부터 시작) |
| `skill_tested` | string | 테스트한 스킬명 |
| `step_tested` | string | 테스트한 STEP 또는 설명 |
| `event_type` | string | OBSERVATION / BUG / IMPROVEMENT / CONFIRMED |
| `observation` | string | 발견 내용 요약 |
| `action_required` | string \| null | 수정 필요 내용. CONFIRMED 타입만 null 허용 |

---

## 조회 출력 포맷

```
=== 테스트 관찰 이력 [YYYYMMDD] ===

[#N] skill_tested — step_tested
  타입        : OBSERVATION / BUG / IMPROVEMENT / CONFIRMED
  발견 내용   : ...
  조치 필요   : ...

총 N건 (OBSERVATION: N | BUG: N | IMPROVEMENT: N | CONFIRMED: N)
```

---

## 주의사항

- JSONL 특성상 JSON 한 줄로 기록 — 줄바꿈 없이 작성
- `test_no`는 해당 날짜 파일 내 순번 (1부터 시작)
- `action_required`가 null이면 CONFIRMED 타입에만 허용
