(function () {
  'use strict';

  var script = document.currentScript;
  var trackingKey = script && script.getAttribute('data-tracking-id');

  if (!trackingKey || trackingKey === 'YOUR_TRACKING_KEY') {
    return;
  }

  var endpoint = (script && script.src
    ? new URL(script.src).origin
    : window.location.origin) + '/api/public/track';
  var urlParams = new URLSearchParams(window.location.search);
  var sessionId;

  try {
    sessionId = sessionStorage.getItem('vrn_track_session_id');
    if (!sessionId) {
      sessionId = 'vrn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      sessionStorage.setItem('vrn_track_session_id', sessionId);
    }
  } catch (error) {
    sessionId = 'vrn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
  }

  function isBot() {
    var userAgent = navigator.userAgent || '';
    return Boolean(
      navigator.webdriver ||
      /bot|crawler|spider|headless|puppeteer|selenium|playwright|phantom|curl|wget/i.test(userAgent)
    );
  }

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
      user_agent: navigator.userAgent || '',
      is_bot: isBot()
    }, extraData || {});

    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      try {
        var sent = navigator.sendBeacon(
          endpoint,
          new Blob([body], { type: 'application/json' })
        );
        if (sent) return;
      } catch (error) {
        // Fall through to fetch when Beacon is unavailable or rejected.
      }
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true
    }).catch(function () {});
  }

  function trackClick(data) {
    sendEvent('click', data);
  }

  window.VRNTrack = {
    trackClick: trackClick
  };

  function captureClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var element = target.closest('[data-vrn-click], a[href^="https://wa.me/"], a[href^="https://api.whatsapp.com/"], a[href^="tel:"]');
    if (!element) return;

    trackClick({
      click_target: element.getAttribute('data-vrn-click') || element.getAttribute('href') || element.tagName.toLowerCase(),
      landing_page: window.location.href
    });
  }

  function initialize() {
    sendEvent('page_view');
    document.addEventListener('click', captureClick, { passive: true, capture: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
}());
