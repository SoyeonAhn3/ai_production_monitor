# 매뉴얼 섹션 구성 가이드

## 섹션 포함 판단 기준

| 섹션 | 포함 조건 | 기본값 |
|---|---|---|
| 표지 | 항상 포함 | 필수 |
| 목차 | 항상 포함 | 필수 |
| 개요 | 항상 포함 | 필수 |
| 사전 준비사항 | 설치/환경 요구사항이 1개 이상 있을 때 | 조건부 |
| 시작하기 | 실행/접속 절차가 있을 때 | 조건부 |
| 주요 기능 | 항상 포함 (기능이 없으면 스킬 실행 불필요) | 필수 |
| 데이터 저장 방식 | 파일/DB/브라우저 저장이 있을 때 | 조건부 |
| 주의사항 및 제한사항 | 제약 또는 위험 동작이 있을 때 | 조건부 |
| FAQ | Q&A가 1개 이상 있을 때 | 조건부 |

---

## 섹션별 작성 가이드

### 표지
- APP_NAME: 공식 프로그램명 (짧고 명확하게)
- VERSION: "v숫자.숫자" 형식 (없으면 v1.0)
- TARGET_AUDIENCE: "일반 사용자" / "관리자" / "개발자" / "운영팀" 등
- TODAY: 자동 삽입 (datetime.date.today())

---

### 개요 스펙 표 (OVERVIEW_SPECS)

프로그램 유형별 권장 스펙 항목:

**웹 앱:**
- 플랫폼: "웹 브라우저 (Chrome 권장)"
- 데이터 저장: "브라우저 LocalStorage / IndexedDB"
- 출력 형식: "Word (.docx) / PDF / Excel"
- 인터넷 연결: "최초 접속 시 필요 / 오프라인 사용 가능"

**데스크탑 앱 (Python/Electron 등):**
- 플랫폼: "Windows 10 이상 / macOS"
- 설치 방법: "pip install xxx / exe 실행"
- 데이터 저장: "로컬 파일 (JSON/SQLite)"
- 출력 형식: "Excel (.xlsx) / Word (.docx)"

**CLI 도구:**
- 플랫폼: "Windows CMD / PowerShell / macOS Terminal"
- Python 버전: "3.8 이상"
- 설치: "pip install xxx"
- 출력: "콘솔 출력 / 파일 저장"

---

### 주요 기능 표 (FEATURES)

기능 표 컬럼 유형별 권장 구성:

**기능 목록형:**
```python
table_headers = ["기능", "설명", "단축키/버튼"]
```

**계층/구조 설명형:**
```python
table_headers = ["계층", "설명", "예시", "삭제 영향"]
```

**단계별 절차형:**
```python
table_headers = ["단계", "동작", "결과"]
```

**설정/옵션형:**
```python
table_headers = ["항목", "기본값", "설명"]
```

---

### FAQ 작성 규칙

- Q: 사용자가 실제로 겪을 문제 상황으로 시작 ("Q. ~합니다." / "Q. ~되지 않습니다.")
- A: 원인 + 해결 방법을 1~2문장으로 (기술적 설명 최소화)
- 권장 FAQ 수: 3~7개

**공통 FAQ 패턴 (해당 시 포함):**
- 데이터가 사라졌을 때 → 저장 방식 설명 + 백업 권장
- 파일이 다운로드/저장되지 않을 때 → 권한/팝업 설정 확인
- 프로그램이 실행되지 않을 때 → 환경 요구사항 재확인
- 속도가 느릴 때 → 데이터 크기 제한 또는 최적화 방법

---

## 다국어 지원 (i18n)

- 기본 언어: 한국어 (`LANG = "ko"`)
- 지원 언어: 영어 (`LANG = "en"`)
- 사용자가 "영어로 만들어줘", "English manual", "in English" 등 영어 매뉴얼을 요청하면 `LANG = "en"` 설정
- **별도 언어 요청이 없으면 항상 한국어로 생성**

### 영어 매뉴얼 작성 시 주의사항

- DATA 섹션의 모든 내용 텍스트(OVERVIEW_TEXT, PREREQUISITES, FEATURES 등)를 영어로 작성
- TARGET_AUDIENCE도 영어로 설정 (예: "General Users", "Administrators")
- FAQ의 Q/A도 영어로 작성 (Q. → Q., A. → A. 형식 유지)
- 파일명 suffix도 영어로: `_Manual.docx`

### 영어 섹션 구성 예시

| 한국어 | 영어 |
|---|---|
| 개요 | Overview |
| 사전 준비사항 | Prerequisites |
| 시작하기 | Getting Started |
| 주요 기능 | Key Features |
| 데이터 저장 방식 | Data Storage |
| 주의사항 및 제한사항 | Cautions & Limitations |
| 문제 해결 (FAQ) | Troubleshooting (FAQ) |

---

## 출력 파일 경로 규칙

```
manuals/YYYYMMDD_프로그램명_매뉴얼.docx        (한국어)
manuals/YYYYMMDD_ProgramName_Manual.docx      (영어)
```

- YYYYMMDD: currentDate 기준 오늘 날짜
- 프로그램명: APP_NAME 기반, 공백은 `_` 치환, 특수문자 제거
- 예: `manuals/20260313_ProcessFlow_매뉴얼.docx`
- 예: `manuals/20260313_ProcessFlow_Manual.docx` (영어)

**사용자가 다른 경로를 지정한 경우 해당 경로 사용**

---

## 섹션 번호 자동 조정 규칙

조건부 섹션이 빠질 경우 번호를 재조정한다:

| 경우 | 섹션 구성 |
|---|---|
| 모든 섹션 포함 | 1.개요 2.사전준비 3.시작하기 4.주요기능 5.저장방식 6.주의사항 7.FAQ |
| 사전준비 없음 | 1.개요 2.시작하기 3.주요기능 4.저장방식 5.주의사항 6.FAQ |
| 저장방식+주의사항 없음 | 1.개요 2.사전준비 3.시작하기 4.주요기능 5.FAQ |
| 최소 구성 | 1.개요 2.주요기능 |

목차 번호도 동일하게 조정하여 일치시킨다.
