import { useEffect, useState } from 'react';

/**
 * How long to wait for an exit animation before removing the panel regardless.
 *
 * Comfortably longer than the slowest exit in index.css (`sheet-down`, 200ms), so in
 * the ordinary case `animationend` always wins and this never fires.
 */
const EXIT_FALLBACK_MS = 450;

/**
 * Whether this viewer has asked for less motion.
 *
 * Read live rather than cached: it is consulted at the moment a panel closes, and a
 * stale answer would mean the wrong close behaviour for the rest of the session.
 */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Keeps a dialog mounted long enough to animate itself out.
 *
 * A panel that renders on `open` and returns `null` on `!open` can only ever animate
 * in: the moment it is closed it is gone, and there is nothing left to play an exit
 * on. This holds it in the tree for one more beat, in a `leaving` state, and then
 * removes it.
 *
 * The state is adjusted during render rather than in an effect. That is the pattern
 * React documents for deriving state from props, and here it also matters for the
 * result: an effect would not run until after the browser had already painted the
 * close, so the exit would start one frame late and look like a stutter.
 *
 * Removal has two triggers, and whichever arrives first wins:
 *
 * - `animationend`, the normal one. It keeps the duration in the stylesheet beside
 *   the animation rather than duplicated as a number here that has to be kept in
 *   step with it.
 *
 * - a timer, as a guarantee. `animationend` is not a promise: an animation that
 *   never starts never ends, and a CSS animation only starts once the browser
 *   actually renders the element. Miss that event — the tab is backgrounded
 *   mid-close, the element is not being painted, the animation is interrupted — and
 *   a dialog waiting solely on it stays on screen forever, with its own close button
 *   underneath it doing nothing. That failure was real and is what this timer exists
 *   to make impossible. Closing a dialog must not be able to fail.
 */
export function usePresence(open: boolean) {
  /*
    The only thing this hook remembers is whether an exit is still playing. It is
    deliberately not a three-state "phase".

    A phase held alongside `open` is a second source of truth for whether the panel
    is on screen, and the two can drift: land on `open === wasOpen === false` while
    the phase still says `entering`, and no future render sees a transition, so the
    phase never advances and the panel is pinned open with nothing able to close it —
    not its own button, not the scrim, not Escape. That is not a hypothetical; it is
    what this hook did.

    Here `open` is the single source of truth. Presence is `open` plus a grace period,
    and every path out of that grace period clears the same flag, so a closed dialog
    cannot stay on screen.
  */
  const [exiting, setExiting] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  /*
    Computed for this render rather than read back from state: `setExiting` does not
    change `exiting` for the rest of this call, and returning the old value would
    describe the state the panel is leaving instead of the one it is entering.
  */
  let nowExiting = exiting;

  if (open !== wasOpen) {
    setWasOpen(open);
    /*
      With reduced motion there is no exit to play — the stylesheet collapses every
      duration to a hundredth of a millisecond — so the panel skips the grace period
      entirely. That is both what the setting asks for and one less thing that can
      fail: for these viewers, closing never waits on anything.
    */
    nowExiting = !open && !prefersReducedMotion();
    setExiting(nowExiting);
  }

  /*
    `open` wins outright, in both directions. An open dialog is never leaving, and a
    closed one is on screen only for as long as its exit is still running — which the
    effect below always ends.
  */
  const present = open || nowExiting;
  const leaving = !open && nowExiting;

  useEffect(() => {
    if (!leaving) return undefined;
    const timer = window.setTimeout(() => setExiting(false), EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return {
    /** Render nothing when this is false. */
    present,
    /** True while the exit animation is playing. */
    leaving,
    /**
     * Bind to the animating panel's `onAnimationEnd`.
     *
     * Animation events bubble, so a child finishing its own animation would otherwise
     * unmount the whole dialog mid-exit — hence the target check.
     */
    onAnimationEnd: (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
      if (event.target !== event.currentTarget) return;
      setExiting(false);
    },
  };
}

/**
 * Remembers the last value a prop actually had.
 *
 * The companion to `usePresence` for a dialog that is closed by clearing the thing it
 * is editing rather than by flipping a boolean. The panel has to keep rendering that
 * thing for the length of its exit, and the parent has already thrown it away — so
 * this hands back the last one it saw.
 *
 * State rather than a ref: a ref may not be read or written during render, and this
 * is needed during render, by the very component whose output depends on it.
 */
export function useLastPresent<T>(value: T | null | undefined): T | null {
  const [held, setHeld] = useState<T | null>(value ?? null);
  if (value != null && value !== held) setHeld(value);
  return value ?? held;
}
