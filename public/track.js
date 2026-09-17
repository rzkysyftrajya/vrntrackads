(function () {
  'use strict';

  var currentScript = document.currentScript || document.querySelector('script[data-tracking-id]');
  var trackingKey = currentScript ? currentScript.getAttribute('data-tracking-id') : null;

  if (!trackingKey) return;

  var urlParams = new URLSearchParams(window.location.search);
  var sessionId = localStorage.getItem('vrn_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('vrn_session_id', sessionId);
  }

 var ENDPOINT = 'https://vrnadvertiser.vercel.app/api/public/track';

  function sendEvent(eventType, extraData) {
    var payload = Object.assign({
      event: eventType,
      tracking_key: trackingKey,
      session_id: sessionId,
      page_url: window.location.href,
      referrer: document.referrer || '',
      gclid: urlParams.get('gclid') || '',
      utm_source: urlParams.get('utm_source') || '',
      utm_medium: urlParams.get('utm_medium') || '',
      utm_campaign: urlParams.get('utm_campaign') || '',
      utm_content: urlParams.get('utm_content') || '',
      utm_term: urlParams.get('utm_term') || '',
      keyword: urlParams.get('keyword') || urlParams.get('utm_term') || '',
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
      }).catch(function () {});
    }
  }

  sendEvent('page_view');

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