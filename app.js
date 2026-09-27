// URL Web app của Apps Script (kết thúc bằng /exec). Xem README.md, mục "Cài đặt".
const API_URL = 'https://script.google.com/macros/s/AKfycbz9RhKVCq4YId3cPT4gpGB3395Bm3avh4q94C5SOc79QeJa__3KBvUmDjfwbHXShH6Q/exec';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const state = { data: null, tab: 'trip', subtab: 'overview' };

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').trim();
const parseMoney = v => Number(String(v || '').replace(/[^\d]/g, '')) || 0;
const money = n => new Intl.NumberFormat('vi-VN').format(n) + ' đ';
const store = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
};

/* ---------- Gọi backend ---------- */
function call(fn, arg) {
  if (!API_URL) return Promise.reject(new Error('Chưa cấu hình API_URL trong app.js'));
  const gets = { getData: 'data', getMembers: 'members', getComments: 'comments' };
  const posts = { register: 'register', addComment: 'comment' };
  // Gửi dạng text/plain để trình duyệt không phải gửi preflight CORS (Apps Script không hỗ trợ)
  const req = gets[fn]
    ? fetch(API_URL + '?action=' + gets[fn])
    : fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: posts[fn], data: arg }),
      });
  return req.then(r => r.json()).then(j => {
    if (!j.ok) throw new Error(j.error);
    return j.data;
  });
}

function load() {
  $('#loading').hidden = false;
  $('#error').hidden = true;
  call('getData')
    .then(d => {
      state.data = d;
      $('#loading').hidden = true;
      renderTrip();
      renderMembers();
      renderComments();
      renderRegisterState();
      showTab(state.tab, true);
    })
    .catch(err => {
      $('#loading').hidden = true;
      $('#error').hidden = false;
      $('#errorMsg').textContent = 'Không tải được dữ liệu: ' + err.message;
    });
}

function refresh(kind, btn) {
  if (!state.data) return;
  const fn = kind === 'members' ? 'getMembers' : 'getComments';
  if (btn) btn.classList.add('spinning');
  call(fn)
    .then(v => {
      state.data[kind] = v;
      kind === 'members' ? renderMembers() : renderComments();
    })
    .catch(err => btn && toast(err.message))
    .finally(() => btn && btn.classList.remove('spinning'));
}

/* ---------- Điều hướng ---------- */
function showTab(tab, skipRefresh) {
  state.tab = tab;
  const ready = !!state.data;
  $$('.tab').forEach(s => { s.hidden = !ready || s.id !== 'tab-' + tab; });
  $$('.bottom-nav button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  window.scrollTo(0, 0);
  if (ready && !skipRefresh) {
    if (tab === 'list') refresh('members');
    if (tab === 'comments') refresh('comments');
  }
}

/* ---------- 1. Giới thiệu chuyến đi ---------- */
const COLORS = ['#ff6b4a', '#14b8a6', '#a855f7', '#ffb020', '#3b82f6', '#ec4899'];
const PLACE_EMOJI = ['🏞️', '🌊', '⛰️', '🏖️', '🌸', '🏯', '🌅', '🍜'];
const WAVES = `<svg class="waves" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
  <path class="back" fill="currentColor" d="M0,40 C200,90 440,10 720,50 C1000,90 1240,20 1440,45 L1440,100 L0,100 Z"/>
  <path fill="currentColor" d="M0,60 C240,100 480,20 720,55 C960,90 1200,35 1440,62 L1440,100 L0,100 Z"/></svg>`;

function renderTrip() {
  const { info, gallery, guide, schedule } = state.data;
  const title = info.ten_chuyen_di || 'Chuyến du lịch';
  document.title = title;

  const dates = [info.ngay_di, info.ngay_ve].filter(Boolean).join(' → ');
  const hero = $('#hero');
  hero.classList.toggle('has-img', !!info.anh_bia);
  hero.innerHTML =
    (info.anh_bia
      ? `<img src="${esc(info.anh_bia)}" alt="" referrerpolicy="no-referrer">`
      : '<div class="sun"></div>') +
    `<div class="hero-body">
       <h1>${esc(title)}</h1>
       <div class="hero-meta">
         ${info.dia_diem ? `<span class="pill">📍 ${esc(info.dia_diem)}</span>` : ''}
         ${dates ? `<span class="pill">📅 ${esc(dates)}</span>` : ''}
       </div>
     </div>` + WAVES;

  const phone = (info.lien_he || '').match(/(\+?\d[\d .]{7,}\d)/);
  const contact = phone
    ? esc(info.lien_he).replace(esc(phone[1]), `<a href="tel:${esc(phone[1].replace(/[ .]/g, ''))}">${esc(phone[1])}</a>`)
    : esc(info.lien_he);
  const meet = [info.gio_tap_trung, info.diem_tap_trung].filter(Boolean).join(' · ');
  const rows = [
    ['🚩', 'Tập trung', esc(meet)],
    ['📝', 'Hạn đăng ký', esc(info.han_dang_ky)],
    ['📞', 'Liên hệ', contact],
  ].filter(r => r[2]);

  $('#sec-info').hidden = !rows.length && !info.gioi_thieu;
  $('#sec-info').innerHTML =
    (info.gioi_thieu ? `<p class="intro">${esc(info.gioi_thieu)}</p>` : '') +
    (rows.length
      ? `<ul class="info-rows">${rows.map(r =>
          `<li><span class="ico">${r[0]}</span><span class="lbl">${r[1]}</span><span class="val">${r[2]}</span></li>`).join('')}</ul>`
      : '');

  $('#sec-gallery').hidden = !gallery.length;
  $('#gallery').innerHTML = gallery.map(g =>
    `<button type="button" data-zoom="${esc(g.url)}" aria-label="Xem ảnh ${esc(g.name)}">
       <img src="${esc(g.url)}" alt="${esc(g.name)}" loading="lazy" referrerpolicy="no-referrer">
     </button>`).join('');

  $('#guideList').innerHTML = guide.length
    ? guide.map((g, i) => {
        const long = g.content.length > 110;
        return `<article class="guide" style="--c:${COLORS[i % COLORS.length]}">
          ${g.image
            ? `<img src="${esc(g.image)}" alt="${esc(g.title)}" loading="lazy" referrerpolicy="no-referrer" data-zoom="${esc(g.image)}">`
            : `<div class="guide-ph">${PLACE_EMOJI[i % PLACE_EMOJI.length]}</div>`}
          <div class="guide-body">
            <h3>${esc(g.title)}</h3>
            <p class="${long ? 'clamp' : ''}">${esc(g.content)}</p>
            ${long ? '<button type="button" class="link-btn" data-more>Xem thêm</button>' : ''}
          </div>
        </article>`;
      }).join('')
    : '';
  $('#sec-guide').hidden = !guide.length;

  const days = [];
  schedule.forEach(s => {
    let d = days[days.length - 1];
    if (!d || d.day !== s.day) days.push(d = { day: s.day, items: [] });
    d.items.push(s);
  });
  $('#scheduleList').innerHTML = days.length
    ? days.map((d, i) => `<div class="day" style="--c:${COLORS[i % COLORS.length]}">
        <h3 class="day-head"><span class="num">${i + 1}</span>${esc(d.day || 'Ngày ' + (i + 1))}</h3>
        <ol class="timeline">
          ${d.items.map(s => `<li>
            <time>${esc(s.time)}</time>
            <div class="tl-body">
              <b>${esc(s.activity || s.place)}</b>
              ${s.activity && s.place ? `<p class="muted">📍 ${esc(s.place)}</p>` : ''}
              ${s.note ? `<p>💡 ${esc(s.note)}</p>` : ''}
              ${s.image ? `<img src="${esc(s.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-zoom="${esc(s.image)}">` : ''}
            </div>
          </li>`).join('')}
        </ol>
      </div>`).join('')
    : '';
  $('#sec-schedule').hidden = !days.length;

  renderBudget();
  renderCrowd();
  renderSubtabs();
}

/* Tab con trong "Chuyến đi": mỗi lần chỉ hiện 1 mục để khỏi cuộn dài */
const SUBTABS = [
  ['overview', 'Tổng quan'],
  ['guide', 'Điểm đến'],
  ['schedule', 'Lịch trình'],
  ['budget', 'Kinh phí'],
];

function renderSubtabs() {
  const sections = $$('#tab-trip [data-panel]');
  // Tab chỉ hiện khi có ít nhất 1 mục có dữ liệu (mục trống đã được đặt hidden)
  const available = SUBTABS.filter(([id]) => sections.some(s => s.dataset.panel === id && !s.hidden));
  if (!available.some(([id]) => id === state.subtab)) state.subtab = available.length ? available[0][0] : '';

  $('#subtabs').hidden = available.length < 2;
  $('#subtabs').innerHTML = available.map(([id, label]) =>
    `<button type="button" role="tab" data-subtab="${id}" aria-selected="${id === state.subtab}">${label}</button>`).join('');
  sections.forEach(s => s.classList.toggle('off', s.dataset.panel !== state.subtab));
  $('#tripEmpty').hidden = available.length > 0;
}

function showSubtab(id) {
  state.subtab = id;
  renderSubtabs();
  // Nếu đang cuộn xuống dưới thì đưa về đầu nội dung tab
  const bar = $('#subtabs');
  const top = bar.getBoundingClientRect().top + window.scrollY;
  if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
}

// Khung dưới ảnh bìa: avatar + số người đã đăng ký
function renderCrowd() {
  const { members } = state.data;
  const people = memberStats(members).people;
  $('#crowd').hidden = !members.length;
  $('#crowd').innerHTML = members.length
    ? `<div class="faces">${members.slice(-5).map(m => avatar(m.name, 'sm')).join('')}</div>
       <span><b>${people} người</b> đã sẵn sàng lên đường</span>`
    : '';
}

function memberStats(list) {
  const adults = list.reduce((s, m) => s + 1 + m.adults, 0);
  const children = list.reduce((s, m) => s + m.children, 0);
  return { count: list.length, adults, children, people: adults + children };
}

function renderBudget() {
  const { info, budget, members } = state.data;
  const total = budget.reduce((s, b) => s + b.amount, 0);
  const feeAdult = parseMoney(info.phi_nguoi_lon);
  const feeChild = parseMoney(info.phi_tre_em);
  const st = memberStats(members);
  const estimate = st.adults * feeAdult + st.children * feeChild;
  const color = i => COLORS[i % COLORS.length];

  let html = '';
  if (budget.length) {
    if (total > 0) {
      html += `<div class="bar" aria-hidden="true">${budget.map((b, i) =>
        `<span style="width:${Math.max(0, b.amount) / total * 100}%;background:${color(i)}"></span>`).join('')}</div>`;
    }
    html += budget.map((b, i) => `<div class="budget-row">
        <span class="dot" style="background:${color(i)}"></span>
        <div class="name">${esc(b.item)}${b.note ? `<div class="muted small">${esc(b.note)}</div>` : ''}</div>
        <div class="amt">${money(b.amount)}</div>
      </div>`).join('');
    html += `<div class="budget-total"><span>Tổng chi phí</span><span class="amt">${money(total)}</span></div>`;
  }
  if (feeAdult || feeChild) {
    html += `<div class="fees">
      <div class="fee adult"><div class="lbl">🧑 Người lớn</div><div class="val">${money(feeAdult)}</div><div class="lbl">mỗi người</div></div>
      <div class="fee child"><div class="lbl">🧒 Trẻ em</div><div class="val">${money(feeChild)}</div><div class="lbl">mỗi người</div></div>
    </div>`;
    if (st.count) {
      html += `<p class="estimate">🧮 Tạm thu theo <b>${st.people}</b> người đã đăng ký
        (${st.adults} người lớn, ${st.children} trẻ em): <b>${money(estimate)}</b></p>`;
    }
  }
  $('#budgetBox').innerHTML = html;
  $('#sec-budget').hidden = !html;
}

/* ---------- 2. Đăng ký ---------- */
function renderRegisterState() {
  const closed = !!state.data.closed;
  $('#regClosed').hidden = !closed;
  $('#regFields').disabled = closed;
  const saved = store.get('travel_name');
  if (saved) {
    const f = $('#commentForm').elements.namedItem('name');
    if (!f.value) f.value = saved;
  }
}

$('#familyToggle').addEventListener('change', e => {
  const on = e.target.checked;
  $('#familyFields').hidden = !on;
  const form = $('#regForm');
  const adults = form.elements.namedItem('adults');
  const children = form.elements.namedItem('children');
  if (on && +adults.value === 0 && +children.value === 0) adults.value = 1;
});

document.addEventListener('click', e => {
  const step = e.target.closest('[data-step]');
  if (step) {
    const input = step.parentElement.querySelector('input');
    input.value = Math.max(0, Math.min(20, (parseInt(input.value, 10) || 0) + Number(step.dataset.step)));
  }
});

$('#regForm').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  const el = n => form.elements.namedItem(n);
  const errBox = $('#regError');
  const data = {
    name: el('name').value.trim(),
    family: el('family').checked,
    adults: parseInt(el('adults').value, 10) || 0,
    children: parseInt(el('children').value, 10) || 0,
    note: el('note').value.trim(),
  };
  let error = '';
  if (!data.name) error = 'Vui lòng nhập tên thành viên';
  else if (data.family && data.adults + data.children === 0) error = 'Vui lòng nhập số người lớn hoặc trẻ em đi cùng';
  if (error) {
    errBox.textContent = error;
    errBox.hidden = false;
    return;
  }
  errBox.hidden = true;
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Đang gửi…';
  call('register', data)
    .then(members => {
      state.data.members = members;
      store.set('travel_name', data.name);
      form.reset();
      $('#familyFields').hidden = true;
      renderMembers();
      renderRegisterState();
      showTab('list', true);
      confetti();
      toast('🎉 Đăng ký thành công! Hẹn gặp bạn trên xe nhé!');
    })
    .catch(err => {
      errBox.textContent = err.message;
      errBox.hidden = false;
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = '🎉 Đăng ký ngay';
    });
});

/* ---------- 3. Danh sách ---------- */
function avatar(name, cls) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  const letter = name.trim().split(/\s+/).pop().charAt(0).toUpperCase();
  const bg = `linear-gradient(135deg, hsl(${h} 85% 62%), hsl(${(h + 45) % 360} 75% 50%))`;
  return `<div class="avatar ${cls || ''}" style="background:${bg}">${esc(letter)}</div>`;
}

function renderMembers() {
  const list = state.data.members;
  const st = memberStats(list);
  $('#memberStats').innerHTML = [
    ['🙋', st.count, 'Đăng ký', COLORS[0]],
    ['🧑', st.adults, 'Người lớn', COLORS[2]],
    ['🧒', st.children, 'Trẻ em', COLORS[4]],
    ['🎉', st.people, 'Tổng', COLORS[1]],
  ].map(s => `<div class="stat" style="--c:${s[3]}"><div class="emo">${s[0]}</div><b>${s[1]}</b><span>${s[2]}</span></div>`).join('');

  const q = norm($('#memberSearch').value);
  const me = norm(store.get('travel_name'));
  const rows = list
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !q || norm([m.name, m.roommate, m.room, m.note].join(' ')).includes(q));

  $('#memberList').innerHTML = rows.length
    ? rows.map(({ m, i }) => `<li class="card member ${me && norm(m.name) === me ? 'me' : ''}">
        ${avatar(m.name)}
        <div>
          <div class="top">
            <b>${esc(m.name)}</b>
            ${m.family
              ? '<span class="tag" style="--c:var(--sea)">👨‍👩‍👧 Cả nhà</span>'
              : '<span class="tag" style="--c:var(--grape)">🎒 Solo</span>'}
            ${me && norm(m.name) === me ? '<span class="tag" style="--c:var(--coral)">Bạn</span>' : ''}
          </div>
          <div class="meta">#${i + 1}${m.family ? ` · +${m.adults} người lớn · +${m.children} trẻ em` : ''}</div>
          <div class="room">
            <span>🛏️ ${m.room ? `<b>${esc(m.room)}</b>` : '<span class="unset">Chưa xếp phòng</span>'}</span>
            <span>👥 ${m.roommate ? `Ở cùng <b>${esc(m.roommate)}</b>` : '<span class="unset">Chưa xếp bạn cùng phòng</span>'}</span>
          </div>
          ${m.note ? `<p class="note">📝 ${esc(m.note)}</p>` : ''}
        </div>
      </li>`).join('')
    : `<li class="card empty">${q ? '🔍 Không tìm thấy ai' : '🙋 Chưa có ai đăng ký, hãy là người đầu tiên!'}</li>`;

  renderBudget();
  renderCrowd();
}

$('#memberSearch').addEventListener('input', renderMembers);

/* ---------- 4. Bình luận ---------- */
function renderComments() {
  const list = state.data.comments;
  const me = norm(store.get('travel_name'));
  $('#commentList').innerHTML = list.length
    ? list.map(c => `<li class="comment ${me && norm(c.name) === me ? 'me' : ''}">
        ${avatar(c.name)}
        <div class="bubble">
          <div class="top"><b>${esc(c.name)}</b><span class="muted small">${esc(c.time)}</span></div>
          <p>${esc(c.content)}</p>
        </div>
      </li>`).join('')
    : '<li class="card empty">🦗 Im ắng quá… mở hàng đi nè!</li>';
}

$('#commentForm').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  const name = form.elements.namedItem('name');
  const content = form.elements.namedItem('content');
  const errBox = $('#commentError');
  const data = { name: name.value.trim(), content: content.value.trim() };
  if (!data.name || !data.content) {
    errBox.textContent = !data.name ? 'Vui lòng nhập tên' : 'Vui lòng nhập nội dung';
    errBox.hidden = false;
    return;
  }
  errBox.hidden = true;
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Đang gửi…';
  call('addComment', data)
    .then(comments => {
      state.data.comments = comments;
      store.set('travel_name', data.name);
      content.value = '';
      renderComments();
      toast('💬 Đã gửi!');
    })
    .catch(err => {
      errBox.textContent = err.message;
      errBox.hidden = false;
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = 'Gửi 🚀';
    });
});

/* ---------- Chung ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

function confetti() {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  let html = '';
  for (let i = 0; i < 90; i++) {
    const dur = 1.8 + Math.random() * 1.6;
    html += `<i style="left:${Math.random() * 100}%;background:${COLORS[i % COLORS.length]};` +
      `--dx:${(Math.random() - .5) * 200}px;--r:${Math.random() * 900 - 450}deg;` +
      `animation-duration:${dur}s;animation-delay:${Math.random() * .4}s;` +
      `${i % 3 === 0 ? 'border-radius:50%;width:9px;height:9px;' : ''}"></i>`;
  }
  box.innerHTML = html;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4000);
}

function openLightbox(src) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = `<img src="${esc(src.replace(/sz=w\d+/, 'sz=w2000'))}" alt="" referrerpolicy="no-referrer">`;
  box.addEventListener('click', () => box.remove());
  document.body.appendChild(box);
}

document.addEventListener('click', e => {
  const t = e.target;
  const tab = t.closest('[data-tab]');
  if (tab) return showTab(tab.dataset.tab);
  const go = t.closest('[data-go]');
  if (go) return showTab(go.dataset.go);
  const sub = t.closest('[data-subtab]');
  if (sub) return showSubtab(sub.dataset.subtab);
  const zoom = t.closest('[data-zoom]');
  if (zoom) return openLightbox(zoom.dataset.zoom);
  const more = t.closest('[data-more]');
  if (more) {
    const p = more.previousElementSibling;
    const open = p.classList.toggle('clamp');
    more.textContent = open ? 'Xem thêm' : 'Thu gọn';
    return;
  }
  const rf = t.closest('[data-refresh]');
  if (rf) refresh(rf.dataset.refresh, rf);
});

$('#retryBtn').addEventListener('click', load);
load();
