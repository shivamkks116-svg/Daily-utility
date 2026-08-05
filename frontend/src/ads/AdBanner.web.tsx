// Web fallback for the banner — renders nothing so react-native-google-mobile-ads
// is never imported on the web bundle.
export function AdBanner(_props: { testID?: string }) {
  return null;
}
