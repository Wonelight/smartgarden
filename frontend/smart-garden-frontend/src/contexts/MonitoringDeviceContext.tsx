import React, { createContext, useContext, useState, useCallback } from 'react';

interface MonitoringDeviceContextValue {
    selectedDeviceId: number | null;
    setSelectedDeviceId: (id: number | null) => void;
}

const MonitoringDeviceContext = createContext<MonitoringDeviceContextValue | null>(null);

export const MonitoringDeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
    return (
        <MonitoringDeviceContext.Provider
            value={{
                selectedDeviceId,
                setSelectedDeviceId: useCallback((id: number | null) => setSelectedDeviceId(id), []),
            }}
        >
            {children}
        </MonitoringDeviceContext.Provider>
    );
};

export function useMonitoringDevice(): MonitoringDeviceContextValue {
    const ctx = useContext(MonitoringDeviceContext);
    if (!ctx) {
        return {
            selectedDeviceId: null,
            setSelectedDeviceId: () => {},
        };
    }
    return ctx;
}
