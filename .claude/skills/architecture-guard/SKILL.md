---
name: architecture-guard
version: 1.0
description: 코드 구조 점검 스킬. 매 Phase 완료 시 또는 "구조 점검" 명령 시 트리거. 파일 길이, props 과다, 중복 패턴, frontmatter 중복 키, 수동 동기화 안티패턴을 자동 검출한다.
depends_on: []
produces: []
---

# architecture-guard Skill

코드 구조를 자동 점검하여 리팩토링이 필요한 지점을 사전에 탐지한다.
매 Phase 완료 시점 또는 사용자가 "구조 점검"을 요청할 때 실행한다.

---

## STEP 1 — 점검 범위 결정

사용자가 특정 파일/폴더를 지정하면 해당 범위만 점검.
지정하지 않으면 현재 프로젝트의 소스 코드를 자동 탐지하여 점검:

1. Glob으로 프로젝트 내 소스 파일을 탐색한다:
   - `**/*.{jsx,tsx,js,ts}` (React/JS/TS 프로젝트)
   - `**/*.{py}` (Python 프로젝트)
   - `**/*.{java,kt}` (Java/Kotlin 프로젝트)
2. `node_modules`, `dist`, `build`, `.next`, `__pycache__`, `.venv` 등 빌드/의존성 디렉토리는 제외한다.
3. `.claude/skills/**/SKILL.md` 파일도 점검 대상에 포함한다.

---

## STEP 2 — 점검 항목 실행

아래 5가지 항목을 순서대로 점검한다.

### 점검 1: 단일 파일 300줄 초과

**방법:** Glob으로 대상 파일 목록을 수집한 뒤, 각 파일의 줄 수를 `wc -l`로 확인한다.

```bash
find [대상경로] -name "*.jsx" -o -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" | xargs wc -l | sort -rn
```

- 300줄 초과 파일을 목록화
- 각 파일에 대해 Read로 구조를 파악하고 분리 지점을 제안

**판정 기준:**
- 300줄 초과: WARNING — 분리 권고
- 500줄 초과: CRITICAL — 즉시 분리 필요

---

### 점검 2: 컴포넌트 props 8개 초과

**방법:** Grep으로 함수 컴포넌트의 destructured props를 탐지한다.

```
패턴: export default function \w+\(\{([^}]+)\}\)
또는: function \w+\(\{([^}]+)\}\)
또는: const \w+ = \(\{([^}]+)\}\) =>
```

- 추출된 props를 `,` 기준으로 분리하여 개수를 센다
- 8개 초과 시 Context API 또는 상태 관리 도입을 권고

**판정 기준:**
- 8개 초과: WARNING — Context 또는 커스텀 훅으로 그룹화 권고
- 12개 초과: CRITICAL — 반드시 분리 필요

---

### 점검 3: 동일 패턴 3회 이상 반복

**방법:** 아래 유형의 반복을 탐지한다.

#### 3-A. 동일 함수/로직 블록 반복
- Grep으로 동일한 함수 호출 패턴이 3개 이상 파일에서 발견되는지 확인
- 예: `useState` + `useEffect` 조합이 동일 구조로 3회 이상 등장

#### 3-B. 동일 JSX 구조 반복
- 동일한 JSX 태그 구조(모달, 폼, 리스트, 카드)가 3회 이상 반복되는지 확인
- 예: 동일한 `<div style={...}>` + `<input>` + `<button>` 패턴

#### 3-C. 동일 스타일 객체 반복
- 같은 inline style 객체가 여러 파일에서 복붙되었는지 확인

**판정 기준:**
- 3회 반복: WARNING — 공통 유틸/훅/컴포넌트 추출 권고
- 5회 이상: CRITICAL — 즉시 추출 필요

**주의:** 구조적으로 유사하지만 세부가 다른 경우는 플래그만 하고 최종 판단은 사용자에게 맡긴다.

---

### 점검 4: SKILL.md frontmatter 중복 키

**방법:** `.claude/skills/**/SKILL.md` 파일들의 frontmatter에서 중복 키를 검출한다.

```bash
# 각 SKILL.md에서 --- 사이의 YAML 키를 추출하여 중복 확인
```

- 동일 SKILL.md 내에서 같은 키가 2번 이상 선언된 경우 탐지
- 서로 다른 SKILL.md 간에 description이 동일한 트리거 문구를 포함하는 경우 탐지

**판정 기준:**
- 동일 파일 내 중복 키: CRITICAL — YAML 파싱 오류 원인
- 파일 간 트리거 문구 중복: WARNING — 스킬 충돌 가능성

---

### 점검 5: 상태 업데이트 후 수동 동기화 패턴

**방법:** Grep으로 아래 안티패턴을 탐지한다.

#### 5-A. setState 후 수동 재계산
```
패턴: set\w+\(.*\)[\s\S]{0,50}set\w+\(
```
- 하나의 상태를 업데이트한 직후 다른 상태를 수동으로 동기화하는 패턴
- 예: `setItems(newItems); setCount(newItems.length);`
- → `count`는 `items.length`에서 파생(derived)되므로 별도 상태 불필요

#### 5-B. useEffect로 상태 동기화
```
패턴: useEffect\(\(\) => \{[\s\S]*?set\w+\(
```
- `useEffect` 안에서 다른 상태를 기반으로 상태를 설정하는 패턴
- → `useMemo` 또는 렌더링 중 직접 계산으로 전환 권고

**판정 기준:**
- 탐지 시: WARNING — derived state로 전환 권고
- 3회 이상 반복: CRITICAL — 상태 구조 재설계 필요

---

## STEP 3 — 결과 출력

아래 포맷으로 결과를 출력한다:

```
## 🏗️ Architecture Guard 점검 결과

### 요약
| 항목 | 검출 수 | 심각도 |
|------|---------|--------|
| 파일 300줄 초과 | N개 | WARNING/CRITICAL |
| Props 8개 초과 | N개 | WARNING/CRITICAL |
| 패턴 3회 반복 | N건 | WARNING/CRITICAL |
| Frontmatter 중복 키 | N건 | WARNING/CRITICAL |
| 수동 동기화 패턴 | N건 | WARNING/CRITICAL |

### 상세 내역

#### 1. 파일 300줄 초과
| 파일 | 줄 수 | 분리 제안 |
|------|-------|-----------|
| path/to/file.jsx | 350 | [분리 지점 설명] |

#### 2. Props 8개 초과
| 컴포넌트 | props 수 | 권고 |
|----------|----------|------|
| ComponentName | 10 | [Context 그룹화 제안] |

#### 3. 동일 패턴 반복
| 패턴 설명 | 발견 위치 | 권고 |
|-----------|-----------|------|
| [패턴] | file1, file2, file3 | [공통 추출 제안] |

#### 4. Frontmatter 중복 키
| 파일 | 중복 키 | 수정 방법 |
|------|---------|-----------|
| SKILL.md | key | [수정 방법] |

#### 5. 수동 동기화 패턴
| 파일:라인 | 현재 패턴 | 개선 방향 |
|-----------|-----------|-----------|
| file.jsx:42 | setState A → setState B | derived state 전환 |

### 📊 총평
- CRITICAL: N건 (즉시 수정 필요)
- WARNING: N건 (권장 수정)
- ✅ PASS: N항목 (문제 없음)
```

모든 항목이 통과하면:
```
✅ Architecture Guard 점검 통과 — 모든 항목 정상
```

---

## 실패 처리

| 실패 유형 | 처리 방법 |
|----------|----------|
| 대상 파일 없음 | 범위 재확인 후 사용자에게 알림 |
| Grep 패턴 매칭 실패 | 해당 항목 SKIP 처리, 사유 명시 |
| 파일 읽기 실패 | 해당 파일 SKIP, 나머지 계속 진행 |
