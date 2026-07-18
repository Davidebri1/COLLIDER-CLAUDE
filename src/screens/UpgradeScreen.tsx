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
import { styles, SCREEN_W, withFont } from "../styles/theme";
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

  const getTierGradient = (tier: Tier): [string, string] => {
    // #d39e00 (gold) was here for elite — explicitly banned by the palette
    // rule, no tier-specific exception carved out. Matches TIER_INFO's
    // established orange accent instead.
    if (tier === "elite") return ["#ffb74d", "#e2e8f0"];
    if (tier === "pro") return ["#dc2626", "#e2e8f0"];
    return ["#3b3846", "#8d8398"]; // free
  };

  return (
    <Page title="Billing & Plans" goBack={goBack}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40, gap: 14 }} showsVerticalScrollIndicator={false}>
        
        {/* Render Tiers */}
        {tiers.map((tier, index) => {
          const info = TIER_INFO[tier];
          const isActive = state.tier === tier;
          const gradientColors = getTierGradient(tier);
          
          return (
            <Glass
              isCard
              key={tier}
              style={[
                localStyles.planCard,
                { borderColor: isActive ? info.color : `${gradientColors[0]}40` },
                isActive && { borderWidth: 1.5 },
              ]}
            >
              {/* Faint tier-colored wash behind the header — the gradient
                  language used on the Activate button now bleeds into the
                  card itself instead of living only on one element. */}
              <LinearGradient
                colors={[`${gradientColors[0]}26`, `${gradientColors[1]}00`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              {/* Card header with plan name and price */}
              <View style={localStyles.planHeader}>
                <View>
                  <Text style={[localStyles.planTitle, { color: info.color }]}>{info.label.toUpperCase()}</Text>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
                    <Text style={localStyles.planPrice}>{info.price.replace("/mo", "")}</Text>
                    {tier !== "free" && <Text style={localStyles.planPriceSuffix}>/mo</Text>}
                  </View>
                </View>
                {isActive && (
                  <View style={[localStyles.activeBadge, { backgroundColor: `${info.color}22`, borderWidth: 1, borderColor: `${info.color}66` }]}>
                    <Text style={[localStyles.activeBadgeText, { color: info.color }]}>ACTIVE PLAN</Text>
                  </View>
                )}
              </View>

              {/* Credits counter info */}
              <LinearGradient
                colors={[`${gradientColors[0]}30`, `${gradientColors[1]}18`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[localStyles.creditsPill, { borderColor: `${gradientColors[0]}50` }]}
              >
                <Ionicons name="sparkles" size={12} color={info.color} />
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>
                  {info.pool.toLocaleString()} CREDS / MONTH
                </Text>
              </LinearGradient>

              {/* Features list */}
              <View style={{ gap: 8, marginVertical: 8 }}>
                <View style={localStyles.featureRow}>
                  <Ionicons name="checkmark-circle" size={13} color={info.color} />
                  <Text style={localStyles.featureText}>
                    {tier === "free"
                      ? "6 free General models (unlimited queries)"
                      : tier === "pro"
                      ? "Unlimited queries on Claude, GPT-4o, Gemini 1.5 Pro, Grok"
                      : "Unlimited General + all Pro models + Premium models"}
                  </Text>
                </View>
                <View style={localStyles.featureRow}>
                  <Ionicons name="checkmark-circle" size={13} color={info.color} />
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
                    <Ionicons name="checkmark-circle" size={13} color={info.color} />
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
                  isActive && { backgroundColor: "#0a0a0c" }
                ]}
              >
                {isActive ? (
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>CURRENT SUBSCRIPTION</Text>
                ) : (
                  <LinearGradient 
                    colors={gradientColors} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 0 }} 
                    style={localStyles.gradientBtnBg}
                  >
                    <Text style={{ color: "#000", fontSize: 11.5, fontWeight: "900", letterSpacing: 1.5 }}>
                      ACTIVATE {info.label.toUpperCase()}
                    </Text>
                  </LinearGradient>
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
              placeholderTextColor="#6b6478"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={localStyles.formInput}
            />
            
            <TextInput
              placeholder="Tell us about your team's AI workload bounds..."
              placeholderTextColor="#6b6478"
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
                <Text style={{ color: "#000", fontWeight: "900", fontSize: 11.5, letterSpacing: 1 }}>
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
    fontWeight: "900",
    letterSpacing: 2,
  },
  planPrice: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2,
  },
  planPriceSuffix: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 3,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 8.5,
    fontWeight: "900",
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
    color: "#6b6478",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  formInput: {
    backgroundColor: "#0a0a0c",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    height: 36,
    color: "#fff",
    fontSize: 12,
  },
  formTextarea: {
    backgroundColor: "#0a0a0c",
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
