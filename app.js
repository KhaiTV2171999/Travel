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
      // Không vẽ lại nếu không có gì mới (tránh giật khi tự tải tin mỗi 15 giây)
      if (JSON.stringify(v) === JSON.stringify(state.data[kind])) return;
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
  $$('.bottom-nav button:not(.nav-brand)').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  window.scrollTo(0, 0);
  if (ready && !skipRefresh) {
    if (tab === 'list' || tab === 'pay') refresh('members');
    if (tab === 'comments') refresh('comments');
  }
  // Tab trò chuyện: cuộn xuống tin mới nhất và tự tải tin mới mỗi 8 giây
  clearInterval(chat.timer);
  if (ready && tab === 'comments') {
    chat.stick = true;
    renderComments();
    chat.timer = setInterval(() => { if (!document.hidden) refresh('comments'); }, 8000);
  }
}

// Quay lại trang (mở lại app, chuyển tab trình duyệt) thì tải tin mới ngay
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.data && state.tab === 'comments') refresh('comments');
});

/* ---------- 1. Giới thiệu chuyến đi ---------- */
const COLORS = ['#ff6b4a', '#14b8a6', '#a855f7', '#ffb020', '#3b82f6', '#ec4899'];
const PLACE_EMOJI = ['🏞️', '🌊', '⛰️', '🏖️', '🌸', '🏯', '🌅'];
const FOOD_EMOJI = ['🍜', '🍲', '🥖', '🍢', '🦐', '🍚', '☕', '🍧'];
const HOTEL_EMOJI = ['🏨', '🏡', '🛏️', '🏩'];
const WAVES = `<svg class="waves" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
  <path class="back" fill="currentColor" d="M0,40 C200,90 440,10 720,50 C1000,90 1240,20 1440,45 L1440,100 L0,100 Z"/>
  <path fill="currentColor" d="M0,60 C240,100 480,20 720,55 C960,90 1200,35 1440,62 L1440,100 L0,100 Z"/></svg>`;

// Thẻ dùng chung cho Điểm đến, Ăn uống, Khách sạn: ảnh (hoặc emoji) bên trái, chữ bên phải
function cards(items, emojis, colorOffset) {
  return items.map((g, i) => {
    const long = g.content.length > 110;
    const maps = g.address
      ? `<a class="addr" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(g.address)}" target="_blank" rel="noopener">📍 ${esc(g.address)}</a>`
      : '';
    const tel = g.phone
      ? `<a class="addr" href="tel:${esc(g.phone.replace(/[^\d+]/g, ''))}">📞 ${esc(g.phone)}</a>`
      : '';
    return `<article class="guide" style="--c:${COLORS[(i + colorOffset) % COLORS.length]}">
      ${g.image
        ? `<img src="${esc(g.image)}" alt="${esc(g.title)}" loading="lazy" referrerpolicy="no-referrer" data-zoom="${esc(g.image)}">`
        : `<div class="guide-ph">${emojis[i % emojis.length]}</div>`}
      <div class="guide-body">
        <h3>${esc(g.title)}</h3>
        ${maps}${tel}
        <p class="${long ? 'clamp' : ''}">${esc(g.content)}</p>
        ${long ? '<button type="button" class="link-btn" data-more>Xem thêm</button>' : ''}
      </div>
    </article>`;
  }).join('');
}

function renderTrip() {
  const { info, gallery, guide, schedule } = state.data;
  const food = state.data.food || []; // backend cũ chưa có mục Ăn uống / Khách sạn
  const hotel = state.data.hotel || [];
  const title = info.ten_chuyen_di || 'Chuyến du lịch';
  document.title = title;
  $('#navBrand').textContent = '✈️ ' + title;

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
  const rows = [
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
  // Lưới ảnh nhỏ: tải bản thu nhỏ 400px, bấm vào mới mở ảnh lớn
  $('#gallery').innerHTML = gallery.map(g =>
    `<button type="button" data-zoom="${esc(g.url)}" aria-label="Xem ảnh ${esc(g.name)}">
       <img src="${esc(g.url.replace(/sz=w\d+/, 'sz=w400'))}" alt="${esc(g.name)}" loading="lazy" referrerpolicy="no-referrer">
     </button>`).join('');

  $('#guideList').innerHTML = cards(guide, PLACE_EMOJI, 0);
  $('#sec-guide').hidden = !guide.length;
  $('#foodList').innerHTML = cards(food, FOOD_EMOJI, 3);
  $('#sec-food').hidden = !food.length;
  $('#hotelList').innerHTML = cards(hotel, HOTEL_EMOJI, 4);
  $('#sec-hotel').hidden = !hotel.length;

  const days = [];
  schedule.forEach(s => {
    let d = days[days.length - 1];
    if (!d || d.day !== s.day) days.push(d = { day: s.day, items: [] });
    d.items.push(s);
  });
  $('#scheduleList').innerHTML = days.length
    ? days.map((d, i) => {
        // "Ngày 1 (17/10)" -> tiêu đề "Ngày 1" + nhãn ngày "17/10"
        const m = String(d.day || '').match(/^(.*?)\s*\((.+)\)\s*$/);
        const title = m ? m[1] : d.day || 'Ngày ' + (i + 1);
        const date = m ? m[2] : '';
        return `<article class="day" style="--c:${COLORS[i % COLORS.length]}">
          <header class="day-head">
            <h3>${esc(title)}</h3>
            ${date ? `<span class="day-date">${esc(date)}</span>` : ''}
            <span class="day-count">${d.items.length} hoạt động</span>
          </header>
          <ol class="timeline">
            ${d.items.map(s => `<li>
              ${s.time ? `<time>${esc(s.time)}</time>` : ''}
              <b>${esc(s.activity || s.place)}</b>
              ${(s.activity && s.place) || s.note ? `<div class="tl-meta">
                ${s.activity && s.place ? `<span>📍 ${esc(s.place)}</span>` : ''}
                ${s.note ? `<span>💡 ${esc(s.note)}</span>` : ''}
              </div>` : ''}
              ${s.image ? `<img src="${esc(s.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-zoom="${esc(s.image)}">` : ''}
            </li>`).join('')}
          </ol>
        </article>`;
      }).join('')
    : '';
  $('#sec-schedule').hidden = !days.length;

  renderBudget();
  renderCrowd();
  renderSubtabs();
}

/* Tab con trong "Chuyến đi": mỗi lần chỉ hiện 1 mục để khỏi cuộn dài */
const SUBTABS = [
  ['overview', 'Tổng quan'],
  ['schedule', 'Lịch trình'],
  ['budget', 'Khái toán'],
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
       <span><b>${people} người</b> đã sẵn sàng lên đường</span><span class="crowd-go" aria-hidden="true">›</span>`
    : '';
}

function memberStats(list) {
  const adults = list.reduce((s, m) => s + 1 + m.adults, 0);
  const children = list.reduce((s, m) => s + m.children, 0);
  return { count: list.length, adults, children, people: adults + children };
}

function renderBudget() {
  const { budget } = state.data;
  const total = budget.reduce((s, b) => s + b.amount, 0);
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
    html += `<div class="budget-total"><span>Tổng khái toán</span><span class="amt">${money(total)}</span></div>`;
  }
  $('#budgetBox').innerHTML = html;
  $('#sec-budget').hidden = !html;
  renderPayment();
}

/* ---------- Nộp tiền: chỉ tính người lớn (người đăng ký + người lớn đi cùng) ---------- */
// Bỏ dấu cho nội dung chuyển khoản: "Trần Văn Khải" -> "Tran Van Khai"
// Ảnh QR nhận tiền (cắt từ app ngân hàng), đặt cùng thư mục với index.html
const QR_IMAGE = 'qr-card.jpg?v=1';

const ascii = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// Hai giai đoạn (đều nhập trong trang Thông tin, tính cho mỗi người lớn):
// - "Tạm thu": số tiền nộp trước chuyến đi.
// - "Thực tế": người tổ chức tự tính sau chuyến đi. Có số này thì chuyển sang quyết toán:
//   so với số đã nộp -> nộp thêm / được trả lại.
function infoMoney(info, key) {
  // Khớp cả "Tạm thu" lẫn "Tạm thu mỗi người lớn"
  const k = Object.keys(info).find(x => x === key || x.indexOf(key + '_') === 0);
  return k ? parseMoney(info[k]) : 0;
}

function renderPayment() {
  const { info, members } = state.data;
  const fee = infoMoney(info, 'tam_thu') || infoMoney(info, 'phi_nguoi_lon'); // tên cũ: Phí người lớn
  const actual = infoMoney(info, 'thuc_te');
  const settled = actual > 0;
  const per = settled ? actual : fee;
  const adults = members.reduce((s, m) => s + 1 + m.adults, 0);

  if (!per || !members.length) {
    $('#payBox').innerHTML = `<div class="card empty">${!per
      ? '🛠️ Chưa có thông tin nộp tiền.<br>Người tổ chức cần điền "Tạm thu" trong Sheet.'
      : '🙋 Chưa có ai đăng ký.'}</div>`;
    return;
  }

  const rows = members.map(m => {
    const n = 1 + m.adults;
    const due = n * per;
    const paid = m.paid || 0;
    return { m, adults: n, due, paid, diff: due - paid }; // diff > 0: còn thiếu, < 0: thừa
  });
  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  const collected = rows.reduce((s, r) => s + r.paid, 0);
  const owe = rows.reduce((s, r) => s + Math.max(0, r.diff), 0);
  const refund = rows.reduce((s, r) => s + Math.max(0, -r.diff), 0);
  const done = rows.filter(r => r.diff === 0 || (!settled && r.diff < 0)).length;

  // Người đang chọn: mặc định là tên đã lưu trên máy
  const me = norm(store.get('travel_name'));
  if (state.payFor === undefined) {
    const mine = rows.find(r => me && norm(r.m.name) === me);
    state.payFor = mine ? mine.m.name : '';
  }
  const sel = rows.find(r => r.m.name === state.payFor);

  // Khối 1: tổng quan
  const summary = settled
    ? `<div class="card pay-sum">
        <span class="phase done">🧾 Đã quyết toán</span>
        <div class="pay-fee"><span>Thực tế mỗi người lớn</span><b>${money(per)}</b></div>
        <p class="muted small">${adults} người lớn${fee ? ` · đã tạm thu ${money(fee)}/người` : ''}</p>
        <div class="settle-grid">
          <div><span>Đã thu</span><b>${money(collected)}</b></div>
          <div class="owe"><span>Cần thu thêm</span><b>${money(owe)}</b></div>
          <div class="refund"><span>Cần trả lại</span><b>${money(refund)}</b></div>
        </div>
      </div>`
    : `<div class="card pay-sum">
        <span class="phase">⏳ Đang tạm thu</span>
        <div class="pay-fee"><span>Tạm thu mỗi người lớn</span><b>${money(per)}</b></div>
        <p class="muted small">Trẻ em không tính tiền · ${adults} người lớn · cần thu ${money(totalDue)}.
          Sau chuyến đi sẽ quyết toán theo số thực tế (nộp thêm hoặc trả lại).</p>
        <div class="progress" aria-label="Đã thu"><span style="width:${totalDue ? Math.min(100, collected / totalDue * 100) : 0}%"></span></div>
        <div class="pay-nums"><span>Đã thu <b>${money(collected)}</b></span><span><b>${done}/${rows.length}</b> đã nộp đủ</span></div>
      </div>`;

  // Khối 2: chuyển khoản bằng ảnh QR + số tiền/nội dung theo người được chọn
  const acc = String(info.so_tai_khoan || '').replace(/\s/g, '');
  const bank = String(info.ngan_hang || '').trim();
  const holder = info.chu_tai_khoan || '';
  const content = sel ? `${ascii(sel.m.name)} ${settled ? 'nop them' : 'nop tien'} du lich`.slice(0, 50) : '';
  let selInfo = '';
  if (sel) {
    const label = sel.diff > 0 ? (settled && sel.paid ? 'Cần nộp thêm' : 'Cần nộp')
      : sel.diff < 0 && settled ? 'Được trả lại' : '';
    selInfo = `<div class="bank-row big"><span class="lbl">${label || 'Trạng thái'}</span>
        <span class="v ${sel.diff > 0 ? '' : sel.diff < 0 && settled ? 'refund' : 'ok'}">${sel.diff > 0
          ? `${money(sel.diff)}<button type="button" class="copy" data-copy="${sel.diff}">Sao chép</button>`
          : sel.diff < 0 && settled ? money(-sel.diff) : '✅ Đã nộp đủ'}</span></div>
      <div class="muted small">${sel.adults} người lớn × ${money(per)} = ${money(sel.due)}${sel.paid ? ` · đã nộp ${money(sel.paid)}` : ''}</div>
      ${sel.diff < 0 && settled ? '<div class="muted small">Người tổ chức sẽ chuyển trả lại cho bạn.</div>' : ''}
      ${sel.diff > 0 ? `<div class="bank-row"><span class="lbl">Nội dung</span>
        <span class="v">${esc(content)}<button type="button" class="copy" data-copy="${esc(content)}">Sao chép</button></span></div>` : ''}`;
  }
  const transfer = `<div class="card bank">
    <h3>🏦 Chuyển khoản</h3>
    <button type="button" class="qr" data-zoom="${QR_IMAGE}" aria-label="Phóng to mã QR">
      <img src="${QR_IMAGE}" alt="Mã QR nhận tiền" loading="lazy">
    </button>
    <p class="muted small center">Quét mã QR bằng app ngân hàng, rồi nhập <b>số tiền</b> và <b>nội dung</b> bên dưới</p>
    <label class="field"><span>Bạn là ai?</span>
      <select id="payFor">
        <option value="">Chọn tên để xem số tiền của bạn</option>
        ${rows.map(r => `<option value="${esc(r.m.name)}" ${r.m.name === state.payFor ? 'selected' : ''}>${esc(r.m.name)}</option>`).join('')}
      </select>
    </label>
    ${selInfo}
    ${bank ? `<div class="bank-row"><span class="lbl">Ngân hàng</span><span class="v">${esc(bank)}</span></div>` : ''}
    ${acc ? `<div class="bank-row"><span class="lbl">Số tài khoản</span>
      <span class="v">${esc(acc)}<button type="button" class="copy" data-copy="${esc(acc)}">Sao chép</button></span></div>` : ''}
    ${holder ? `<div class="bank-row"><span class="lbl">Chủ tài khoản</span><span class="v">${esc(holder)}</span></div>` : ''}
  </div>`;

  // Khối 3: tình hình từng người
  const status = r => {
    if (r.diff > 0) {
      if (r.paid === 0) return `<span class="st no">Chưa nộp</span>`;
      return `<span class="st part">${settled ? 'Nộp thêm' : 'Thiếu'} ${money(r.diff)}</span>`;
    }
    if (r.diff < 0 && settled) return `<span class="st back">Trả lại ${money(-r.diff)}</span>`;
    return '<span class="st ok">✅ Đủ</span>';
  };
  const list = `<div class="card">
    <h3>📋 ${settled ? 'Quyết toán từng người' : 'Tình hình nộp tiền'}</h3>
    <ul class="pay-list">
      ${rows.map(r => `<li class="pay-row ${me && norm(r.m.name) === me ? 'me' : ''}">
        <div><b>${esc(r.m.name)}</b>
          <div class="muted small">${r.adults} người lớn · ${money(r.due)}${r.paid ? ` · đã nộp ${money(r.paid)}` : ''}</div></div>
        ${status(r)}
      </li>`).join('')}
    </ul>
  </div>`;

  $('#payBox').innerHTML = `<div class="pay-col">${summary}${transfer}</div>${list}`;
}

document.addEventListener('change', e => {
  if (e.target.id === 'payFor') {
    state.payFor = e.target.value;
    renderPayment();
  }
});

function copyText(text) {
  const done = () => toast('📋 Đã sao chép: ' + text);
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(done, () => {});
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (err) { /* bỏ qua */ }
  ta.remove();
}

/* ---------- 2. Đăng ký ---------- */
function renderRegisterState() {
  const closed = !!state.data.closed;
  $('#regClosed').hidden = !closed;
  $('#regFields').disabled = closed;
  renderComposer();
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
    [st.count, 'đăng ký', COLORS[0]],
    [st.adults, 'người lớn', COLORS[2]],
    [st.children, 'trẻ em', COLORS[4]],
    [st.people, 'tổng', COLORS[1]],
    [new Set(list.map(m => m.room.trim()).filter(Boolean)).size, 'phòng', COLORS[3]],
  ].map(s => `<div class="stat" style="--c:${s[2]}"><b>${s[0]}</b><span>${s[1]}</span></div>`).join('');

  const q = norm($('#memberSearch').value);
  const me = norm(store.get('travel_name'));
  const rows = list
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !q || norm([m.name, m.room, m.note].join(' ')).includes(q));

  // Gom theo cột "Xếp phòng": cùng giá trị = ở chung phòng. Sắp theo số phòng, chưa xếp nằm cuối.
  const groups = new Map();
  rows.forEach(r => {
    const key = r.m.room.trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  const rooms = [...groups.keys()].sort((a, b) =>
    !a ? 1 : !b ? -1 : a.localeCompare(b, 'vi', { numeric: true }));

  const row = ({ m, i }) => {
    const isMe = me && norm(m.name) === me;
    return `<li class="m-row ${isMe ? 'me' : ''}">
      <span class="m-idx">${i + 1}</span>
      <span class="m-who">${avatar(m.name, 'sm')}<b>${esc(m.name)}</b>${isMe ? '<span class="tag" style="--c:var(--coral)">Bạn</span>' : ''}</span>
      <span class="m-det">
        <span class="m-adults" title="Người lớn (tính cả người đăng ký)">${1 + m.adults}</span>
        <span class="m-kids" title="Trẻ em">${m.children}</span>
      </span>
      <span class="m-note">${esc(m.note)}</span>
    </li>`;
  };

  // Desktop: bảng nhiều cột (.m-det bị "trải" thành các cột). Điện thoại: mỗi người 2–3 dòng.
  $('#memberList').innerHTML = rows.length
    ? `<li class="m-row m-head" aria-hidden="true">
         <span class="m-idx">#</span><span class="m-who">Thành viên</span>
         <span class="m-det"><span class="m-adults">Người lớn</span><span class="m-kids">Trẻ em</span></span>
         <span class="m-note">Ghi chú</span>
       </li>` +
      rooms.map((room, gi) => {
        const items = groups.get(room);
        const people = memberStats(items.map(r => r.m)).people;
        const label = !room ? 'Chưa xếp phòng' : /^\d+$/.test(room) ? 'Phòng ' + room : room;
        return `<li class="room-group ${room ? '' : 'unassigned'}" style="--c:${room ? COLORS[gi % COLORS.length] : 'var(--muted)'}">
          <div class="room-head">${room ? '🛏️' : '⏳'} <b>${esc(label)}</b>
            <span>· ${items.length} thành viên${people !== items.length ? ` · ${people} người` : ''}</span></div>
          <ul>${items.map(row).join('')}</ul>
        </li>`;
      }).join('')
    : `<li class="empty">${q ? '🔍 Không tìm thấy ai' : '🙋 Chưa có ai đăng ký, hãy là người đầu tiên!'}</li>`;

  renderBudget();
  renderCrowd();
  renderSubtabs();
}

$('#memberSearch').addEventListener('input', renderMembers);

/* ---------- 4. Trò chuyện ---------- */
const chat = { pending: [], timer: null, stick: false };

// "27/09/2026 10:12:33" -> { day: '27/09/2026', time: '10:12' }
function splitTime(s) {
  const str = String(s || '');
  const t = str.match(/(\d{1,2}):(\d{2})/);
  return { day: str.split(/[ ,T]+/)[0] || '', time: t ? t[1].padStart(2, '0') + ':' + t[2] : '' };
}

// Đã có tên thì ẩn ô nhập tên, chỉ hiện "Đang nhắn với tên …"
function renderComposer() {
  const name = store.get('travel_name');
  $('#nameRow').hidden = !!name;
  $('#meRow').hidden = !name;
  $('#meName').textContent = name;
  if (name) $('#commentForm').elements.namedItem('name').value = name;
}

function renderComments() {
  const box = $('#commentList');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  const { info, members } = state.data;
  const me = norm(store.get('travel_name'));
  // API trả tin mới nhất trước -> đảo lại cho tin cũ ở trên, tin mới ở dưới
  const list = state.data.comments.slice().reverse().concat(chat.pending);

  $('#chatTitle').textContent = info.ten_chuyen_di || 'Trò chuyện';
  $('#chatSub').textContent = members.length
    ? `${memberStats(members).people} thành viên · ${list.length} tin nhắn`
    : 'Hỏi đáp, rủ rê, chia sẻ';
  $('#chatFaces').innerHTML = members.slice(-3).map(m => avatar(m.name, 'sm')).join('');

  // Gom các tin liên tiếp của cùng một người trong cùng một ngày
  const sameGroup = (a, b) => a && b && norm(a.name) === norm(b.name) && splitTime(a.time).day === splitTime(b.time).day;
  let html = '';
  let lastDay = '';
  list.forEach((c, i) => {
    const t = splitTime(c.time);
    if (t.day && t.day !== lastDay) {
      html += `<li class="chat-sep"><span>${esc(t.day)}</span></li>`;
      lastDay = t.day;
    }
    const first = !sameGroup(list[i - 1], c);
    const last = !sameGroup(c, list[i + 1]);
    const mine = me && norm(c.name) === me;
    html += `<li class="msg ${mine ? 'me' : ''} ${first ? 'first' : ''} ${last ? 'last' : ''} ${c.pending ? 'pending' : ''}">
      ${mine ? '' : last ? avatar(c.name, 'sm') : '<span class="avatar-gap"></span>'}
      <div class="msg-body">
        ${first && !mine ? `<div class="msg-name">${esc(c.name)}</div>` : ''}
        <div class="bubble">${esc(c.content)}</div>
        ${last ? `<div class="msg-time">${c.pending ? '🕓' : esc(t.time)}</div>` : ''}
      </div>
    </li>`;
  });
  box.innerHTML = html || '<li class="chat-empty">🦗 Im ắng quá… mở hàng đi nè!</li>';
  if (nearBottom || chat.stick) {
    box.scrollTop = box.scrollHeight;
    chat.stick = false;
  }
}

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

const composerText = $('#commentForm').elements.namedItem('content');
composerText.addEventListener('input', () => autoGrow(composerText));
// Máy tính: Enter để gửi, Shift+Enter xuống dòng. Bỏ qua khi bộ gõ tiếng Việt đang ghép chữ.
composerText.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches) {
    e.preventDefault();
    const form = $('#commentForm');
    form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
  }
});

$('#changeName').addEventListener('click', () => {
  store.set('travel_name', '');
  const input = $('#commentForm').elements.namedItem('name');
  input.value = '';
  renderComposer();
  input.focus();
});

$('#commentForm').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  const nameInput = form.elements.namedItem('name');
  const errBox = $('#commentError');
  const data = { name: (store.get('travel_name') || nameInput.value).trim(), content: composerText.value.trim() };
  if (!data.name) {
    errBox.textContent = 'Nhập tên của bạn trước nhé';
    errBox.hidden = false;
    nameInput.focus();
    return;
  }
  if (!data.content) return;
  errBox.hidden = true;
  store.set('travel_name', data.name);
  renderComposer();

  // Hiện tin ngay (mờ) trong lúc chờ server lưu
  const msg = { name: data.name, content: data.content, time: '', pending: true };
  chat.pending.push(msg);
  composerText.value = '';
  autoGrow(composerText);
  chat.stick = true;
  renderComments();

  call('addComment', data)
    .then(comments => { state.data.comments = comments; })
    .catch(err => {
      errBox.textContent = 'Gửi không được: ' + err.message;
      errBox.hidden = false;
      if (!composerText.value) composerText.value = data.content;
    })
    .finally(() => {
      chat.pending = chat.pending.filter(m => m !== msg);
      chat.stick = true;
      renderComments();
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
  const cp = t.closest('[data-copy]');
  if (cp) return copyText(cp.dataset.copy);
  const rf = t.closest('[data-refresh]');
  if (rf) refresh(rf.dataset.refresh, rf);
});

$('#retryBtn').addEventListener('click', load);
load();
