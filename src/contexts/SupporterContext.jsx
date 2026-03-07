import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { API_BASE } from '../services/api';
import { useAuth } from './AuthContext';
import { getUserUsageStats } from '../utils/usageStats';

const SupporterContext = createContext(null);
const GUEST_ADS_ENABLED_KEY = 'quran_guest_ads_enabled';

const DEFAULT_STATS = {
  ads_enabled: false,
  ads_watched: 0,
  usage_seconds: 0,
  supporter_until: null,
  is_supporter: false,
  membership_type: 'normal',
  milestone_count: 0,
  cycle_ads: 0,
  remaining_to_next_unlock: 50,
  pro_expires_at: null,
  is_quick_pro_active: false,
  quick_pro_remaining_seconds: 0,
  daily_quick_pro_limit: 3,
  daily_quick_pro_used: 0,
  daily_quick_pro_remaining: 3,
  can_watch_for_quick_pro: false,
};

function toStatsPayload(payload) {
  if (!payload || typeof payload !== 'object') return DEFAULT_STATS;
  return {
    ...DEFAULT_STATS,
    ...payload,
  };
}

export function SupporterProvider({ children }) {
  const { user, isLoggedIn } = useAuth();
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState('');
  const [guestAdsEnabled, setGuestAdsEnabled] = useState(() => {
    try {
      return localStorage.getItem(GUEST_ADS_ENABLED_KEY) === '1';
    } catch {
      return false;
    }
  });

  const userId = user?.id ? Number(user.id) : 0;

  const fetchMyStats = useCallback(async () => {
    if (!isLoggedIn || !userId) {
      setStats(DEFAULT_STATS);
      setLastError('');
      return;
    }

    setLoading(true);
    setLastError('');

    const merged = { ...DEFAULT_STATS };
    let firstError = '';

    try {
      const res = await fetch(`${API_BASE}/supporters.php?action=my&user_id=${userId}`);
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Destek verileri alınamadı.');
      }
      Object.assign(merged, toStatsPayload(data.stats));
    } catch (err) {
      firstError = err?.message || 'Destek verileri alınamadı.';
    }

    try {
      const res = await fetch(`${API_BASE}/ads/status?user_id=${userId}`);
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Pro erişim durumu alınamadı.');
      }
      Object.assign(merged, toStatsPayload(data.status));
    } catch (err) {
      if (!firstError) {
        firstError = err?.message || 'Pro erişim durumu alınamadı.';
      }
    }

    setStats(toStatsPayload(merged));
    setLastError(firstError);
    setLoading(false);
  }, [isLoggedIn, userId]);

  useEffect(() => {
    fetchMyStats();
  }, [fetchMyStats]);

  useEffect(() => {
    try {
      localStorage.setItem(GUEST_ADS_ENABLED_KEY, guestAdsEnabled ? '1' : '0');
    } catch {
      // silent
    }
  }, [guestAdsEnabled]);

  const postAction = useCallback(
    async (action, body = {}) => {
      if (!isLoggedIn || !userId) {
        throw new Error('Bu özellik için giriş yapmalısınız.');
      }
      const res = await fetch(`${API_BASE}/supporters.php?action=${action}&user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'İşlem başarısız.');
      }
      if (data.stats) setStats((prev) => toStatsPayload({ ...prev, ...data.stats }));
      return data;
    },
    [isLoggedIn, userId]
  );

  const postAdsAction = useCallback(
    async (path, body = {}) => {
      if (!isLoggedIn || !userId) {
        throw new Error('Bu özellik için giriş yapmalısınız.');
      }
      const res = await fetch(`${API_BASE}/ads/${path}?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Reklam işlemi başarısız.');
      }
      if (data.status) {
        setStats((prev) => toStatsPayload({ ...prev, ...data.status }));
      }
      return data;
    },
    [isLoggedIn, userId]
  );

  const toggleAdsEnabled = useCallback(
    async (enabled) => {
      if (!isLoggedIn || !userId) {
        setGuestAdsEnabled(!!enabled);
        return { ads_enabled: !!enabled };
      }
      const data = await postAction('toggle_ads', { enabled: !!enabled });
      return data?.stats;
    },
    [isLoggedIn, postAction, userId]
  );

  const watchAd = useCallback(async () => {
    if (!isLoggedIn || !userId) {
      return { stats: null };
    }
    const data = await postAction('watch_ad', {});
    return { stats: data?.stats };
  }, [isLoggedIn, postAction, userId]);

  const createMockQuickProReward = useCallback(async () => {
    const data = await postAdsAction('mock-reward', {});
    return data?.transaction_id;
  }, [postAdsAction]);

  const grantHourlyProAccess = useCallback(
    async (transactionId) => {
      const data = await postAdsAction('grant-hourly-access', { transaction_id: transactionId });
      return data;
    },
    [postAdsAction]
  );

  const syncUsage = useCallback(async () => {
    if (!isLoggedIn || !userId) return;
    const usage = getUserUsageStats(user);
    const usageSeconds = Number(usage?.totalSeconds || 0);
    if (!Number.isFinite(usageSeconds) || usageSeconds <= 0) return;
    try {
      await postAction('sync_usage', { usage_seconds: Math.floor(usageSeconds) });
    } catch {
      // silent
    }
  }, [isLoggedIn, postAction, user, userId]);

  useEffect(() => {
    if (!isLoggedIn || !userId) return undefined;
    syncUsage();
    const intervalId = window.setInterval(syncUsage, 30000);
    return () => window.clearInterval(intervalId);
  }, [isLoggedIn, syncUsage, userId]);

  const value = useMemo(() => {
    const supporterByDate = !!(
      stats.supporter_until &&
      new Date(stats.supporter_until).getTime() > Date.now()
    );
    const supporterActive = supporterByDate || !!stats.is_supporter;

    const quickProActive = !!(
      stats.pro_expires_at &&
      new Date(stats.pro_expires_at).getTime() > Date.now()
    );

    const isProAccessActive = supporterActive || quickProActive;
    const membershipType = supporterActive ? 'supporter' : quickProActive ? 'quick-pro' : 'normal';
    const playlistLimit = isProAccessActive ? 999 : 1;
    const journeyLimit = isProAccessActive ? 999 : 1;
    const dailyQuickProLimit = Number(stats.daily_quick_pro_limit || 3);
    const dailyQuickProUsed = Number(stats.daily_quick_pro_used || 0);
    const dailyQuickProRemaining = Math.max(0, Number(stats.daily_quick_pro_remaining ?? (dailyQuickProLimit - dailyQuickProUsed)));

    return {
      stats,
      loading,
      lastError,
      refresh: fetchMyStats,
      toggleAdsEnabled,
      watchAd,
      syncUsage,
      createMockQuickProReward,
      grantHourlyProAccess,
      membershipType,
      isSupporter: supporterActive,
      isQuickProActive: quickProActive,
      isProAccessActive,
      quickProExpiresAt: stats.pro_expires_at,
      quickProRemainingSeconds: Number(stats.quick_pro_remaining_seconds || 0),
      canWatchQuickProAd: isLoggedIn && !supporterActive && dailyQuickProRemaining > 0,
      dailyQuickProLimit,
      dailyQuickProUsed,
      dailyQuickProRemaining,
      canAccessUsageAnalytics: isProAccessActive,
      playlistLimit,
      journeyLimit,
      remainingAdsToUnlock: isLoggedIn ? stats.remaining_to_next_unlock : 50,
      adsEnabled: isLoggedIn ? !!stats.ads_enabled : guestAdsEnabled,
    };
  }, [stats, loading, lastError, fetchMyStats, toggleAdsEnabled, watchAd, syncUsage, createMockQuickProReward, grantHourlyProAccess, isLoggedIn, guestAdsEnabled]);

  return <SupporterContext.Provider value={value}>{children}</SupporterContext.Provider>;
}

export function useSupporter() {
  const ctx = useContext(SupporterContext);
  if (!ctx) throw new Error('useSupporter must be used within SupporterProvider');
  return ctx;
}
