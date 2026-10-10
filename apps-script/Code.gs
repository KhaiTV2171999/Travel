/**
 * Ứng dụng đăng ký du lịch — backend API trên Google Apps Script.
 * Dữ liệu lấy từ Google Sheet, ảnh lấy từ Google Drive.
 * Giao diện (index.html, styles.css, app.js) đặt ở hosting tĩnh và gọi API này.
 *
 * Hướng dẫn cài đặt: xem README.md
 */

// Để trống nếu script được tạo từ Google Sheet (Tiện ích mở rộng > Apps Script).
// Nếu tạo script riêng, dán ID của Google Sheet vào đây.
const SHEET_ID = '';

const LIMITS = { name: 100, note: 500, comment: 1000, people: 20 };

// Bộ nhớ đệm để trả dữ liệu nhanh, không phải đọc Sheet mỗi lần.
// Sửa tay trong Sheet sẽ hiện trên app sau tối đa CACHE_TTL giây (hoặc chạy hàm clearCache).
const CACHE_TTL = 60;

// Tên sheet và cột. Code so khớp tên sheet/cột không phân biệt hoa thường và dấu,
// nên có thể viết "Đăng ký" hay "dang ky" đều được, và thứ tự cột có thể thay đổi.
const SCHEMA = {
  info: {
    name: 'Thông tin',
    headers: ['Mục', 'Giá trị'],
    sample: [
      ['Tên chuyến đi', 'Du lịch Đà Lạt 3 ngày 2 đêm'],
      ['Địa điểm', 'Đà Lạt, Lâm Đồng'],
      ['Ngày đi', new Date(2026, 9, 16)],
      ['Ngày về', new Date(2026, 9, 18)],
      ['Giờ tập trung', "'05:30"],
      ['Điểm tập trung', 'Sảnh công ty, 123 Nguyễn Trãi, Quận 1'],
      ['Hạn đăng ký', new Date(2026, 9, 10)],
      ['Liên hệ', 'Anh Minh - 0901 234 567'],
      ['Ảnh bìa', ''],
      ['Thư mục ảnh', ''],
      ['Giới thiệu', 'Chuyến nghỉ dưỡng cuối năm cùng gia đình: săn mây, cà phê view đồi thông, BBQ tối và tham quan các điểm nổi tiếng của Đà Lạt.'],
      ['Tạm thu', 2500000],
      ['Thực tế', ''],
      ['Ngân hàng', 'MB'],
      ['Số tài khoản', "'0123456789"],
      ['Chủ tài khoản', 'NGUYEN VAN MINH'],
    ],
  },
  guide: {
    name: 'Guide',
    headers: ['Tiêu đề', 'Nội dung', 'Ảnh'],
    sample: [
      ['Hồ Xuân Hương', 'Hồ nước trung tâm thành phố, đi bộ hoặc đạp vịt quanh hồ vào sáng sớm rất đẹp.', ''],
      ['Đồi chè Cầu Đất', 'Săn mây lúc 5h–6h sáng. Nên mang áo khoác dày vì trời lạnh.', ''],
      ['Chợ đêm Đà Lạt', 'Ăn bánh tráng nướng, sữa đậu nành nóng, mua đặc sản mứt và atiso.', ''],
    ],
  },
  food: {
    name: 'Ăn uống',
    headers: ['Tên', 'Mô tả', 'Địa chỉ', 'Ảnh'],
    sample: [
      ['Bánh căn Nhà Chung', 'Bánh căn nóng giòn chấm nước mắm xíu mại, ăn sáng rất hợp.', '1 Nhà Chung, Phường 3, Đà Lạt', ''],
      ['Lẩu gà lá é Tao Ngộ', 'Lẩu gà nấu lá é thơm, hợp trời lạnh buổi tối.', '5 Bà Triệu, Phường 3, Đà Lạt', ''],
      ['Kem bơ Thanh Thảo', 'Kem bơ dẻo béo, món tráng miệng nổi tiếng.', '76 Nguyễn Văn Trỗi, Phường 2, Đà Lạt', ''],
    ],
  },
  hotel: {
    name: 'Khách sạn',
    headers: ['Tên', 'Mô tả', 'Địa chỉ', 'Điện thoại', 'Ảnh'],
    sample: [
      ['Khách sạn Colline', 'Nhận phòng 14:00, trả phòng 12:00. Gần chợ Đà Lạt, có ăn sáng.', '10 Phan Bội Châu, Phường 1, Đà Lạt', "'0263 3665 777", ''],
    ],
  },
  schedule: {
    name: 'Lịch trình',
    headers: ['Ngày', 'Giờ', 'Hoạt động', 'Địa điểm', 'Ghi chú', 'Ảnh'],
    sample: [
      ['Ngày 1 (16/10)', "'05:30", 'Tập trung, khởi hành', 'Sảnh công ty', 'Có mặt trước 15 phút', ''],
      ['', "'12:00", 'Ăn trưa', 'Bảo Lộc', '', ''],
      ['', "'15:00", 'Nhận phòng khách sạn', 'Trung tâm Đà Lạt', '', ''],
      ['', "'19:00", 'Ăn tối, dạo chợ đêm', 'Chợ Đà Lạt', 'Tự do', ''],
      ['Ngày 2 (17/10)', "'05:00", 'Săn mây', 'Đồi chè Cầu Đất', 'Mang áo ấm', ''],
      ['', "'18:30", 'Tiệc BBQ + giao lưu', 'Khách sạn', '', ''],
      ['Ngày 3 (18/10)', "'09:00", 'Trả phòng, mua đặc sản', 'Chợ Đà Lạt', '', ''],
      ['', "'18:00", 'Về đến điểm tập trung', 'Sảnh công ty', '', ''],
    ],
  },
  budget: {
    name: 'Khái toán',
    aliases: ['Kinh phí'], // tên cũ
    headers: ['Hạng mục', 'Số tiền', 'Ghi chú'],
    sample: [
      ['Xe 45 chỗ khứ hồi', 18000000, ''],
      ['Khách sạn 2 đêm', 30000000, '15 phòng'],
      ['Ăn uống', 20000000, '6 bữa chính'],
      ['Vé tham quan', 5000000, ''],
      ['Dự phòng', 3000000, ''],
    ],
  },
  expense: {
    name: 'Chi tiêu',
    headers: ['Ngày', 'Nội dung', 'Nhóm', 'Số tiền', 'Người chi', 'Ghi chú', 'Ảnh'],
    sample: [
      [new Date(2026, 9, 16), 'Thuê xe 29 chỗ', 'Di chuyển', 4000000, 'Quỹ', '', ''],
      [new Date(2026, 9, 16), 'Ăn trưa nhà hàng', 'Ăn uống', 2400000, 'Quỹ', '20 suất', ''],
    ],
  },
  members: {
    name: 'Đăng ký',
    headers: ['Thời gian', 'Tên', 'Có người nhà', 'Số người lớn', 'Số trẻ em', 'Ghi chú', 'Xếp phòng', 'Đã nộp', 'Tự báo nộp'],
    sample: [],
  },
  comments: {
    name: 'Bình luận',
    headers: ['Thời gian', 'Tên', 'Nội dung'],
    sample: [],
  },
};

/* ---------- API JSON (giao diện index.html / app.js gọi vào đây) ---------- */

// GET ?action=data | members | comments | expenses
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'data';
  return json_(() => {
    if (action === 'data') return getData();
    if (action === 'members') return getMembers();
    if (action === 'comments') return getComments();
    if (action === 'expenses') return getExpenses();
    throw new Error('Yêu cầu không hợp lệ');
  });
}

// POST body: { action: 'register' | 'comment' | 'markPaid', data: {...} }
function doPost(e) {
  return json_(() => {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'register') return register(body.data);
    if (body.action === 'comment') return addComment(body.data);
    if (body.action === 'markPaid') return markPaid(body.data);
    throw new Error('Yêu cầu không hợp lệ');
  });
}

function json_(fn) {
  let out;
  try {
    out = { ok: true, data: fn() };
  } catch (err) {
    out = { ok: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Xử lý dữ liệu ---------- */

function readTrip_() {
  const info = getInfo_();
  info.anh_bia = imageUrl_(info.anh_bia);
  const deadline = deadline_();

  let day = '';
  const schedule = rows_(SCHEMA.schedule.name)
    .map(r => {
      if (r.ngay) day = r.ngay;
      return {
        day: day,
        time: r.gio || '',
        activity: r.hoat_dong || '',
        place: r.dia_diem || '',
        note: r.ghi_chu || '',
        image: imageUrl_(r.anh),
      };
    })
    .filter(s => s.activity || s.place);

  return {
    info: info,
    closed: !!(deadline && new Date() > deadline),
    gallery: gallery_(info.thu_muc_anh),
    guide: rows_(SCHEMA.guide.name)
      .map(r => ({ title: r.tieu_de || '', content: r.noi_dung || '', image: imageUrl_(r.anh) }))
      .filter(g => g.title || g.content),
    food: rows_(SCHEMA.food.name)
      .map(r => ({ title: r.ten || '', content: r.mo_ta || '', address: r.dia_chi || '', image: imageUrl_(r.anh) }))
      .filter(f => f.title),
    hotel: rows_(SCHEMA.hotel.name)
      .map(r => ({ title: r.ten || '', content: r.mo_ta || '', address: r.dia_chi || '', phone: r.dien_thoai || '', image: imageUrl_(r.anh) }))
      .filter(h => h.title),
    schedule: schedule,
    expenses: rows_(SCHEMA.expense.name)
      .map(r => ({ date: r.ngay || '', item: r.noi_dung || '', group: r.nhom || 'Khác', amount: money_(r.so_tien),
                   payer: r.nguoi_chi || '', note: r.ghi_chu || '', image: imageUrl_(r.anh) }))
      .filter(x => x.item || x.amount),
    budget: rows_([SCHEMA.budget.name].concat(SCHEMA.budget.aliases))
      .map(r => ({ item: r.hang_muc || '', amount: money_(r.so_tien), note: r.ghi_chu || '' }))
      .filter(b => b.item),
  };
}

// Phần thông tin chuyến đi (ít thay đổi) được cache; danh sách và tin nhắn cache riêng
function getData() {
  const trip = cached_('trip', readTrip_);
  trip.members = getMembers();
  trip.comments = getComments();
  return trip;
}

function getMembers() {
  return cached_('members', readMembers_);
}

function getComments() {
  return cached_('comments', readComments_);
}

function getExpenses() {
  return cached_('trip', readTrip_).expenses || [];
}

// Chạy tay trong trình soạn thảo Apps Script khi muốn app thấy ngay dữ liệu vừa sửa trong Sheet
function clearCache() {
  CacheService.getScriptCache().removeAll(['trip', 'members', 'comments']);
}

function readMembers_() {
  return rows_(SCHEMA.members.name)
    .map(r => ({
      time: r.thoi_gian || '',
      name: r.ten || '',
      family: /^(co|x|true|yes|1)$/.test(key_(r.co_nguoi_nha || '')),
      adults: toInt_(r.so_nguoi_lon),
      children: toInt_(r.so_tre_em),
      note: r.ghi_chu || '',
      // Cột "Xếp phòng" (người tổ chức tự ghi). Sheet cũ còn 2 cột "Loại phòng" + "Ở cùng" thì ghép lại.
      room: r.xep_phong || [r.loai_phong, r.o_cung && 'ở cùng ' + r.o_cung].filter(Boolean).join(', '),
      paid: money_(r.da_nop), // số tiền đã nộp, người tổ chức tự ghi (đã kiểm tra)
      claimed: money_(r.tu_bao_nop), // số tiền thành viên tự báo đã chuyển (chưa kiểm tra)
    }))
    .filter(m => m.name);
}

function readComments_() {
  return rows_(SCHEMA.comments.name)
    .map(r => ({ time: r.thoi_gian || '', name: r.ten || '', content: r.noi_dung || '' }))
    .filter(c => c.content)
    .reverse()
    .slice(0, 200);
}

function register(form) {
  form = form || {};
  const name = clean_(form.name, LIMITS.name);
  if (!name) throw new Error('Vui lòng nhập tên thành viên');
  const family = form.family === true;
  const adults = family ? clampInt_(form.adults) : 0;
  const children = family ? clampInt_(form.children) : 0;
  if (family && adults + children === 0) {
    throw new Error('Vui lòng nhập số người lớn hoặc trẻ em đi cùng');
  }
  const note = clean_(form.note, LIMITS.note);
  const deadline = deadline_();
  if (deadline && new Date() > deadline) throw new Error('Đã hết hạn đăng ký');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (readMembers_().some(m => key_(m.name) === key_(name))) {
      throw new Error('"' + name + '" đã có trong danh sách đăng ký');
    }
    appendRow_(ensureSheet_(SCHEMA.members), {
      thoi_gian: new Date(),
      ten: name,
      co_nguoi_nha: family ? 'Có' : 'Không',
      so_nguoi_lon: adults,
      so_tre_em: children,
      ghi_chu: note,
    });
    return refreshCache_('members', readMembers_);
  } finally {
    lock.releaseLock();
  }
}

function addComment(data) {
  data = data || {};
  const name = clean_(data.name, LIMITS.name);
  const content = clean_(data.content, LIMITS.comment);
  if (!name) throw new Error('Vui lòng nhập tên');
  if (!content) throw new Error('Vui lòng nhập nội dung bình luận');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    appendRow_(ensureSheet_(SCHEMA.comments), { thoi_gian: new Date(), ten: name, noi_dung: content });
    return refreshCache_('comments', readComments_);
  } finally {
    lock.releaseLock();
  }
}

// Thành viên tự tích "đã nộp" / bỏ tích. Số tiền do server tự tính theo Thực tế (hoặc Tạm thu),
// ghi vào cột "Tự báo nộp" -- cột "Đã nộp" vẫn do người tổ chức kiểm tra và tự ghi.
function markPaid(data) {
  data = data || {};
  const name = clean_(data.name, LIMITS.name);
  if (!name) throw new Error('Thiếu tên');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = ensureSheet_(SCHEMA.members);
    let headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(key_);
    let col = headers.indexOf('tu_bao_nop') + 1;
    if (!col) { // Sheet cũ chưa có cột này thì tự thêm vào cuối
      col = sh.getLastColumn() + 1;
      sh.getRange(1, col).setValue('Tự báo nộp').setFontWeight('bold');
      headers = headers.concat('tu_bao_nop');
    }
    const nameCol = headers.indexOf('ten');
    const adultCol = headers.indexOf('so_nguoi_lon');
    const values = sh.getDataRange().getValues();
    const i = values.findIndex((r, idx) => idx > 0 && key_(r[nameCol]) === key_(name));
    if (i < 1) throw new Error('Không tìm thấy "' + name + '" trong danh sách đăng ký');

    let amount = '';
    if (data.paid === true) {
      const info = getInfo_();
      const per = infoMoney_(info, 'thuc_te') || infoMoney_(info, 'tam_thu') || infoMoney_(info, 'phi_nguoi_lon');
      if (!per) throw new Error('Chưa có số tiền Tạm thu');
      amount = (1 + toInt_(values[i][adultCol])) * per;
    }
    sh.getRange(i + 1, col).setValue(amount);
    return refreshCache_('members', readMembers_);
  } finally {
    lock.releaseLock();
  }
}

// Khớp cả "Tạm thu" lẫn "Tạm thu mỗi người lớn"
function infoMoney_(info, key) {
  const k = Object.keys(info).find(x => x === key || x.indexOf(key + '_') === 0);
  return k ? money_(info[k]) : 0;
}

/* ---------- Khởi tạo sheet mẫu: chạy 1 lần trong trình soạn thảo Apps Script ---------- */

function setupSheets() {
  Object.keys(SCHEMA).forEach(k => {
    const def = SCHEMA[k];
    if (sheet_([def.name].concat(def.aliases || []))) return;
    const sh = ensureSheet_(def);
    if (def.sample.length) {
      sh.getRange(2, 1, def.sample.length, def.headers.length).setValues(def.sample);
      def.sample.forEach((row, i) => row.forEach((v, j) => {
        if (v instanceof Date) sh.getRange(i + 2, j + 1).setNumberFormat('dd/MM/yyyy');
      }));
    }
    sh.autoResizeColumns(1, def.headers.length);
  });
  const blank = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('Trang tính1');
  if (blank && blank.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(blank);
}

/* ---------- Helpers ---------- */

let ss__ = null;
function ss_() {
  if (!ss__) ss__ = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  return ss__;
}

// Lấy từ cache, không có thì đọc Sheet rồi lưu vào cache
function cached_(key, read) {
  const hit = CacheService.getScriptCache().get(key);
  if (hit) return JSON.parse(hit);
  return refreshCache_(key, read);
}

function refreshCache_(key, read) {
  const value = read();
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(value), CACHE_TTL);
  } catch (err) {
    console.warn('Không lưu được cache ' + key + ': ' + err.message); // vd dữ liệu quá 100KB
  }
  return value;
}

// "Số người lớn" -> "so_nguoi_lon"
function key_(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// name: một tên hoặc danh sách tên (tên mới + tên cũ)
function sheet_(name) {
  const keys = [].concat(name).map(key_);
  return ss_().getSheets().find(s => keys.indexOf(key_(s.getName())) >= 0) || null;
}

function ensureSheet_(def) {
  let sh = sheet_(def.name);
  if (sh) return sh;
  sh = ss_().insertSheet(def.name);
  sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

// Đọc sheet thành mảng object, key là tên cột đã chuẩn hoá. Dùng giá trị hiển thị
// để ngày/giờ/tiền hiện đúng như trong Google Sheet.
function rows_(name) {
  const sh = sheet_(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getDisplayValues();
  const headers = values[0].map(key_);
  return values.slice(1)
    .filter(r => r.some(c => String(c).trim() !== ''))
    .map(r => {
      const o = {};
      headers.forEach((h, i) => { if (h) o[h] = String(r[i]).trim(); });
      return o;
    });
}

// Sheet "Thông tin" dạng 2 cột: Mục | Giá trị
function getInfo_() {
  const sh = sheet_(SCHEMA.info.name);
  const info = {};
  if (!sh || sh.getLastRow() < 2) return info;
  sh.getDataRange().getDisplayValues().slice(1).forEach(r => {
    const k = key_(r[0]);
    if (k) info[k] = String(r[1]).trim();
  });
  return info;
}

function deadline_() {
  const sh = sheet_(SCHEMA.info.name);
  if (!sh || sh.getLastRow() < 2) return null;
  const row = sh.getDataRange().getValues().find(r => key_(r[0]) === 'han_dang_ky');
  if (!row || !(row[1] instanceof Date)) return null;
  const d = new Date(row[1]);
  if (d.getHours() === 0 && d.getMinutes() === 0) d.setHours(23, 59, 59);
  return d;
}

function appendRow_(sh, obj) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(key_);
  sh.appendRow(headers.map(h => (h in obj ? obj[h] : '')));
}

function clean_(v, max) {
  const s = String(v == null ? '' : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
  // Chặn chèn công thức vào Google Sheet
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function toInt_(v) {
  const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function clampInt_(v) {
  const n = Math.floor(Number(v)) || 0;
  return Math.max(0, Math.min(LIMITS.people, n));
}

function money_(v) {
  const n = Number(String(v == null ? '' : v).replace(/[^\d-]/g, ''));
  return isFinite(n) ? n : 0;
}

function driveId_(v) {
  const m = String(v || '').match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

// Nhận link Google Drive / ID file / URL ảnh bất kỳ -> URL ảnh hiển thị được
function imageUrl_(v) {
  v = String(v || '').trim();
  if (!v) return '';
  if (/^https?:\/\//.test(v) && !/(drive|docs)\.google\.com/.test(v)) return v;
  const id = driveId_(v);
  return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200' : '';
}

// Lấy toàn bộ ảnh trong 1 thư mục Drive (cache 10 phút)
function gallery_(folder) {
  const id = driveId_(folder);
  if (!id) return [];
  const cache = CacheService.getScriptCache();
  const hit = cache.get('gallery_' + id);
  if (hit) return JSON.parse(hit);
  try {
    const files = [];
    const it = DriveApp.getFolderById(id).getFiles();
    while (it.hasNext() && files.length < 60) {
      const f = it.next();
      if (f.getMimeType().indexOf('image/') === 0) files.push({ name: f.getName(), url: imageUrl_(f.getId()) });
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    cache.put('gallery_' + id, JSON.stringify(files), 600);
    return files;
  } catch (err) {
    console.warn('Không đọc được thư mục ảnh: ' + err.message);
    return [];
  }
}
