// 워크플로 D — Code Node 3: 리포트 파싱 + 언마스킹 + 이메일 생성
// 입력: Agent 루프 결과 (성공 시 JSON 리포트, 실패 시 폴백)
// 출력: 이메일 제목 + 본문 + CC 여부

const input = items[0].json;
const agentSuccess = input.agentSuccess;
const finalReport = input.finalReport;
const reverseDict = input.reverseDict || {};
const yesterdayStr = input.yesterdayStr;
const toolCallCount = input.toolCallCount || 0;

function unmask(text) {
  if (typeof text !== 'string') return text;
  let result = text;
  const keys = Object.keys(reverseDict).sort((a, b) => b.length - a.length);
  for (const code of keys) { result = result.split(code).join(reverseDict[code]); }
  return result;
}

let emailSubject = '';
let emailBody = '';
let ccManagement = false;

if (agentSuccess && finalReport) {
  // --- JSON 파싱 시도 ---
  let report = null;
  try {
    const cleaned = finalReport.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    report = JSON.parse(cleaned);
  } catch (e) {
    report = null;
  }

  if (report && report.summary) {
    // 파싱 성공: 구조화된 리포트
    ccManagement = report.cc_management || false;
    const level = report.report_level || '보통';
    const levelEmoji = level === '상세' ? '🔴' : level === '보통' ? '🟡' : '🟢';

    emailSubject = `[일일 리포트] ${levelEmoji} ${unmask(report.summary)} (${yesterdayStr})`;

    const parts = [];
    parts.push(`<h2>${levelEmoji} 일일 생산 리포트 — ${yesterdayStr}</h2>`);
    parts.push(`<p><b>리포트 수준:</b> ${level} | <b>도구 호출:</b> ${toolCallCount}회</p>`);
    parts.push(`<p><b>요약:</b> ${unmask(report.summary)}</p>`);
    parts.push('<hr>');

    if (report.sections) {
      const sectionNames = {
        '핵심_경고': '🚨 핵심 경고',
        '추세_분석': '📈 추세 분석',
        '팀별_현황': '👥 팀별 현황',
        '기타_이상': 'ℹ️ 기타 이상',
        '권장_조치': '✅ 권장 조치'
      };
      for (const [key, title] of Object.entries(sectionNames)) {
        const content = report.sections[key];
        if (content && content !== '없음') {
          parts.push(`<h3>${title}</h3>`);
          parts.push(`<p>${unmask(content)}</p>`);
        }
      }
    }

    if (report.recommendations && report.recommendations.length > 0) {
      parts.push('<h3>📋 권장 조치 목록</h3>');
      parts.push('<ol>' + report.recommendations.map(r => `<li>${unmask(r)}</li>`).join('') + '</ol>');
    }

    parts.push(`<hr><p style="color:#888;font-size:12px;">AI Agent 생성 | ${new Date().toISOString()}</p>`);
    emailBody = parts.join('\n');
  } else {
    // 파싱 실패: 텍스트 그대로 사용
    emailSubject = `[일일 리포트] ${yesterdayStr} (텍스트 형식)`;
    emailBody = `<h2>일일 생산 리포트 — ${yesterdayStr}</h2>
<p><i>AI 응답을 JSON으로 파싱하지 못하여 원문을 포함합니다.</i></p>
<hr>
<pre>${unmask(finalReport)}</pre>
<hr>
<p style="color:#888;font-size:12px;">AI Agent 생성 (파싱 실패) | ${new Date().toISOString()}</p>`;
  }
} else {
  // --- 폴백 리포트 ---
  emailSubject = `[일일 리포트] ⚠️ 자동 생성 실패 — 폴백 리포트 (${yesterdayStr})`;
  emailBody = `<h2>⚠️ 일일 생산 리포트 — ${yesterdayStr}</h2>
<p><b>AI Agent 리포트 생성에 실패하여 폴백 리포트를 발송합니다.</b></p>
<p>상세 분석은 Power BI 대시보드 또는 Google Sheets anomaly_log를 직접 확인해주세요.</p>
<hr>
<h3>확인 필요 사항</h3>
<ul>
  <li>production_results 시트의 anomaly_log 탭에서 어제 이상 건 확인</li>
  <li>hourly_summary 탭에서 팀별 달성률 확인</li>
  <li>Claude API 키 및 네트워크 상태 확인</li>
</ul>
<hr>
<p style="color:#888;font-size:12px;">폴백 리포트 | ${new Date().toISOString()}</p>`;
}

return [{ json: { emailSubject, emailBody, ccManagement, sendEmail: true } }];
