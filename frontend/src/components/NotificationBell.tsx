import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ClipboardList, RefreshCw, PartyPopper } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { relativeTime } from '../lib/format';
import { EmptyState, Spinner } from './ui';
import { useIsPhone } from '../lib/breakpoint';
import { usePresence } from '../lib/presence';
import type { AppNotification } from '../types';
import { isManagerLevel } from '../types';

export function NotificationBell() {
  const { items, unread, loading, markRead, markAllRead, reload } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isPhone = useIsPhone();
  /* Held in the tree while the panel animates away — see `usePresence`. */
  const { present, leaving, onAnimationEnd } = usePresence(open);
  const wrapRef = useRef<HTMLDivElement>(null);
  /*
    The panel on a phone is portalled into the body, so it is not inside `wrapRef`
    any more and the outside-click handler below would read a tap on a notification
    as a tap outside the bell. It has to be asked about separately.
  */
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape — standard dropdown behaviour.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /** Clicking a notification marks it read and jumps straight to the task it is about. */
  const handleOpen = async (n: AppNotification) => {
    setOpen(false);
    if (!n.is_read) await markRead(n.id);

    const base = isManagerLevel(user?.role) ? '/manager' : '/employee';
    if (n.related_ticket_id) {
      navigate(`${base}/tickets?highlight=${n.related_ticket_id}`);
      return;
    }
    if (n.related_task_id) {
      navigate(isManagerLevel(user?.role)
        ? `/manager/tasks?highlight=${n.related_task_id}`
        : `/employee/tasks-assigned?highlight=${n.related_task_id}`);
      return;
    }
    navigate(`${base}/notifications`);
  };

  /*
    The panel's contents, shared by both presentations below.

    Extracted rather than duplicated: the phone and the desktop put it in two
    different places in the DOM — a portal and an anchored dropdown — and a list of
    notifications written out twice is a list that will drift.
  */
  const body = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
          Notifications {unread > 0 && <span className="text-muted-foreground">({unread} unread)</span>}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void reload()}
            aria-label="Refresh notifications"
            className="tap rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="flex items-center gap-1 rounded px-2 py-2 text-xs font-semibold text-primary-strong hover:bg-primary/10 sm:py-1"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {/* The words go on a phone; the icon already says it, and the header
                  has to fit a count and two controls at 360px. */}
              <span className="hidden sm:inline">Mark all read</span>
              <span className="sr-only sm:hidden">Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/*
        A max-height rather than `flex-1`.

        `flex-1` carries a flex-basis of 0, and in a container whose own height is
        driven by its content that resolves to a list zero pixels tall — which is
        what left the panel showing nothing but its footer button. Capping the height
        instead lets it hug a short list and scroll a long one.
      */}
      <div className="max-h-[55dvh] overflow-y-auto sm:max-h-96" data-scroll>
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<PartyPopper className="h-6 w-6" />}
            title="You're all caught up!"
            description="New task assignments and updates will show up here."
          />
        ) : (
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void handleOpen(n)}
                  className={`flex w-full items-start gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-muted active:bg-muted sm:py-3 ${
                    n.is_read ? '' : 'bg-primary/5'
                  }`}
                >
                  <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    n.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary-strong'
                  }`}
                  >
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`truncate text-sm ${n.is_read ? 'font-medium text-foreground' : 'font-semibold text-foreground'}`}>
                        {n.title}
                      </span>
                      {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground line-clamp-2">{n.message}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{relativeTime(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setOpen(false);
          navigate(isManagerLevel(user?.role) ? '/manager/notifications' : '/employee/notifications');
        }}
        className="block w-full shrink-0 bg-muted px-4 py-4 text-center text-sm font-semibold text-primary-strong hover:bg-muted sm:py-3"
      >
        View all notifications
      </button>
    </>
  );

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) void reload(); }}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="tap relative shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/*
        On a phone the panel is a bottom sheet, and it is rendered into the body
        rather than here beside the bell.

        The app header carries a `backdrop-blur`, and `backdrop-filter` makes an
        element the containing block for every `position: fixed` descendant. Left in
        place, the sheet's `bottom: 0` resolved against the 56px header rather than
        the viewport, and the panel was drawn almost entirely above the top of the
        screen — the only part still on it was the last row, the "View all
        notifications" button. A portal to the body puts the sheet back in the
        viewport's coordinate space.

        The desktop dropdown stays here deliberately: it is positioned against the
        bell, so living inside the header is exactly what it wants.
      */}
      {present && (isPhone ? createPortal(
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] ${
              leaving ? 'animate-scrim-out' : 'animate-scrim-in'
            }`}
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            onAnimationEnd={onAnimationEnd}
            className={`safe-pb fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden
                       rounded-t-3xl border border-border bg-popover text-popover-foreground shadow-2xl ${
              leaving ? 'animate-sheet-down' : 'animate-sheet-up'
            }`}
          >
            <div className="sheet-handle" aria-hidden />
            {body}
          </div>
        </>,
        document.body,
      ) : (
        <div
          ref={panelRef}
          onAnimationEnd={onAnimationEnd}
          className={`absolute right-0 z-50 mt-2 flex w-[min(22rem,calc(100vw-2rem))] flex-col
                     overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg ${
            leaving ? 'animate-out-down' : 'animate-in-up'
          }`}
        >
          {body}
        </div>
      ))}
    </div>
  );
}
