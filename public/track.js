(function () {
  'use strict';

  // 1. Ambil script tag & Tracking Key
  var currentScript = document.currentScript || document.querySelector('script[data-tracking-id]');
  var trackingKey = currentScript ? currentScript.getAttribute('data-tracking-id') : null;

  if (!trackingKey) {
    console.error('[VRN Track] Error: attribute data-tracking-id tidak ditemukan!');
    return;
  }

  // 2. Parse URL Parameters (UTM, GCLID, Keyword)
  var urlParams = new URLSearchParams(window.location.search);
  var gclid = urlParams.get('gclid') || '';
  var utmSource = urlParams.get('utm_source') || '';
  var utmMedium = urlParams.get('utm_medium') || '';
  var utmCampaign = urlParams.get('utm_campaign') || '';
  var keyword = urlParams.get('keyword') || urlParams.get('utm_term') || '';

  // 3. Buat Session ID sederhana
  var sessionId = localStorage.getItem('vrn_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('vrn_session_id', sessionId);
  }

  // Target Endpoint API Vercel kamu
  var ENDPOINT = '/api/public/track';

  // Fungsi pengiriman payload
  function sendEvent(eventType, extraData) {
    var payload = Object.assign({
      event: eventType,
      tracking_key: trackingKey,
      session_id: sessionId,
      landing_page: window.location.href,
      page_url: window.location.href,
      referrer: document.referrer || '',
      gclid: gclid,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      keyword: keyword,
      user_agent: navigator.userAgent
    }, extraData || {});

    var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, blob);
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function (err) {
        console.error('[VRN Track] Fetch error:', err);
      });
    }
  }

  // 4. Kirim Page View saat halaman dimuat
  sendEvent('page_view');

  // 5. Track Klik (Contoh: Tombol WhatsApp / Telepon)
  document.addEventListener('click', function (e) {
    var target = e.target.closest('a, button');
    if (!target) return;

    var href = target.getAttribute('href') || '';
    var text = (target.innerText || target.textContent || '').trim();

    if (href.includes('wa.me') || href.includes('whatsapp.com') || href.startsWith('tel:')) {
      sendEvent('click', {
        element_text: text,
        element_href: href
      });
    }
  }, true);

})();