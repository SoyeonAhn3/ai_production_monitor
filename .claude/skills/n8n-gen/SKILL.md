---
name: n8n-gen
type: project-specific
version: 1.0
description: n8n 워크플로 A/B/C/D의 JSON 템플릿을 자동 생성한다. "/n8n-gen", "워크플로 생성해줘", "n8n JSON 만들어줘", "워크플로 A 생성" 등의 요청 시 트리거한다.
required_environment:
  - Node.js 18+
  - n8n (npm install -g n8n)
depends_on: []
produces:
  - n8n/workflow_a_simulator.json
  - n8n/workflow_b_monitor.json
  - n8n/workflow_c_backup.json
  - n8n/workflow_d_report.json
references:
  - references/workflow-specs.md
  - references/node-templates.md
---

# n8n-gen Skill

n8n 워크플로 A/B/C/D의 JSON 템플릿을 자동 생성하여 `n8n/` 폴더에 저장한다. Credential은 placeholder 처리하며, n8n UI에서 Import 후 수동 연결한다.

---

## 사전 조건

- 프로젝트 루트에 `n8n/` 디렉토리 존재 (없으면 생성)
- Phase 문서 및 명세서 참조 가능
- `references/workflow-specs.md` — 워크플로별 상세 스펙
- `references/node-templates.md` — n8n 노드 JSON 구조 템플릿

---

## STEP 1 — 워크플로 선택

사용자에게 생성할 워크플로를 확인한다.

| 옵션 | 워크플로 | 출력 파일 |
|---|---|---|
| A | 테스트 시뮬레이터 | `n8n/workflow_a_simulator.json` |
| B | 모니터 (이상 탐지) | `n8n/workflow_b_monitor.json` |
| C | 주간 백업 | `n8n/workflow_c_backup.json` |
| D | AI Agent 일일 리포트 | `n8n/workflow_d_report.json` |
| ALL | 전체 재생성 | 위 4개 전부 |

사용자가 명시하지 않으면 질문한다:
```
어떤 워크플로를 생성할까요?
A: 테스트 시뮬레이터
B: 모니터 (이상 탐지)
C: 주간 백업
D: AI Agent 일일 리포트
ALL: 전체
```

---

## STEP 2 — 스펙 로드

선택된 워크플로의 상세 스펙을 로드한다.

```
Read("references/workflow-specs.md")
Read("references/node-templates.md")
```

Phase 문서도 참조:
- 워크플로 A/B 기본 구조: `Phase/Phase1_환경구축_데이터.md`
- 워크플로 B 완성/C/D: `Phase/Phase2_이상탐지_AI연동.md`

---

## STEP 3 — JSON 생성

`references/node-templates.md`의 노드 구조를 기반으로 워크플로 JSON을 조합한다.

### 생성 규칙

1. **Credential placeholder**: 모든 credential 참조는 `"id": "PLACEHOLDER"`로 처리
2. **노드 위치**: x, y 좌표를 적절히 배치하여 n8n UI에서 보기 좋게
3. **노드 연결**: connections 객체에서 노드 간 연결 정의
4. **워크플로 메타데이터**: name, active(false), settings 포함
5. **OneDrive 경로**: 프로젝트 폴더 구조에 맞게 설정
   - production/production_week.xlsx
   - production/production_results.xlsx
   - config/line_master.xlsx
   - simulator/data_bank.xlsx

### JSON 최상위 구조

```json
{
  "name": "워크플로명",
  "nodes": [...],
  "connections": {...},
  "active": false,
  "settings": {
    "executionOrder": "v1"
  },
  "tags": []
}
```

---

## STEP 4 — 파일 저장 및 검증

1. `n8n/` 디렉토리 확인 (없으면 생성)
2. JSON 파일 저장
3. JSON 유효성 검증 (파싱 가능한지 확인)

```bash
node -e "JSON.parse(require('fs').readFileSync('n8n/workflow_a_simulator.json', 'utf8')); console.log('Valid JSON')"
```

---

## STEP 5 — 사용자 안내

생성 완료 후 Import 방법을 안내한다:

```
워크플로 JSON 생성 완료: n8n/workflow_[x]_[name].json

n8n에서 Import하는 방법:
1. n8n UI (http://localhost:5678) 접속
2. 왼쪽 메뉴 "Workflows" 클릭
3. 우측 상단 "..." → "Import from File" 클릭
4. 생성된 JSON 파일 선택
5. Import 후 각 노드에서 Credential 연결 (PLACEHOLDER → 실제 인증 정보)
6. "Save" 후 "Active" 토글로 활성화
```

---

## 출력 형식

```
n8n 워크플로 생성 완료

| 워크플로 | 파일 | 노드 수 | 상태 |
|---|---|---|---|
| A: 시뮬레이터 | n8n/workflow_a_simulator.json | 7개 | 생성 완료 |

다음 단계: n8n UI에서 Import → Credential 연결 → 활성화
```

---

## 실패 처리

| 실패 유형 | 처리 방법 |
|---|---|
| n8n/ 디렉토리 생성 실패 | 권한 확인 요청 후 중단 |
| JSON 유효성 검증 실패 | 에러 위치 표시 후 재생성 |
| references 파일 없음 | 기본 스펙으로 생성 (Phase 문서 참조) |
| 이미 같은 파일 존재 | 사용자에게 덮어쓰기 확인 후 진행 |

---

## 주의사항

- Credential은 절대 실제 값을 넣지 않는다. 항상 `"PLACEHOLDER"`
- 워크플로 B는 Phase 1에서는 뼈대만, Phase 2에서 완성본을 재생성한다
- 워크플로 C/D는 Phase 2에서 생성한다
- JSON 생성 후 반드시 유효성 검증을 수행한다
- 기존 파일이 있으면 사용자 확인 없이 덮어쓰지 않는다
