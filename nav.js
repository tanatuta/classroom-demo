// ===== nav.js: Sidebar, Top Bar และการสลับหน้า =====
// ห่อ showByRole เดิมจาก app.js เพื่อแสดงโครงหน้าหลัง login
const _showByRoleOriginal = showByRole;

showByRole = async function () {
  await _showByRoleOriginal();
  document.querySelector('.login-wrap').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  await loadTopBar();
  showPage('home');
};

function isAdmin() {
  return !document.getElementById('adminSection').classList.contains('hidden');
}

// แสดงชื่อ ตำแหน่ง อักษรย่อ และวันที่ใน Top Bar
async function loadTopBar() {
  const { data: { user } } = await db.auth.getUser();
  const { data: p } = await db.from('profiles')
    .select('full_name, title').eq('id', user.id).single();
  const shortName = p.full_name.replace(/^(นางสาว|นาง|นาย)/, '').trim();

  document.getElementById('userName').textContent = p.full_name;
  document.getElementById('userTitle').textContent = p.title || (isAdmin() ? 'ครู' : 'นักเรียน');
  document.getElementById('avatar').textContent = shortName.charAt(0);
  document.getElementById('topDate').textContent = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok'
  });
}

// สลับหน้าในส่วนที่ตรงกับบทบาทของผู้ใช้
function showPage(key) {
  const admin = isAdmin();
  const prefix = admin ? 'a-' : 's-';
  const sectionId = admin ? 'adminSection' : 'studentSection';
  const navId = admin ? 'navAdmin' : 'navStudent';

  document.getElementById('navAdmin').classList.toggle('hidden', !admin);
  document.getElementById('navStudent').classList.toggle('hidden', admin);

  document.querySelectorAll('#' + sectionId + ' .page').forEach(p => p.classList.add('hidden'));
  document.getElementById(prefix + key).classList.remove('hidden');

  document.querySelectorAll('#' + navId + ' .nav-item')
    .forEach(b => b.classList.toggle('active', b.dataset.page === key));
  window.scrollTo(0, 0);
}

// ตรวจ session ตอนเปิดหน้า: ถ้าไม่มี session ค่อยแสดงหน้า login
db.auth.getSession().then(({ data: { session } }) => {
  if (!session) {
    document.querySelector('.login-wrap').classList.remove('hidden');
  }
});