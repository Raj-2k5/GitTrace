/* ============================================================
 * GitTrace — Notification Toast
 * ------------------------------------------------------------
 * Bottom-right toast for new activity in watched repos.
 * Auto-dismisses after 8 seconds.
 * ============================================================ */

import { useEffect } from 'react';
import { useWatch } from '../../contexts/WatchContext';

export default function NotificationToast({ onNavigate }) {
  const { notifications, clearNotification } = useWatch();

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (notifications.length === 0) return;

    const timers = notifications.map(n =>
      setTimeout(() => clearNotification(n.id), 8000)
    );

    return () => timers.forEach(t => clearTimeout(t));
  }, [notifications, clearNotification]);

  if (notifications.length === 0) return null;

  // Show only the most recent 3
  const visible = notifications.slice(-3);

  return (
    <div className="notification-stack">
      {visible.map(n => (
        <div key={n.id} className="notification-toast" id={`notif-${n.id}`}>
          <button
            className="notification-toast__close"
            onClick={() => clearNotification(n.id)}
          >
            ✕
          </button>
          <div className="notification-toast__title">{n.message}</div>
          <div className="notification-toast__sub">
            New commits since you last checked
          </div>
          <button
            className="notification-toast__action"
            onClick={() => {
              clearNotification(n.id);
              onNavigate(`https://github.com/${n.owner}/${n.repo}`);
            }}
          >
            View now →
          </button>
        </div>
      ))}
    </div>
  );
}
