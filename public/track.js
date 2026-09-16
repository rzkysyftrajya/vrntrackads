(function() {
  const VRNTrack = {
    tracking_key: null,
    endpoint: 'https://qtgbuacxiuntczeaqlqi.supabase.co/functions/v1/track',
    
    init: function(config) {
      if (!config || !config.tracking_key) {
        console.error('[VRNTrack] Missing tracking_key');
        return;
      }
      this.tracking_key = config.tracking_key;
      this.trackImpression();
    },

    trackImpression: function() {
      this.send('impression');
    },

    trackClick: function(extraData) {
      this.send('click', extraData || {});
    },

    send: function(event, extra) {
      if (!this.tracking_key) return;
      const urlParams = new URLSearchParams(window.location.search);
      const payload = {
        event: event,
        tracking_key: this.tracking_key,
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
        user_agent: navigator.userAgent || '',
        timestamp: new Date().toISOString(),
        ...(extra || {})
      };

      fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).then(function(res) {
        return res.json();
      }).then(function(data) {
        console.log('[VRNTrack] Event logged:', data);
      }).catch(function(err) {
        console.warn('[VRNTrack] Error:', err);
      });
    }
  };

  try {
    const currentScript = document.currentScript;
    if (currentScript) {
      const autoKey =
        currentScript.getAttribute('data-tracking-id') ||
        currentScript.getAttribute('data-tracking-key');
      if (autoKey) {
        VRNTrack.init({ tracking_key: autoKey });
      }
    }
  } catch (e) {
    // Ignore script detection errors
  }

  // BARIS INI WAJIB ADA:
  window.VRNTrack = VRNTrack;
})();
