import type { DateFilter } from './types';

export interface DateRangeBounds {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
}

export function getDateRangeBounds(
  filter: DateFilter,
  customStart?: string,
  customEnd?: string
): DateRangeBounds {
  const now = new Date();

  if (filter === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      start,
      end,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  }

  if (filter === 'yesterday') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    return {
      start,
      end,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  }

  if (filter === '7days') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      start,
      end,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  }

  if (filter === '30days') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      start,
      end,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  }

  // 'custom'
  let start: Date;
  let end: Date;

  if (customStart) {
    const [sY, sM, sD] = customStart.split('-').map(Number);
    start = new Date(sY, (sM || 1) - 1, sD || 1, 0, 0, 0, 0);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
  }

  if (customEnd) {
    const [eY, eM, eD] = customEnd.split('-').map(Number);
    end = new Date(eY, (eM || 1) - 1, eD || 1, 23, 59, 59, 999);
  } else {
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function formatDisplayDateRange(start: Date, end: Date, filter: DateFilter): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  if (filter === 'today') {
    return `Hari ini (${start.toLocaleDateString('id-ID', options)})`;
  }
  if (filter === 'yesterday') {
    return `Kemarin (${start.toLocaleDateString('id-ID', options)})`;
  }
  if (filter === '7days') {
    return `7 Hari Terakhir (${start.toLocaleDateString('id-ID', options)} — ${end.toLocaleDateString('id-ID', options)})`;
  }
  if (filter === '30days') {
    return `30 Hari Terakhir (${start.toLocaleDateString('id-ID', options)} — ${end.toLocaleDateString('id-ID', options)})`;
  }
  return `${start.toLocaleDateString('id-ID', options)} — ${end.toLocaleDateString('id-ID', options)}`;
}

export function formatTimelineLabel(dateStr: string): string {
  if (dateStr.includes(':')) {
    return dateStr;
  }
  if (dateStr.length >= 10) {
    return dateStr.slice(5);
  }
  return dateStr;
}
