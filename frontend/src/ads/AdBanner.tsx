// Native banner (Android/iOS). This file is picked by Metro on native.
import React from "react";
import { View, StyleSheet } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { AD_UNIT_IDS } from "./ids";

export function AdBanner({ testID }: { testID?: string }) {
  return (
    <View style={styles.wrap} testID={testID}>
      <BannerAd
        unitId={AD_UNIT_IDS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => {
          // Silent fail — the container height stays reserved so layout is stable.
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    minHeight: 56,
    justifyContent: "center",
  },
});
