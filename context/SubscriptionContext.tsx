import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PREMIUM_PRODUCT_ID = 'com.lborzani.spmove.premium_monthly';
const PREMIUM_STORAGE_KEY = 'spmove_is_premium';

interface SubscriptionContextValue {
  isPremium: boolean;
  loading: boolean;
  purchasing: boolean;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  isPremium: false,
  loading: true,
  purchasing: false,
  purchase: async () => {},
  restore: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(PREMIUM_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'true') setIsPremium(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const purchase = useCallback(async () => {}, []);
  const restore = useCallback(async () => {}, []);

  return (
    <SubscriptionContext.Provider
      value={{ isPremium, loading, purchasing: false, purchase, restore }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
