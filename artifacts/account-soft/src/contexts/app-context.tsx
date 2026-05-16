import React, { createContext, useContext, useState, useEffect } from "react";
import { useListFirms, useGetSettings } from "@workspace/api-client-react";
import type { Firm, AppSettings } from "@workspace/api-client-react";

interface AppContextType {
  activeFirm: Firm | null;
  setActiveFirm: (firm: Firm | null) => void;
  firms: Firm[];
  settings: AppSettings | null;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: firms = [], isLoading: firmsLoading } = useListFirms();
  const { data: settings, isLoading: settingsLoading } = useGetSettings();
  const [activeFirm, setActiveFirm] = useState<Firm | null>(null);

  useEffect(() => {
    if (firms.length > 0 && !activeFirm) {
      // For now, default to the first firm or one saved in localStorage
      const savedFirmId = localStorage.getItem("activeFirmId");
      const found = firms.find(f => f.id.toString() === savedFirmId);
      setActiveFirm(found || firms[0]);
    }
  }, [firms, activeFirm]);

  const handleSetActiveFirm = (firm: Firm | null) => {
    setActiveFirm(firm);
    if (firm) {
      localStorage.setItem("activeFirmId", firm.id.toString());
    }
  };

  return (
    <AppContext.Provider
      value={{
        activeFirm,
        setActiveFirm: handleSetActiveFirm,
        firms,
        settings: settings || null,
        isLoading: firmsLoading || settingsLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
