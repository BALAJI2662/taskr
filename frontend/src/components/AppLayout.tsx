import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, FileText, BarChart3, Bell,
  LogOut, X, CheckSquare, Bug, PanelLeftClose, PanelLeftOpen, Pencil,
  NotebookPen, Sun, Moon, MoreHorizontal, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { NotificationBell } from './NotificationBell';
import { applyTheme, currentTheme, type Theme } from '../lib/theme';
import { Avatar } from './ui';
import { usePresence } from '../lib/presence';
import { isManagerLevel, roleLabel } from '../types';

interface NavItem {
  to: string;
  label: string;
  /*
    The icon component, not a rendered element.

    Three surfaces draw this list — the sidebar, the bottom tab bar and the More
    sheet — and the tab bar wants a larger glyph than the other two. Baking a size
    into an element here would force the tab bar to override it from CSS, and in
    Tailwind v4 that override cannot win: `utilities` is a later cascade layer than
    `components`, so a `.bottom-nav-icon svg` rule loses to an `h-[18px]` class no
    matter how specific it is. Each surface sizing its own icon avoids the fight.
  */
  Icon: LucideIcon;
  end?: boolean;
  /**
   * What the bottom tab bar calls this item. A tab is about 70px wide, so
   * "Tasks Assigned" has to become "Assigned" there — but only there, because the
   * sidebar has the room and the longer name is the clearer one.
   */
  short?: string;
}

const MANAGER_NAV: NavItem[] = [
  { to: '/manager', label: 'Dashboard', Icon: LayoutDashboard, end: true, short: 'Home' },
  { to: '/manager/team', label: 'Team Members', Icon: Users, short: 'Team' },
  { to: '/manager/tasks', label: 'Tasks', Icon: ClipboardList },
  { to: '/manager/my-day', label: 'My Day', Icon: NotebookPen },
  { to: '/manager/reports', label: 'Daily Reports', Icon: FileText, short: 'Reports' },
  { to: '/manager/tickets', label: 'Tickets', Icon: Bug },
  { to: '/manager/analytics', label: 'Analytics', Icon: BarChart3 },
  { to: '/manager/notifications', label: 'Notifications', Icon: Bell, short: 'Alerts' },
];

const EMPLOYEE_NAV: NavItem[] = [
  { to: '/employee', label: 'Dashboard', Icon: LayoutDashboard, end: true, short: 'Home' },
  { to: '/employee/tasks-assigned', label: 'Tasks Assigned', Icon: ClipboardList, short: 'Assigned' },
  { to: '/employee/tasks-done', label: 'Tasks Done', Icon: CheckSquare, short: 'Done' },
  { to: '/employee/my-day', label: 'My Day', Icon: NotebookPen },
  { to: '/employee/tickets', label: 'Tickets', Icon: Bug },
  { to: '/employee/notifications', label: 'Notifications', Icon: Bell, short: 'Alerts' },
];

/**
 * How many destinations reach the bottom bar directly.
 *
 * Four, plus More, which makes five targets across the width of a phone. A sixth
 * would take each tab under the 44px a thumb needs on a 360px screen, so the rest of
 * the navigation goes into the More sheet rather than being squeezed in beside them.
 */
const TAB_SLOTS = 4;

/** Remembered so the choice survives a reload rather than resetting every visit. */
const COLLAPSE_KEY = 'taskr.sidebarCollapsed';

const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /** Mobile only: the sheet holding the navigation that does not fit on the tab bar. */
  const [moreOpen, setMoreOpen] = useState(false);

  /*
    Stable identities, not inline arrows.

    `closeMore` is a dependency of the sheet's own effect, and a new function on every
    render tore that effect down and rebuilt it on every render of this component —
    unbinding and rebinding the Escape key and re-locking page scroll each time.
  */
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const openMore = useCallback(() => setMoreOpen(true), []);
  /** Desktop only: the sidebar is permanent, and this narrows it to widen the page. */
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
      return next;
    });
  };

  const isManager = isManagerLevel(user?.role);
  const nav = isManager ? MANAGER_NAV : EMPLOYEE_NAV;
  const profilePath = isManager ? '/manager/profile' : '/employee/profile';
  /* The name is the only way to the profile page now, so it also has to be what
     shows you are on it — otherwise that route highlights nothing at all. */
  const onProfile = location.pathname === profilePath;

  const tabs = nav.slice(0, TAB_SLOTS);
  const overflow = nav.slice(TAB_SLOTS);
  /* The More tab lights up when the route you are on lives inside the sheet, so the
     bar always says where you are even when the destination is not on it. */
  const onOverflowRoute = overflow.some((item) => location.pathname.startsWith(item.to)) || onProfile;

  // Navigating dismisses the sheet — it is navigation, so every choice in it closes it.
  useEffect(() => { closeMore(); }, [location.pathname, closeMore]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted">
      {/*
        Sidebar — the desktop navigation, and desktop only now. Below `lg` the app
        uses the bottom tab bar instead of a slide-over copy of this: a drawer needs
        a hamburger, a tap to open and a second tap to choose, where a tab bar needs
        one tap and keeps the destinations visible the whole time.

        Collapsing narrows it to a rail rather than hiding it: the rail is always the
        way back, so navigation can never be dismissed with no route left to reopen it.
      */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-[4.75rem]' : 'w-64'
        }`}
        aria-label="Main navigation"
      >
        {/* ------------------------------------------------------------ header */}
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          {collapsed ? (
            <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CheckSquare className="h-5 w-5" />
            </span>
          ) : <BrandMark />}
          {/*
            Expanded, the collapse control sits in the header beside the wordmark.
            Collapsed there is no room for it there — the rail is barely wider than
            the logo — so it moves to its own centred row below, which is why this
            one is hidden rather than restyled.
          */}
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="rounded-lg p-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* The same control once the panel is a rail, on a row of its own. */}
        {collapsed && (
          <div className="flex shrink-0 justify-center pb-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="rounded-lg p-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          </div>
        )}

        {/*
          Who is signed in, and the way to their own details. A link rather than a
          label, and it says so on hover and to a screen reader.
        */}
        <div className={`shrink-0 border-b border-sidebar-border pb-4 ${collapsed ? 'px-2' : 'px-3'}`}>
          <Link
            to={profilePath}
            title={collapsed ? `${user?.name} — edit your details` : undefined}
            aria-label={`${user?.name}. Edit your profile details.`}
            aria-current={onProfile ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-md p-2 transition-colors ${
              onProfile ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <Avatar name={user?.name ?? '?'} src={user?.profile_image} size="md" />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/70">
                  {roleLabel(user?.role)}
                </span>
                <span className="block truncate text-sm font-bold text-sidebar-foreground">{user?.name}</span>
              </span>
            )}
            {!collapsed && (
              <Pencil className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            )}
          </Link>
        </div>

        {/* -------------------------------------------------------------- nav */}
        {/*
          Collapsed, the flyout labels sit outside the rail's own width, and a scroll
          container would clip them on that axis — `overflow-y-auto` cannot pair with
          a visible x. The rail is short enough not to need scrolling, so it drops the
          clipping entirely and only the expanded panel scrolls.
        */}
        <div className={`flex-1 px-3 py-4 ${collapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
          <nav className="space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `group relative nav-link ${
                  collapsed ? 'justify-center px-0' : ''
                } ${isActive ? 'nav-link-active' : ''}`}
              >
                <item.Icon className="h-[18px] w-[18px] shrink-0" />
                <span className={collapsed ? 'hidden' : ''}>{item.label}</span>
                {/* Collapsed, the label arrives as a flyout — the rail must still say
                    what each icon is, without depending on a native tooltip's delay. */}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-border bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="shrink-0 border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={handleLogout}
            className={`group relative nav-link w-full ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span className={collapsed ? 'hidden' : ''}>Logout</span>
            {collapsed && (
              <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-border bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-64'}`}>
        {/*
          `safe-pt` rather than a fixed offset: on a notched phone in a home-screen
          window the status bar is drawn over the page, so the header pads itself down
          by exactly the notch and its background fills the gap. Everywhere else the
          inset is zero and this is the same 64px header as before.
        */}
        <header className="safe-pt sticky top-0 z-30 border-b border-border bg-muted/90 backdrop-blur">
          {/* The same gutter as the page below, so the title lines up with the content
              it names rather than sitting 4px inside it. */}
          <div className="px-page flex h-14 items-center gap-2 sm:h-16 sm:gap-3">
            {/*
              The avatar is the mobile way to the profile, standing in for the
              sidebar's name row. On desktop the sidebar already has it, so it stops
              at `lg`.
            */}
            <Link
              to={profilePath}
              aria-label={`${user?.name}. Edit your profile details.`}
              aria-current={onProfile ? 'page' : undefined}
              className={`shrink-0 rounded-full lg:hidden ${onProfile ? 'ring-2 ring-primary ring-offset-2 ring-offset-muted' : ''}`}
            >
              <Avatar name={user?.name ?? '?'} src={user?.profile_image} size="sm" />
            </Link>

            <div className="min-w-0 flex-1">
              <p className="display-title truncate text-sm text-foreground sm:text-base">
                {isManager ? `${roleLabel(user?.role)} Dashboard` : `Welcome, ${user?.name.split(' ')[0]}`}
              </p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {isManager
                  ? 'Company-wide task and reporting overview'
                  : user?.department
                    ? `${user.job_title || 'Team Member'} · ${user.department}`
                    : 'Team Member portal'}
              </p>
            </div>

            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        {/*
          `pb-nav` reserves the height of the tab bar plus the home indicator, so the
          last card in any list clears the bar instead of sitting behind it. It
          collapses to nothing from `lg` up, where there is no bar.
        */}
        <main className="pb-nav px-page mx-auto w-full max-w-7xl py-5 sm:py-8">
          {/*
            Keyed on the path, so React remounts this wrapper on every navigation and
            the entrance animation replays. Without the key the same element would be
            reused and the animation would run once, on first load, and never again.

            The wrapper is transformed for a fraction of a second, which would make it
            the containing block for any `position: fixed` descendant caught inside
            that window. Nothing is: every dialog on every page starts closed, so none
            can be open at the moment a route mounts.
          */}
          <div key={location.pathname} className="route-enter">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileTabBar
        tabs={tabs}
        hasOverflow={overflow.length > 0}
        moreActive={onOverflowRoute}
        onMore={openMore}
      />

      <MoreSheet
        open={moreOpen}
        onClose={closeMore}
        items={overflow}
        profilePath={profilePath}
        onLogout={handleLogout}
      />
    </div>
  );
}

/* ------------------------------------------------------------- mobile tab bar */

/**
 * The bottom navigation, phones and small tablets only.
 *
 * Bottom rather than top because that is the half of a phone a thumb reaches without
 * regripping, and because a fixed top bar competes with the browser's own. The tabs
 * are `NavLink`s, so the active state is the router's answer rather than a second
 * copy of the routing table kept in sync by hand.
 */
function MobileTabBar({
  tabs, hasOverflow, moreActive, onMore,
}: {
  tabs: NavItem[];
  hasOverflow: boolean;
  moreActive: boolean;
  onMore: () => void;
}) {
  const { unread } = useNotifications();

  return (
    <div className="bottom-nav">
      <nav className="bottom-nav-bar" aria-label="Primary">
        {tabs.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'bottom-nav-item-active' : ''}`}
          >
            <span className="bottom-nav-icon">
              <item.Icon className="h-[22px] w-[22px]" />
            </span>
            <span className="w-full truncate text-center">{item.short ?? item.label}</span>
          </NavLink>
        ))}

        {hasOverflow && (
          <button
            type="button"
            onClick={onMore}
            aria-label="More navigation"
            aria-haspopup="dialog"
            className={`bottom-nav-item ${moreActive ? 'bottom-nav-item-active' : ''}`}
          >
            <span className="bottom-nav-icon">
              {/*
                The badge is anchored to the glyph, not to the pill around it. On the
                pill's own corner it sat over the middle of the icon and swallowed the
                third dot; from here it clears the glyph and overhangs the pill, which
                is where a count belongs.
              */}
              <span className="relative inline-flex">
                <MoreHorizontal className="h-[22px] w-[22px]" />
                {/*
                  Notifications live in the sheet, so their count has to surface on
                  the tab that opens it — otherwise the only unread indicator on a
                  phone is inside the thing you have to open to find out.
                */}
                {unread > 0 && (
                  <span
                    className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground"
                    aria-hidden
                  >
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </span>
            </span>
            <span className="w-full truncate text-center">More</span>
          </button>
        )}
      </nav>
    </div>
  );
}

/* ----------------------------------------------------------------- more sheet */

/**
 * The rest of the navigation, as a bottom sheet.
 *
 * A sheet rather than a full-screen page: it keeps the screen you were on visible
 * behind it, so choosing nothing and dismissing costs no context. It holds what did
 * not fit on the bar, plus the two things the sidebar keeps in its own corners —
 * your profile and signing out.
 */
function MoreSheet({
  open, onClose, items, profilePath, onLogout,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  profilePath: string;
  onLogout: () => void;
}) {
  const { user } = useAuth();
  /* Held in the tree while it slides back down — see `usePresence`. */
  const { present, leaving, onAnimationEnd } = usePresence(open);

  // Escape closes, and the page behind is locked so the sheet is the only thing that
  // scrolls while it is open.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!present) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] ${
          leaving ? 'animate-scrim-out' : 'animate-scrim-in'
        }`}
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
        onAnimationEnd={onAnimationEnd}
        className={`safe-pb relative max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-card shadow-2xl ${
          leaving ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        data-scroll
      >
        <div className="sheet-handle" aria-hidden />

        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <h2 className="text-base font-semibold text-foreground">More</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Your own account, at the top, the way it sits at the top of the sidebar. */}
        <div className="px-3">
          <Link
            to={profilePath}
            className="press flex items-center gap-3 rounded-xl border border-border p-3 transition-colors active:bg-muted"
          >
            <Avatar name={user?.name ?? '?'} src={user?.profile_image} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">{user?.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{roleLabel(user?.role)}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>

        <nav className="mt-2 px-3 pb-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `press flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-medium transition-colors active:bg-muted ${
                isActive ? 'bg-primary/10 text-primary-strong' : 'text-foreground'
              }`}
            >
              <item.Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={onLogout}
            className="press flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-medium text-destructive transition-colors active:bg-destructive/10"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Light and dark.
 *
 * The state is seeded from what is already on the document rather than from storage,
 * so the button agrees with the theme the pre-paint script chose — including the case
 * where that came from the operating system and nothing is stored yet.
 *
 * One button rather than two, because there are exactly two states: it shows the moon
 * when clicking it would go dark, and the sun when clicking it would come back.
 */
function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : currentTheme()
  ));

  const flip = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  const goingDark = theme !== 'dark';
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={goingDark ? 'Switch to dark mode' : 'Switch to light mode'}
      title={goingDark ? 'Dark mode' : 'Light mode'}
      className="tap shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {goingDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  );
}

/** The wordmark, always on the deep plum surface, so it is always light text. */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <CheckSquare className="h-5 w-5" />
      </span>
      <span className="display-title text-lg leading-tight text-background">Taskr</span>
    </span>
  );
}
