import { createContext, type ReactNode, useContext, useState } from "react";

interface HeaderSlotContextValue {
  slot: ReactNode | null;
  setSlot: (node: ReactNode) => void;
  clearSlot: () => void;
}

export const HeaderSlotContext = createContext<HeaderSlotContextValue | null>(
  null,
);

export function useHeaderSlot() {
  const context = useContext(HeaderSlotContext);
  if (!context) {
    throw new Error("useHeaderSlot must be used within DashboardLayout");
  }
  return context;
}

export function useHeaderSlotProvider() {
  const [slot, setSlotState] = useState<ReactNode | null>(null);
  const setSlot = (node: ReactNode) => setSlotState(node);
  const clearSlot = () => setSlotState(null);
  return { slot, setSlot, clearSlot };
}
