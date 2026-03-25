const XLSX = require('xlsx');
const path = require('path');

// 12라인, 3팀 구성 데모 데이터
const data = [
  { 라인ID: 'L01', 라인명: '프레스 1호기', 팀: '1팀', 상위라인ID: null, 계층: 'line', 품목: '패널 A',     시간당목표: 120, 정상불량률: 0.8 },
  { 라인ID: 'L02', 라인명: '프레스 2호기', 팀: '1팀', 상위라인ID: null, 계층: 'line', 품목: '패널 B',     시간당목표: 100, 정상불량률: 1.0 },
  { 라인ID: 'L03', 라인명: 'CNC 1호기',    팀: '1팀', 상위라인ID: null, 계층: 'line', 품목: '샤프트 A',   시간당목표: 80,  정상불량률: 0.5 },
  { 라인ID: 'L04', 라인명: 'CNC 2호기',    팀: '1팀', 상위라인ID: null, 계층: 'line', 품목: '샤프트 B',   시간당목표: 75,  정상불량률: 0.6 },
  { 라인ID: 'L05', 라인명: '용접 1호기',   팀: '2팀', 상위라인ID: null, 계층: 'line', 품목: '프레임 A',   시간당목표: 60,  정상불량률: 1.2 },
  { 라인ID: 'L06', 라인명: '용접 2호기',   팀: '2팀', 상위라인ID: null, 계층: 'line', 품목: '프레임 B',   시간당목표: 55,  정상불량률: 1.5 },
  { 라인ID: 'L07', 라인명: '도장 라인',    팀: '2팀', 상위라인ID: null, 계층: 'line', 품목: '도장 부품',  시간당목표: 90,  정상불량률: 2.0 },
  { 라인ID: 'L08', 라인명: '사출 1호기',   팀: '2팀', 상위라인ID: null, 계층: 'line', 품목: '케이스 A',   시간당목표: 150, 정상불량률: 0.7 },
  { 라인ID: 'L09', 라인명: '사출 2호기',   팀: '3팀', 상위라인ID: null, 계층: 'line', 품목: '케이스 B',   시간당목표: 140, 정상불량률: 0.8 },
  { 라인ID: 'L10', 라인명: '조립 1라인',   팀: '3팀', 상위라인ID: null, 계층: 'line', 품목: '완제품 A',   시간당목표: 45,  정상불량률: 0.3 },
  { 라인ID: 'L11', 라인명: '조립 2라인',   팀: '3팀', 상위라인ID: null, 계층: 'line', 품목: '완제품 B',   시간당목표: 40,  정상불량률: 0.4 },
  { 라인ID: 'L12', 라인명: '검사/포장',    팀: '3팀', 상위라인ID: null, 계층: 'line', 품목: '출하 검사',  시간당목표: 200, 정상불량률: 0.2 },
];

const ws = XLSX.utils.json_to_sheet(data);

// 컬럼 너비 설정
ws['!cols'] = [
  { wch: 8 },   // 라인ID
  { wch: 14 },  // 라인명
  { wch: 6 },   // 팀
  { wch: 12 },  // 상위라인ID
  { wch: 6 },   // 계층
  { wch: 12 },  // 품목
  { wch: 10 },  // 시간당목표
  { wch: 10 },  // 정상불량률
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'line_master');

const outputPath = path.join(__dirname, '..', 'config', 'line_master.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`line_master.xlsx 생성 완료: ${outputPath}`);
console.log(`총 ${data.length}개 라인, ${[...new Set(data.map(d => d.팀))].length}개 팀`);
