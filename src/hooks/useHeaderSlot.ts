import { createContext, useContext, useEffect, useState } from "react";

interface HeaderSlotContextValue {
  /** The DOM node that portals render into */
  container: HTMLDivElement | null;
  /** Callback ref — pass as ref={} on the target div */
  setContainer: (node: HTMLDivElement | null) => void;
  /** Whether a child has claimed the slot */
  slotActive: boolean;
  setSlotActive: (active: boolean) => void;
}

export const HeaderSlotContext = createContext<HeaderSlotContextValue | null>(
  null,
);

/**
 * Returns the portal container and a setter to mark the slot as active.
 * Call `setSlotActive(true)` in a useEffect when your portal content mounts.
 */
export function useHeaderSlot() {
  const context = useContext(HeaderSlotContext);
  if (!context) {
    throw new Error("useHeaderSlot must be used within DashboardLayout");
  }
  const { container, setSlotActive } = context;

  // Auto-deactivate when the consumer unmounts
  useEffect(() => {
    return () => setSlotActive(false);
  });

  return { container, setSlotActive };
}

export function useHeaderSlotProvider() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [slotActive, setSlotActive] = useState(false);
  return { container, setContainer, slotActive, setSlotActive };
}
