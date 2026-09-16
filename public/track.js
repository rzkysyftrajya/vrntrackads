/**
 * VRN TRACK ADS — Tracking SDK v1.0
 * Auto-detects URL parameters (gclid, utm_source, utm_medium, utm_campaign, keyword),
 * device, referrer, and landing page. Fires impression on load and click on CTA links.
 *
 * Usage: <script src="https://YOUR_DOMAIN/track.js" data-tracking-id="TRACKING_KEY"></script>
 */
(function () {
  var scriptEl = document.currentScript || document.querySelector('script[data-tracking-id]');
  if (!scriptEl) return;
  var trackingKey = scriptEl.getAttribute('data-tracking-id');
  if (!trackingKey) return;

  var endpoint = scriptEl.getAttribute('data-endpoint');
  if (!endpoint) {
    if (scriptEl.src && scriptEl.src.indexOf('http') === 0) {
      endpoint = scriptEl.src.replace(/\/track\.js.*$/, '/api/public/track');
    } else {
      endpoint = '/api/public/track';
    }
  }

  function getParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  function detectDevice() {
    var ua = navigator.userAgent;
    if (/iPad|Tablet/i.test(ua)) return 'Tablet';
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  function detectBrowser() {
    var ua = navigator.userAgent;
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/OPR\//i.test(ua)) return 'Opera';
    if (/Chrome\//i.test(ua)) return 'Chrome';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    if (/Safari\//i.test(ua)) return 'Safari';
    return 'Unknown';
  }

  var payload = {
    tracking_key: trackingKey,
    landing_page: window.location.href,
    referrer: document.referrer || '',
    device: detectDevice(),
    browser: detectBrowser(),
    gclid: getParam('gclid'),
    utm_source: getParam('utm_source'),
    utm_medium: getParam('utm_medium'),
    utm_campaign: getParam('utm_campaign'),
    keyword: getParam('keyword'),
  };

  function sendEvent(event, extra) {
    var data = Object.assign({}, payload, { event: event }, extra || {});
    var body = JSON.stringify(data);
    try {
      if (window.fetch) {
        window.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true,
        }).catch(function() {
          sendFallback(endpoint, body);
        });
      } else {
        sendFallback(endpoint, body);
      }
    } catch (e) {
      sendFallback(endpoint, body);
    }
  }

  function sendFallback(url, body) {
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(body);
      }
    } catch (_) {}
  }

  // Fire impression on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { sendEvent('impression'); });
  } else {
    sendEvent('impression');
  }

  // Fire click on CTA links / buttons with data-vrn-cta or common CTA patterns
  document.addEventListener('click', function (e) {
    var target = e.target;
    var el = target && target.closest ? target.closest('a, button, [data-vrn-cta], [role="button"]') : null;
    if (el) {
      sendEvent('click', {
        gclid: payload.gclid,
        utm_source: payload.utm_source,
        utm_medium: payload.utm_medium,
        utm_campaign: payload.utm_campaign,
        keyword: payload.keyword,
      });
    }
  }, true);
})();
