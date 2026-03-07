import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSupporter } from '../contexts/SupporterContext';
import './SupportAdPrompt.css';

const MIN_INTERVAL_MS = 90000;
const MAX_INTERVAL_MS = 160000;
const WATCH_SECONDS = 5;

function randomInterval() {
  return Math.floor(MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS));
}

export default function SupportAdPrompt() {
  const { adsEnabled, watchAd } = useSupporter();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [remaining, setRemaining] = useState(WATCH_SECONDS);
  const [showContributionToast, setShowContributionToast] = useState(false);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);

  const shouldRun = useMemo(() => {
    if (!adsEnabled) return false;
    const blocked = ['/kaydol', '/giris'];
    return !blocked.includes(location.pathname);
  }, [adsEnabled, location.pathname]);

  useEffect(() => {
    if (!shouldRun) {
      setIsOpen(false);
      return undefined;
    }

    const scheduleNext = () => {
      timerRef.current = window.setTimeout(() => {
        setIsOpen(true);
      }, randomInterval());
    };

    scheduleNext();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [shouldRun, isOpen]);

  const closePrompt = () => {
    if (isWatching) return;
    setIsOpen(false);
  };

  const startWatch = () => {
    if (isWatching) return;
    setIsWatching(true);
    setRemaining(WATCH_SECONDS);

    intervalRef.current = window.setInterval(async () => {
      setRemaining((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (!isWatching || remaining > 0) return;

    const finish = async () => {
      try {
        await watchAd();
        setShowContributionToast(true);
      } catch {
        setShowContributionToast(false);
      } finally {
        setIsWatching(false);
        setIsOpen(false);
        setRemaining(WATCH_SECONDS);
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    finish();
  }, [isWatching, remaining, watchAd]);

  useEffect(() => {
    if (!showContributionToast) return undefined;
    const timerId = window.setTimeout(() => setShowContributionToast(false), 3200);
    return () => window.clearTimeout(timerId);
  }, [showContributionToast]);

  if (!shouldRun) return null;

  return (
    <>
      {showContributionToast && (
        <div className="support-ad-toast">
          Reklam katkısı işlendi.
        </div>
      )}

      {isOpen && (
        <div className="support-ad-overlay" onClick={closePrompt}>
          <div className="support-ad-card" onClick={(event) => event.stopPropagation()}>
            <span className="support-ad-badge">DESTEK MODU</span>
            <h3>Kısa bir reklamla destek olur musunuz?</h3>
            <p>
              Her izleme katkı sayısına eklenir. 50 reklama ulaşınca 1 aylık Pro üyelik açılır.
            </p>
            <div className="support-ad-actions">
              <button type="button" className="support-ad-btn passive" onClick={closePrompt} disabled={isWatching}>
                Sonra
              </button>
              <button type="button" className="support-ad-btn active" onClick={startWatch} disabled={isWatching}>
                {isWatching ? `İzleniyor ${remaining}s` : 'Reklamı İzle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
