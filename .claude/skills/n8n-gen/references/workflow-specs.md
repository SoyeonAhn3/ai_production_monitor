# 워크플로 상세 스펙

## 공통 사항

- **데이터 저장소**: OneDrive for Business
- **n8n Excel 노드**: Microsoft Excel 365 노드 사용 (OneDrive 연결)
- **Code 노드**: JavaScript (n8n 네이티브)
- **Credential placeholder**: `"id": "PLACEHOLDER"`
- **파일 경로 기준**: OneDrive 루트 기준 상대 경로

### OneDrive 파일 경로

| 파일 | 경로 |
|---|---|
| production_week.xlsx | production/production_week.xlsx |
| production_results.xlsx | production/production_results.xlsx |
| line_master.xlsx | config/line_master.xlsx |
| rules.json | config/rules.json |
| data_bank.xlsx | simulator/data_bank.xlsx |

---

## 워크플로 A: 테스트 시뮬레이터

### 개요
Webhook 클릭으로 data_bank.xlsx에서 다음 시간 데이터를 꺼내 production_week.xlsx에 추가. 10번 클릭 = 하루 시뮬레이션.

### 트리거
- Webhook (수동, HTTP GET)
- 리셋용 Webhook (별도 path: /webhook/reset)

### 노드 구성

```
1. [Webhook] path: /webhook/simulate, method: GET
2. [Code 노드] Static Data에서 카운터 읽기 (초기값 0)
3. [Microsoft Excel 365] data_bank.xlsx 전체 읽기
4. [Code 노드] 카운터 기반으로 해당 시간 행 필터링
   - 시간 배열: ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']
   - 카운터 0 → 08:00 행(12개), 카운터 1 → 09:00 행(12개)...
   - 카운터 >= 10이면 "하루 완료" 메시지 반환
5. [Microsoft Excel 365] production_week.xlsx에 행 추가 (append)
6. [Code 노드] 카운터 +1, Static Data에 저장
7. [Respond to Webhook] 결과 반환 (추가된 행 수, 현재 시간)
```

### 리셋 워크플로 (별도 또는 같은 워크플로 내 분기)

```
1. [Webhook] path: /webhook/reset, method: GET
2. [Code 노드] 카운터 = 0으로 초기화
3. [Microsoft Excel 365] production_week.xlsx 시트 클리어 (헤더만 남김)
4. [Respond to Webhook] "리셋 완료" 반환
```

### Static Data 구조
```json
{
  "counter": 0
}
```

---

## 워크플로 B: 모니터 (Phase 1 — 뼈대)

### 개요
Phase 1에서는 Schedule Trigger + OneDrive 읽기만 구성. 이상 탐지 로직은 Phase 2에서 추가.

### 트리거
- Schedule Trigger: 매시간 10분 (08:10, 09:10, 10:10...)

### 노드 구성 (Phase 1 뼈대)

```
1. [Schedule Trigger] 매시간 10분
2. [Microsoft Excel 365] production_week.xlsx 읽기
3. [Microsoft Excel 365] line_master.xlsx 읽기
4. [Code 노드] 데이터 확인 (행 수 출력, 정상 동작 확인용)
5. [NoOp] 종료 (Phase 2에서 이상 탐지 로직으로 교체)
```

---

## 워크플로 B: 모니터 (Phase 2 — 완성)

### 트리거
- Schedule Trigger: 매시간 10분

### 노드 구성 (완성)

```
1.  [Schedule Trigger] 매시간 10분
2.  [Microsoft Excel 365] production_week.xlsx 읽기
3.  [Microsoft Excel 365] line_master.xlsx 읽기
4.  [Code 노드 1] 데이터 검증 — null/빈칸 체크, 라인 누락 판정
5.  [Code 노드 2] 이상 탐지 + 집계 — rules.json 기반 8룰 판정, hourly_summary 생성
6.  [Microsoft Excel 365] hourly_summary 탭에 저장
7.  [Microsoft Excel 365] anomaly_log 최근 7일 읽기
8.  [Code 노드 3] 패턴 분류 — 신규/반복/악화 판정
9.  [Microsoft Excel 365] anomaly_log에 전체 이상 저장
10. [IF 노드] 심각 또는 악화 있는가?
    ├─ YES:
    │  11. [Code 노드 4] 마스킹 + 프롬프트 조합 (최대 5건)
    │  12. [HTTP Request] Claude API 호출
    │  13. [Code 노드 5] JSON 파싱 + 언마스킹
    │  14. [Microsoft Excel 365] anomaly_log에 AI 해석 업데이트
    │  15. [Gmail] 알림 이메일 (심각+중간+낮음 포함)
    ├─ 중간만:
    │  16. [Gmail] 알림 이메일 (중간+낮음, AI 없음)
    └─ 낮음만:
       17. [NoOp] 종료 (로그만 저장됨)
```

---

## 워크플로 C: 주간 백업

### 개요
매주 월요일 07:50에 지난주 데이터를 백업하고 새 주를 시작.

### 트리거
- Cron: 매주 월요일 07:50

### 노드 구성

```
1. [Schedule Trigger] 매주 월요일 07:50
2. [Microsoft Excel 365] production_week.xlsx 읽기
3. [Code 노드] 날짜 범위 계산 (지난주 월~일)
4. [Code 노드] daily_summary 집계 (팀별 일별 요약)
5. [Microsoft Excel 365] daily_summary 탭에 저장
6. [Microsoft Excel 365] backup/ 폴더에 production_YYYYMMDD_YYYYMMDD.xlsx로 복사
7. [Microsoft Excel 365] production_week.xlsx 클리어 (헤더만 남김)
8. [Code 노드] anomaly_log에서 지난주 건 보관 확인
```

---

## 워크플로 D: AI Agent 일일 리포트

### 개요
매일 08:00에 AI Agent가 자율적으로 어제 데이터를 분석하고 리포트를 작성.

### 트리거
- Cron: 매일 08:00

### 노드 구성

```
1. [Schedule Trigger] 매일 08:00
2. [Microsoft Excel 365] production_results.xlsx (anomaly_log, daily_summary 탭) 읽기
3. [Microsoft Excel 365] production_week.xlsx 읽기
4. [Microsoft Excel 365] line_master.xlsx 읽기
5. [Code 노드 1] 도구 함수 정의 + 데이터를 변수에 저장
   - get_anomaly_log(날짜, 심각도, 라인)
   - get_daily_summary(날짜, 팀)
   - get_line_master()
   - get_hourly_detail(날짜, 라인)
6. [Code 노드 2] Agent 루프
   - Claude API에 System Prompt + 도구 목록 + "어제 리포트 작성" 전송
   - tool_use 응답 시 → 해당 도구 실행 → 결과 전달 → 반복
   - end_turn 응답 시 → 최종 리포트 추출
   - 최대 8회 도구 호출 제한
7. [IF 노드] Agent 성공?
   ├─ YES:
   │  8. [Code 노드 3] 리포트 파싱 + 경영진 CC 판단
   │  9. [Gmail] 리포트 이메일 발송
   └─ NO:
      10. [Code 노드 4] 폴백 리포트 생성 (고정 포맷)
      11. [Gmail] 폴백 이메일 발송
```

### Agent System Prompt 핵심

```
당신은 생산 현장 일일 리포트 작성 AI Agent입니다.
제공된 도구를 사용해 어제의 생산 데이터를 조회하고 분석하세요.

리포트 깊이 기준:
- 심각 0건 + 중간 2건 이하 → 간단 (도구 1~2회)
- 심각 1~2건 또는 중간 3건+ → 보통 (도구 3~4회)
- 심각 3건+ 또는 악화 추세 → 상세 (도구 5~6회, 경영진 CC)

출력은 반드시 JSON 형식으로:
{
  "report_level": "간단/보통/상세",
  "cc_management": true/false,
  "summary": "한 줄 요약",
  "sections": {...},
  "recommendations": [...]
}
```

### 안전장치

| 상황 | 대응 |
|---|---|
| 도구 호출 8회 초과 | 루프 강제 종료, 현재까지 데이터로 리포트 |
| Claude API 실패 | 폴백 리포트 (고정 포맷) |
| 리포트 파싱 실패 | 텍스트 그대로 이메일 본문에 포함 |
| 도구 실행 실패 | Agent에게 에러 메시지 전달, 가능한 범위로 작성 |
| API 타임아웃 | 60초 제한, 폴백 리포트 |
