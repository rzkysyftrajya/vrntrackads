/**
 * VRN TRACK ADS — Tracking SDK v1.0 (Fixed & Robust)
 * Modernized with global window object API, anti-spam mechanisms, fallback endpoints,
 * and standard event listeners for Single Page Applications (SPA).
 */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Ambil script element dan atribut dasarnya
  var scriptEl = document.currentScript || document.querySelector('script[data-tracking-id], script[data-tracking-key], script[src*="track.js"]');
  var trackingKey = scriptEl ? (scriptEl.getAttribute('data-tracking-id') || scriptEl.getAttribute('data-tracking-key')) : null;

  var supabaseEdgeUrl = 'https://qtgbuacxiuntczeaqlqi.supabase.co/functions/v1/track';
  var endpoint = scriptEl ? scriptEl.getAttribute('data-endpoint') : null;
  
  if (!endpoint) {
    if (scriptEl && scriptEl.src && scriptEl.src.indexOf('http') === 0) {
      endpoint = scriptEl.src.replace(/\/track\.js.*$/, '/api/public/track');
    } else {
      endpoint = '/api/public/track';
    }
  }

  // 2. Helper Functions
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

  // 3. Objek VRNTrack Global
  var clickDebounceTimer = null;
  var CLICK_DEBOUNCE_MS = 3000;

  var VRNTrack = {
    tracking_key: trackingKey,
    
    init: function (config) {
      if (config && config.tracking_key) {
        this.tracking_key = config.tracking_key;
      }
      this.trackImpression();
    },

    sendEvent: function (event, extra) {
      var activeKey = this.tracking_key || trackingKey;
      if (!activeKey) {
        console.warn('[VRNTrack] Skipping event, no tracking_key provided.');
        return;
      }

      var payload = {
        tracking_key: activeKey,
        event: event,
        landing_page: window.location.href,
        referrer: document.referrer || '',
        device: detectDevice(),
        browser: detectBrowser(),
        gclid: getParam('gclid'),
        utm_source: getParam('utm_source'),
        utm_medium: getParam('utm_medium'),
        utm_campaign: getParam('utm_campaign'),
        utm_content: getParam('utm_content'),
        utm_term: getParam('utm_term'),
        keyword: getParam('keyword'),
        user_agent: navigator.userAgent || '',
        timestamp: new Date().toISOString()
      };

      var data = Object.assign({}, payload, extra || {});
      var body = JSON.stringify(data);

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
            }).then(function (res) {
              if (!res.ok && index + 1 < targetUrls.length) {
                tryNext(index + 1);
              }
            }).catch(function () {
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
    },

    trackImpression: function () {
      var activeKey = this.tracking_key || trackingKey;
      var IMPRESSION_KEY = 'vrn_pageview_sent_' + (activeKey || 'default');

      try {
        if (sessionStorage.getItem(IMPRESSION_KEY)) return; // Cegah duplikat per sesi browser
        sessionStorage.setItem(IMPRESSION_KEY, '1');
      } catch (_) { /* Jika private mode/disabled, tetap jalankan */ }

      this.sendEvent('page_view');
    },

    trackClick: function (extraData) {
      if (clickDebounceTimer !== null) return; // Debounce 3 detik
      
      clickDebounceTimer = setTimeout(function () {
        clickDebounceTimer = null;
      }, CLICK_DEBOUNCE_MS);

      this.sendEvent('click', extraData);
    }
  };

  // Bind ke window object agar GoogleAdsTracker / React bisa mengaksesnya
  window.VRNTrack = VRNTrack;

  // 4. Auto-Run Impression & Event Listener
  if (document && typeof document.addEventListener === 'function') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        VRNTrack.trackImpression();
      });
    } else {
      VRNTrack.trackImpression();
    }

    document.addEventListener('click', function (e) {
      var target = e ? (e.target || e.srcElement) : null;
      var el = target && target.closest ? target.closest('a, button, [data-vrn-cta], [role="button"]') : null;
      if (el) {
        VRNTrack.trackClick({
          element_text: el.textContent ? el.textContent.trim().substring(0, 50) : '',
          element_href: el.getAttribute('href') || ''
        });
      }
    }, true);
  }
})();