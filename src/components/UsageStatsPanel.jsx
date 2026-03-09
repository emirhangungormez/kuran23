import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { surahs } from '../data/quranData';
import {
  getUserUsageStats,
  getLastDaysSeries,
  getTopDurations,
  formatDurationLabel,
} from '../utils/usageStats';
import './UsageStatsPanel.css';

const REFRESH_INTERVAL_MS = 10000;
const UI_TEXT = {
  totalReadingTime: 'Toplam Okuma S\u00fcresi',
  allTime: 'T\u00fcm zamanlar',
  last7Days: 'Son 7 G\u00fcn',
  currentPace: 'G\u00fcncel tempo',
  dailyTimeDistribution: 'G\u00fcnl\u00fck Vakit Da\u011f\u0131l\u0131m\u0131',
  last7DaysLower: 'Son 7 g\u00fcn',
  mostVisitedSurahs: 'En \u00c7ok Ziyaret Edilen Sureler',
  mostSpentVerses: 'En \u00c7ok Vakit Ge\u00e7irilen Ayetler',
  records: 'kay\u0131t',
  notEnoughTimeData: 'Hen\u00fcz yeterli s\u00fcre verisi olu\u015fmad\u0131.',
  notEnoughVerseData: 'Hen\u00fcz yeterli ayet verisi olu\u015fmad\u0131.',
  autoStatsNote: 'S\u00fcre ve ayet sayfalar\u0131nda ge\u00e7irdi\u011fin s\u00fcre birikmeye ba\u015flad\u0131\u011f\u0131nda burada otomatik olarak g\u00f6sterilir.',
  verseSuffix: '. ayet',
};

function parseVerseKey(verseKey) {
  const [surahIdText, ayahText] = String(verseKey || '').split(':');
  const surahId = Number(surahIdText);
  const ayahNo = Number(ayahText);
  if (!Number.isFinite(surahId) || !Number.isFinite(ayahNo)) return null;
  return { surahId, ayahNo };
}

function getSurahName(surahId) {
  const match = surahs.find((item) => Number(item.no) === Number(surahId));
  return match?.nameTr || `Sure ${surahId}`;
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRankClass(index) {
  if (index === 0) return 'is-gold';
  if (index === 1) return 'is-silver';
  if (index === 2) return 'is-bronze';
  return '';
}

export default function UsageStatsPanel() {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((prev) => prev + 1);
    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const usage = useMemo(() => {
    void version;
    return getUserUsageStats(user);
  }, [user, version]);
  const dailySeries = useMemo(() => getLastDaysSeries(usage, 7), [usage]);
  const topSurahs = useMemo(() => getTopDurations(usage.surahs, 6), [usage.surahs]);
  const topVerses = useMemo(() => getTopDurations(usage.verses, 6), [usage.verses]);

  const maxDaily = dailySeries.reduce((max, item) => Math.max(max, item.seconds), 0);
  const weeklyTotal = dailySeries.reduce((sum, item) => sum + item.seconds, 0);
  const hasData = usage.totalSeconds > 0;
  const todayKey = useMemo(() => getTodayKey(), []);

  return (
    <section className="usage-stats-panel">
      <div className="usage-summary-grid">
        <article className="usage-summary-card usage-summary-card-total">
          <div className="usage-summary-head">
            <span className="usage-summary-dot" aria-hidden="true" />
            <span className="usage-summary-label">{UI_TEXT.totalReadingTime}</span>
          </div>
          <strong className="usage-summary-value">{formatDurationLabel(usage.totalSeconds)}</strong>
          <span className="usage-summary-meta">{UI_TEXT.allTime}</span>
        </article>
        <article className="usage-summary-card usage-summary-card-week">
          <div className="usage-summary-head">
            <span className="usage-summary-dot" aria-hidden="true" />
            <span className="usage-summary-label">{UI_TEXT.last7Days}</span>
          </div>
          <strong className="usage-summary-value">{formatDurationLabel(weeklyTotal)}</strong>
          <span className="usage-summary-meta">{UI_TEXT.currentPace}</span>
        </article>
      </div>

      <article className="usage-card">
        <div className="usage-card-head">
          <h3>{UI_TEXT.dailyTimeDistribution}</h3>
          <span className="usage-card-sub">{UI_TEXT.last7DaysLower}</span>
        </div>
        <div className="usage-bars">
          {dailySeries.map((item) => {
            const barHeight = maxDaily > 0 ? Math.max(8, (item.seconds / maxDaily) * 100) : 8;
            const isToday = item.key === todayKey;
            const isPeak = maxDaily > 0 && item.seconds === maxDaily;
            return (
              <div
                key={item.key}
                className={`usage-bar-col ${item.seconds > 0 ? 'has-value' : ''} ${isToday ? 'is-today' : ''} ${isPeak ? 'is-peak' : ''}`.trim()}
              >
                <span className="usage-bar-value">{formatDurationLabel(item.seconds)}</span>
                <div className="usage-bar-track">
                  <div className="usage-bar-fill" style={{ height: `${barHeight}%` }} />
                </div>
                <span className="usage-bar-label">{item.dayLabel}</span>
              </div>
            );
          })}
        </div>
      </article>

      <div className="usage-lists-grid">
        <article className="usage-card">
          <div className="usage-card-head">
            <h3>{UI_TEXT.mostVisitedSurahs}</h3>
            <span className="usage-card-sub">{topSurahs.length} {UI_TEXT.records}</span>
          </div>
          {topSurahs.length > 0 ? (
            <div className="usage-list">
              {topSurahs.map((item, index) => (
                <div key={item.key} className={`usage-list-row ${index < 3 ? 'is-top' : ''}`.trim()}>
                  <div className="usage-list-main">
                    <span className={`usage-list-rank ${getRankClass(index)}`.trim()}>{index + 1}</span>
                    <span className="usage-list-name">{getSurahName(item.key)}</span>
                  </div>
                  <span className="usage-list-time">{formatDurationLabel(item.seconds)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="usage-empty">{UI_TEXT.notEnoughTimeData}</p>
          )}
        </article>

        <article className="usage-card">
          <div className="usage-card-head">
            <h3>{UI_TEXT.mostSpentVerses}</h3>
            <span className="usage-card-sub">{topVerses.length} {UI_TEXT.records}</span>
          </div>
          {topVerses.length > 0 ? (
            <div className="usage-list">
              {topVerses.map((item, index) => {
                const parsed = parseVerseKey(item.key);
                if (!parsed) return null;
                return (
                  <div key={item.key} className={`usage-list-row ${index < 3 ? 'is-top' : ''}`.trim()}>
                    <div className="usage-list-main">
                      <span className={`usage-list-rank ${getRankClass(index)}`.trim()}>{index + 1}</span>
                      <span className="usage-list-name">
                        {getSurahName(parsed.surahId)} · {parsed.ayahNo}{UI_TEXT.verseSuffix}
                      </span>
                    </div>
                    <span className="usage-list-time">{formatDurationLabel(item.seconds)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="usage-empty">{UI_TEXT.notEnoughVerseData}</p>
          )}
        </article>
      </div>

      {!hasData && (
        <p className="usage-empty usage-empty-wide">{UI_TEXT.autoStatsNote}</p>
      )}
    </section>
  );
}
