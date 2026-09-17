import { GoogleAdsApi } from 'google-ads-api';

export interface GoogleAdsCampaignMetric {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  cost: number;
  date: string;
}

/**
 * Fetches campaign performance metrics for the last 30 days from Google Ads API.
 * Converts cost_micros to standard currency units (divided by 1,000,000).
 */
interface GoogleAdsRow {
  campaign?: {
    id?: string | number;
    name?: string;
  };
  metrics?: {
    impressions?: string | number;
    clicks?: string | number;
    cost_micros?: string | number;
  };
  segments?: {
    date?: string;
  };
}

export async function fetchGoogleAdsMetrics(): Promise<GoogleAdsCampaignMetric[]> {
  const clientId = process.env.GADS_CLIENT_ID;
  const clientSecret = process.env.GADS_CLIENT_SECRET;
  const developerToken = process.env.GADS_DEVELOPER_TOKEN;
  const refreshToken = process.env.GADS_REFRESH_TOKEN;
  // Sanitize customer ID by removing hyphens (e.g. 123-456-7890 -> 1234567890)
  const customerId = process.env.GADS_CUSTOMER_ID?.replace(/-/g, '');

  if (!clientId || !clientSecret || !developerToken || !refreshToken || !customerId) {
    throw new Error(
      'Missing required Google Ads credentials in environment variables: ' +
        'GADS_CLIENT_ID, GADS_CLIENT_SECRET, GADS_DEVELOPER_TOKEN, GADS_REFRESH_TOKEN, GADS_CUSTOMER_ID'
    );
  }

  // Initialize the Google Ads API client
  const client = new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: developerToken,
  });

  // Access customer account
  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: refreshToken,
  });

  // Query campaign metrics for the last 30 days using GAQL
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      segments.date
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY segments.date DESC
  `;

  const rows = (await customer.query(query)) as unknown as GoogleAdsRow[];

  return rows.map((row) => {
    const costMicros = Number(row.metrics?.cost_micros ?? 0);

    return {
      campaign_id: String(row.campaign?.id ?? ''),
      campaign_name: row.campaign?.name ?? 'Unknown Campaign',
      impressions: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      cost_micros: costMicros,
      cost: costMicros / 1_000_000, // Conversion: 1,000,000 micros = 1 currency unit
      date: row.segments?.date ?? '',
    };
  });
}

