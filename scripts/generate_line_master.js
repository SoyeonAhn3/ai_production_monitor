// DATA_SOURCE: Google Sheets (googleapis)
const { getSheets, loadSheetsConfig } = require('./google_auth');

const data = [
  { 라인ID: 'L01', 라인명: '프레스 1호기', 팀: '1팀', 상위라인ID: '', 계층: 'line', 품목: '패널 A',     시간당목표: 120, 정상불량률: 0.8 },
  { 라인ID: 'L02', 라인명: '프레스 2호기', 팀: '1팀', 상위라인ID: '', 계층: 'line', 품목: '패널 B',     시간당목표: 100, 정상불량률: 1.0 },
  { 라인ID: 'L03', 라인명: 'CNC 1호기',    팀: '1팀', 상위라인ID: '', 계층: 'line', 품목: '샤프트 A',   시간당목표: 80,  정상불량률: 0.5 },
  { 라인ID: 'L04', 라인명: 'CNC 2호기',    팀: '1팀', 상위라인ID: '', 계층: 'line', 품목: '샤프트 B',   시간당목표: 75,  정상불량률: 0.6 },
  { 라인ID: 'L05', 라인명: '용접 1호기',   팀: '2팀', 상위라인ID: '', 계층: 'line', 품목: '프레임 A',   시간당목표: 60,  정상불량률: 1.2 },
  { 라인ID: 'L06', 라인명: '용접 2호기',   팀: '2팀', 상위라인ID: '', 계층: 'line', 품목: '프레임 B',   시간당목표: 55,  정상불량률: 1.5 },
  { 라인ID: 'L07', 라인명: '도장 라인',    팀: '2팀', 상위라인ID: '', 계층: 'line', 품목: '도장 부품',  시간당목표: 90,  정상불량률: 2.0 },
  { 라인ID: 'L08', 라인명: '사출 1호기',   팀: '2팀', 상위라인ID: '', 계층: 'line', 품목: '케이스 A',   시간당목표: 150, 정상불량률: 0.7 },
  { 라인ID: 'L09', 라인명: '사출 2호기',   팀: '3팀', 상위라인ID: '', 계층: 'line', 품목: '케이스 B',   시간당목표: 140, 정상불량률: 0.8 },
  { 라인ID: 'L10', 라인명: '조립 1라인',   팀: '3팀', 상위라인ID: '', 계층: 'line', 품목: '완제품 A',   시간당목표: 45,  정상불량률: 0.3 },
  { 라인ID: 'L11', 라인명: '조립 2라인',   팀: '3팀', 상위라인ID: '', 계층: 'line', 품목: '완제품 B',   시간당목표: 40,  정상불량률: 0.4 },
  { 라인ID: 'L12', 라인명: '검사/포장',    팀: '3팀', 상위라인ID: '', 계층: 'line', 품목: '출하 검사',  시간당목표: 200, 정상불량률: 0.2 },
];

async function main() {
  const sheets = await getSheets();
  const config = loadSheetsConfig();
  const { spreadsheetId, sheetName } = config.line_master;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const firstTab = meta.data.sheets[0].properties;
  if (firstTab.title !== sheetName) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: firstTab.sheetId, title: sheetName }, fields: 'title' } }] },
    });
    console.log(`탭 이름 변경: ${firstTab.title} → ${sheetName}`);
  }

  const headers = ['라인ID', '라인명', '팀', '상위라인ID', '계층', '품목', '시간당목표', '정상불량률'];
  const values = [headers, ...data.map(d => headers.map(h => d[h]))];

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A1:Z1000` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  console.log(`Google Sheets [line_master] 업로드 완료`);
  console.log(`총 ${data.length}개 라인, ${[...new Set(data.map(d => d.팀))].length}개 팀`);
}

main().catch(err => { console.error('에러:', err.message); process.exit(1); });
