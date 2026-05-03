// Code Node 4: 마스킹 + Claude API 프롬프트 조합
// 입력: 심각/악화 이상 목록 + lineMaster
// 출력: 마스킹된 프롬프트 + maskDict (언마스킹용)

const input = items[0].json;
const toNotify = input.toNotify;
const lineMaster = input.lineMaster;
const run_id = input.run_id;
const warnings = input.warnings || [];
const hourly_summary = input.hourly_summary;
const classifiedAnomalies = input.classifiedAnomalies;

// 심각 또는 악화 건만 AI 분석 대상
const aiTargets = toNotify
  .filter(a => a.severity === '심각' || a.pattern_type === '악화')
  .sort((a, b) => {
    const sOrder = { '심각': 0, '중간': 1, '낮음': 2 };
    const pOrder = { '악화': 0, '반복': 1, '신규': 2 };
    if (sOrder[a.severity] !== sOrder[b.severity]) return sOrder[a.severity] - sOrder[b.severity];
    return (pOrder[a.pattern_type] || 2) - (pOrder[b.pattern_type] || 2);
  })
  .slice(0, 5);

if (aiTargets.length === 0) {
  return [{ json: { skipAI: true, toNotify, classifiedAnomalies, run_id, warnings, hourly_summary, lineMaster } }];
}

// --- 마스킹 사전 생성 ---
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

function applyMask(text) {
  let masked = text;
  const sortedKeys = Object.keys(maskDict).sort((a, b) => b.length - a.length);
  for (const original of sortedKeys) { masked = masked.split(original).join(maskDict[original]); }
  return masked;
}

// --- 마스킹된 이상 목록 ---
const maskedTargets = aiTargets.map((a, idx) => ({
  id: idx + 1,
  line: maskDict[a['라인명']] || a['라인명'],
  product: maskDict[a['품목']] || a['품목'],
  type: a.type,
  severity: a.severity,
  pattern: a.pattern_type,
  recurrence: a.recurrence_count,
  detail: applyMask(a.detail)
}));

// --- Claude API 프롬프트 ---
const systemPrompt = `당신은 제조 현장 이상 탐지 분석 전문가입니다.
다음 이상 건들을 분석하고 JSON 형식으로 응답해주세요.
응답에서 반드시 제공된 코드(LINE_A, PROD_01 등)를 사용하세요.
실제 이름은 사용하지 마세요.

출력 형식:
{
  "anomalies": [
    {
      "id": 번호,
      "summary": "한 줄 요약",
      "root_cause": "추정 원인",
      "action": "권장 조치",
      "pattern_verification": "동의" 또는 "보정: 이유",
      "cross_impact": "다른 라인에 미치는 영향 (없으면 '없음')"
    }
  ],
  "overall_assessment": "전체 상황 종합 평가"
}`;

const userPrompt = `다음 ${maskedTargets.length}건의 이상을 분석해주세요:\n\n${JSON.stringify(maskedTargets, null, 2)}`;

const requestBody = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 2000,
  system: systemPrompt,
  messages: [{ role: "user", content: userPrompt }]
};

return [{ json: {
  skipAI: false,
  requestBody,
  reverseDict,
  aiTargets,
  toNotify,
  classifiedAnomalies,
  run_id, warnings, hourly_summary, lineMaster
} }];
