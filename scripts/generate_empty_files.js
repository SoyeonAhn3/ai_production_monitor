// DATA_SOURCE: Google Sheets (googleapis)
const { getSheets, loadSheetsConfig } = require('./google_auth');

const weekHeaders = [
  '날짜', '시간', '라인ID', '라인명', '팀', '생산품목', '일일목표',
  '시간당생산', '시간당양품', '시간당불량', '시간당폐기', '시간당불량률(%)',
  '누적생산', '누적양품', '누적불량', '누적폐기', '누적불량률(%)',
  '달성률(%)', '예상달성률(%)', '달성갭(%p)',
  '시간당가동(분)', '시간당비가동(분)', '시간당가동률(%)', '누적가동률(%)',
  '이상플래그'
];

const resultsTabs = {
  hourly_summary: [
    '날짜', '시간', '팀', '작업건수', '계획합계', '실적합계', '달성률(%)',
    '불량합계', '폐기합계', '평균가동률(%)', '비가동합계(분)'
  ],
  anomaly_log: [
    '날짜', '시간', '라인ID', '라인명', '팀', '품목',
    'type', 'severity', 'detail',
    'pattern_type', 'recurrence_count', 'ai_insight', 'ai_parsed',
    'run_id', 'idempotency_key', 'notification_status'
  ],
  daily_summary: [
    '날짜', '팀', '총계획', '총실적', '일일달성률(%)',
    '총불량', '총폐기', '일일불량률(%)',
    '평균가동률(%)', '총비가동시간(분)',
    '이상건수_심각', '이상건수_중간', '이상건수_낮음',
    '반복이상건수', '악화이상건수'
  ],
  error_log: [
    '날짜', '시간', 'run_id', 'workflow', 'step', 'error_type', 'error_message', 'action_taken'
  ],
};

async function renameFirstTab(sheets, spreadsheetId, targetName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const firstTab = meta.data.sheets[0].properties;
  if (firstTab.title !== targetName) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: firstTab.sheetId, title: targetName }, fields: 'title' } }] },
    });
    console.log(`탭 이름 변경: ${firstTab.title} → ${targetName}`);
  }
}

async function writeHeaders(sheets, spreadsheetId, sheetName, headers) {
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A1:Z1000` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] },
  });
}

async function main() {
  const sheets = await getSheets();
  const config = loadSheetsConfig();

  // 1. production_week
  const pw = config.production_week;
  await renameFirstTab(sheets, pw.spreadsheetId, pw.sheetName);
  await writeHeaders(sheets, pw.spreadsheetId, pw.sheetName, weekHeaders);
  console.log(`Google Sheets [production_week] 헤더 생성 완료 (${weekHeaders.length}개 컬럼)`);

  // 2. production_results (4개 탭)
  const pr = config.production_results;
  for (const [tabName, headers] of Object.entries(resultsTabs)) {
    await writeHeaders(sheets, pr.spreadsheetId, tabName, headers);
    console.log(`Google Sheets [production_results/${tabName}] 헤더 생성 완료 (${headers.length}개 컬럼)`);
  }
}

main().catch(err => { console.error('에러:', err.message); process.exit(1); });
