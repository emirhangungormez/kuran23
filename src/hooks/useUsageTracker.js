import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { buildUsageUserKey, recordUsageDuration } from '../utils/usageStats';

const FLUSH_INTERVAL_MS = 5000;

export default function useUsageTracker({ surahId, ayahNo = null, enabled = true }) {
  const { user, isLoggedIn } = useAuth();
  const sessionRef = useRef({ lastTick: 0, carryMs: 0 });

  useEffect(() => {
    if (!enabled || !isLoggedIn) return undefined;

    const userKey = buildUsageUserKey(user);
    const normalizedSurahId = Number(surahId);
    const normalizedAyahNo = ayahNo == null ? null : Number(ayahNo);

    if (!userKey || !Number.isFinite(normalizedSurahId) || normalizedSurahId <= 0) {
      return undefined;
    }

    const isPageActive = () => {
      if (typeof document === 'undefined') return true;
      return document.visibilityState === 'visible' && document.hasFocus();
    };

    const flush = (force = false) => {
      const now = Date.now();
      const state = sessionRef.current;

      if (!state.lastTick) {
        state.lastTick = now;
        return;
      }

      const elapsed = now - state.lastTick;
      state.lastTick = now;

      if (isPageActive()) {
        state.carryMs += elapsed;
      }

      if (!force && state.carryMs < FLUSH_INTERVAL_MS) return;

      const seconds = Math.floor(state.carryMs / 1000);
      if (seconds <= 0) return;

      state.carryMs -= seconds * 1000;
      recordUsageDuration({
        userKey,
        surahId: normalizedSurahId,
        ayahNo: normalizedAyahNo,
        seconds,
      });
    };

    const start = Date.now();
    sessionRef.current = { lastTick: start, carryMs: 0 };

    const intervalId = window.setInterval(() => flush(false), FLUSH_INTERVAL_MS);

    const onVisibilityChange = () => flush(true);
    const onBlur = () => flush(true);
    const onBeforeUnload = () => flush(true);

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      flush(true);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
      sessionRef.current = { lastTick: 0, carryMs: 0 };
    };
  }, [enabled, isLoggedIn, user, surahId, ayahNo]);
}
