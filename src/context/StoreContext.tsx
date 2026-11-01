import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Store } from '../types';
import { api, tokenStorage } from '../services/api';

interface StoreContextType {
  stores: Store[];
  currentStore: Store | null;
  selectedStoreId: number | null; // null = Consolidated / All Stores
  setSelectedStoreId: (id: number | null) => void;
  loading: boolean;
  refreshStores: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType>({
  stores: [],
  currentStore: null,
  selectedStoreId: null,
  setSelectedStoreId: () => {},
  loading: false,
  refreshStores: async () => {},
});

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem('bussinex_selected_store');
    return saved ? (saved === 'all' ? null : Number(saved)) : null;
  });
  const [loading, setLoading] = useState(false);

  const setSelectedStoreId = (id: number | null) => {
    setSelectedStoreIdState(id);
    if (id === null) {
      localStorage.setItem('bussinex_selected_store', 'all');
    } else {
      localStorage.setItem('bussinex_selected_store', String(id));
    }
  };

  const refreshStores = useCallback(async () => {
    if (!tokenStorage.get()) {
      setStores([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.stores.getStores();
      setStores(data || []);
      // If selectedStoreId is set but not in list, fallback to primary or all
      if (selectedStoreId !== null && data.length > 0 && !data.some(s => s.id === selectedStoreId)) {
        const primary = data.find(s => s.is_primary) || data[0];
        setSelectedStoreId(primary.id);
      }
    } catch {
      // Keep existing stores if request fails
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    refreshStores();

    const handleAuthChange = () => {
      refreshStores();
    };

    window.addEventListener('bussinex-logout', () => {
      setStores([]);
      setSelectedStoreIdState(null);
    });

    window.addEventListener('bussinex-login', handleAuthChange);

    return () => {
      window.removeEventListener('bussinex-login', handleAuthChange);
    };
  }, [refreshStores]);

  const currentStore = selectedStoreId 
    ? (stores.find(s => s.id === selectedStoreId) || null) 
    : null;

  return (
    <StoreContext.Provider
      value={{
        stores,
        currentStore,
        selectedStoreId,
        setSelectedStoreId,
        loading,
        refreshStores,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
