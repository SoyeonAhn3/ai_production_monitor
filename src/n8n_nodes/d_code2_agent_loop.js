// 워크플로 D — Code Node 2: AI Agent 루프
// 입력: d_code1에서 전달된 tools, systemPrompt, 마스킹된 데이터
// 출력: Agent 최종 리포트 또는 폴백 리포트

const input = items[0].json;
const tools = input.tools;
const systemPrompt = input.systemPrompt;
const yesterdayStr = input.yesterdayStr;
const maskedAnomalyLog = input.maskedAnomalyLog;
const maskedDailySummary = input.maskedDailySummary;
const maskedProductionWeek = input.maskedProductionWeek;
const maskedLineMaster = input.maskedLineMaster;
const reverseDict = input.reverseDict;

const MAX_TOOL_CALLS = 8;
const API_TIMEOUT = 60000;

// --- 도구 실행 함수 ---
function executeTool(toolName, toolInput) {
  try {
    if (toolName === 'get_anomaly_log') {
      let results = maskedAnomalyLog;
      const date = toolInput.date || yesterdayStr;
      results = results.filter(r => r['날짜'] === date);
      if (toolInput.severity) results = results.filter(r => r.severity === toolInput.severity);
      if (toolInput.line_id) results = results.filter(r => r['라인ID'] === toolInput.line_id);
      return JSON.stringify({ count: results.length, data: results.slice(0, 50) });
    }

    if (toolName === 'get_daily_summary') {
      let results = maskedDailySummary;
      const date = toolInput.date || yesterdayStr;
      results = results.filter(r => r['날짜'] === date);
      if (toolInput.team) results = results.filter(r => r['팀'] === toolInput.team);
      return JSON.stringify({ count: results.length, data: results });
    }

    if (toolName === 'get_line_master') {
      return JSON.stringify({ count: maskedLineMaster.length, data: maskedLineMaster });
    }

    if (toolName === 'get_hourly_detail') {
      let results = maskedProductionWeek;
      const date = toolInput.date || yesterdayStr;
      results = results.filter(r => r['날짜'] === date);
      if (toolInput.line_id) results = results.filter(r => r['라인ID'] === toolInput.line_id);
      return JSON.stringify({ count: results.length, data: results.slice(0, 120) });
    }

    return JSON.stringify({ error: `알 수 없는 도구: ${toolName}` });
  } catch (e) {
    return JSON.stringify({ error: `도구 실행 실패: ${e.message}` });
  }
}

// --- Agent 루프 ---
const messages = [{ role: "user", content: `어제(${yesterdayStr}) 일일 리포트를 작성해주세요.` }];
let toolCallCount = 0;
let agentSuccess = false;
let finalReport = null;

try {
  for (let iteration = 0; iteration < MAX_TOOL_CALLS + 2; iteration++) {
    const requestBody = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: systemPrompt,
      tools: tools,
      messages: messages
    };

    const response = await this.helpers.httpRequest({
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': '{{ $credentials.apiKey }}',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: requestBody,
      timeout: API_TIMEOUT,
      json: true
    });

    if (response.stop_reason === 'tool_use') {
      const assistantContent = response.content;
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults = [];
      for (const block of assistantContent) {
        if (block.type === 'tool_use') {
          toolCallCount++;
          if (toolCallCount > MAX_TOOL_CALLS) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({ error: "도구 호출 횟수 초과 (최대 8회). 현재까지 데이터로 리포트를 작성하세요." })
            });
          } else {
            const result = executeTool(block.name, block.input);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result
            });
          }
        }
      }

      messages.push({ role: "user", content: toolResults });

      if (toolCallCount > MAX_TOOL_CALLS) continue;
    } else if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock) {
        finalReport = textBlock.text;
        agentSuccess = true;
      }
      break;
    } else {
      break;
    }
  }
} catch (e) {
  agentSuccess = false;
  finalReport = null;
}

// --- 결과 전달 ---
return [{ json: {
  agentSuccess,
  finalReport,
  toolCallCount,
  reverseDict,
  yesterdayStr
} }];
