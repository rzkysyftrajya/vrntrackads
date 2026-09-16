/**
 * VRN TRACK ADS — Tracking SDK v1.0
 * Auto-detects URL parameters (gclid, utm_source, utm_medium, utm_campaign, keyword),
 * device, browser, referrer, and landing page.
 * Fires impression on load and click on CTA links.
 *
 * Usage: <script src="https://YOUR_DOMAIN/track.js" data-tracking-id="YOUR_TRACKING_KEY"></script>
 */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var scriptEl = document.currentScript || document.querySelector('script[data-tracking-id]');
  if (!scriptEl) return;
  var trackingKey = scriptEl.getAttribute('data-tracking-id');
  if (!trackingKey) return;

  // Deployed Supabase Edge Function URL (Primary endpoint for external landing pages)
  var supabaseEdgeUrl = 'https://qtgbuacxiuntczeaqlqi.supabase.co/functions/v1/track';
  var endpoint = scriptEl.getAttribute('data-endpoint');

  if (!endpoint) {
    var isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    var isScriptFromSameDomain = scriptEl.src && scriptEl.src.indexOf(window.location.origin) === 0;

    if (isLocalhost && isScriptFromSameDomain) {
      endpoint = '/api/public/track';
    } else {
      endpoint = supabaseEdgeUrl;
    }
  }

  function getParam(name) {
    try {
      var m = new RegExp('[?&]' + name + '=([^&]*)', 'i').exec(window.location.search);
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

  var basePayload = {
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
    var data = Object.assign({}, basePayload, { event: event }, extra || {});
    var body = JSON.stringify(data);

    if (window.console && window.console.log) {
      console.log('[VRN TRACK ADS] Sending ' + event + ' event:', data);
    }

    var targetUrls = [endpoint];
    if (endpoint !== supabaseEdgeUrl) {
      targetUrls.push(supabaseEdgeUrl);
    }

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
          }).then(function (res) {
            if (res.ok) {
              if (window.console && window.console.log) {
                console.log('[VRN TRACK ADS] Event recorded successfully via ' + targetUrl);
              }
            } else if (index + 1 < targetUrls.length) {
              tryNext(index + 1);
            }
          }).catch(function (err) {
            if (window.console && window.console.warn) {
              console.warn('[VRN TRACK ADS] Fetch error on ' + targetUrl + ':', err);
            }
            sendBeaconOrXHR(targetUrl, body, function () {
              if (index + 1 < targetUrls.length) tryNext(index + 1);
            });
          });
        } else {
          sendBeaconOrXHR(targetUrl, body, function () {
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
        if (onFail) xhr.onerror = onFail;
        xhr.send(body);
      }
    } catch (_) {
      if (onFail) onFail();
    }
  }

  // Safe DOM Event Listeners
  if (document && typeof document.addEventListener === 'function') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        sendEvent('impression');
      });
    } else {
      sendEvent('impression');
    }

    // Track clicks on CTA links / buttons / forms
    document.addEventListener(
      'click',
      function (e) {
        var target = e ? e.target || e.srcElement : null;
        var el = target && target.closest ? target.closest('a, button, [data-vrn-cta], [role="button"]') : null;
        if (el) {
          sendEvent('click', {
            gclid: basePayload.gclid,
            utm_source: basePayload.utm_source,
            utm_medium: basePayload.utm_medium,
            utm_campaign: basePayload.utm_campaign,
            keyword: basePayload.keyword,
          });
        }
      },
      true
    );
  }
})();
