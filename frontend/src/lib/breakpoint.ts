import { useSyncExternalStore } from 'react';

/**
 * Is the viewport phone-sized?
 *
 * The boundary is Tailwind's `sm`, so a component branching on this stays in step
 * with its own stylesheet — 639.98px rather than 639px because the query is on a
 * continuous value and a 639.5px viewport belongs on the phone side of it.
 *
 * Almost everything responsive in this app is CSS and should stay CSS: a class list
 * with `sm:` in it costs nothing and cannot fall out of sync. This exists for the
 * cases where the two layouts genuinely cannot be the same element — a panel that is
 * a portalled sheet on a phone and a dropdown anchored beside its trigger on a
 * desktop is not one element with two class lists, because only one of the two may
 * be in the tree at a time.
 *
 * `useSyncExternalStore` rather than state plus an effect: it reads the query during
 * render and subscribes without a re-render, so there is no first paint at the wrong
 * breakpoint and no gap between the initial read and the listener being attached.
 */
const QUERY = '(max-width: 639.98px)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;

/** There is no server render here; the value is only ever read in the browser. */
const getServerSnapshot = () => false;

export function useIsPhone() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
