import type { TimelinePoint, LiveFeedItem } from './types';

export const mockTimeline: TimelinePoint[] = [
  { date: '2026-09-10', impressions: 1240, clicks: 82 },
  { date: '2026-09-11', impressions: 1580, clicks: 104 },
  { date: '2026-09-12', impressions: 1320, clicks: 91 },
  { date: '2026-09-13', impressions: 2010, clicks: 156 },
  { date: '2026-09-14', impressions: 1890, clicks: 143 },
  { date: '2026-09-15', impressions: 2240, clicks: 178 },
  { date: '2026-09-16', impressions: 1670, clicks: 112 },
];

export const mockLiveFeed: LiveFeedItem[] = [
  { id: '1', type: 'impression', country: 'United States', city: 'New York', device: 'Desktop', landing_page: '/landing/summer-sale', created_at: new Date(Date.now() - 30000).toISOString() },
  { id: '2', type: 'click', country: 'United Kingdom', city: 'London', device: 'Mobile', landing_page: '/landing/summer-sale', created_at: new Date(Date.now() - 60000).toISOString() },
  { id: '3', type: 'impression', country: 'Germany', city: 'Berlin', device: 'Desktop', landing_page: '/landing/promo', created_at: new Date(Date.now() - 90000).toISOString() },
  { id: '4', type: 'click', country: 'United States', city: 'San Francisco', device: 'Mobile', landing_page: '/landing/summer-sale', created_at: new Date(Date.now() - 120000).toISOString() },
  { id: '5', type: 'impression', country: 'Canada', city: 'Toronto', device: 'Tablet', landing_page: '/landing/promo', created_at: new Date(Date.now() - 150000).toISOString() },
  { id: '6', type: 'impression', country: 'Australia', city: 'Sydney', device: 'Desktop', landing_page: '/landing/new-launch', created_at: new Date(Date.now() - 180000).toISOString() },
  { id: '7', type: 'click', country: 'France', city: 'Paris', device: 'Mobile', landing_page: '/landing/summer-sale', created_at: new Date(Date.now() - 210000).toISOString() },
  { id: '8', type: 'impression', country: 'Japan', city: 'Tokyo', device: 'Desktop', landing_page: '/landing/promo', created_at: new Date(Date.now() - 240000).toISOString() },
];

export const mockStats = {
  totalImpressions: 11950,
  totalClicks: 866,
  ctr: 7.24,
  integrationStatus: 'Connected' as 'Connected' | 'Disconnected',
};
