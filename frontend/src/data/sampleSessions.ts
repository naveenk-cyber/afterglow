import type { ChargingStation } from '../types';

/**
 * Sample charging sessions.
 *
 * The account area runs on a local demo session and has no authenticated
 * server-side history, so the analytics dashboard cannot read real sessions.
 * These records are generated deterministically from stations that actually
 * exist in the catalogue: the station, connector, price and power all come from
 * the record, and the page labels every chart as sample data. They are never
 * presented as live or personal history.
 */
export interface SampleSession {
  id: string;
  station: ChargingStation;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  energyKwh: number;
  connectorType: string;
  cost: number;
  status: 'Completed' | 'Scheduled';
  /** Always true — the UI keys its "Sample" labels off this. */
  isSample: true;
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** Small deterministic PRNG so every render and every range shows the same data. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export function buildSampleSessions(
  stations: ChargingStation[],
  now = Date.now(),
): SampleSession[] {
  if (stations.length === 0) return [];

  const random = mulberry32(20261021);
  const sessions: SampleSession[] = [];

  // 90 completed sessions spread over the last 180 days, so 30- and 90-day
  // ranges both have a comparable previous period to measure against.
  for (let index = 0; index < 90; index += 1) {
    // Cycle through the catalogue instead of sampling randomly, so the table
    // does not list the same station twice in a row.
    const station = stations[(index * 5 + Math.floor(random() * 3)) % stations.length];
    const connector =
      station.connectorTypes[Math.floor(random() * Math.max(station.connectorTypes.length, 1))];
    const daysAgo = Math.floor(random() * 178) + 1;
    const hourOfDay = 7 + Math.floor(random() * 14);
    const durationMinutes = 18 + Math.floor(random() * 52);
    // Energy is bounded by the connector's power and a realistic session length.
    const connectorPower = connector?.maxPower ?? 50;
    const energyKwh = round(
      Math.min(durationMinutes / 60, 1.2) * Math.min(connectorPower, 180) * (0.55 + random() * 0.3),
      1,
    );
    const pricePerKwh = station.pricing.perKwh ?? 0.3;
    const startedAt = new Date(now - daysAgo * DAY);
    startedAt.setHours(hourOfDay, Math.floor(random() * 60), 0, 0);
    const endedAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

    sessions.push({
      id: `sample-${index + 1}`,
      station,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes,
      energyKwh,
      connectorType: connector?.type ?? 'CCS',
      cost: round(energyKwh * pricePerKwh + (station.pricing.sessionFee ?? 0)),
      status: 'Completed',
      isSample: true,
    });
  }

  // Two planned sessions, created from real station records.
  for (let index = 0; index < Math.min(2, stations.length); index += 1) {
    const station = stations[(index + 3) % stations.length];
    const start = new Date(now + (index + 1) * 5 * HOUR);
    start.setMinutes(0, 0, 0);
    const durationMinutes = 45 + index * 15;
    const connector = station.connectorTypes[0];
    sessions.push({
      id: `sample-upcoming-${index + 1}`,
      station,
      startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString(),
      durationMinutes,
      energyKwh: 0,
      connectorType: connector?.type ?? 'CCS',
      cost: 0,
      status: 'Scheduled',
      isSample: true,
    });
  }

  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function findSampleSession(
  sessions: SampleSession[],
  id: string | undefined,
): SampleSession | undefined {
  if (!id) return undefined;
  return sessions.find((session) => session.id === id);
}

/* -------------------------------------------------------------------------
   Aggregation
   ------------------------------------------------------------------------- */

export type RangeDays = 7 | 30 | 90;

export interface SeriesPoint {
  label: string;
  value: number;
  /** ISO date for the bucket start, used for accessible descriptions. */
  date: string;
}

export interface ConnectorSlice {
  label: string;
  value: number;
}

export interface RangeSummary {
  sessions: number;
  energyKwh: number;
  spend: number;
  avgDuration: number;
  perWeek: number;
  activity: SeriesPoint[];
  energy: SeriesPoint[];
  spendSeries: SeriesPoint[];
  connectors: ConnectorSlice[];
}

const startOfDay = (timestamp: number) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const dayLabel = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function bucketSeries(
  sessions: SampleSession[],
  now: number,
  days: RangeDays,
): { activity: SeriesPoint[]; energy: SeriesPoint[]; spendSeries: SeriesPoint[] } {
  // 90 days is bucketed weekly so labels stay readable on a phone.
  const bucketDays = days === 90 ? 7 : days === 30 ? 2 : 1;
  const bucketCount = Math.ceil(days / bucketDays);
  const today = startOfDay(now);

  const startOfRange = today - (bucketCount - 1) * bucketDays * DAY;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = startOfRange + index * bucketDays * DAY;
    return {
      start: bucketStart,
      end: bucketStart + bucketDays * DAY,
      label: dayLabel(bucketStart),
      sessions: 0,
      energy: 0,
      spend: 0,
    };
  });

  for (const session of sessions) {
    if (session.status !== 'Completed') continue;
    const timestamp = new Date(session.startedAt).getTime();
    const bucket = buckets.find((item) => timestamp >= item.start && timestamp < item.end);
    if (!bucket) continue;
    bucket.sessions += 1;
    bucket.energy += session.energyKwh;
    bucket.spend += session.cost;
  }

  return {
    activity: buckets.map((bucket) => ({
      label: bucket.label,
      value: bucket.sessions,
      date: new Date(bucket.start).toISOString(),
    })),
    energy: buckets.map((bucket) => ({
      label: bucket.label,
      value: round(bucket.energy, 1),
      date: new Date(bucket.start).toISOString(),
    })),
    spendSeries: buckets.map((bucket) => ({
      label: bucket.label,
      value: round(bucket.spend),
      date: new Date(bucket.start).toISOString(),
    })),
  };
}

export function summariseRange(
  sessions: SampleSession[],
  days: RangeDays,
  now = Date.now(),
): RangeSummary {
  const end = now;
  const start = now - days * DAY;
  const inRange = sessions.filter((session) => {
    if (session.status !== 'Completed') return false;
    const timestamp = new Date(session.startedAt).getTime();
    return timestamp >= start && timestamp <= end;
  });

  const energyKwh = round(inRange.reduce((total, session) => total + session.energyKwh, 0), 1);
  const spend = round(inRange.reduce((total, session) => total + session.cost, 0));
  const avgDuration = inRange.length
    ? Math.round(inRange.reduce((total, session) => total + session.durationMinutes, 0) / inRange.length)
    : 0;

  const connectorCounts = new Map<string, number>();
  for (const session of inRange) {
    connectorCounts.set(session.connectorType, (connectorCounts.get(session.connectorType) ?? 0) + 1);
  }

  return {
    sessions: inRange.length,
    energyKwh,
    spend,
    avgDuration,
    perWeek: round((inRange.length / days) * 7, 1),
    ...bucketSeries(sessions, now, days),
    connectors: [...connectorCounts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
  };
}

/** Same metrics for the immediately preceding period, for delta labels. */
export function previousRangeSummary(
  sessions: SampleSession[],
  days: RangeDays,
  now = Date.now(),
): RangeSummary {
  return summariseRange(sessions, days, now - days * DAY);
}

export interface MonthlySpend {
  label: string;
  value: number;
}

export function monthlySpend(sessions: SampleSession[], now = Date.now()): MonthlySpend[] {
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
  const buckets = new Map<string, { label: string; value: number }>();
  const cursor = new Date(now);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(cursor);
    date.setMonth(cursor.getMonth() - index);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    buckets.set(key, { label: formatter.format(date), value: 0 });
  }

  for (const session of sessions) {
    if (session.status !== 'Completed') continue;
    const date = new Date(session.startedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.value = round(bucket.value + session.cost);
  }

  return [...buckets.values()];
}
