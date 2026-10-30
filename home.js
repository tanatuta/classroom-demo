// ===== home.js: การ์ด KPI และกราฟหน้าหลักของครู =====
const charts = {};
const COLORS = { present: '#16a34a', late: '#f59e0b', absent: '#dc2626', none: '#cbd5e1' };

// โหลดข้อมูลวันนี้ของทั้งการเข้าแถวและวิชาสังคม (คาบที่เลือก)
async function loadAdminHome() {
  const period = Number(document.getElementById('homePeriod').value);

  const { count } = await db.from('profiles')
    .select('id', { count: 'exact', head: true }).eq('role', 'student');
  const total = count || 0;

  const { data: flagRows } = await db.from('flag_attendance')
    .select('status').eq('attend_date', today);
  const { data: subjRows } = await db.from('subject_attendance')
    .select('status').eq('attend_date', today).eq('period', period);

  renderAttendance('flag', total, flagRows || []);
  renderAttendance('subj', total, subjRows || []);
}

// วาดการ์ดและกราฟของชุดข้อมูลหนึ่ง (prefix = 'flag' หรือ 'subj')
function renderAttendance(prefix, total, rows) {
  const countOf = s => rows.filter(r => r.status === s).length;
  const present = countOf('present');
  const late = countOf('late');
  const absent = countOf('absent');
  const none = Math.max(total - rows.length, 0);
  const pct = n => total ? Math.round((n / total) * 100) : 0;

  document.getElementById(prefix + '-total').textContent = total + ' คน';
  document.getElementById(prefix + '-attend').textContent =
    (present + late) + ' คน · ' + pct(present + late) + '%';
  document.getElementById(prefix + '-late').textContent =
    late + ' คน · ' + pct(late) + '%';
  document.getElementById(prefix + '-absent').textContent =
    absent + ' คน · ' + pct(absent) + '%';

  const data = [present, late, absent, none];
  if (charts[prefix]) {
    charts[prefix].data.datasets[0].data = data;
    charts[prefix].update();
  } else {
    charts[prefix] = new Chart(document.getElementById(prefix + 'Chart'), {
      type: 'doughnut',
      data: {
        labels: ['มา', 'สาย', 'ขาด', 'ยังไม่เช็ค'],
        datasets: [{ data, backgroundColor: [COLORS.present, COLORS.late, COLORS.absent, COLORS.none] }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  }
}

// ห่อ showPage จาก nav.js ให้โหลดข้อมูลหน้าหลักทุกครั้งที่เปิดหน้านี้
const _showPageOriginal = showPage;
showPage = function (key) {
  _showPageOriginal(key);
  if (key === 'home' && isAdmin()) loadAdminHome();
};