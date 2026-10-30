
    // ===== ตั้งค่าและตัวแปรหลัก =====
    const SUPABASE_URL = 'https://ejnaphfpzehakmutjxor.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_pUr-MnwjwN2rxT1hjcumQg_1f_fEsgU';
    const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const STATUS_LABEL = { present: 'มา', late: 'สาย', absent: 'ขาด' };
    const CATEGORY_LABEL = {
      before_midterm: 'ก่อนกลางภาค',
      midterm: 'กลางภาค',
      after_midterm: 'หลังกลางภาค',
      final: 'ปลายภาค'
    };
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    let currentItems = [];

    document.getElementById('today').textContent = today;
    document.getElementById('subjToday').textContent = today;

    // ===== Login / Logout =====
    async function login() {
      const { error } = await db.auth.signInWithPassword({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      });
      if (error) {
        document.getElementById('loginMsg').textContent = 'Login ไม่สำเร็จ: ' + error.message;
        return;
      }
      await showByRole();
    }

    async function logout() {
      await db.auth.signOut();
      location.reload();
    }

    // ตรวจบทบาทแล้วแสดงส่วนที่ถูกต้อง
    async function showByRole() {
      const { data: { user } } = await db.auth.getUser();
      const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
      document.getElementById('loginSection').classList.add('hidden');

      if (profile.role === 'admin') {
        document.getElementById('adminSection').classList.remove('hidden');
        await loadRoster();
        await loadSubjectRoster();
        await loadScoreItems();
        await loadMaterials();
        await loadWorksheetOptions();
      } else {
        document.getElementById('studentSection').classList.remove('hidden');
        await loadMyAttendance();
        await loadMySubjectAttendance();
        await loadMyScores();
        await loadDutyList();
        await loadMaterials();
        await loadWorksheets();
      }
    }

    // ===== เช็คชื่อหน้าเสาธง =====
    // ครู: โหลดรายชื่อพร้อมสถานะวันนี้
    async function loadRoster() {
      const { data: students } = await db.from('profiles')
        .select('id, full_name, student_no').eq('role', 'student').order('student_no');
      const { data: records } = await db.from('flag_attendance')
        .select('student_id, status').eq('attend_date', today);
      const map = Object.fromEntries((records || []).map(r => [r.student_id, r.status]));

      document.getElementById('rosterBody').innerHTML = students.map(s => `
      <tr>
        <td>${s.student_no}</td>
        <td>${s.full_name}</td>
        <td>
          <select data-id="${s.id}">
            ${Object.entries(STATUS_LABEL).map(([v, t]) =>
        `<option value="${v}" ${map[s.id] === v ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('');
    }

    // ครู: บันทึกทั้งห้อง (upsert กันแถวซ้ำ)
    async function saveAll() {
      const { data: { user } } = await db.auth.getUser();
      const rows = [...document.querySelectorAll('#rosterBody select')].map(sel => ({
        attend_date: today,
        student_id: sel.dataset.id,
        status: sel.value,
        recorded_by: user.id
      }));
      const { error } = await db.from('flag_attendance')
        .upsert(rows, { onConflict: 'attend_date,student_id' });
      document.getElementById('adminMsg').textContent = error
        ? 'บันทึกไม่สำเร็จ: ' + error.message
        : 'บันทึกแล้ว ' + rows.length + ' คน';
    }

    // นักเรียน: ดูของตัวเอง (RLS กรองให้อยู่แล้ว)
    async function loadMyAttendance() {
      const { data, error } = await db.from('flag_attendance')
        .select('attend_date, status').order('attend_date', { ascending: false });
      document.getElementById('myAttendance').textContent = error
        ? 'เกิดข้อผิดพลาด: ' + error.message
        : (data.length
          ? data.map(r => r.attend_date + ' : ' + STATUS_LABEL[r.status]).join('\n')
          : 'ยังไม่มีข้อมูล');
    }

    // ===== เช็คชื่อวิชาสังคม =====
    // ครู: โหลดรายชื่อและสถานะของคาบที่เลือก
    async function loadSubjectRoster() {
      const period = Number(document.getElementById('periodSelect').value);
      const { data: students } = await db.from('profiles')
        .select('id, full_name, student_no').eq('role', 'student').order('student_no');
      const { data: records } = await db.from('subject_attendance')
        .select('student_id, status').eq('attend_date', today).eq('period', period);
      const map = Object.fromEntries((records || []).map(r => [r.student_id, r.status]));

      document.getElementById('subjRosterBody').innerHTML = students.map(s => `
      <tr>
        <td>${s.student_no}</td>
        <td>${s.full_name}</td>
        <td>
          <select data-id="${s.id}">
            ${Object.entries(STATUS_LABEL).map(([v, t]) =>
        `<option value="${v}" ${map[s.id] === v ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('');
    }

    // ครู: บันทึกทั้งห้องของคาบที่เลือก
    async function saveSubjectAll() {
      const period = Number(document.getElementById('periodSelect').value);
      const { data: { user } } = await db.auth.getUser();
      const rows = [...document.querySelectorAll('#subjRosterBody select')].map(sel => ({
        attend_date: today,
        period: period,
        student_id: sel.dataset.id,
        status: sel.value,
        recorded_by: user.id
      }));
      const { error } = await db.from('subject_attendance')
        .upsert(rows, { onConflict: 'attend_date,period,student_id' });
      document.getElementById('subjMsg').textContent = error
        ? 'บันทึกไม่สำเร็จ: ' + error.message
        : 'บันทึกคาบ ' + period + ' แล้ว ' + rows.length + ' คน';
    }

    // นักเรียน: ดูของตัวเอง
    async function loadMySubjectAttendance() {
      const { data, error } = await db.from('subject_attendance')
        .select('attend_date, period, status')
        .order('attend_date', { ascending: false })
        .order('period');
      document.getElementById('mySubjectAttendance').textContent = error
        ? 'เกิดข้อผิดพลาด: ' + error.message
        : (data.length
          ? data.map(r => r.attend_date + ' คาบ ' + r.period + ' : ' + STATUS_LABEL[r.status]).join('\n')
          : 'ยังไม่มีข้อมูล');
    }

    // ===== คะแนน =====
    // ครู: โหลดรายการชิ้นงานลงใน dropdown
    async function loadScoreItems() {
      const { data } = await db.from('score_items').select('id, name, max_score').order('id');
      currentItems = data || [];
      document.getElementById('itemSelect').innerHTML = currentItems
        .map(i => `<option value="${i.id}">${i.name} (เต็ม ${i.max_score})</option>`).join('');
      await loadScoreRoster();
    }

    // ครู: โหลดรายชื่อพร้อมคะแนนที่กรอกไว้
    async function loadScoreRoster() {
      const itemId = Number(document.getElementById('itemSelect').value);
      const item = currentItems.find(i => i.id === itemId);
      document.getElementById('itemMax').textContent = item ? 'คะแนนเต็ม ' + item.max_score : '';

      const { data: students } = await db.from('profiles')
        .select('id, full_name, student_no').eq('role', 'student').order('student_no');
      const { data: records } = await db.from('scores')
        .select('student_id, score').eq('item_id', itemId);
      const map = Object.fromEntries((records || []).map(r => [r.student_id, r.score]));

      document.getElementById('scoreRosterBody').innerHTML = students.map(s => `
      <tr>
        <td>${s.student_no}</td>
        <td>${s.full_name}</td>
        <td><input type="number" min="0" max="${item ? item.max_score : ''}"
                   step="0.5" data-id="${s.id}" value="${map[s.id] ?? ''}"></td>
      </tr>`).join('');
    }

    // ครู: บันทึกคะแนนทั้งห้อง (ข้ามช่องที่ว่าง)
    async function saveScores() {
      const itemId = Number(document.getElementById('itemSelect').value);
      const { data: { user } } = await db.auth.getUser();
      const rows = [...document.querySelectorAll('#scoreRosterBody input')]
        .filter(inp => inp.value !== '')
        .map(inp => ({
          item_id: itemId,
          student_id: inp.dataset.id,
          score: Number(inp.value),
          recorded_by: user.id
        }));
      const { error } = await db.from('scores')
        .upsert(rows, { onConflict: 'item_id,student_id' });
      document.getElementById('scoreMsg').textContent = error
        ? 'บันทึกไม่สำเร็จ: ' + error.message
        : 'บันทึกคะแนนแล้ว ' + rows.length + ' คน';
    }

    // นักเรียน: ดูคะแนนของตัวเองพร้อมคะแนนเต็ม
    async function loadMyScores() {
      const { data: items, error: e1 } = await db.from('score_items')
        .select('id, name, category, max_score').order('id');
      const { data: mine, error: e2 } = await db.from('scores')
        .select('item_id, score');
      if (e1 || e2) {
        document.getElementById('myScores').textContent = 'เกิดข้อผิดพลาด: ' + (e1 || e2).message;
        return;
      }
      const map = Object.fromEntries((mine || []).map(r => [r.item_id, r.score]));

      const lines = [];
      for (const cat of Object.keys(CATEGORY_LABEL)) {
        const inCat = items.filter(i => i.category === cat);
        if (!inCat.length) continue;
        const total = inCat.reduce((s, i) => s + Number(i.max_score), 0);
        const got = inCat.reduce((s, i) => s + (map[i.id] !== undefined ? Number(map[i.id]) : 0), 0);
        lines.push('== ' + CATEGORY_LABEL[cat] + ' (' + got + ' / ' + total + ')');
        for (const i of inCat) {
          const v = map[i.id] !== undefined ? map[i.id] : 'ยังไม่มีคะแนน';
          lines.push('   ' + i.name + ': ' + v + ' / ' + i.max_score);
        }
      }
      const all = items.reduce((s, i) => s + Number(i.max_score), 0);
      const sum = Object.values(map).reduce((s, v) => s + Number(v), 0);
      lines.push('');
      lines.push('รวมทั้งภาค: ' + sum + ' / ' + all);
      document.getElementById('myScores').textContent = lines.join('\n');
    }

    // ===== บันทึกเวร =====
    // นักเรียน: บันทึกเวรของตัวเอง (RLS บังคับ student_id ให้เป็นของตัวเอง)
    async function addDuty() {
      const { data: { user } } = await db.auth.getUser();
      const area = document.getElementById('dutyArea').value.trim();
      if (!area) {
        document.getElementById('dutyMsg').textContent = 'กรุณากรอกพื้นที่';
        return;
      }
      const { error } = await db.from('duty_log').insert({
        student_id: user.id,
        area: area,
        note: document.getElementById('dutyNote').value.trim() || null
      });
      document.getElementById('dutyMsg').textContent = error
        ? 'บันทึกไม่สำเร็จ: ' + error.message
        : 'บันทึกเวรแล้ว';
      if (!error) {
        document.getElementById('dutyArea').value = '';
        document.getElementById('dutyNote').value = '';
        await loadDutyList();
      }
    }

    // ทุกคน: ดูรายการเวรทั้งห้อง
    async function loadDutyList() {
      const { data, error } = await db.from('duty_log')
        .select('duty_date, area, note, profiles(full_name)')
        .order('duty_date', { ascending: false })
        .order('id', { ascending: false });
      document.getElementById('dutyList').textContent = error
        ? 'เกิดข้อผิดพลาด: ' + error.message
        : (data.length
          ? data.map(r => r.duty_date + ' | ' + r.profiles.full_name + ' | ' + r.area + (r.note ? ' | ' + r.note : '')).join('\n')
          : 'ยังไม่มีบันทึก');
    }

    // ===== ชีทและใบงาน =====
    // ครู: เพิ่มลิงก์ชีทหรือใบงาน (มีกำหนดส่งเฉพาะใบงาน)
    async function addMaterial() {
      const { data: { user } } = await db.auth.getUser();
      const title = document.getElementById('matTitle').value.trim();
      const url = document.getElementById('matUrl').value.trim();
      const periodVal = document.getElementById('matPeriod').value;
      const kind = document.getElementById('matKind').value;
      const dueVal = document.getElementById('matDue').value;

      if (!title || !url) {
        document.getElementById('matMsg').textContent = 'กรุณากรอกชื่อและลิงก์';
        return;
      }

      const { error } = await db.from('materials').insert({
        kind: kind,
        title: title,
        drive_url: url,
        period: periodVal ? Number(periodVal) : null,
        // datetime-local ให้ค่าแบบ 2026-11-06T23:59 ต่อวินาทีและโซนเวลาไทยเข้าไปเพื่อให้ไม่คลาดเคลื่อน
        due_at: (kind === 'worksheet' && dueVal) ? dueVal + ':00+07:00' : null,
        uploaded_by: user.id
      });

      document.getElementById('matMsg').textContent = error
        ? 'เพิ่มไม่สำเร็จ: ' + error.message
        : 'เพิ่มรายการแล้ว';

      if (!error) {
        document.getElementById('matTitle').value = '';
        document.getElementById('matUrl').value = '';
        document.getElementById('matPeriod').value = '';
        document.getElementById('matDue').value = '';
        await loadMaterials();
        await loadWorksheetOptions();
      }
    }

    // ทุกคน: แสดงรายการชีทและใบงานพร้อมปุ่มเปิดลิงก์
    async function loadMaterials() {
      const { data, error } = await db.from('materials')
        .select('lesson_date, period, kind, title, drive_url')
        .order('lesson_date', { ascending: false })
        .order('id', { ascending: false });
      const box = document.getElementById('materialList');
      if (error) { box.textContent = 'เกิดข้อผิดพลาด: ' + error.message; return; }
      if (!data.length) { box.textContent = 'ยังไม่มีรายการ'; return; }
      box.innerHTML = data.map(m => `
      <div class="card">
        <strong>${m.title}</strong><br>
        ${m.lesson_date} ${m.period ? 'คาบ ' + m.period : ''} ·
        ${m.kind === 'sheet' ? 'ชีท' : 'ใบงาน'}<br>
        <a href="${m.drive_url}" target="_blank" rel="noopener">เปิดลิงก์</a>
      </div>`).join('');
    }

    // ===== การส่งใบงาน =====
    // ครู: โหลดรายชื่อใบงานลง dropdown
    async function loadWorksheetOptions() {
      const { data } = await db.from('materials')
        .select('id, title').eq('kind', 'worksheet').order('id', { ascending: false });
      document.getElementById('wsSelect').innerHTML = (data || [])
        .map(w => `<option value="${w.id}">${w.title}</option>`).join('');
      await loadSubmissions();
    }

    // ครู: ดูว่าใครส่งลิงก์อะไรไว้บ้าง
    async function loadSubmissions() {
      const wsId = Number(document.getElementById('wsSelect').value);
      const body = document.getElementById('subBody');
      if (!wsId) { body.innerHTML = '<tr><td colspan="5">ยังไม่มีใบงาน</td></tr>'; return; }

      const { data, error } = await db.from('submissions')
        .select('drive_url, submitted_at, updated_at, profiles(full_name, student_no)')
        .eq('material_id', wsId)
        .order('updated_at');
      if (error) {
        body.innerHTML = `<tr><td colspan="5">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
      }
      const fmt = t => new Date(t).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
      body.innerHTML = data.length
        ? data.map(s => `
      <tr>
        <td>${s.profiles.student_no}</td>
        <td>${s.profiles.full_name}</td>
        <td>${fmt(s.submitted_at)}</td>
        <td>${fmt(s.updated_at)}</td>
        <td><a href="${s.drive_url}" target="_blank" rel="noopener">เปิด</a></td>
      </tr>`).join('')
        : '<tr><td colspan="5">ยังไม่มีการส่ง</td></tr>';
    }

    // นักเรียน: แสดงใบงานพร้อมกำหนดส่งและลิงก์ที่เคยส่งไว้
    async function loadWorksheets() {
      const { data: { user } } = await db.auth.getUser();
      const { data: ws } = await db.from('materials')
        .select('id, title, due_at').eq('kind', 'worksheet').order('id', { ascending: false });
      const { data: mine } = await db.from('submissions')
        .select('material_id, drive_url').eq('student_id', user.id);
      const map = Object.fromEntries((mine || []).map(s => [s.material_id, s.drive_url]));
      const box = document.getElementById('worksheetList');
      if (!ws || !ws.length) { box.textContent = 'ยังไม่มีใบงาน'; return; }

      box.innerHTML = ws.map(w => {
        const due = w.due_at ? new Date(w.due_at) : null;
        const open = !due || new Date() <= due;
        const dueText = due
          ? 'กำหนดส่ง ' + due.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
          : 'ไม่มีกำหนดส่ง';
        const sent = map[w.id] ? '(ส่งแล้ว)' : '(ยังไม่ได้ส่ง)';
        return `
        <div class="card">
          <strong>${w.title}</strong><br>${dueText}<br>
          ${open
            ? `<input id="link-${w.id}" class="full" placeholder="ลิงก์ Google Drive" value="${map[w.id] || ''}">
               <button class="full" onclick="submitWorksheet(${w.id})">${map[w.id] ? 'แก้ลิงก์' : 'ส่งใบงาน'}</button>`
            : `<em>หมดเวลาส่งแล้ว ${sent}</em>`}
        </div>`;
      }).join('');
    }

    // นักเรียน: ส่งหรือแก้ลิงก์ของตัวเอง (ฐานข้อมูลเป็นคนตรวจกำหนดส่งจริง)
    async function submitWorksheet(id) {
      const url = document.getElementById('link-' + id).value.trim();
      const { data: { user } } = await db.auth.getUser();
      const { error } = await db.from('submissions').upsert(
        { material_id: id, student_id: user.id, drive_url: url, updated_at: new Date().toISOString() },
        { onConflict: 'material_id,student_id' }
      );
      alert(error ? 'ส่งไม่สำเร็จ: ' + error.message : 'ส่งใบงานแล้ว');
      await loadWorksheets();
    }

    // ===== เริ่มทำงาน =====
    // เปิดหน้าแล้วถ้า login ค้างอยู่ ให้แสดงส่วนที่ถูกต้องเลย
    db.auth.getSession().then(({ data: { session } }) => {
      if (session) showByRole();
    });