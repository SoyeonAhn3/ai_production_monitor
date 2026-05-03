// Code Node 0: run_id 생성
// 입력: Schedule Trigger에서 트리거됨
// 출력: run_id를 다음 노드에 전달

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}`;
const run_id = `B_${dateStr}_${timeStr}`;

return [{ json: { run_id } }];
