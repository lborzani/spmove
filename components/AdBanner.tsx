import React from 'react';
import { View, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSubscription } from '@/context/SubscriptionContext';
import { useRuntimeTheme } from '@/context/RuntimeThemeContext';

// Substitua pelos IDs reais do console do AdMob em produção
const AD_UNIT_ID = Platform.select({
  android: __DEV__ ? TestIds.BANNER : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  ios: __DEV__ ? TestIds.BANNER : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  default: TestIds.BANNER,
});

export function AdBanner() {
  const { isPremium } = useSubscription();
  const { rt } = useRuntimeTheme();
  if (isPremium) return null;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: rt.border,
        backgroundColor: rt.bg,
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
