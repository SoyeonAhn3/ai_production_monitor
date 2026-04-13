// DATA_SOURCE: Google Sheets (googleapis)
// EXCEL_FALLBACK: xlsx 라이브러리 + fs 기반으로 교체 시 이 파일 불필요
const { google } = require('googleapis');
const path = require('path');

/**
 * Google Sheets API 인증 + 클라이언트 반환
 * 서비스 계정 키 파일 경로: config/credentials.json
 */
async function getSheets() {
  const credPath = path.join(__dirname, '..', 'config', 'credentials.json');
  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * sheets_config.json 로드
 */
function loadSheetsConfig() {
  return require(path.join(__dirname, '..', 'config', 'sheets_config.json'));
}

module.exports = { getSheets, loadSheetsConfig };
