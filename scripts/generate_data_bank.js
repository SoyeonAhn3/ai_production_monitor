// DATA_SOURCE: Google Sheets (googleapis)
const { getSheets, loadSheetsConfig } = require('./google_auth');

const lines = [
  { id: 'L01', name: '프레스 1호기', team: '1팀', product: '패널 A',     target: 120, defectRate: 0.8 },
  { id: 'L02', name: '프레스 2호기', team: '1팀', product: '패널 B',     target: 100, defectRate: 1.0 },
  { id: 'L03', name: 'CNC 1호기',    team: '1팀', product: '샤프트 A',   target: 80,  defectRate: 0.5 },
  { id: 'L04', name: 'CNC 2호기',    team: '1팀', product: '샤프트 B',   target: 75,  defectRate: 0.6 },
  { id: 'L05', name: '용접 1호기',   team: '2팀', product: '프레임 A',   target: 60,  defectRate: 1.2 },
  { id: 'L06', name: '용접 2호기',   team: '2팀', product: '프레임 B',   target: 55,  defectRate: 1.5 },
  { id: 'L07', name: '도장 라인',    team: '2팀', product: '도장 부품',  target: 90,  defectRate: 2.0 },
  { id: 'L08', name: '사출 1호기',   team: '2팀', product: '케이스 A',   target: 150, defectRate: 0.7 },
  { id: 'L09', name: '사출 2호기',   team: '3팀', product: '케이스 B',   target: 140, defectRate: 0.8 },
  { id: 'L10', name: '조립 1라인',   team: '3팀', product: '완제품 A',   target: 45,  defectRate: 0.3 },
  { id: 'L11', name: '조립 2라인',   team: '3팀', product: '완제품 B',   target: 40,  defectRate: 0.4 },
  { id: 'L12', name: '검사/포장',    team: '3팀', product: '출하 검사',  target: 200, defectRate: 0.2 },
];

const DATE = '2026-03-23';
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalProduction(target) {
  return randInt(Math.floor(target * 0.85), Math.floor(target * 1.05));
}

function normalDefect(production, defectRate) {
  const expected = production * (defectRate / 100);
  return Math.max(0, randInt(Math.floor(expected * 0.5), Math.ceil(expected * 1.5)));
}

function normalUptime() {
  return randInt(50, 60);
}

function getAnomalyOverride(lineId, hourIdx) {
  const hour = HOURS[hourIdx];
  const h = parseInt(hour.split(':')[0]);

  if (lineId === 'L03' && h >= 11 && h <= 14) {
    if (h === 11) return { production: randInt(3, 8), defect: randInt(1, 3), scrap: 0, uptime: randInt(10, 20), flag: '시나리오1:설비고장(급감)' };
    if (h === 12 || h === 13) return { production: 0, defect: 0, scrap: 0, uptime: 0, flag: '시나리오1:설비고장(정지)' };
    if (h === 14) return { production: randInt(15, 25), defect: randInt(2, 5), scrap: 0, uptime: randInt(20, 30), flag: '시나리오1:설비고장(시운전)' };
  }

  if (lineId === 'L07' && h >= 9 && h <= 12) {
    const line = lines.find(l => l.id === lineId);
    const prod = normalProduction(line.target);
    const defect = Math.round(prod * (line.defectRate * 8 / 100));
    const scrap = Math.round(defect * 0.3);
    if (h === 12) {
      const defect2 = Math.round(prod * (line.defectRate * 4 / 100));
      return { production: prod, defect: defect2, scrap: Math.round(defect2 * 0.2), uptime: normalUptime(), flag: '시나리오2:불량급등(개선중)' };
    }
    return { production: prod, defect, scrap, uptime: normalUptime(), flag: '시나리오2:불량급등' };
  }

  if (lineId === 'L08' && h >= 13 && h <= 15) {
    if (h === 13) return { production: randInt(40, 60), defect: randInt(5, 10), scrap: randInt(2, 5), uptime: randInt(30, 40), flag: '시나리오3:금형이상(급감)' };
    if (h === 14) return { production: randInt(20, 35), defect: randInt(8, 15), scrap: randInt(3, 7), uptime: randInt(20, 30), flag: '시나리오3:금형이상(심화)' };
    if (h === 15) return { production: randInt(80, 100), defect: randInt(3, 6), scrap: randInt(1, 2), uptime: randInt(40, 50), flag: '시나리오3:금형이상(복구중)' };
  }

  if (lineId === 'L11' && h >= 10 && h <= 12) {
    const line = lines.find(l => l.id === lineId);
    const prod = randInt(Math.floor(line.target * 0.4), Math.floor(line.target * 0.55));
    const defect = Math.round(prod * (line.defectRate * 5 / 100));
    return { production: prod, defect, scrap: randInt(0, 2), uptime: randInt(40, 55), flag: '시나리오4:작업자교체(복합)' };
  }

  if (lineId === 'L01' && h >= 15 && h <= 17) {
    if (h === 15) return { production: randInt(15, 25), defect: randInt(0, 2), scrap: 0, uptime: randInt(10, 15), flag: '시나리오5:자재대기(급락)' };
    if (h === 16) return { production: randInt(5, 12), defect: randInt(0, 1), scrap: 0, uptime: randInt(5, 12), flag: '시나리오5:자재대기(대기중)' };
    if (h === 17) return { production: randInt(50, 70), defect: randInt(1, 3), scrap: 0, uptime: randInt(25, 35), flag: '시나리오5:자재대기(일부입고)' };
  }

  return null;
}

const HEADERS = [
  '날짜', '시간', '라인ID', '라인명', '팀', '생산품목', '일일목표',
  '시간당생산', '시간당양품', '시간당불량', '시간당폐기', '시간당불량률(%)',
  '누적생산', '누적양품', '누적불량', '누적폐기', '누적불량률(%)',
  '달성률(%)', '예상달성률(%)', '달성갭(%p)',
  '시간당가동(분)', '시간당비가동(분)', '시간당가동률(%)', '누적가동률(%)',
  '이상플래그'
];

async function main() {
  const rows = [];

  for (const line of lines) {
    const dailyTarget = line.target * 10;
    let cumProduction = 0, cumGood = 0, cumDefect = 0, cumScrap = 0, cumUptime = 0, cumTotal = 0;

    for (let hi = 0; hi < HOURS.length; hi++) {
      const anomaly = getAnomalyOverride(line.id, hi);
      let hourlyProd, hourlyDefect, hourlyScrap, uptime, flag;

      if (anomaly) {
        hourlyProd = anomaly.production; hourlyDefect = anomaly.defect;
        hourlyScrap = anomaly.scrap; uptime = anomaly.uptime; flag = anomaly.flag;
      } else {
        hourlyProd = normalProduction(line.target); hourlyDefect = normalDefect(hourlyProd, line.defectRate);
        hourlyScrap = 0; uptime = normalUptime(); flag = '';
      }

      const hourlyGood = Math.max(0, hourlyProd - hourlyDefect - hourlyScrap);
      const hourlyDefectRate = hourlyProd > 0 ? Math.round((hourlyDefect / hourlyProd) * 10000) / 100 : 0;
      const downtime = 60 - uptime;
      const hourlyUptimeRate = Math.round((uptime / 60) * 10000) / 100;

      cumProduction += hourlyProd; cumGood += hourlyGood; cumDefect += hourlyDefect;
      cumScrap += hourlyScrap; cumUptime += uptime; cumTotal += 60;

      const cumDefectRate = cumProduction > 0 ? Math.round((cumDefect / cumProduction) * 10000) / 100 : 0;
      const cumUptimeRate = Math.round((cumUptime / cumTotal) * 10000) / 100;
      const achieveRate = Math.round((cumProduction / dailyTarget) * 10000) / 100;
      const elapsedHours = hi + 1;
      const expectedRate = Math.round((elapsedHours / 10) * 10000) / 100;
      const achieveGap = Math.round((achieveRate - expectedRate) * 100) / 100;

      rows.push([
        DATE, HOURS[hi], line.id, line.name, line.team, line.product, dailyTarget,
        hourlyProd, hourlyGood, hourlyDefect, hourlyScrap, hourlyDefectRate,
        cumProduction, cumGood, cumDefect, cumScrap, cumDefectRate,
        achieveRate, expectedRate, achieveGap,
        uptime, downtime, hourlyUptimeRate, cumUptimeRate,
        flag
      ]);
    }
  }

  rows.sort((a, b) => {
    if (a[1] !== b[1]) return a[1].localeCompare(b[1]);
    return a[2].localeCompare(b[2]);
  });

  const sheets = await getSheets();
  const config = loadSheetsConfig();
  const { spreadsheetId, sheetName } = config.data_bank;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const firstTab = meta.data.sheets[0].properties;
  if (firstTab.title !== sheetName) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: firstTab.sheetId, title: sheetName }, fields: 'title' } }] },
    });
    console.log(`탭 이름 변경: ${firstTab.title} → ${sheetName}`);
  }

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A1:Z1000` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS, ...rows] },
  });

  const anomalyRows = rows.filter(r => r[24] !== '');
  console.log(`Google Sheets [data_bank] 업로드 완료`);
  console.log(`총 ${rows.length}행 (${lines.length}라인 × ${HOURS.length}시간)`);
  console.log(`이상 시나리오 행: ${anomalyRows.length}개`);
}

main().catch(err => { console.error('에러:', err.message); process.exit(1); });
