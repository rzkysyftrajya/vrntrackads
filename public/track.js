(function () {
  'use strict';

  // Prevent double execution if track.js is loaded multiple times
  if (window.__VRN_TRACK_INITIALIZED__) {
    return;
  }
  window.__VRN_TRACK_INITIALIZED__ = true;

  var script = document.currentScript;
  var trackingKey = script && script.getAttribute('data-tracking-id');

  if (!trackingKey || trackingKey === 'YOUR_TRACKING_KEY') {
    return;
  }

  // Helper to sanitize/clean URL and remove extraneous markdown brackets/characters
  function sanitizeString(str) {
    if (!str || typeof str !== 'string') return '';
    return str.split(']')[0].replace(/[\[\]\(\)]/g, '').trim();
  }

  function getCleanUrl() {
    try {
      var href = window.location.href || '';
      return sanitizeString(href);
    } catch (e) {
      return '';
    }
  }

  function getCleanQueryParam(paramName) {
    try {
      var searchStr = window.location.search || '';
      var cleanSearch = searchStr.split(']')[0].replace(/[\[\]\(\)]/g, '');
      var params = new URLSearchParams(cleanSearch);
      var val = params.get(paramName);
      return val ? sanitizeString(val) : '';
    } catch (e) {
      return '';
    }
  }

  var endpoint = (script && script.src
    ? new URL(script.src).origin
    : window.location.origin) + '/api/public/track';

  var sessionId;
  var startTime = Date.now();
  var hasMoved = false;
  var maxScrollDepth = 0;

  // Global Debounce / Timestamp Cooldown Lock (2000ms) for click events
  var lastClickTimestamp = 0;
  var CLICK_COOLDOWN_MS = 2000;

  // Track user engagement / behavior
  function onUserMove() {
    hasMoved = true;
  }
  window.addEventListener('mousemove', onUserMove, { passive: true, once: true });
  window.addEventListener('touchstart', onUserMove, { passive: true, once: true });
  window.addEventListener('scroll', onUserMove, { passive: true, once: true });
  window.addEventListener('keydown', onUserMove, { passive: true, once: true });

  // Track max scroll depth
  function updateScrollDepth() {
    try {
      var docElem = document.documentElement;
      var docBody = document.body;
      var scrollTop = window.pageYOffset || docElem.scrollTop || docBody.scrollTop || 0;
      var scrollHeight = Math.max(
        docBody.scrollHeight, docElem.scrollHeight,
        docBody.offsetHeight, docElem.offsetHeight,
        docBody.clientHeight, docElem.clientHeight
      );
      var clientHeight = window.innerHeight || docElem.clientHeight || 0;
      if (scrollHeight > clientHeight) {
        var depth = Math.round(((scrollTop + clientHeight) / scrollHeight) * 100);
        if (depth > maxScrollDepth) {
          maxScrollDepth = Math.min(depth, 100);
        }
      } else {
        maxScrollDepth = 100;
      }
    } catch (e) {}
  }
  window.addEventListener('scroll', updateScrollDepth, { passive: true });

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

  function getGpuRenderer() {
    try {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || null;
        }
      }
    } catch (e) {}
    return null;
  }

  function getHardwareInfo() {
    var screenRes = (window.screen && window.screen.width && window.screen.height)
      ? window.screen.width + 'x' + window.screen.height
      : null;
    var cpuCores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null;
    var deviceMemory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
    var gpuRenderer = getGpuRenderer();
    var timezone = null;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (e) {}
    var language = navigator.language || navigator.userLanguage || null;

    return {
      screen_resolution: screenRes,
      cpu_cores: cpuCores,
      device_memory: deviceMemory,
      gpu_renderer: gpuRenderer,
      timezone: timezone,
      language: language
    };
  }

  // Fallback hash generator if FingerprintJS CDN is blocked or unavailable
  function generateFallbackFingerprint(hw) {
    try {
      var raw = [
        navigator.userAgent || '',
        hw.screen_resolution || '',
        hw.timezone || '',
        hw.language || '',
        hw.cpu_cores || '',
        hw.device_memory || '',
        hw.gpu_renderer || ''
      ].join('###');

      var hash = 0;
      for (var i = 0; i < raw.length; i++) {
        var char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
      }
      return 'fp_' + Math.abs(hash).toString(36);
    } catch (e) {
      return null;
    }
  }

  var fingerprintPromise = null;

  function getFingerprint(hw) {
    if (!fingerprintPromise) {
      fingerprintPromise = new Promise(function (resolve) {
        var fallback = generateFallbackFingerprint(hw);
        var timeoutId = setTimeout(function () {
          resolve(fallback);
        }, 1500);

        try {
          import('https://openfpcdn.io/fingerprintjs/v4')
            .then(function (FingerprintJS) {
              return FingerprintJS.load();
            })
            .then(function (fp) {
              return fp.get();
            })
            .then(function (result) {
              clearTimeout(timeoutId);
              resolve(result.visitorId || fallback);
            })
            .catch(function () {
              clearTimeout(timeoutId);
              resolve(fallback);
            });
        } catch (e) {
          clearTimeout(timeoutId);
          resolve(fallback);
        }
      });
    }
    return fingerprintPromise;
  }

  function sendEvent(eventType, extraData) {
    var hw = getHardwareInfo();
    updateScrollDepth();

    var timeOnPage = Math.max(0, Math.round((Date.now() - startTime) / 1000));
    var cleanCurrentUrl = getCleanUrl();
    var cleanReferrer = sanitizeString(document.referrer || '');

    getFingerprint(hw).then(function (fingerprint) {
      var payload = Object.assign({
        event: eventType,
        tracking_key: trackingKey,
        session_id: sessionId,
        fingerprint: fingerprint,
        screen_resolution: hw.screen_resolution,
        cpu_cores: hw.cpu_cores,
        device_memory: hw.device_memory,
        gpu_renderer: hw.gpu_renderer,
        timezone: hw.timezone,
        language: hw.language,
        has_moved: hasMoved,
        scroll_depth: maxScrollDepth,
        time_on_page: timeOnPage,
        page_url: cleanCurrentUrl,
        referrer: cleanReferrer,
        gclid: getCleanQueryParam('gclid'),
        utm_source: getCleanQueryParam('utm_source'),
        utm_medium: getCleanQueryParam('utm_medium'),
        utm_campaign: getCleanQueryParam('utm_campaign'),
        utm_content: getCleanQueryParam('utm_content'),
        utm_term: getCleanQueryParam('utm_term'),
        keyword: getCleanQueryParam('keyword') || getCleanQueryParam('utm_term'),
        user_agent: navigator.userAgent || '',
        is_bot: isBot()
      }, extraData || {});

      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        try {
          var sent = navigator.sendBeacon(
            endpoint,
            new Blob([body], { type: 'text/plain;charset=UTF-8' })
          );
          if (sent) return;
        } catch (error) {
          // Fall through to fetch when Beacon is unavailable or rejected.
        }
      }

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: body,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      }).catch(function () {});
    });
  }

  function trackClick(data) {
    var now = Date.now();
    // Debounce / cooldown 2000ms: Jika klik terjadi < 2 detik dari klik sebelumnya, abaikan
    if (now - lastClickTimestamp < CLICK_COOLDOWN_MS) {
      return;
    }
    lastClickTimestamp = now;
    sendEvent('click', data);
  }

  window.VRNTrack = {
    trackClick: trackClick
  };

  function captureClick(event) {
    // 1. TINGKAT PALING ATAS: Langsung cek dan kunci cooldown timestamp sebelum pemrosesan apa pun
    var now = Date.now();
    if (now - lastClickTimestamp < CLICK_COOLDOWN_MS) {
      return;
    }

    var target = event && event.target;
    if (!target || !target.closest) return;

    var element = target.closest('[data-vrn-click], a[href^="https://wa.me/"], a[href^="https://api.whatsapp.com/"], a[href^="tel:"]');
    if (!element) return;

    // Kunci timestamp segera setelah tombol valid ditemukan
    lastClickTimestamp = now;

    var targetAttr = element.getAttribute('data-vrn-click') || element.getAttribute('href') || element.tagName.toLowerCase();

    sendEvent('click', {
      click_target: sanitizeString(targetAttr),
      landing_page: getCleanUrl()
    });
  }

  function initialize() {
    sendEvent('page_view');
    // Hanya menempel pada event 'click' murni (bukan gabungan touchstart dan click)
    document.addEventListener('click', captureClick, { passive: true, capture: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
}());
