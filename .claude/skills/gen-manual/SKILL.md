---
name: gen-manual
version: 1.1
description: 개발한 프로그램의 Word 사용자 매뉴얼(.docx)을 자동 생성한다. 한국어(기본) 및 영어 지원. /gen-manual, "매뉴얼 만들어줘", "사용 설명서 만들어줘", "Word 매뉴얼 생성해줘", "프로그램 메뉴얼 작성해줘", "영어 매뉴얼 만들어줘", "create manual in English" 등의 요청 시 트리거한다.
required_environment:
  - Python 3.8+
  - python-docx (pip install python-docx)
depends_on: []
produces:
  - manuals/YYYYMMDD_프로그램명_매뉴얼.docx (한국어)
  - manuals/YYYYMMDD_ProgramName_Manual.docx (영어)
references:
  - references/template-code.py   # Word 생성 기반 코드 패턴 (i18n 포함)
  - references/sections-guide.md  # 섹션 구성 판단 기준 및 다국어 작성 가이드
---

# gen-manual Skill

프로그램 정보를 수집하여 전문적인 Word 사용자 매뉴얼(.docx)을 자동 생성한다.
한국어(기본) 및 영어 매뉴얼을 지원한다.
생성 코드 패턴은 `references/template-code.py`, 섹션 구성 기준은 `references/sections-guide.md`를 참고한다.

---

## STEP 0 — 레퍼런스 로드

스킬 실행 전 반드시 먼저 실행:

```
Read(".claude/skills/gen-manual/references/template-code.py")
Read(".claude/skills/gen-manual/references/sections-guide.md")
```

→ 코드 패턴, 색상 상수, 섹션 판단 기준, 출력 경로 규칙 확인

---

## STEP 1 — 언어 감지 및 프로그램 정보 수집

### 1-A. 언어 감지

사용자 요청에서 언어를 판별한다:

| 감지 키워드 | 설정 |
|---|---|
| (기본, 언어 미지정) | `LANG = "ko"` |
| "영어로", "English", "in English", "영문 매뉴얼" | `LANG = "en"` |

→ 이후 모든 DATA 텍스트(OVERVIEW_TEXT, PREREQUISITES, FEATURES, FAQS 등)를 해당 언어로 작성
→ `TARGET_AUDIENCE`도 언어에 맞게 설정 (ko: "일반 사용자", en: "General Users")

### 1-B. 프로그램 정보 수집

사용자 설명 또는 대화 컨텍스트에서 아래 항목이 파악되면 바로 STEP 2 진행:

**필수 항목:**
- 프로그램 이름
- 한 줄 설명 (무엇을 하는 프로그램인지)
- 주요 기능 목록 (2개 이상)

**선택 항목 (파악 가능하면 포함):**
- 버전 (기본값: v1.0)
- 대상 사용자 (기본값: 일반 사용자 / General Users)
- 플랫폼/환경 (웹, 데스크탑, CLI 등)
- 사전 요구사항 (설치 필요 항목 등)
- FAQ (자주 묻는 질문)
- 매뉴얼 저장 경로 (기본값: 현재 프로젝트 내 manuals/)

파악이 부족하면 한 번만 질문:
```
"매뉴얼을 만들 프로그램 정보를 알려주세요:
1. 프로그램 이름
2. 한 줄 설명 (무엇을 하는 프로그램인지)
3. 주요 기능 목록
4. (선택) 버전, 대상 사용자, 사전 요구사항, FAQ"
```

---

## STEP 2 — 매뉴얼 구조 설계

`references/sections-guide.md`의 섹션 판단 기준에 따라 포함할 섹션 결정:

1. **표지** (필수) — 프로그램명, 버전, 작성일, 대상 사용자
2. **목차** (필수) — 확정된 섹션 반영
3. **개요** (필수) — 한 줄 설명 + 주요 스펙 표
4. **사전 준비사항** (조건부) — 설치/환경 요구사항이 있을 때
5. **시작하기** (조건부) — 설치/접속 절차가 있을 때
6. **주요 기능** (필수) — 기능별 소제목 + 표/설명
7. **데이터 저장 방식** (조건부) — 저장 메커니즘이 있을 때
8. **주의사항 및 제한사항** (조건부) — 제약이 있을 때
9. **FAQ** (조건부) — Q&A가 있을 때

---

## STEP 3 — Python 스크립트 생성

`references/template-code.py`의 코드 패턴을 기반으로, 수집한 정보로 채운 Python 스크립트를 생성한다.

**생성 규칙:**
- 상단 DATA 섹션에 모든 내용 변수 정의
- `LANG` 변수 설정: `"ko"` (기본) 또는 `"en"` (영어 요청 시)
- LANG이 `"en"`이면 모든 DATA 텍스트를 영어로 작성
- 색상 상수는 template-code.py의 COLOR_* 그대로 사용
- I18N 딕셔너리와 `t()` 함수는 template-code.py에서 그대로 사용
- 섹션 수에 맞게 목차 항목 동적 생성
- 출력 경로: `{프로젝트_루트}/manuals/YYYYMMDD_프로그램명_매뉴얼.docx` (한국어)
- 출력 경로: `{프로젝트_루트}/manuals/YYYYMMDD_ProgramName_Manual.docx` (영어)
- 파일명 규칙: 한글 OK, 공백은 `_`로 치환

스크립트를 임시 파일로 저장:
```
Write("manuals/_gen_temp.py", [생성한 스크립트 내용])
```

---

## STEP 4 — 스크립트 실행

```bash
# python-docx 설치 확인 후 실행
py -3.14 -m pip install python-docx -q
py -3.14 manuals/_gen_temp.py
```

실행 성공 시 임시 파일 삭제:
```bash
del manuals\_gen_temp.py
```

---

## STEP 5 — 결과 출력

```
✅ 매뉴얼 생성 완료
🌐 언어: 한국어 / English
📁 저장 위치: manuals/YYYYMMDD_프로그램명_매뉴얼.docx
📋 포함 섹션: [섹션 목록]
📄 주요 기능: N개
❓ FAQ: N개

Word에서 열어 확인하세요.
목차 페이지 번호는 Word에서 목차 선택 → F9로 갱신할 수 있습니다.
```

---

## 실패 처리

| 실패 유형 | 처리 방법 |
|---|---|
| python-docx 미설치 | `pip install python-docx` 실행 후 재시도 |
| 프로그램 정보 부족 | STEP 1 질문 1회 실행 |
| 스크립트 실행 오류 | 오류 메시지 파악 후 스크립트 수정 재시도 |
| 저장 경로 없음 | `mkdir -p manuals` 후 재시도 |
| 파일 저장 실패 | 채팅에만 출력 후 저장 실패 안내 |

---

## 주의사항

- 이미지(스크린샷) 삽입은 사용자가 이미지 파일 경로를 제공할 때만 포함
- Word 자동 목차 필드는 지원하지 않음 — 점선 목차로 대체, F9 갱신 안내
- 생성된 임시 스크립트(`_gen_temp.py`)는 실행 후 반드시 삭제
