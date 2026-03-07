import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { getUserUsageStats } from '../utils/usageStats'
import { supabase } from '../infrastructure/supabaseClient'

const SupporterContext = createContext(null)
const GUEST_ADS_ENABLED_KEY = 'quran_guest_ads_enabled'

const SUPPORT_UNLOCK_ADS = 50
const DAILY_REWARDED_LIMIT = 3
const QUICK_PRO_MINUTES = 60

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
  daily_quick_pro_limit: DAILY_REWARDED_LIMIT,
  daily_quick_pro_used: 0,
  daily_quick_pro_remaining: DAILY_REWARDED_LIMIT,
  can_watch_for_quick_pro: false,
}

function toStatsPayload(payload) {
  if (!payload || typeof payload !== 'object') return DEFAULT_STATS
  return {
    ...DEFAULT_STATS,
    ...payload,
  }
}

function isFutureDate(value) {
  if (!value) return false
  return new Date(value).getTime() > Date.now()
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10)
}

function buildStatsPayload({ supportRow, proExpiresAt, usedToday }) {
  const adsWatched = Number(supportRow?.ads_watched || 0)
  const cycleAds = adsWatched % SUPPORT_UNLOCK_ADS
  const remainingToNext = cycleAds === 0 ? SUPPORT_UNLOCK_ADS : (SUPPORT_UNLOCK_ADS - cycleAds)
  const supporterUntil = supportRow?.supporter_until || null
  const supporterActive = isFutureDate(supporterUntil)
  const proActive = !supporterActive && isFutureDate(proExpiresAt)
  const remainingSeconds = proActive
    ? Math.max(0, Math.floor((new Date(proExpiresAt).getTime() - Date.now()) / 1000))
    : 0

  return {
    ads_enabled: !!supportRow?.ads_enabled,
    ads_watched: adsWatched,
    usage_seconds: Number(supportRow?.usage_seconds || 0),
    supporter_until: supporterUntil,
    is_supporter: supporterActive,
    membership_type: supporterActive ? 'supporter' : 'normal',
    milestone_count: Number(supportRow?.milestone_count || 0),
    cycle_ads: cycleAds,
    remaining_to_next_unlock: remainingToNext,
    pro_expires_at: proExpiresAt || null,
    is_quick_pro_active: proActive,
    quick_pro_remaining_seconds: remainingSeconds,
    daily_quick_pro_limit: DAILY_REWARDED_LIMIT,
    daily_quick_pro_used: usedToday,
    daily_quick_pro_remaining: Math.max(0, DAILY_REWARDED_LIMIT - usedToday),
    can_watch_for_quick_pro: !supporterActive && usedToday < DAILY_REWARDED_LIMIT,
  }
}

async function ensureSupportRow(userId) {
  const { data: existing, error: readError } = await supabase
    .from('user_support_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (readError) throw readError
  if (existing) return existing

  const { data: inserted, error: insertError } = await supabase
    .from('user_support_stats')
    .insert({ user_id: userId })
    .select('*')
    .single()

  if (insertError) throw insertError
  return inserted
}

async function getTodayUsage(userId) {
  const { data } = await supabase
    .from('user_daily_pro_ad_usage')
    .select('used_count')
    .eq('user_id', userId)
    .eq('usage_date', todayDateKey())
    .maybeSingle()
  return Number(data?.used_count || 0)
}

export function SupporterProvider({ children }) {
  const { user, isLoggedIn } = useAuth()
  const [stats, setStats] = useState(DEFAULT_STATS)
  const [loading, setLoading] = useState(false)
  const [lastError, setLastError] = useState('')
  const [guestAdsEnabled, setGuestAdsEnabled] = useState(() => {
    try {
      return localStorage.getItem(GUEST_ADS_ENABLED_KEY) === '1'
    } catch {
      return false
    }
  })

  const userId = user?.id || ''

  const fetchMyStats = useCallback(async () => {
    if (!isLoggedIn || !userId) {
      setStats(DEFAULT_STATS)
      setLastError('')
      return
    }

    setLoading(true)
    setLastError('')

    try {
      const [supportRow, usedToday] = await Promise.all([
        ensureSupportRow(userId),
        getTodayUsage(userId)
      ])

      const payload = buildStatsPayload({
        supportRow,
        proExpiresAt: user?.pro_expires_at || null,
        usedToday,
      })

      setStats(toStatsPayload(payload))
    } catch (err) {
      setLastError(err?.message || 'Destek verileri alınamadı.')
      setStats(DEFAULT_STATS)
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn, userId, user?.pro_expires_at])

  useEffect(() => {
    fetchMyStats()
  }, [fetchMyStats])

  useEffect(() => {
    try {
      localStorage.setItem(GUEST_ADS_ENABLED_KEY, guestAdsEnabled ? '1' : '0')
    } catch {
      // silent
    }
  }, [guestAdsEnabled])

  const toggleAdsEnabled = useCallback(async (enabled) => {
    if (!isLoggedIn || !userId) {
      setGuestAdsEnabled(!!enabled)
      return { ads_enabled: !!enabled }
    }

    await ensureSupportRow(userId)

    const { data, error } = await supabase
      .from('user_support_stats')
      .update({ ads_enabled: !!enabled })
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) throw new Error(error.message || 'Destek modu güncellenemedi.')

    const payload = buildStatsPayload({
      supportRow: data,
      proExpiresAt: user?.pro_expires_at || null,
      usedToday: await getTodayUsage(userId)
    })
    setStats(toStatsPayload(payload))
    return payload
  }, [isLoggedIn, userId, user?.pro_expires_at])

  const watchAd = useCallback(async () => {
    if (!isLoggedIn || !userId) {
      return { stats: null }
    }

    const row = await ensureSupportRow(userId)
    const oldAds = Number(row.ads_watched || 0)
    const oldMilestones = Number(row.milestone_count || 0)
    const newAds = oldAds + 1
    const newMilestones = Math.floor(newAds / SUPPORT_UNLOCK_ADS)

    let supporterUntil = row.supporter_until || null
    if (newMilestones > oldMilestones) {
      const currentTs = isFutureDate(supporterUntil) ? new Date(supporterUntil).getTime() : Date.now()
      const deltaDays = (newMilestones - oldMilestones) * 30
      supporterUntil = new Date(currentTs + deltaDays * 24 * 60 * 60 * 1000).toISOString()
    }

    const { data, error } = await supabase
      .from('user_support_stats')
      .update({
        ads_watched: newAds,
        milestone_count: newMilestones,
        supporter_until: supporterUntil,
      })
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) throw new Error(error.message || 'Reklam katkısı kaydedilemedi.')

    const payload = buildStatsPayload({
      supportRow: data,
      proExpiresAt: user?.pro_expires_at || null,
      usedToday: await getTodayUsage(userId)
    })
    setStats(toStatsPayload(payload))
    return { stats: payload }
  }, [isLoggedIn, userId, user?.pro_expires_at])

  const createMockQuickProReward = useCallback(async () => {
    if (!isLoggedIn || !userId) {
      throw new Error('Bu özellik için giriş yapmalısınız.')
    }

    const transactionId = (globalThis.crypto?.randomUUID?.() || `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`)

    await supabase.from('rewarded_ad_callbacks').insert({
      transaction_id: transactionId,
      user_id: userId,
      reward_item: 'quick_pro_hour',
      reward_amount: 1,
      callback_payload: { source: 'frontend_mock' },
      verified: true,
      source: 'frontend_mock'
    })

    return transactionId
  }, [isLoggedIn, userId])

  const grantHourlyProAccess = useCallback(async (transactionId) => {
    if (!isLoggedIn || !userId) {
      throw new Error('Bu özellik için giriş yapmalısınız.')
    }

    const supportRow = await ensureSupportRow(userId)
    if (isFutureDate(supportRow.supporter_until)) {
      throw new Error('Kron23 Pro üyeliğiniz aktif. Bu buton size kapalıdır.')
    }

    const today = todayDateKey()
    const currentUsed = await getTodayUsage(userId)
    if (currentUsed >= DAILY_REWARDED_LIMIT) {
      throw new Error('Günlük 3 reklam limitine ulaştınız. Yarın tekrar deneyin.')
    }

    const now = Date.now()
    const currentProTs = isFutureDate(user?.pro_expires_at) ? new Date(user.pro_expires_at).getTime() : now
    const newProTs = currentProTs + QUICK_PRO_MINUTES * 60 * 1000
    const newProIso = new Date(newProTs).toISOString()

    const { error: updateUserError } = await supabase
      .from('users')
      .update({ pro_expires_at: newProIso })
      .eq('id', userId)

    if (updateUserError) {
      throw new Error(updateUserError.message || 'Pro süresi güncellenemedi.')
    }

    await supabase
      .from('user_daily_pro_ad_usage')
      .upsert({
        user_id: userId,
        usage_date: today,
        used_count: currentUsed + 1
      }, { onConflict: 'user_id,usage_date' })

    if (transactionId) {
      await supabase
        .from('rewarded_ad_callbacks')
        .update({ consumed_at: new Date().toISOString() })
        .eq('transaction_id', transactionId)
        .eq('user_id', userId)
    }

    await supabase
      .from('user_pro_access_grants')
      .insert({
        user_id: userId,
        transaction_id: transactionId || null,
        previous_expires_at: user?.pro_expires_at || null,
        new_expires_at: newProIso,
        duration_minutes: QUICK_PRO_MINUTES,
        source: 'frontend_rewarded'
      })

    const payload = buildStatsPayload({
      supportRow,
      proExpiresAt: newProIso,
      usedToday: currentUsed + 1,
    })
    setStats(toStatsPayload(payload))

    return {
      success: true,
      message: 'Teşekkürler, 1 saatlik Pro süreniz başladı!',
      status: payload
    }
  }, [isLoggedIn, userId, user?.pro_expires_at])

  const syncUsage = useCallback(async () => {
    if (!isLoggedIn || !userId) return

    const usage = getUserUsageStats(user)
    const usageSeconds = Number(usage?.totalSeconds || 0)
    if (!Number.isFinite(usageSeconds) || usageSeconds <= 0) return

    const row = await ensureSupportRow(userId)
    const merged = Math.max(Number(row.usage_seconds || 0), Math.floor(usageSeconds))

    const { data, error } = await supabase
      .from('user_support_stats')
      .update({ usage_seconds: merged })
      .eq('user_id', userId)
      .select('*')
      .single()

    if (!error && data) {
      const payload = buildStatsPayload({
        supportRow: data,
        proExpiresAt: user?.pro_expires_at || null,
        usedToday: await getTodayUsage(userId)
      })
      setStats(toStatsPayload(payload))
    }
  }, [isLoggedIn, userId, user])

  useEffect(() => {
    if (!isLoggedIn || !userId) return undefined
    syncUsage()
    const intervalId = window.setInterval(syncUsage, 30000)
    return () => window.clearInterval(intervalId)
  }, [isLoggedIn, syncUsage, userId])

  const value = useMemo(() => {
    const supporterByDate = !!(
      stats.supporter_until &&
      new Date(stats.supporter_until).getTime() > Date.now()
    )
    const supporterActive = supporterByDate || !!stats.is_supporter

    const quickProActive = !!(
      stats.pro_expires_at &&
      new Date(stats.pro_expires_at).getTime() > Date.now()
    )

    const isProAccessActive = supporterActive || quickProActive
    const membershipType = supporterActive ? 'supporter' : quickProActive ? 'quick-pro' : 'normal'
    const playlistLimit = isProAccessActive ? 999 : 1
    const journeyLimit = isProAccessActive ? 999 : 1
    const dailyQuickProLimit = Number(stats.daily_quick_pro_limit || DAILY_REWARDED_LIMIT)
    const dailyQuickProUsed = Number(stats.daily_quick_pro_used || 0)
    const dailyQuickProRemaining = Math.max(0, Number(stats.daily_quick_pro_remaining ?? (dailyQuickProLimit - dailyQuickProUsed)))

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
    }
  }, [stats, loading, lastError, fetchMyStats, toggleAdsEnabled, watchAd, syncUsage, createMockQuickProReward, grantHourlyProAccess, isLoggedIn, guestAdsEnabled])

  return <SupporterContext.Provider value={value}>{children}</SupporterContext.Provider>
}

export function useSupporter() {
  const ctx = useContext(SupporterContext)
  if (!ctx) throw new Error('useSupporter must be used within SupporterProvider')
  return ctx
}
