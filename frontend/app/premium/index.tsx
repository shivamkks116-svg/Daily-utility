import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, fontSize, fontWeight } from "@/src/theme";
import {
  useSubscription,
  rcNativeAvailable,
  REVENUECAT_ENTITLEMENT_IDENTIFIER,
} from "@/src/subscription/RevenueCat";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ------------------------------------------------------------------ */
/*                            Static content                           */
/* ------------------------------------------------------------------ */

const BENEFITS = [
  { icon: "close-circle", label: "Ad-free experience", desc: "No banner or interstitial ads, ever." },
  { icon: "sparkles", label: "Unlimited AI chat", desc: "No daily quota on Gemini responses." },
  { icon: "document-attach", label: "Advanced PDF tools", desc: "Larger files, batch merge, priority processing." },
  { icon: "images", label: "Higher image limits", desc: "OCR & describe unlimited images." },
  { icon: "shield-checkmark", label: "Priority support", desc: "Faster response on support tickets." },
  { icon: "medal", label: "Premium badge", desc: "Show off your Premium status in Profile." },
];

const COMPARISON: { label: string; free: string; pro: string; icon: string }[] = [
  { label: "AI chat responses / day", free: "10", pro: "Unlimited", icon: "chatbubbles" },
  { label: "Advertisements", free: "Shown", pro: "Removed", icon: "close-circle" },
  { label: "PDF merge / compress size", free: "Up to 10 MB", pro: "Up to 200 MB", icon: "document-attach" },
  { label: "Image OCR & describe", free: "5 / day", pro: "Unlimited", icon: "images" },
  { label: "Support priority", free: "Standard", pro: "Priority", icon: "shield-checkmark" },
  { label: "Premium badge in profile", free: "—", pro: "Included", icon: "medal" },
];

const TESTIMONIALS: { name: string; avatar: string; text: string }[] = [
  { name: "Priya S.", avatar: "P", text: "Ad-free experience aur unlimited AI — worth every rupee!" },
  { name: "Rahul K.", avatar: "R", text: "PDF merge tool ne mera office ka half kaam bacha diya." },
  { name: "Ananya M.", avatar: "A", text: "Best productivity app I've bought this year. 💚" },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Kya main kabhi bhi cancel kar sakta hoon?",
    a: "Haan. Google Play → Subscriptions se ek tap me cancel kar sakte ho. Current period ke end tak Premium features chalte rahenge.",
  },
  {
    q: "Kya yearly plan me discount milta hai?",
    a: "Bilkul. Yearly plan monthly ke comparison me ~40% saste padta hai — ek saal ke commitment ka fayda.",
  },
  {
    q: "Kya free trial available hai?",
    a: "Agar aapke Google Play account par eligible ho, to free trial automatically apply hoga. Trial ke baad hi payment charge hoga.",
  },
  {
    q: "Kya multiple devices par kaam karega?",
    a: "Haan. Same Google account se login karo, aur Premium sabhi devices par auto-restore ho jayega.",
  },
];

/* ------------------------------------------------------------------ */
/*                         Package helpers                             */
/* ------------------------------------------------------------------ */

type PackageMeta = {
  key: string;
  title: string;
  period: string;
  badge?: string;
  savings?: string;
  monthlyEquivalent?: string;
  trialLabel?: string;
};

function detectTrial(pkg: any): string | null {
  const p = pkg?.product;
  // react-native-purchases exposes intro / free trial info under `introPrice` or `defaultOption`
  const intro = p?.introPrice;
  if (intro && intro.price === 0 && intro.periodNumberOfUnits && intro.periodUnit) {
    return `${intro.periodNumberOfUnits}-${String(intro.periodUnit).toLowerCase()} free trial`;
  }
  const option = p?.defaultOption?.freePhase;
  if (option?.billingPeriod?.iso8601) {
    // ISO 8601 like "P7D" or "P1W"
    const iso: string = option.billingPeriod.iso8601;
    const m = iso.match(/P(\d+)([DWMY])/);
    if (m) {
      const unit = { D: "day", W: "week", M: "month", Y: "year" }[m[2] as "D"];
      return `${m[1]}-${unit} free trial`;
    }
  }
  return null;
}

function packageMeta(pkg: any, allPackages: any[]): PackageMeta {
  const id = pkg?.identifier || pkg?.packageType || "";
  const productId = pkg?.product?.identifier || "";
  const price = pkg?.product?.price || 0;
  const trialLabel = detectTrial(pkg);

  // Recognise the dashboard-configured "monthly" package for `dailyhub_premium`.
  const isMonthly =
    id.includes("MONTHLY") ||
    id === "$rc_monthly" ||
    id.toLowerCase() === "monthly" ||
    productId === "dailyhub_premium";

  if (isMonthly) {
    return {
      key: "monthly",
      title: "Monthly",
      period: "/month",
      trialLabel: trialLabel ?? undefined,
    };
  }
  if (id.includes("ANNUAL") || id === "$rc_annual" || id.toLowerCase() === "annual") {
    // Compute dynamic savings vs monthly
    const monthly = allPackages.find(
      (p) =>
        (p?.identifier || "").includes("MONTHLY") ||
        p?.identifier === "$rc_monthly" ||
        (p?.identifier || "").toLowerCase() === "monthly",
    );
    let savings = "Save 40%";
    let monthlyEquivalent: string | undefined;
    if (monthly?.product?.price && price) {
      const yearlyIfMonthly = monthly.product.price * 12;
      const pct = Math.max(1, Math.round(((yearlyIfMonthly - price) / yearlyIfMonthly) * 100));
      savings = `Save ${pct}%`;
      const cur = pkg?.product?.currencyCode || "";
      monthlyEquivalent = `${cur} ${(price / 12).toFixed(2)}/mo`;
    }
    return {
      key: "annual",
      title: "Yearly",
      period: "/year",
      badge: "MOST POPULAR",
      savings,
      monthlyEquivalent,
      trialLabel: trialLabel ?? undefined,
    };
  }
  if (id.includes("LIFETIME") || id === "$rc_lifetime") {
    return { key: "lifetime", title: "Lifetime", period: "one-time", badge: "FOREVER" };
  }
  return { key: id, title: pkg?.product?.title || "Plan", period: "" };
}

/* ------------------------------------------------------------------ */
/*                              Screen                                 */
/* ------------------------------------------------------------------ */

export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sub = useSubscription();
  const [selected, setSelected] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const cards = useMemo(() => {
    const list = sub.packages || [];
    return list
      .map((p) => ({ pkg: p, meta: packageMeta(p, list) }))
      .sort((a, b) => (a.meta.key === "annual" ? -1 : b.meta.key === "annual" ? 1 : 0));
  }, [sub.packages]);

  // Default select yearly if available
  React.useEffect(() => {
    if (!selected && cards.length) setSelected(cards[0].meta.key);
  }, [cards, selected]);

  const activeCard = cards.find((c) => c.meta.key === selected) || cards[0];
  const activeTrial = activeCard?.meta.trialLabel;

  const doBuy = async () => {
    if (!rcNativeAvailable) {
      Alert.alert(
        "Development build required",
        "Purchases only work in a real Android APK. Install from Play Store or your development build.",
      );
      return;
    }
    if (!sub.identityReady) {
      Alert.alert("Sign in first", sub.identityError || "Please sign in with Google to subscribe.");
      return;
    }
    if (!activeCard) return;
    try {
      await sub.purchase(activeCard.pkg);
      Alert.alert("Welcome to Premium! 🎉", "Your subscription is active. Enjoy an ad-free experience.");
    } catch (e: any) {
      const msg = String(e?.userCancelled ? "" : e?.message || e);
      if (!msg) return;
      Alert.alert("Purchase failed", msg);
    }
  };

  const doRestore = async () => {
    if (!rcNativeAvailable) {
      Alert.alert("Development build required", "Restore only works in a real Android APK.");
      return;
    }
    try {
      await sub.restore();
      if (sub.isSubscribed) Alert.alert("Restored", "Your Premium subscription has been restored.");
      else Alert.alert("Nothing to restore", "No active Premium found on this account.");
    } catch (e: any) {
      Alert.alert("Restore failed", String(e?.message || e));
    }
  };

  const openLink = (url: string) => Linking.openURL(url).catch(() => {});

  const toggleFaq = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaq(openFaq === i ? null : i);
  };

  /* -------------------- Active subscription screen ------------------- */
  if (sub.isSubscribed) {
    const active = sub.customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
    const expiresAt = active?.expirationDate ? new Date(active.expirationDate).toLocaleDateString() : null;
    const planId = active?.productIdentifier || "";
    const planLabel = planId.includes("annual") || planId.includes("year")
      ? "Yearly Plan"
      : planId.includes("month") ? "Monthly Plan"
      : planId.includes("lifetime") ? "Lifetime" : "Premium";

    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Header title="Premium" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          <LinearGradient
            colors={[colors.brandTertiary, colors.surface]}
            style={styles.thanksHero}
          >
            <View style={styles.thanksBadge}>
              <Ionicons name="medal" size={44} color={colors.brandPrimary} />
            </View>
            <Text style={styles.thanksTitle}>You&apos;re a Premium member ⭐</Text>
            <Text style={styles.thanksSub}>Thank you for supporting DailyHub AI!</Text>
            <View style={styles.thanksPlanChip}>
              <Text style={styles.thanksPlanChipText}>{planLabel}</Text>
            </View>
            {expiresAt ? <Text style={styles.thanksMeta}>Renews on {expiresAt}</Text> : null}
          </LinearGradient>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your benefits</Text>
            {BENEFITS.map((b) => (
              <View key={b.label} style={styles.benefitRowActive}>
                <View style={styles.benefitCheck}>
                  <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitLabel}>{b.label}</Text>
                  <Text style={styles.benefitDesc}>{b.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <Pressable
              onPress={() => Linking.openURL("https://play.google.com/store/account/subscriptions").catch(() => {})}
              style={styles.manageBtn}
            >
              <Ionicons name="settings-outline" size={18} color={colors.onSurface} />
              <Text style={styles.manageText}>Manage subscription</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={[styles.manageBtn, { marginTop: spacing.sm, backgroundColor: colors.brandPrimary }]}>
              <Text style={[styles.manageText, { color: colors.onBrandPrimary }]}>Back to app</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* --------------------------- Paywall ------------------------------ */
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Header title="DailyHub Premium" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}>
        {/* Gradient hero */}
        <LinearGradient
          colors={[colors.brandTertiary, colors.surface]}
          style={styles.hero}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={30} color={colors.brandPrimary} />
          </View>
          <Text style={styles.heroTitle}>Go Premium</Text>
          <Text style={styles.heroSub}>
            Unlock the full power of DailyHub AI — ad-free, unlimited, priority. Cancel anytime.
          </Text>

          {/* Social proof */}
          <View style={styles.socialProof}>
            <View style={styles.stars}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Ionicons key={i} name="star" size={12} color="#FFD700" />
              ))}
            </View>
            <Text style={styles.socialText}>Loved by 10,000+ productive users</Text>
          </View>
        </LinearGradient>

        {/* Comparison table */}
        <Text style={styles.sectionTitle}>Free vs Premium</Text>
        <View style={styles.compareCard}>
          <View style={styles.compareHeaderRow}>
            <Text style={[styles.compareCell, styles.compareLabelCol]}> </Text>
            <Text style={[styles.compareCell, styles.compareColHead]}>Free</Text>
            <View style={[styles.compareCell, styles.compareColHeadPro]}>
              <Ionicons name="star" size={11} color={colors.onBrandPrimary} />
              <Text style={styles.compareColHeadProText}> Pro</Text>
            </View>
          </View>
          {COMPARISON.map((row, i) => (
            <View key={row.label} style={[styles.compareRow, i === COMPARISON.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.compareCell, styles.compareLabelCol, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                <Ionicons name={row.icon as any} size={13} color={colors.onSurfaceTertiary} />
                <Text style={styles.compareLabelText}>{row.label}</Text>
              </View>
              <Text style={[styles.compareCell, styles.compareFreeText]}>{row.free}</Text>
              <Text style={[styles.compareCell, styles.compareProText]}>{row.pro}</Text>
            </View>
          ))}
        </View>

        {/* Plans */}
        <Text style={styles.sectionTitle}>Choose your plan</Text>
        {sub.isLoading ? (
          <View style={{ padding: spacing.xl, alignItems: "center" }}>
            <ActivityIndicator color={colors.brandPrimary} />
          </View>
        ) : cards.length === 0 ? (
          <View style={styles.unavailableBox}>
            <Ionicons name="hourglass-outline" size={22} color={colors.brandPrimary} />
            <Text style={styles.unavailableTitle}>Coming soon</Text>
            <Text style={styles.unavailable}>
              We&apos;re finalising subscription products with Google Play. Premium plans will appear here as soon as they&apos;re live.
            </Text>
            {sub.offeringsError ? (
              <Text style={styles.unavailableHint} testID="premium-offerings-error">
                {sub.offeringsError}
              </Text>
            ) : sub.identityError ? (
              <Text style={styles.unavailableHint}>Identity: {sub.identityError}</Text>
            ) : null}
            <Pressable
              onPress={() => sub.refresh()}
              style={styles.retryBtn}
              testID="premium-retry-btn"
            >
              <Ionicons name="refresh" size={14} color={colors.onSurface} />
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.planWrap}>
            {cards.map(({ pkg, meta }) => {
              const isSel = (selected || cards[0].meta.key) === meta.key;
              const price = pkg?.product?.priceString || `₹${pkg?.product?.price || "-"}`;
              return (
                <Pressable
                  key={meta.key}
                  onPress={() => setSelected(meta.key)}
                  style={[styles.plan, isSel && styles.planSelected]}
                >
                  {meta.badge ? (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>{meta.badge}</Text>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle}>{meta.title}</Text>
                    <Text style={styles.planPrice}>
                      {price}
                      <Text style={styles.planPeriod}>{meta.period}</Text>
                    </Text>
                    {meta.monthlyEquivalent ? (
                      <Text style={styles.planMonthlyEq}>≈ {meta.monthlyEquivalent}</Text>
                    ) : null}
                    <View style={styles.planTagRow}>
                      {meta.savings ? (
                        <View style={styles.savingsChip}>
                          <Ionicons name="pricetag" size={10} color={colors.onBrandPrimary} />
                          <Text style={styles.savingsChipText}>{meta.savings}</Text>
                        </View>
                      ) : null}
                      {meta.trialLabel ? (
                        <View style={styles.trialChip}>
                          <Ionicons name="gift" size={10} color={colors.brandPrimary} />
                          <Text style={styles.trialChipText}>{meta.trialLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={[styles.radio, isSel && styles.radioOn]}>
                    {isSel ? <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Testimonials */}
        <Text style={styles.sectionTitle}>What users say</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.testiScroll}
        >
          {TESTIMONIALS.map((t) => (
            <View key={t.name} style={styles.testiCard}>
              <View style={styles.testiHead}>
                <View style={styles.testiAvatar}>
                  <Text style={styles.testiAvatarText}>{t.avatar}</Text>
                </View>
                <View>
                  <Text style={styles.testiName}>{t.name}</Text>
                  <View style={styles.stars}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Ionicons key={i} name="star" size={10} color="#FFD700" />
                    ))}
                  </View>
                </View>
              </View>
              <Text style={styles.testiText}>“{t.text}”</Text>
            </View>
          ))}
        </ScrollView>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>Frequently asked</Text>
        <View style={styles.faqWrap}>
          {FAQS.map((f, i) => (
            <Pressable key={f.q} onPress={() => toggleFaq(i)} style={styles.faqItem}>
              <View style={styles.faqRow}>
                <Text style={styles.faqQ}>{f.q}</Text>
                <Ionicons
                  name={openFaq === i ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.onSurfaceTertiary}
                />
              </View>
              {openFaq === i ? <Text style={styles.faqA}>{f.a}</Text> : null}
            </Pressable>
          ))}
        </View>

        {/* Restore + legal */}
        <View style={styles.legalWrap}>
          <Pressable onPress={doRestore} style={styles.restore}>
            {sub.isRestoring ? (
              <ActivityIndicator size="small" color={colors.brandPrimary} />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </Pressable>
          <View style={styles.legalRow}>
            <Pressable onPress={() => openLink("https://daily-utility-ai.emergent.host/terms")}>
              <Text style={styles.legalLink}>Terms</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => openLink("https://daily-utility-ai.emergent.host/privacy")}>
              <Text style={styles.legalLink}>Privacy</Text>
            </Pressable>
          </View>
          <Text style={styles.legalNote}>
            Payment charged to your Google Play account. Subscription auto-renews unless cancelled 24h before period
            end. Manage or cancel in Play Store → Subscriptions.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {activeTrial ? (
          <Text style={styles.ctaTrialLine}>🎁 {activeTrial} — cancel anytime before it ends</Text>
        ) : null}
        <Pressable
          onPress={doBuy}
          disabled={sub.isPurchasing || cards.length === 0}
          style={({ pressed }) => [
            styles.ctaBtn,
            (sub.isPurchasing || cards.length === 0) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {sub.isPurchasing ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Ionicons name={activeTrial ? "gift" : "lock-open"} size={18} color={colors.onBrandPrimary} />
              <Text style={styles.ctaText}>
                {cards.length === 0
                  ? "Unavailable"
                  : activeTrial
                  ? "Start free trial"
                  : "Subscribe now"}
              </Text>
            </>
          )}
        </Pressable>
        {Platform.OS !== "android" || !rcNativeAvailable ? (
          <Text style={styles.envNote}>Purchases only work on Android release / dev builds.</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*                              Header                                 */
/* ------------------------------------------------------------------ */

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.hBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.hTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*                              Styles                                 */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  hBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
  },
  hTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.onSurface,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },

  hero: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    marginBottom: spacing.md,
  },
  heroBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
  },
  heroTitle: {
    color: colors.onSurface,
    fontSize: 30,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -0.5,
  },
  heroSub: {
    color: colors.onSurfaceSecondary,
    fontSize: fontSize.md,
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  socialProof: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stars: { flexDirection: "row", gap: 2 },
  socialText: { color: colors.onSurfaceSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  sectionTitle: {
    color: colors.onSurface,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },

  /* Comparison table */
  compareCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  compareHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
  },
  compareRow: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    alignItems: "center",
  },
  compareCell: {
    flex: 1,
    fontSize: fontSize.xs,
    textAlign: "center",
  },
  compareLabelCol: { flex: 1.6, textAlign: "left", paddingLeft: 4 },
  compareLabelText: { color: colors.onSurfaceSecondary, fontSize: fontSize.xs, flex: 1 },
  compareColHead: { color: colors.onSurfaceTertiary, fontWeight: fontWeight.semibold, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  compareColHeadPro: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandPrimary,
    marginHorizontal: 4,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  compareColHeadProText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: 11, letterSpacing: 0.5 },
  compareFreeText: { color: colors.onSurfaceTertiary },
  compareProText: { color: colors.brandPrimary, fontWeight: fontWeight.bold },

  /* Plans */
  planWrap: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    position: "relative",
    minHeight: 88,
  },
  planSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandTertiary,
  },
  planBadge: {
    position: "absolute",
    top: -8,
    right: spacing.md,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  planBadgeText: {
    color: colors.onBrandPrimary,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  planTitle: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  planPrice: { color: colors.onSurface, fontSize: 22, fontWeight: fontWeight.extrabold, marginTop: 4 },
  planPeriod: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  planMonthlyEq: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  planTagRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  savingsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  savingsChipText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: fontWeight.bold },
  trialChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  trialChipText: { color: colors.brandPrimary, fontSize: 10, fontWeight: fontWeight.bold },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  radioOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  unavailableBox: {
    marginHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unavailableTitle: {
    color: colors.onSurface,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginTop: 4,
  },
  unavailable: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, textAlign: "center" },
  unavailableHint: { color: colors.onSurfaceTertiary, fontSize: 11, textAlign: "center", fontStyle: "italic" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryBtnText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  /* Testimonials */
  testiScroll: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 4 },
  testiCard: {
    width: 260,
    marginRight: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  testiHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  testiAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  testiAvatarText: { color: colors.onBrandPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.md },
  testiName: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  testiText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, lineHeight: 20, fontStyle: "italic" },

  /* FAQ */
  faqWrap: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  faqItem: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  faqRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  faqQ: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flex: 1 },
  faqA: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: spacing.sm, lineHeight: 20 },

  /* Benefits (active screen) */
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.sm },
  benefitRowActive: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  benefitCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitLabel: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  benefitDesc: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, marginTop: 2, lineHeight: 17 },

  /* Legal */
  legalWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, alignItems: "center", gap: spacing.sm },
  restore: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  restoreText: {
    color: colors.brandPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    textDecorationLine: "underline",
  },
  legalRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  legalLink: { color: colors.onSurfaceTertiary, fontSize: fontSize.xs, textDecorationLine: "underline" },
  legalDot: { color: colors.onSurfaceTertiary },
  legalNote: {
    color: colors.onSurfaceTertiary,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: spacing.md,
  },

  /* Sticky CTA */
  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  ctaTrialLine: {
    color: colors.brandPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textAlign: "center",
    marginBottom: 8,
  },
  ctaBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 54,
  },
  ctaText: { color: colors.onBrandPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  envNote: { color: colors.onSurfaceTertiary, fontSize: 11, textAlign: "center", marginTop: 6 },

  /* Thanks / active */
  thanksHero: {
    alignItems: "center",
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  thanksBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
  },
  thanksTitle: { color: colors.onSurface, fontSize: 24, fontWeight: fontWeight.extrabold, textAlign: "center" },
  thanksSub: { color: colors.onSurfaceSecondary, fontSize: fontSize.md, marginTop: 6, textAlign: "center" },
  thanksPlanChip: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  thanksPlanChipText: { color: colors.onBrandPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  thanksMeta: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: spacing.sm },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manageText: { color: colors.onSurface, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
