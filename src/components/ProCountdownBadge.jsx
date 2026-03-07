import { useEffect, useMemo, useState } from 'react';
import { useSupporter } from '../contexts/SupporterContext';
import './ProCountdownBadge.css';

function formatCountdown(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function ProCountdownBadge() {
  const { isSupporter, isQuickProActive, quickProExpiresAt } = useSupporter();
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    if (!isQuickProActive || isSupporter || !quickProExpiresAt) return undefined;
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isQuickProActive, isSupporter, quickProExpiresAt]);

  const remainingSeconds = useMemo(() => {
    if (!quickProExpiresAt) return 0;
    const expiresTs = new Date(quickProExpiresAt).getTime();
    if (!Number.isFinite(expiresTs)) return 0;
    return Math.max(0, Math.floor((expiresTs - nowTs) / 1000));
  }, [quickProExpiresAt, nowTs]);

  if (isSupporter || !isQuickProActive || remainingSeconds <= 0) return null;

  return (
    <span className="pro-countdown-badge" title="Saatlik Pro erişim süreniz">
      Pro Süreniz: {formatCountdown(remainingSeconds)}
    </span>
  );
}
