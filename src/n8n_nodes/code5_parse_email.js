// Code Node 5: AI 응답 파싱 + 언마스킹 + 이메일 본문 생성
// 입력: Claude API 응답 + reverseDict + 이상 목록
// 출력: anomaly_log 업데이트 데이터 + 이메일 본문

const input = items[0].json;
const reverseDict = input.reverseDict || {};
const aiTargets = input.aiTargets || [];
const toNotify = input.toNotify || [];
const classifiedAnomalies = input.classifiedAnomalies || [];
const run_id = input.run_id;
const warnings = input.warnings || [];
const skipAI = input.skipAI || false;

// --- 언마스킹 함수 ---
function applyUnmask(text) {
  let unmasked = text;
  const sortedKeys = Object.keys(reverseDict).sort((a, b) => b.length - a.length);
  for (const code of sortedKeys) { unmasked = unmasked.split(code).join(reverseDict[code]); }
  return unmasked;
}

// --- AI 응답 파싱 ---
let aiResult = null;
let aiParsed = false;

if (!skipAI && input.apiResponse) {
  const rawText = input.apiResponse.content?.[0]?.text || '';
  try {
    const jsonMatch = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    aiResult = JSON.parse(jsonMatch);
    aiParsed = true;
  } catch (e) {
    aiResult = { raw_text: rawText };
    aiParsed = false;
  }
}

// --- anomaly_log에 AI 해석 반영 ---
for (const a of classifiedAnomalies) {
  if (aiParsed && aiResult?.anomalies) {
    const targetIdx = aiTargets.findIndex(t => t['라인ID'] === a['라인ID'] && t.type === a.type);
    if (targetIdx >= 0) {
      const aiEntry = aiResult.anomalies.find(e => e.id === targetIdx + 1);
      if (aiEntry) {
        const insight = [
          aiEntry.summary,
          `원인: ${aiEntry.root_cause}`,
          `조치: ${aiEntry.action}`,
          `패턴검증: ${aiEntry.pattern_verification}`,
          aiEntry.cross_impact !== '없음' ? `교차영향: ${aiEntry.cross_impact}` : ''
        ].filter(Boolean).join(' | ');
        a.ai_insight = applyUnmask(insight);
        a.ai_parsed = true;
      }
    }
  } else if (!skipAI && !aiParsed && aiResult?.raw_text) {
    const targetIdx = aiTargets.findIndex(t => t['라인ID'] === a['라인ID'] && t.type === a.type);
    if (targetIdx >= 0) {
      a.ai_insight = applyUnmask(aiResult.raw_text);
      a.ai_parsed = false;
    }
  }

  if (!a.ai_insight) {
    a.ai_insight = '';
    a.ai_parsed = false;
  }
}

// --- 이메일 본문 생성 ---
const severeList = toNotify.filter(a => a.severity === '심각');
const mediumList = toNotify.filter(a => a.severity === '중간');
const lowList = classifiedAnomalies.filter(a => a.severity === '낮음');

let emailSubject = '';
let emailBody = '';

if (severeList.length > 0 || mediumList.length > 0) {
  emailSubject = `[생산 이상 알림] ${severeList.length > 0 ? '🔴 심각 ' + severeList.length + '건' : ''}${mediumList.length > 0 ? ' 🟡 중간 ' + mediumList.length + '건' : ''} (${run_id})`;

  const parts = [];

  if (warnings.length > 0) {
    parts.push('<h3>⚠️ 데이터 경고</h3>');
    parts.push('<ul>' + warnings.map(w => `<li>${w.message}</li>`).join('') + '</ul>');
    parts.push('<hr>');
  }

  if (severeList.length > 0) {
    parts.push('<h3>🔴 심각</h3>');
    for (const a of severeList) {
      const matched = classifiedAnomalies.find(c => c.idempotency_key === a.idempotency_key);
      parts.push(`<div style="margin-bottom:12px;padding:10px;border-left:4px solid #e74c3c;background:#fdf2f2;">`);
      parts.push(`<b>${a['라인명']} — ${a.type}</b> (${a.pattern_type}, ${a.recurrence_count}회 발생)<br>`);
      parts.push(`${a.detail}<br>`);
      if (matched?.ai_insight) {
        parts.push(`<br><b>AI 분석:</b> ${matched.ai_insight}`);
      }
      parts.push(`</div>`);
    }
  }

  if (mediumList.length > 0) {
    parts.push('<h3>🟡 중간</h3>');
    for (const a of mediumList) {
      parts.push(`<div style="margin-bottom:8px;padding:8px;border-left:4px solid #f39c12;background:#fef9e7;">`);
      parts.push(`<b>${a['라인명']} — ${a.type}</b> (${a.pattern_type})<br>${a.detail}`);
      parts.push(`</div>`);
    }
  }

  if (lowList.length > 0) {
    parts.push('<h3>ℹ️ 참고 (낮음)</h3>');
    parts.push('<ul>' + lowList.map(a => `<li>${a['라인명']}: ${a.type} — ${a.detail}</li>`).join('') + '</ul>');
  }

  parts.push(`<hr><p style="color:#888;font-size:12px;">run_id: ${run_id} | 생성 시각: ${new Date().toISOString()}</p>`);
  emailBody = parts.join('\n');
}

// --- anomaly_log 저장용 행 변환 ---
const anomalyLogRows = classifiedAnomalies.map(a => ({
  날짜: a['날짜'],
  시간: a['시간'],
  라인ID: a['라인ID'],
  라인명: a['라인명'],
  팀: a['팀'],
  품목: a['품목'],
  type: a.type,
  severity: a.severity,
  detail: a.detail,
  pattern_type: a.pattern_type,
  recurrence_count: a.recurrence_count,
  ai_insight: a.ai_insight || '',
  ai_parsed: a.ai_parsed || false,
  run_id: a.run_id,
  idempotency_key: a.idempotency_key,
  notification_status: a.notification_status
}));

return [{ json: {
  anomalyLogRows,
  emailSubject,
  emailBody,
  sendEmail: (severeList.length > 0 || mediumList.length > 0),
  hasSevere: severeList.length > 0,
  run_id
} }];
