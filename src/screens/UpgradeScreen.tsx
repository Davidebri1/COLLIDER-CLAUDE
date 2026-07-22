import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  LayoutAnimation
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useCollider } from "../state";
import { Glass } from "../components/Glass";
import { Page } from "../components/Page";
import { styles, SCREEN_W, withFont, fontFamilyForWeight, FONT_MONO } from "../styles/theme";
import { TIER_INFO, type Tier } from "../models";
import { IAP_PRODUCTS, purchaseProduct } from "../services/iap";
import { useToast } from "../components/Toast";

export function UpgradeScreen({ goBack }: { goBack: () => void }) {
  const { state, dispatch } = useCollider();
  const { toast } = useToast();
  const tiers: Tier[] = ["free", "pro", "elite"];

  const [email, setEmail] = useState("");
  const [inquiry, setInquiry] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleEnterpriseSubmit = () => {
    if (!email.trim() || !inquiry.trim()) {
      toast("Please fill in both your email and inquiry message.");
      return;
    }
    if (!email.includes("@")) {
      toast("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(`Inquiry submitted! A representative will contact you at ${email.trim()} within 24 hours.`);
      setEmail("");
      setInquiry("");
      setSubmitting(false);
    }, 800);
  };

  // Redesign: no per-tier red/yellow. The plans read as one cool-glass family;
  // the featured tier (Pro) is simply brighter with a white specular CTA,
  // Elite is a quieter glass CTA, Free is the muted "current plan" state.
  const tierCfg = (tier: Tier) => {
    if (tier === "pro") return { accent: "#eef2f8", cta: ["#ffffff", "#c9d2e0"] as [string, string], ctaText: "#0a0c11", wash: 0.09, border: "rgba(255,255,255,0.28)", hot: true };
    if (tier === "elite") return { accent: "#c9d2e0", cta: null as [string, string] | null, ctaText: "#f2f5fa", wash: 0.06, border: "rgba(255,255,255,0.14)", hot: false };
    return { accent: "rgba(238,241,246,0.6)", cta: null as [string, string] | null, ctaText: "rgba(238,241,246,0.5)", wash: 0.04, border: "rgba(255,255,255,0.1)", hot: false };
  };

  return (
    <Page title="Billing & Plans" goBack={goBack}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40, gap: 14 }} showsVerticalScrollIndicator={false}>
        
        {/* Render Tiers */}
        {tiers.map((tier, index) => {
          const info = TIER_INFO[tier];
          const isActive = state.tier === tier;
          const cfg = tierCfg(tier);

          return (
            <Glass
              isCard
              key={tier}
              style={[
                localStyles.planCard,
                { borderColor: isActive ? "rgba(255,255,255,0.4)" : cfg.border },
                (isActive || cfg.hot) && { borderWidth: 1.5 },
              ]}
            >
              {/* Brightness wash — the featured (hot) tier glows a little more
                  than the others; all neutral, no tier color. */}
              <LinearGradient
                colors={[`rgba(255,255,255,${cfg.wash})`, "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              {/* Card header with plan name and price */}
              <View style={localStyles.planHeader}>
                <View>
                  <Text style={[localStyles.planTitle, { color: cfg.accent }]}>{info.label.toUpperCase()}</Text>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
                    <Text style={localStyles.planPrice}>{info.price.replace("/mo", "")}</Text>
                    {tier !== "free" && <Text style={localStyles.planPriceSuffix}>/mo</Text>}
                  </View>
                </View>
                {isActive && (
                  <View style={[localStyles.activeBadge, { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" }]}>
                    <Text style={[localStyles.activeBadgeText, { color: "#f2f5fa" }]}>ACTIVE PLAN</Text>
                  </View>
                )}
              </View>

              {/* Credits counter — neutral glass pill, mono figure */}
              <View style={[localStyles.creditsPill, { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }]}>
                <Ionicons name="sparkles" size={12} color={cfg.accent} />
                <Text style={{ color: "#eef1f6", fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 0.5 }}>
                  {info.pool.toLocaleString()} CREDS / MONTH
                </Text>
              </View>

              {/* Features list */}
              <View style={{ gap: 8, marginVertical: 8 }}>
                <View style={localStyles.featureRow}>
                  <Ionicons name="checkmark-circle" size={13} color={cfg.accent} />
                  <Text style={localStyles.featureText}>
                    {tier === "free"
                      ? "6 free General models (unlimited queries)"
                      : tier === "pro"
                      ? "Unlimited queries on Claude, GPT-4o, Gemini 1.5 Pro, Grok"
                      : "Unlimited General + all Pro models + Premium models"}
                  </Text>
                </View>
                <View style={localStyles.featureRow}>
                  <Ionicons name="checkmark-circle" size={13} color={cfg.accent} />
                  <Text style={localStyles.featureText}>
                    {tier === "free"
                      ? `20 daily messages for media generation tabs`
                      : tier === "pro"
                      ? "3,000 monthly credits for image, video, music, coding models"
                      : "9,000 monthly credits for Sora 2, Veo 3, Qwen Coder, Udio"}
                  </Text>
                </View>
                {tier !== "free" && (
                  <View style={localStyles.featureRow}>
                    <Ionicons name="checkmark-circle" size={13} color={cfg.accent} />
                    <Text style={localStyles.featureText}>
                      {tier === "pro"
                        ? "Unlock 10+ custom wallpaper presets and system instructions"
                        : "Full developer skills engine injection (ML, dbt, GCP Composer Diagnostics)"}
                    </Text>
                  </View>
                )}
              </View>

              {/* Activate Button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  dispatch({ type: "tier", tier });
                  if (index > 0) {
                    purchaseProduct(IAP_PRODUCTS[index - 1]).catch(() => undefined);
                  }
                }}
                disabled={isActive}
                style={[
                  localStyles.activateBtn,
                  isActive && { backgroundColor: "rgba(255,255,255,0.04)" }
                ]}
              >
                {isActive ? (
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700", fontFamily: fontFamilyForWeight(700), letterSpacing: 1 }}>CURRENT SUBSCRIPTION</Text>
                ) : cfg.cta ? (
                  <LinearGradient
                    colors={cfg.cta}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={localStyles.gradientBtnBg}
                  >
                    <Text style={{ color: cfg.ctaText, fontSize: 11.5, fontWeight: "700", fontFamily: fontFamilyForWeight(700), letterSpacing: 1.5 }}>
                      UPGRADE TO {info.label.toUpperCase()}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={[localStyles.gradientBtnBg, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                    <Text style={{ color: cfg.ctaText, fontSize: 11.5, fontWeight: "700", fontFamily: fontFamilyForWeight(700), letterSpacing: 1.5 }}>
                      UPGRADE TO {info.label.toUpperCase()}
                    </Text>
                  </View>
                )}
              </Pressable>
            </Glass>
          );
        })}

        {/* Enterprise Tier & Contact Form */}
        <Glass isCard style={[localStyles.planCard, { borderColor: "rgba(255,255,255,0.25)", marginTop: 4 }]}>
          <LinearGradient
            colors={["rgba(255,255,255,0.15)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={localStyles.planHeader}>
            <View>
              <Text style={[localStyles.planTitle, { color: "#ffffff" }]}>ENTERPRISE</Text>
              <Text style={localStyles.planPrice}>Custom Contract</Text>
            </View>
            <View style={[localStyles.activeBadge, { backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" }]}>
              <Text style={[localStyles.activeBadgeText, { color: "#ffffff" }]}>B2B TEAMS</Text>
            </View>
          </View>

          <View style={{ gap: 8, marginVertical: 6 }}>
            <View style={localStyles.featureRow}>
              <Ionicons name="shield-checkmark" size={13} color="#ffffff" />
              <Text style={localStyles.featureText}>Unlimited API access, dedicated model hosting, SLA guarantees.</Text>
            </View>
            <View style={localStyles.featureRow}>
              <Ionicons name="shield-checkmark" size={13} color="#ffffff" />
              <Text style={localStyles.featureText}>Dedicated support manager and custom data privacy compliance.</Text>
            </View>
          </View>
          
          {/* Sales contact form */}
          <View style={localStyles.contactForm}>
            <Text style={localStyles.formTitle}>CONTACT SALES REPRESENTATIVE</Text>
            
            <TextInput
              placeholder="Work Email"
              placeholderTextColor="rgba(238,241,246,0.45)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={localStyles.formInput}
            />
            
            <TextInput
              placeholder="Tell us about your team's AI workload bounds..."
              placeholderTextColor="rgba(238,241,246,0.45)"
              value={inquiry}
              onChangeText={setInquiry}
              multiline
              numberOfLines={3}
              style={localStyles.formTextarea}
            />
            
            <Pressable onPress={handleEnterpriseSubmit} disabled={submitting} style={localStyles.submitBtn}>
              <LinearGradient
                colors={["#ffffff", "#d8d8dc"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={localStyles.gradientBtnBg}
              >
                <Text style={{ color: "#000", fontWeight: "900", fontFamily: fontFamilyForWeight(900), fontSize: 11.5, letterSpacing: 1 }}>
                  {submitting ? "SENDING ENQUIRY..." : "SUBMIT REQUEST"}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Glass>

      </ScrollView>
    </Page>
  );
}

const localStyles = StyleSheet.create(withFont({
  planCard: {
    borderRadius: 22,
    overflow: "hidden",
    padding: 16,
    gap: 10,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planTitle: {
    fontSize: 9.5,
    fontWeight: "900", fontFamily: fontFamilyForWeight(900),
    letterSpacing: 2,
  },
  planPrice: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900", fontFamily: fontFamilyForWeight(900),
    marginTop: 2,
  },
  planPriceSuffix: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "700", fontFamily: fontFamilyForWeight(700),
    marginBottom: 3,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 8.5,
    fontWeight: "900", fontFamily: fontFamilyForWeight(900),
    letterSpacing: 0.5,
  },
  creditsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  featureText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  activateBtn: {
    height: 40,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginTop: 6,
  },
  gradientBtnBg: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  contactForm: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginTop: 8,
    gap: 8,
  },
  formTitle: {
    color: "rgba(238,241,246,0.45)",
    fontSize: 8.5,
    fontWeight: "900", fontFamily: fontFamilyForWeight(900),
    letterSpacing: 1.5,
  },
  formInput: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    height: 36,
    color: "#fff",
    fontSize: 12,
  },
  formTextarea: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    height: 60,
    color: "#fff",
    fontSize: 12,
    textAlignVertical: "top",
  },
  submitBtn: {
    height: 36,
    borderRadius: 10,
    overflow: "hidden",
  },
}));
