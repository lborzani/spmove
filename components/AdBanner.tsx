import React from 'react';
import { View, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSubscription } from '@/context/SubscriptionContext';
import { theme } from '@/constants/theme';

// Substitua pelos IDs reais do console do AdMob em produção
const AD_UNIT_ID = Platform.select({
  android: __DEV__ ? TestIds.BANNER : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  ios: __DEV__ ? TestIds.BANNER : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  default: TestIds.BANNER,
});

export function AdBanner() {
  const { isPremium } = useSubscription();
  if (isPremium) return null;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.border,
        backgroundColor: theme.bg,
        alignItems: 'center',
      }}>
      <BannerAd
        unitId={AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}
