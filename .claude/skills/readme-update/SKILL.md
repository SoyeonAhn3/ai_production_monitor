---
name: readme-update
type: general
version: 1.0
description: 프로젝트 방향성/구조/개발 로직 변경 또는 개발 Status 업데이트 시 README.md를 자동으로 갱신한다. "readme 업데이트해줘", "개발 현황 반영해줘", "Phase 상태 바꿔줘", "완료 표시해줘" 등의 요청 시 트리거한다.
required_environment:
  - Python 3.8+
depends_on: []
produces:
  - README.md (갱신)
  - logs/dev_YYYYMMDD.jsonl (변경 이력 기록)
---

# README Update Skill

`README.md`를 최신 프로젝트 상태에 맞게 갱신한다.
갱신 대상: 개발 진행 현황 테이블 / Phase 상태 / 프로젝트 구조 / 아키텍처 / 변경 이력

---

## 실행 절차

### STEP 1 — 현재 상태 파악

아래 파일들을 Read 도구로 확인한다:
- `README.md` — 현재 내용
- `UserRequirement.md` — 최신 요구사항
- `src/modules/` 디렉토리 — 실제 구현된 파일 목록
- `.claude/skills/` 디렉토리 — 등록된 스킬 목록

### STEP 2 — 변경 유형 판단

사용자 요청을 아래 유형으로 분류하여 해당 섹션만 업데이트한다:

| 변경 유형 | 업데이트 대상 섹션 |
|---|---|
| Skill/모듈 완료 | 개발 진행 현황 테이블, Phase 현황, 프로젝트 구조 |
| 방향성/요구사항 변경 | 시스템 아키텍처, 가중치 점수표, 설명 문구 |
| 구조 변경 (파일/폴더) | 프로젝트 구조 트리 |
| Phase 변경 | Phase별 개발 계획 테이블 |
| 전체 갱신 | 모든 섹션 |

### STEP 3 — README.md 업데이트

Edit 도구로 해당 섹션을 수정한다.

**상태 표기 규칙:**
```
✅ 완료
🚧 진행 중
🔲 미시작
⏸ 보류
```

**Phase 상태 표기 규칙:**
```
[완료]   — Phase 내 모든 항목 ✅
[진행 중] — Phase 내 일부 ✅, 일부 🔲
[미시작]  — Phase 내 전체 🔲
[보류]   — 일정 미정
```

### STEP 4 — dev-log에 변경 이력 기록

README 업데이트 후 dev-log 스킬로 기록:

```
[dev-log에 기록할 내용]
event_type : CHANGE
module     : README
message    : README.md 업데이트
before     : [변경 전 상태 요약]
after      : [변경 후 상태 요약]
reason     : [변경 이유]
```

### STEP 5 — 완료 보고

업데이트된 섹션과 변경 내용을 사용자에게 요약하여 보고한다.

---

## 실패 처리

| 실패 유형 | 처리 방법 |
|---|---|
| README.md 파일 없음 | 경로 재확인 요청 후 중단 |
| 파일 I/O 실패 (쓰기) | `logs/error_YYYYMMDD.jsonl`에 기록 후 중단 |
| dev-log 스킬 기록 실패 | README 업데이트는 완료 처리, dev-log 기록 스킵 후 사용자 알림 |
| 대상 섹션 미발견 | 사용자에게 현재 README 구조 보고 후 수동 확인 요청 |

---

## 주의사항
- 섹션 전체를 재작성하지 말고 변경된 부분만 Edit 도구로 수정할 것
- 개발 진행 현황 테이블의 번호 순서와 Phase 분류는 유지할 것
- 실제 파일/폴더 존재 여부를 확인한 후 구조 트리를 업데이트할 것
- `변경 이력` 섹션에 날짜와 변경 내용을 항상 추가할 것
