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

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () {});
  }