/**
 * VRN TRACK ADS — Tracking SDK v1.0
 * Auto-detects URL parameters (gclid, utm_source, utm_medium, utm_campaign, keyword),
 * device, referrer, and landing page. Fires impression on load and click on CTA links.
 *
 * Usage: <script src="https://YOUR_DOMAIN/track.js" data-tracking-id="TRACKING_KEY"></script>
 */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var scriptEl = document.currentScript || document.querySelector('script[data-tracking-id]');
  if (!scriptEl) return;
  var trackingKey = scriptEl.getAttribute('data-tracking-id');
  if (!trackingKey) return;

  var supabaseEdgeUrl = 'https://qtgbuacxiuntczeaqlqi.supabase.co/functions/v1/track';
  var endpoint = scriptEl.getAttribute('data-endpoint');
  if (!endpoint) {
    if (scriptEl.src && scriptEl.src.indexOf('http') === 0) {
      endpoint = scriptEl.src.replace(/\/track\.js.*$/, '/api/public/track');
    } else {
      endpoint = '/api/public/track';
    }
  }

  function getParam(name) {
    try {
      var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
    } catch (_) {
      return '';
    }
  }

  function detectDevice() {
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet/i.test(ua)) return 'Tablet';
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  function detectBrowser() {
    var ua = navigator.userAgent || '';
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
    
    // Try primary endpoint first, with fallback to Supabase Edge Function
    var targetUrls = [endpoint, supabaseEdgeUrl];
    if (endpoint === supabaseEdgeUrl) targetUrls = [supabaseEdgeUrl];

    function tryNext(index) {
      if (index >= targetUrls.length) return;
      var targetUrl = targetUrls[index];

      try {
        if (window.fetch) {
          window.fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            keepalive: true,
          }).then(function(res) {
            if (!res.ok && index + 1 < targetUrls.length) {
              tryNext(index + 1);
            }
          }).catch(function() {
            sendBeaconOrXHR(targetUrl, body, function() {
              if (index + 1 < targetUrls.length) tryNext(index + 1);
            });
          });
        } else {
          sendBeaconOrXHR(targetUrl, body, function() {
            if (index + 1 < targetUrls.length) tryNext(index + 1);
          });
        }
      } catch (_) {
        if (index + 1 < targetUrls.length) tryNext(index + 1);
      }
    }

    tryNext(0);
  }

  function sendBeaconOrXHR(url, body, onFail) {
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        var sent = navigator.sendBeacon(url, blob);
        if (!sent && onFail) onFail();
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        if (onFail) {
          xhr.onerror = onFail;
        }
        xhr.send(body);
      }
    } catch (_) {
      if (onFail) onFail();
    }
  }

  // ─── Impression: hanya 1 kali per sesi browser (sessionStorage) ───────────
  var IMPRESSION_KEY = 'vrn_impression_sent_' + trackingKey;

  function sendImpression() {
    try {
      if (sessionStorage.getItem(IMPRESSION_KEY)) return; // sudah terkirim di sesi ini
      sessionStorage.setItem(IMPRESSION_KEY, '1');
    } catch (_) { /* private mode / storage disabled → tetap kirim */ }
    sendEvent('impression');
  }

  // ─── Click: debounce 3 detik agar klik beruntun tidak multi-request ────────
  var clickDebounceTimer = null;
  var CLICK_DEBOUNCE_MS = 3000;

  function trackClick(extraData) {
    if (clickDebounceTimer !== null) return; // masih dalam jendela debounce
    clickDebounceTimer = setTimeout(function () {
      clickDebounceTimer = null;
    }, CLICK_DEBOUNCE_MS);
    sendEvent('click', extraData);
  }

  // Safe DOM Event Listeners
  if (document && typeof document.addEventListener === 'function') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { sendImpression(); });
    } else {
      sendImpression();
    }

    document.addEventListener('click', function (e) {
      var target = e ? (e.target || e.srcElement) : null;
      var el = target && target.closest ? target.closest('a, button, [data-vrn-cta], [role="button"]') : null;
      if (el) {
        trackClick({
          gclid: payload.gclid,
          utm_source: payload.utm_source,
          utm_medium: payload.utm_medium,
          utm_campaign: payload.utm_campaign,
          keyword: payload.keyword,
        });
      }
    }, true);
  }
})();
