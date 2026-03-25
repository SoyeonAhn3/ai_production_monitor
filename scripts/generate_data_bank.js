const XLSX = require('xlsx');
const path = require('path');

// line_master 데이터 (generate_line_master.js와 동일)
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

// 난수 유틸: min~max 범위의 정수
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 정상 데이터 생성 (시간당목표의 85~105% 범위)
function normalProduction(target) {
  return randInt(Math.floor(target * 0.85), Math.floor(target * 1.05));
}

// 정상 불량 수 (정상불량률 기준 ±50%)
function normalDefect(production, defectRate) {
  const expected = production * (defectRate / 100);
  return Math.max(0, randInt(Math.floor(expected * 0.5), Math.ceil(expected * 1.5)));
}

// 정상 가동시간 (50~60분)
function normalUptime() {
  return randInt(50, 60);
}

// 이상 시나리오 정의
// 반환: { production, defect, scrap, uptime, flag } 또는 null(정상)
function getAnomalyOverride(lineId, hourIdx) {
  const hour = HOURS[hourIdx];
  const h = parseInt(hour.split(':')[0]);

  // 시나리오 1: CNC 1호기(L03) 설비 고장 11:00~14:00
  if (lineId === 'L03' && h >= 11 && h <= 14) {
    const line = lines.find(l => l.id === lineId);
    if (h === 11) return { production: randInt(3, 8), defect: randInt(1, 3), scrap: 0, uptime: randInt(10, 20), flag: '시나리오1:설비고장(급감)' };
    if (h === 12 || h === 13) return { production: 0, defect: 0, scrap: 0, uptime: 0, flag: '시나리오1:설비고장(정지)' };
    if (h === 14) return { production: randInt(15, 25), defect: randInt(2, 5), scrap: 0, uptime: randInt(20, 30), flag: '시나리오1:설비고장(시운전)' };
  }

  // 시나리오 2: 도장 라인(L07) 불량률 급등 09:00~12:00
  if (lineId === 'L07' && h >= 9 && h <= 12) {
    const line = lines.find(l => l.id === lineId);
    const prod = normalProduction(line.target);
    // 불량률을 정상의 8배로 (정상 2% → 16%)
    const defect = Math.round(prod * (line.defectRate * 8 / 100));
    const scrap = Math.round(defect * 0.3); // 불량의 30%가 폐기
    if (h === 12) {
      // 12시에 개선 시작
      const defect2 = Math.round(prod * (line.defectRate * 4 / 100));
      return { production: prod, defect: defect2, scrap: Math.round(defect2 * 0.2), uptime: normalUptime(), flag: '시나리오2:불량급등(개선중)' };
    }
    return { production: prod, defect, scrap, uptime: normalUptime(), flag: '시나리오2:불량급등' };
  }

  // 시나리오 3: 사출 1호기(L08) 금형 이상 13:00~15:00
  if (lineId === 'L08' && h >= 13 && h <= 15) {
    const line = lines.find(l => l.id === lineId);
    if (h === 13) return { production: randInt(40, 60), defect: randInt(5, 10), scrap: randInt(2, 5), uptime: randInt(30, 40), flag: '시나리오3:금형이상(급감)' };
    if (h === 14) return { production: randInt(20, 35), defect: randInt(8, 15), scrap: randInt(3, 7), uptime: randInt(20, 30), flag: '시나리오3:금형이상(심화)' };
    if (h === 15) return { production: randInt(80, 100), defect: randInt(3, 6), scrap: randInt(1, 2), uptime: randInt(40, 50), flag: '시나리오3:금형이상(복구중)' };
  }

  // 시나리오 4: 조립 2라인(L11) 작업자 교체 10:00~12:00
  if (lineId === 'L11' && h >= 10 && h <= 12) {
    const line = lines.find(l => l.id === lineId);
    // 생산 50% 감소 + 불량 5배 증가
    const prod = randInt(Math.floor(line.target * 0.4), Math.floor(line.target * 0.55));
    const defect = Math.round(prod * (line.defectRate * 5 / 100));
    return { production: prod, defect, scrap: randInt(0, 2), uptime: randInt(40, 55), flag: '시나리오4:작업자교체(복합)' };
  }

  // 시나리오 5: 프레스 1호기(L01) 자재 대기 15:00~17:00
  if (lineId === 'L01' && h >= 15 && h <= 17) {
    if (h === 15) return { production: randInt(15, 25), defect: randInt(0, 2), scrap: 0, uptime: randInt(10, 15), flag: '시나리오5:자재대기(급락)' };
    if (h === 16) return { production: randInt(5, 12), defect: randInt(0, 1), scrap: 0, uptime: randInt(5, 12), flag: '시나리오5:자재대기(대기중)' };
    if (h === 17) return { production: randInt(50, 70), defect: randInt(1, 3), scrap: 0, uptime: randInt(25, 35), flag: '시나리오5:자재대기(일부입고)' };
  }

  return null; // 정상
}

// 데이터 생성
const rows = [];

for (const line of lines) {
  const dailyTarget = line.target * 10; // 10시간 기준 일일목표
  let cumProduction = 0;
  let cumGood = 0;
  let cumDefect = 0;
  let cumScrap = 0;
  let cumUptime = 0;
  let cumTotal = 0; // 총 시간 (분 단위)

  for (let hi = 0; hi < HOURS.length; hi++) {
    const hour = HOURS[hi];
    const anomaly = getAnomalyOverride(line.id, hi);

    let hourlyProd, hourlyDefect, hourlyScrap, uptime, flag;

    if (anomaly) {
      hourlyProd = anomaly.production;
      hourlyDefect = anomaly.defect;
      hourlyScrap = anomaly.scrap;
      uptime = anomaly.uptime;
      flag = anomaly.flag;
    } else {
      hourlyProd = normalProduction(line.target);
      hourlyDefect = normalDefect(hourlyProd, line.defectRate);
      hourlyScrap = 0; // 정상 시 폐기 없음
      uptime = normalUptime();
      flag = '';
    }

    const hourlyGood = Math.max(0, hourlyProd - hourlyDefect - hourlyScrap);
    const hourlyDefectRate = hourlyProd > 0 ? Math.round((hourlyDefect / hourlyProd) * 10000) / 100 : 0;
    const downtime = 60 - uptime;
    const hourlyUptimeRate = Math.round((uptime / 60) * 10000) / 100;

    // 누적 계산
    cumProduction += hourlyProd;
    cumGood += hourlyGood;
    cumDefect += hourlyDefect;
    cumScrap += hourlyScrap;
    cumUptime += uptime;
    cumTotal += 60;

    const cumDefectRate = cumProduction > 0 ? Math.round((cumDefect / cumProduction) * 10000) / 100 : 0;
    const cumUptimeRate = Math.round((cumUptime / cumTotal) * 10000) / 100;

    // 진척 지표
    const achieveRate = Math.round((cumProduction / dailyTarget) * 10000) / 100;
    // 예상달성률: 현재 시간까지의 기대 달성률
    const elapsedHours = hi + 1;
    const expectedRate = Math.round((elapsedHours / 10) * 10000) / 100;
    const achieveGap = Math.round((achieveRate - expectedRate) * 100) / 100;

    rows.push({
      '날짜': DATE,
      '시간': hour,
      '라인ID': line.id,
      '라인명': line.name,
      '팀': line.team,
      '생산품목': line.product,
      '일일목표': dailyTarget,
      '시간당생산': hourlyProd,
      '시간당양품': hourlyGood,
      '시간당불량': hourlyDefect,
      '시간당폐기': hourlyScrap,
      '시간당불량률(%)': hourlyDefectRate,
      '누적생산': cumProduction,
      '누적양품': cumGood,
      '누적불량': cumDefect,
      '누적폐기': cumScrap,
      '누적불량률(%)': cumDefectRate,
      '달성률(%)': achieveRate,
      '예상달성률(%)': expectedRate,
      '달성갭(%p)': achieveGap,
      '시간당가동(분)': uptime,
      '시간당비가동(분)': downtime,
      '시간당가동률(%)': hourlyUptimeRate,
      '누적가동률(%)': cumUptimeRate,
      '이상플래그': flag,
    });
  }
}

// 시간순 정렬 (시간 → 라인ID)
rows.sort((a, b) => {
  if (a['시간'] !== b['시간']) return a['시간'].localeCompare(b['시간']);
  return a['라인ID'].localeCompare(b['라인ID']);
});

const ws = XLSX.utils.json_to_sheet(rows);

// 컬럼 너비
ws['!cols'] = [
  { wch: 12 }, // 날짜
  { wch: 6 },  // 시간
  { wch: 6 },  // 라인ID
  { wch: 12 }, // 라인명
  { wch: 5 },  // 팀
  { wch: 10 }, // 생산품목
  { wch: 8 },  // 일일목표
  { wch: 8 },  // 시간당생산
  { wch: 8 },  // 시간당양품
  { wch: 8 },  // 시간당불량
  { wch: 8 },  // 시간당폐기
  { wch: 12 }, // 시간당불량률
  { wch: 8 },  // 누적생산
  { wch: 8 },  // 누적양품
  { wch: 8 },  // 누적불량
  { wch: 8 },  // 누적폐기
  { wch: 12 }, // 누적불량률
  { wch: 8 },  // 달성률
  { wch: 10 }, // 예상달성률
  { wch: 10 }, // 달성갭
  { wch: 12 }, // 시간당가동
  { wch: 12 }, // 시간당비가동
  { wch: 12 }, // 시간당가동률
  { wch: 10 }, // 누적가동률
  { wch: 25 }, // 이상플래그
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'data_bank');

const outputPath = path.join(__dirname, '..', 'simulator', 'data_bank.xlsx');
XLSX.writeFile(wb, outputPath);

// 요약 출력
const anomalyRows = rows.filter(r => r['이상플래그'] !== '');
console.log(`data_bank.xlsx 생성 완료: ${outputPath}`);
console.log(`총 ${rows.length}행 (${lines.length}라인 × ${HOURS.length}시간)`);
console.log(`이상 시나리오 행: ${anomalyRows.length}개`);
console.log('\n이상 시나리오 분포:');

const scenarios = {};
anomalyRows.forEach(r => {
  const key = r['이상플래그'].split('(')[0];
  if (!scenarios[key]) scenarios[key] = { count: 0, lines: new Set(), hours: new Set() };
  scenarios[key].count++;
  scenarios[key].lines.add(r['라인명']);
  scenarios[key].hours.add(r['시간']);
});
Object.entries(scenarios).forEach(([key, val]) => {
  console.log(`  ${key}: ${val.count}행, ${[...val.lines].join('/')}, ${[...val.hours].join(',')}`);
});
