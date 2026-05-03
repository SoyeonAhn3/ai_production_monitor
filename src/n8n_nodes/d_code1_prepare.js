// 워크플로 D — Code Node 1: 데이터 로드 + 도구 함수 정의 + 마스킹
// 입력: Google Sheets에서 읽은 anomaly_log, daily_summary, production_week, line_master
// 출력: Agent에게 보낼 tools 정의 + 마스킹된 데이터 + System Prompt

const anomalyLog = input.anomalyLog || [];
const dailySummary = input.dailySummary || [];
const productionWeek = input.productionWeek || [];
const lineMaster = input.lineMaster || [];

// --- 날짜 계산 ---
const now = new Date();
const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toISOString().slice(0, 10);

// --- 마스킹 사전 ---
const maskDict = {};
const reverseDict = {};
lineMaster.forEach((lm, i) => {
  const lineCode = `LINE_${String.fromCharCode(65 + i)}`;
  const productCode = `PROD_${String(i + 1).padStart(2, '0')}`;
  const teamCode = `TEAM_${lm['팀'].replace(/[^0-9]/g, '')}`;
  maskDict[lm['라인명']] = lineCode;
  maskDict[lm['품목']] = productCode;
  maskDict[lm['팀']] = teamCode;
  reverseDict[lineCode] = lm['라인명'];
  reverseDict[productCode] = lm['품목'];
  reverseDict[teamCode] = lm['팀'];
});

function maskText(text) {
  if (typeof text !== 'string') return text;
  let masked = text;
  const keys = Object.keys(maskDict).sort((a, b) => b.length - a.length);
  for (const k of keys) { masked = masked.split(k).join(maskDict[k]); }
  return masked;
}

function maskObj(obj) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = typeof v === 'string' ? maskText(v) : v;
  }
  return result;
}

// --- 마스킹된 데이터 준비 ---
const maskedAnomalyLog = anomalyLog.map(maskObj);
const maskedDailySummary = dailySummary.map(maskObj);
const maskedProductionWeek = productionWeek.map(maskObj);
const maskedLineMaster = lineMaster.map((lm, i) => ({
  라인ID: lm['라인ID'],
  라인명: maskDict[lm['라인명']] || lm['라인명'],
  팀: maskDict[lm['팀']] || lm['팀'],
  품목: maskDict[lm['품목']] || lm['품목'],
  시간당목표: lm['시간당목표'],
  정상불량률: lm['정상불량률']
}));

// --- Claude API Tool 정의 ---
const tools = [
  {
    name: "get_anomaly_log",
    description: "이상 이력을 조회합니다. 날짜, 심각도, 라인ID로 필터링할 수 있습니다.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "조회할 날짜 (YYYY-MM-DD). 미지정 시 어제" },
        severity: { type: "string", description: "심각도 필터 (심각/중간/낮음). 미지정 시 전체" },
        line_id: { type: "string", description: "라인ID 필터 (예: L03). 미지정 시 전체" }
      },
      required: []
    }
  },
  {
    name: "get_daily_summary",
    description: "일별 요약을 조회합니다. 날짜, 팀으로 필터링할 수 있습니다.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "조회할 날짜 (YYYY-MM-DD). 미지정 시 어제" },
        team: { type: "string", description: "팀 필터 (예: TEAM_1). 미지정 시 전체" }
      },
      required: []
    }
  },
  {
    name: "get_line_master",
    description: "라인/팀 구성 정보를 조회합니다.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_hourly_detail",
    description: "시간별 생산 상세 데이터를 조회합니다. 날짜, 라인ID로 필터링할 수 있습니다.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "조회할 날짜 (YYYY-MM-DD). 미지정 시 어제" },
        line_id: { type: "string", description: "라인ID 필터 (예: L03). 미지정 시 전체" }
      },
      required: []
    }
  }
];

// --- System Prompt ---
const systemPrompt = `당신은 제조 현장 일일 리포트를 작성하는 AI Agent입니다.
제공된 도구를 사용해 어제(${yesterdayStr})의 생산 데이터를 조회하고 분석하세요.

도구 사용 규칙:
- 먼저 get_anomaly_log로 어제 이상 건수를 파악하세요.
- 심각도와 건수에 따라 추가 조회 깊이를 결정하세요.
- 불필요한 도구 호출은 하지 마세요.
- 모든 라인명과 품목명은 제공된 코드(LINE_A, PROD_01 등)로 표기하세요.

리포트 깊이 기준:
- 심각 0건 + 중간 2건 이하 → 간단 (도구 1~2회)
- 심각 1~2건 또는 중간 3건+ → 보통 (도구 3~4회)
- 심각 3건+ 또는 악화 추세 → 상세 (도구 5~6회, 경영진 CC)

반드시 아래 JSON 형식으로 응답하세요:
{
  "report_level": "간단/보통/상세",
  "cc_management": true/false,
  "summary": "한 줄 요약",
  "sections": {
    "핵심_경고": "심각/악화 건 상세 (없으면 '없음')",
    "추세_분석": "최근 7일 추이 (보통/상세만)",
    "팀별_현황": "팀별 달성률/불량률 요약",
    "기타_이상": "중간/낮음 건 요약",
    "권장_조치": "조치 사항 정리"
  },
  "recommendations": ["권장 조치 1", "권장 조치 2"]
}`;

return [{ json: {
  tools,
  systemPrompt,
  yesterdayStr,
  maskedAnomalyLog,
  maskedDailySummary,
  maskedProductionWeek,
  maskedLineMaster,
  reverseDict
} }];
