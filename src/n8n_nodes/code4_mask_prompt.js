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
// 워크플로 B 개선 — 증거 패킷용 데이터
const productionRows = input.productionRows || [];
const historicalLog = input.historicalLog || [];

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

// --- 증거 패킷 조립 (워크플로 B 개선) ---
// 이미 시트에서 읽어온 데이터로 AI에 근거를 제공 → 추측이 아닌 검증 가능한 가설 유도
function buildEvidence(target) {
  const lineId = target['라인ID'];
  // 1) 해당 라인 최근 6시간 추세
  const trend = productionRows
    .filter(r => r['라인ID'] === lineId)
    .sort((a, b) => String(a['시간']).localeCompare(String(b['시간'])))
    .slice(-6)
    .map(r => ({ 시간: r['시간'], 생산: r['시간당생산'], 불량률: r['시간당불량률(%)'], 가동률: r['시간당가동률(%)'] }));
  // 2) 동일 유형 최근 7일 이력
  const history = historicalLog
    .filter(h => h['라인ID'] === lineId && h['type'] === target.type)
    .sort((a, b) => `${a['날짜']} ${a['시간']}`.localeCompare(`${b['날짜']} ${b['시간']}`))
    .slice(-5)
    .map(h => ({ 날짜: h['날짜'], 시간: h['시간'], severity: h.severity }));
  // 3) 동시간대 같은 팀 타 라인 (라인 국소 문제 vs 공통 원인 구분) — 라인명 마스킹
  const peers = productionRows
    .filter(r => r['시간'] === target['시간'] && r['팀'] === target['팀'] && r['라인ID'] !== lineId)
    .map(r => ({ line: maskDict[r['라인명']] || r['라인명'], 생산: r['시간당생산'], 불량률: r['시간당불량률(%)'], 가동률: r['시간당가동률(%)'] }));
  return { recent_6h_trend: trend, history_7d: history, peer_lines_same_hour: peers };
}

// --- 마스킹된 이상 목록 (증거 패킷 포함) ---
const maskedTargets = aiTargets.map((a, idx) => ({
  id: idx + 1,
  line: maskDict[a['라인명']] || a['라인명'],
  product: maskDict[a['품목']] || a['품목'],
  type: a.type,
  severity: a.severity,
  pattern: a.pattern_type,
  recurrence: a.recurrence_count,
  detail: applyMask(a.detail),
  evidence_data: buildEvidence(a)
}));

// --- Claude API 프롬프트 ---
const systemPrompt = `당신은 제조 현장 이상 탐지 분석 전문가입니다.
각 이상 건을 분석하되, 반드시 [제공된 데이터]에 근거해서만 판단하고 JSON 형식으로 응답하세요.

분석 규칙:
- 각 건의 evidence_data(최근 6시간 추세, 7일 이력, 동시간대 타 라인)에 근거해 판단하세요.
- 데이터에 없는 사실을 지어내지 마세요.
- 각 원인 가설의 근거가 된 구체적 수치를 evidence 배열에 인용하세요.
- 근거가 약하면 confidence를 낮게 주세요.
- 동시간대 타 라인 비교로 배제 가능한 원인은 ruled_out에 이유와 함께 적으세요.
- 응답에서 반드시 제공된 코드(LINE_A, PROD_01 등)만 사용하고 실제 이름은 쓰지 마세요.

출력 형식:
{
  "anomalies": [
    {
      "id": 번호,
      "summary": "한 줄 요약",
      "root_cause": "가장 유력한 추정 원인",
      "confidence": "높음 또는 중간 또는 낮음 + 한 줄 근거",
      "evidence": ["근거가 된 인용 수치1", "인용 수치2"],
      "alternatives": ["대안 가설 (없으면 빈 배열)"],
      "ruled_out": ["배제된 원인 + 이유 (없으면 빈 배열)"],
      "verify_first": "가장 먼저 확인할 것",
      "action": "권장 조치",
      "cross_impact": "다른 라인에 미치는 영향 (없으면 '없음')"
    }
  ],
  "overall_assessment": "전체 상황 종합 평가"
}`;

const userPrompt = `다음 ${maskedTargets.length}건의 이상을 분석해주세요:\n\n${JSON.stringify(maskedTargets, null, 2)}`;

const requestBody = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 3000,
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
