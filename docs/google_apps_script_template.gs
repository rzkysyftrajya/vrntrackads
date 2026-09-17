/**
 * VRN Track Ads — Google Apps Script
 * ====================================
 * Otomatis mencatat data klik iklan ke Google Sheets.
 * Baris SPAM_SUSPECT akan berwarna MERAH otomatis.
 *
 * CARA DEPLOY:
 * 1. Isi SPREADSHEET_ID di bawah dengan ID spreadsheet Anda
 * 2. Klik Deploy → New deployment → Web app
 * 3. Execute as: Me | Who has access: Anyone
 * 4. Salin URL-nya dan tempel ke Settings dashboard VRN Track Ads
 *
 * Lihat panduan lengkap di: docs/panduan_google_sheets.md
 */

// ══════════════════════════════════════════════════════
//  ⚙️  KONFIGURASI — HANYA UBAH BAGIAN INI
// ══════════════════════════════════════════════════════

var SPREADSHEET_ID = 'GANTI_DENGAN_ID_SPREADSHEET_ANDA';
//   ↑ Ganti ini dengan ID dari URL spreadsheet Anda
//   Contoh: var SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms';

var SHEET_NAME = 'TrackLog';
//   ↑ Nama tab di dalam spreadsheet. Biarkan saja kalau tidak mau diubah.

// ══════════════════════════════════════════════════════
//  🎨  PENGATURAN WARNA (opsional, bisa dibiarkan)
// ══════════════════════════════════════════════════════

var WARNA_SPAM    = '#FF0000';  // Merah  → klik mencurigakan (SPAM_SUSPECT)
var WARNA_BARIS_1 = '#FFFFFF';  // Putih  → baris ganjil normal
var WARNA_BARIS_2 = '#F5F5F5';  // Abu    → baris genap normal

// ══════════════════════════════════════════════════════
//  📋  NAMA KOLOM DI SPREADSHEET (jangan diubah)
// ══════════════════════════════════════════════════════

var KOLOM = [
  'Timestamp',        // Waktu kejadian
  'Event',            // impression / click
  'Status',           // OK / SPAM_SUSPECT
  'Spam?',            // TRUE / FALSE
  'Alasan Deteksi',   // Kenapa dianggap spam
  'IP Address',       // Alamat IP pengunjung
  'Negara',
  'Kota',
  'Perangkat',        // Mobile / Desktop / Tablet
  'Browser',          // Chrome / Firefox / dll
  'Halaman Landing',  // URL halaman yang dikunjungi
  'Referrer',         // Dari mana pengunjung datang
  'GCLID',            // ID klik Google Ads
  'UTM Source',
  'UTM Medium',
  'UTM Campaign',
  'Keyword',
  'Tracking Key',
  'User ID',
  'Session ID',
  'Fingerprint',
  'Elemen Diklik',
  'Teks Elemen',
];

// ══════════════════════════════════════════════════════
//  🚀  KODE UTAMA — JANGAN DIUBAH
// ══════════════════════════════════════════════════════

function doPost(e) {
  try {
    // Terima data dari server VRN Track Ads
    var raw  = e.postData ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    // Buka spreadsheet berdasarkan ID
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);

    // Kalau tab 'TrackLog' belum ada, buat otomatis beserta header-nya
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(KOLOM);
      sheet.setFrozenRows(1); // Freeze baris header agar tidak ikut scroll

      // Kasih warna biru tua pada baris header
      sheet.getRange(1, 1, 1, KOLOM.length)
        .setBackground('#1a237e')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');

      // Lebarkan kolom tertentu agar tidak terpotong
      sheet.setColumnWidth(1,  160); // Timestamp
      sheet.setColumnWidth(11, 300); // Halaman Landing
      sheet.setColumnWidth(12, 200); // Referrer
    }

    // Ambil nilai status dari data yang diterima
    var status     = data.status            || 'OK';
    var isSpam     = data.spam_suspect      || false;
    var alasanSpam = data.detection_reasons || '-';

    // Susun data sesuai urutan KOLOM
    var baris = [
      data.timestamp     || new Date().toISOString(),
      data.event         || '',
      status,
      isSpam ? 'TRUE' : 'FALSE',
      alasanSpam,
      data.ip_address    || '',
      data.country       || '',
      data.city          || '',
      data.device        || '',
      data.browser       || '',
      data.landing_page  || '',
      data.referrer      || '',
      data.gclid         || '',
      data.utm_source    || '',
      data.utm_medium    || '',
      data.utm_campaign  || '',
      data.keyword       || '',
      data.tracking_key  || '',
      data.user_id       || '',
      data.session_id    || '',
      data.fingerprint   || '',
      data.click_target  || '',
      data.target_text   || '',
    ];

    // Tulis baris ke spreadsheet
    sheet.appendRow(baris);

    // ── Warnai baris berdasarkan status ─────────────────────────────────
    var noBarisAkhir = sheet.getLastRow();
    var rangeWarna   = sheet.getRange(noBarisAkhir, 1, 1, KOLOM.length);

    if (status === 'SPAM_SUSPECT' || isSpam === true || isSpam === 'true') {
      // 🔴 SPAM_SUSPECT → Merah mencolok + teks putih tebal agar mudah dikenali
      rangeWarna
        .setBackground(WARNA_SPAM)
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');
    } else {
      // ⚪ Normal → Alternating putih/abu untuk keterbacaan
      var warnaNormal = (noBarisAkhir % 2 === 0) ? WARNA_BARIS_2 : WARNA_BARIS_1;
      rangeWarna
        .setBackground(warnaNormal)
        .setFontColor('#212121')
        .setFontWeight('normal');
    }

    // Kirim respons sukses ke server
    return ContentService
      .createTextOutput(JSON.stringify({ sukses: true, status: status }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // Kalau ada error, catat di log dan kirim respons error
    console.error('VRN Track Ads — Error:', err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ sukses: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Health check — bisa diakses via browser untuk memastikan script aktif
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      pesan: 'VRN Track Ads Script aktif ✅'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
