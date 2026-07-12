import { useEffect, useState } from "react";
import { useNavigation } from "react-router-dom";

/**
 * Route-transition indicator (Design System §21).
 *
 * A slim top-edge bar, never a full-page spinner — §21 is blunt about why: a
 * full-page spinner "is an admission that loading scope wasn't designed."
 *
 * The 300ms delay is the §21 timing rule, and it is the whole point of this
 * component: nothing appears before ~300ms, because flashing an indicator for a
 * fast response makes the app FEEL slower than showing nothing at all. Past
 * 300ms an indicator MUST appear.
 */
const APPEAR_AFTER_MS = 300;

export function RouteProgress() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isNavigating) return;

    const timer = window.setTimeout(() => setVisible(true), APPEAR_AFTER_MS);

    // Cleanup runs when the navigation settles (or is superseded), which is what
    // both cancels a not-yet-shown bar and hides a shown one. Resetting here rather
    // than in the effect body avoids a synchronous setState during render.
    return () => {
      window.clearTimeout(timer);
      setVisible(false);
    };
  }, [isNavigating]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Chargement"
      className="bg-primary fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse"
    />
  );
}
