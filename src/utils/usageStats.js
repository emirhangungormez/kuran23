const STORAGE_KEY = 'quran_usage_stats_v1';
const MAX_DAILY_ENTRIES = 120;

function safeParse(jsonValue) {
  if (!jsonValue) return null;
  try {
    return JSON.parse(jsonValue);
  } catch {
    return null;
  }
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function formatDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultUserStats() {
  return {
    totalSeconds: 0,
    daily: {},
    surahs: {},
    verses: {},
    updatedAt: '',
  };
}

function readStore() {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!parsed || typeof parsed !== 'object') {
    return { version: 1, users: {} };
  }
  return {
    version: 1,
    users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
  };
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function trimDailyMap(dailyMap) {
  const entries = Object.entries(dailyMap || {}).sort((a, b) => b[0].localeCompare(a[0]));
  return Object.fromEntries(entries.slice(0, MAX_DAILY_ENTRIES));
}

function ensureUserNode(store, userKey) {
  const current = store.users[userKey];
  const defaults = getDefaultUserStats();
  const node = current && typeof current === 'object' ? current : {};

  return {
    ...defaults,
    ...node,
    daily: node.daily && typeof node.daily === 'object' ? node.daily : {},
    surahs: node.surahs && typeof node.surahs === 'object' ? node.surahs : {},
    verses: node.verses && typeof node.verses === 'object' ? node.verses : {},
  };
}

export function buildUsageUserKey(user) {
  if (!user) return '';
  const idPart = user.id ?? '';
  const usernamePart = (user.username || '').trim().toLowerCase();
  if (!idPart && !usernamePart) return '';
  return `${idPart}:${usernamePart}`;
}

export function recordUsageDuration({ userKey, surahId, ayahNo = null, seconds }) {
  if (!userKey) return;

  const duration = toPositiveInt(seconds);
  const surah = toPositiveInt(surahId);
  const ayah = ayahNo == null ? 0 : toPositiveInt(ayahNo);

  if (!duration || !surah) return;

  const store = readStore();
  const userStats = ensureUserNode(store, userKey);
  const dayKey = formatDateKey(new Date());

  userStats.totalSeconds = toPositiveInt(userStats.totalSeconds) + duration;
  userStats.daily[dayKey] = toPositiveInt(userStats.daily[dayKey]) + duration;
  userStats.surahs[surah] = toPositiveInt(userStats.surahs[surah]) + duration;

  if (ayah > 0) {
    const verseKey = `${surah}:${ayah}`;
    userStats.verses[verseKey] = toPositiveInt(userStats.verses[verseKey]) + duration;
  }

  userStats.daily = trimDailyMap(userStats.daily);
  userStats.updatedAt = new Date().toISOString();

  store.users[userKey] = userStats;
  writeStore(store);
}

export function getUserUsageStats(userOrKey) {
  const userKey = typeof userOrKey === 'string' ? userOrKey : buildUsageUserKey(userOrKey);
  if (!userKey) return getDefaultUserStats();

  const store = readStore();
  return ensureUserNode(store, userKey);
}

export function getLastDaysSeries(userStats, dayCount = 7) {
  const count = Math.max(1, Math.floor(dayCount));
  const now = new Date();
  const out = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - offset);
    const key = formatDateKey(date);
    out.push({
      key,
      dayLabel: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
      seconds: toPositiveInt(userStats?.daily?.[key]),
    });
  }

  return out;
}

export function getTopDurations(mapLike, limit = 5) {
  return Object.entries(mapLike || {})
    .map(([key, value]) => ({ key, seconds: toPositiveInt(value) }))
    .filter((item) => item.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, limit);
}

export function formatDurationLabel(totalSeconds) {
  const seconds = toPositiveInt(totalSeconds);
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours} sa ${minutes} dk` : `${hours} sa`;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest > 0 ? `${minutes} dk ${rest} sn` : `${minutes} dk`;
  }
  return `${seconds} sn`;
}
