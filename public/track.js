/**
 * VRN TRACK ADS — Client Tracking SDK v2.0
 * Ultra-lightweight, High-Performance, Non-Blocking Tracking & Anti-Bot Protection
 *
 * Features:
 * - Bot & Headless Browser Fingerprinting (Webdriver, Headless UA, Screen Anomalies)
 * - Zero UX Interference: Passive listeners, keepalive fetch / sendBeacon, instant CTA navigations
 * - Auto-detects Google Ads UTM & GCLID parameters
 * - Automatic WhatsApp and CTA button click capture
 * - 100% Silent Error Handling (no user-facing errors, popups, or layout shifts)
 */
(function(window, document) {
  'use strict';

  // Crawler / Bot User-Agent signatures
  var BOT_UA_REGEX = /bot|crawler|spider|headless|puppeteer|selenium|playwright|phantom|curl|wget|python|postman|node-fetch|axios|go-http-client|apachebench|ahrefs|semrush|petalbot|bytespider|yandex|facebookexternalhit|bingbot|googlebot|slurp|duckduckbot/i;

  /**
   * Lightweight Client-side Bot Fingerprinting
   * Runs in microseconds without slowing down the page
   */
  function inspectBotSignals() {
    var reasons = [];
    var nav = window.navigator || {};
    var scr = window.screen || {};
    var ua = nav.userAgent || '';

    // 1. Webdriver Detection
    if (nav.webdriver === true || 'webdriver' in nav) {
      reasons.push('webdriver_active');
    }

    // 2. Headless Browser Heuristics
    if (
      window._phantom ||
      window.__nightmare ||
      window.callPhantom ||
      window.Buffer ||
      window.domAutomation ||
      window.domAutomationController
    ) {
      reasons.push('headless_artifact');
    }

    // Chrome without runtime or plugins anomaly
    if (/Chrome/.test(ua) && !window.chrome) {
      reasons.push('chrome_anomaly');
    }

    // Language anomaly (headless browsers often lack languages)
    if (!nav.languages || nav.languages.length === 0) {
      reasons.push('missing_languages');
    }

    // 3. Screen Resolution Anomalies
    if (
      scr.width === 0 ||
      scr.height === 0 ||
      scr.availWidth === 0 ||
      scr.availHeight === 0 ||
      (window.outerWidth === 0 && window.outerHeight === 0)
    ) {
      reasons.push('zero_screen_dimension');
    }

    // 4. User-Agent Regex Filter
    if (BOT_UA_REGEX.test(ua)) {
      reasons.push('crawler_ua_detected');
    }

    return {
      is_bot: reasons.length > 0,
      bot_reasons: reasons,
      bot_score: Math.min(100, reasons.length * 35)
    };
  }

  /**
   * Generates or retrieves a lightweight anonymous Session ID
   */
  function getOrCreateSessionId() {
    var key = 'vrn_sid';
    try {
      var sid = window.sessionStorage ? window.sessionStorage.getItem(key) : null;
      if (!sid) {
        sid = 's_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        if (window.sessionStorage) {
          window.sessionStorage.setItem(key, sid);
        }
      }
      return sid;
    } catch (e) {
      return 's_fallback_' + Date.now();
    }
  }

  /**
   * Generates lightweight browser fingerprint
   */
  function getBrowserFingerprint() {
    try {
      var nav = window.navigator || {};
      var scr = window.screen || {};
      var parts = [
        scr.width || 0,
        scr.height || 0,
        scr.colorDepth || 0,
        nav.language || '',
        nav.platform || '',
        nav.hardwareConcurrency || 1,
        new Date().getTimezoneOffset()
      ];
      var str = parts.join('~');
      var hash = 0;
      for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      return 'fp_' + Math.abs(hash).toString(36);
    } catch (e) {
      return 'fp_fallback';
    }
  }

  var VRNTrack = {
    version: '2.0.0',
    tracking_key: null,
    endpoint: 'https://qtgbuacxiuntczeaqlqi.supabase.co/functions/v1/track',
    initialized: false,
    clickListening: false,
    session_id: null,
    fingerprint: null,
    bot_info: null,

    init: function(config) {
      try {
        if (!config || (!config.tracking_key && !config.tracking_id)) {
          return;
        }
        this.tracking_key = config.tracking_key || config.tracking_id;
        if (config.endpoint) {
          this.endpoint = config.endpoint;
        }

        this.session_id = getOrCreateSessionId();
        this.fingerprint = getBrowserFingerprint();
        this.bot_info = inspectBotSignals();

        this.initialized = true;

        // Auto track impression
        this.trackImpression();

        // Bind passive auto click listener (Zero UX Interference)
        this.bindAutoClickListener();
      } catch (err) {
        // Silent error handling — never break website script
      }
    },

    trackImpression: function(extraData) {
      this.send('impression', extraData || {});
    },

    trackClick: function(extraData) {
      this.send('click', extraData || {});
    },

    /**
     * Dispatches tracking payload non-blockingly using keepalive fetch
     * or navigator.sendBeacon
     */
    send: function(event, extra) {
      try {
        if (!this.tracking_key) return;

        var urlParams = new URLSearchParams(window.location.search);
        var nav = window.navigator || {};

        var payload = {
          event: event,
          tracking_key: this.tracking_key,
          session_id: this.session_id || getOrCreateSessionId(),
          fingerprint: this.fingerprint || getBrowserFingerprint(),
          landing_page: window.location.href,
          referrer: document.referrer || '',
          gclid: urlParams.get('gclid') || null,
          utm_source: urlParams.get('utm_source') || null,
          utm_medium: urlParams.get('utm_medium') || null,
          utm_campaign: urlParams.get('utm_campaign') || null,
          utm_content: urlParams.get('utm_content') || null,
          utm_term: urlParams.get('utm_term') || null,
          keyword: urlParams.get('keyword') || null,
          device: urlParams.get('device') || null,
          user_agent: nav.userAgent || '',
          is_bot: this.bot_info ? this.bot_info.is_bot : false,
          bot_score: this.bot_info ? this.bot_info.bot_score : 0,
          bot_reasons: this.bot_info ? this.bot_info.bot_reasons : [],
          timestamp: new Date().toISOString()
        };

        if (extra && typeof extra === 'object') {
          for (var k in extra) {
            if (Object.prototype.hasOwnProperty.call(extra, k)) {
              payload[k] = extra[k];
            }
          }
        }

        var jsonBody = JSON.stringify(payload);

        // 1. Fetch with keepalive (Priority: non-blocking, survives page unloads)
        if (typeof window.fetch === 'function') {
          window.fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonBody,
            keepalive: true,
            mode: 'cors',
            credentials: 'omit'
          }).catch(function() {
            // Silently swallow network errors
          });
          return;
        }

        // 2. Beacon fallback
        if (nav.sendBeacon) {
          var blob = new Blob([jsonBody], { type: 'application/json' });
          nav.sendBeacon(this.endpoint, blob);
          return;
        }

        // 3. Fallback XHR asynchronous
        var xhr = new XMLHttpRequest();
        xhr.open('POST', this.endpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(jsonBody);
      } catch (e) {
        // Complete silent catch - zero UX impact
      }
    },

    /**
     * Passive listener for WhatsApp, CTA buttons, and links
     * Guaranteed: DOES NOT interrupt click/touch events or navigation
     */
    bindAutoClickListener: function() {
      if (this.clickListening || typeof document === 'undefined') return;
      this.clickListening = true;

      var self = this;

      function handleClick(e) {
        try {
          var target = e.target;
          if (!target) return;

          // Find closest anchor or button
          var el = target.closest ? target.closest('a, button, [role="button"], [data-vrn-click]') : null;
          if (!el) return;

          var href = el.getAttribute('href') || '';
          var isWhatsApp = /wa\.me|api\.whatsapp\.com|whatsapp\.com/i.test(href) || /whatsapp/i.test(el.className || '');
          var isTel = href.indexOf('tel:') === 0;
          var isCustomCTA = el.hasAttribute('data-vrn-click');
          var text = (el.innerText || el.textContent || '').trim().substring(0, 100);

          if (isWhatsApp || isTel || isCustomCTA) {
            self.trackClick({
              click_target: isWhatsApp ? 'whatsapp' : isTel ? 'telephone' : 'cta_button',
              target_url: href || null,
              target_text: text || null
            });
          }
        } catch (err) {
          // Never interfere with user click
        }
      }

      // Passive capture listener ensures zero lag or delay
      document.addEventListener('click', handleClick, { passive: true, capture: true });
    }
  };

  // Auto initialize from current script attributes
  try {
    var currentScript = document.currentScript;
    if (!currentScript) {
      var scripts = document.getElementsByTagName('script');
      for (var s = scripts.length - 1; s >= 0; s--) {
        if (scripts[s].src && scripts[s].src.indexOf('track.js') !== -1) {
          currentScript = scripts[s];
          break;
        }
      }
    }

    if (currentScript) {
      var autoKey =
        currentScript.getAttribute('data-tracking-id') ||
        currentScript.getAttribute('data-tracking-key');
      var customEndpoint = currentScript.getAttribute('data-endpoint');
      if (autoKey) {
        VRNTrack.init({
          tracking_key: autoKey,
          endpoint: customEndpoint || undefined
        });
      }
    }
  } catch (e) {
    // Ignore script auto-detection errors
  }

  // Export to global window
  window.VRNTrack = VRNTrack;
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : {});
