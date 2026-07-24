#!/usr/bin/env node
/**
 * Deterministic invariant checks for Collider.
 *
 * AI-First Pattern 3 (Feedback Loop): the agent validates its own work instead
 * of asserting it. Every check here encodes a defect that was actually found in
 * this codebase — so a regression re-breaks a check rather than shipping.
 *
 * Usage: node scripts/validate.mjs
 * Exit 0 = all pass, 1 = any fail.
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : "");

const results = [];
const check = (name, fn) => {
  try {
    const r = fn();
    results.push(r === true ? { name, ok: true } : { name, ok: false, msg: r });
  } catch (e) {
    results.push({ name, ok: false, msg: e.message });
  }
};

const models = read("src/models.ts");
const chat = read("src/services/chat.ts");
const theme = read("src/styles/theme.ts");
const app = read("App.tsx");
const iap = read("src/services/iap.ts");
const upgrade = read("src/screens/UpgradeScreen.tsx");
const wallpapers = read("src/screens/WallpapersScreen.tsx");
const consensus = read("src/components/ConsensusDrawer.tsx");

const modelIds = [...models.matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1]);
const routeIds = [...chat.matchAll(/^\s+"((?:img|vid|aud)\/[^"]+)":/gm)].map((m) => m[1]);
const mediaIds = modelIds.filter((i) => /^(img|vid|aud)\//.test(i));

// ── Roster integrity ──────────────────────────────────────────────────────
check("every media model has a route (no dead picker options)", () => {
  const missing = mediaIds.filter((i) => !routeIds.includes(i));
  return missing.length === 0 || `no route: ${missing.join(", ")}`;
});

check("no orphan routes (roster and routes stay 1:1)", () => {
  const orphan = routeIds.filter((i) => !mediaIds.includes(i));
  return orphan.length === 0 || `orphan: ${orphan.join(", ")}`;
});

check("every model referenced anywhere actually exists", () => {
  const bad = [];
  for (const f of ["src/state.tsx", "App.tsx", "src/screens/MarketScreen.tsx"]) {
    const refs = [...read(f).matchAll(/"((?:img|vid|aud|free|pro|elite)\/[^"]+)"/g)].map((m) => m[1]);
    for (const r of refs) if (!modelIds.includes(r)) bad.push(`${f}: ${r}`);
  }
  return bad.length === 0 || bad.join("; ");
});

check("media categories are 4 Pro + 4 Elite (spec)", () => {
  const bad = [];
  for (const cat of ["image", "video", "audio"]) {
    const rows = models.split("\n").filter((l) => l.includes(`category: ["${cat}"]`));
    const pro = rows.filter((l) => l.includes('tier: "pro"')).length;
    const el = rows.filter((l) => l.includes('tier: "elite"')).length;
    if (pro !== 4 || el !== 4) bad.push(`${cat}: pro=${pro} elite=${el}`);
  }
  return bad.length === 0 || bad.join("; ");
});

check("no legacy 'music' category survives the audio rename", () => {
  const hits = [];
  if (/category: \["music"\]/.test(models)) hits.push("models.ts category");
  if (/^\s+music: "/m.test(models)) hits.push("CATEGORY_MIN_TIER unquoted key");
  if (/"mus\//.test(models + chat)) hits.push("mus/ id prefix");
  return hits.length === 0 || hits.join("; ");
});

// ── Money path ────────────────────────────────────────────────────────────
check("tier is never granted before purchase resolves", () => {
  // The original defect: dispatch({type:"tier"}) fired before an unawaited
  // purchaseProduct(...).catch(() => undefined).
  if (/purchaseProduct\([^)]*\)\.catch\(\(\)\s*=>\s*undefined\)/.test(upgrade))
    return "purchase result still discarded via .catch(() => undefined)";
  if (!/await purchaseProduct/.test(upgrade)) return "purchaseProduct is not awaited";
  if (!/await verifyPurchase/.test(upgrade)) return "verifyPurchase is not awaited before grant";
  return true;
});

check("verifyPurchase is server-backed, not client-trusted", () => {
  if (/return true;\s*\n}/.test(iap.slice(iap.indexOf("export async function verifyPurchase"), iap.indexOf("export async function verifyPurchase") + 400)))
    return "verifyPurchase still returns true unconditionally";
  return /functions\/v1\/verify-purchase/.test(iap) || "no verification endpoint call";
});

check("IAP finishes transactions (stores auto-refund unfinished ones)", () =>
  /finishTransaction/.test(iap) || "finishTransaction never called");

check("IAP listens for purchase results", () =>
  /purchaseUpdatedListener/.test(iap) || "no purchaseUpdatedListener — requestPurchase alone resolves before payment settles");

check("restorePurchases exists (App Store requires it for non-consumables)", () =>
  /export async function restorePurchases/.test(iap) || "missing");

check("wallpaper purchases are not mocked", () =>
  !/mock — no real charge/.test(wallpapers) || "still grants ownership without charging");

// ── Credits ───────────────────────────────────────────────────────────────
check("failed generations refund credits", () => {
  const n = (app.match(/type: "refund"/g) || []).length;
  return n >= 4 || `only ${n} refund sites; expected >= 4 (grid catch, locked return, card catch, retry catch)`;
});

check("refund is a distinct action, not a negative spend", () =>
  /case "refund"/.test(read("src/state.tsx")) ||
  "no refund case — a negative `spend` is silently dropped when balance is short, i.e. exactly when it matters");

check("retry charges credits (was an unlimited free re-roll)", () => {
  const i = app.indexOf("const retryLast");
  return i > -1 && /dispatch\(\{ type: "spend"/.test(app.slice(i, i + 1200))
    ? true : "retryLast does not spend credits";
});

// ── Fonts (spec: Manrope body + Playfair Display headers) ─────────────────
check("body font is Manrope per spec", () =>
  /Manrope_400Regular/.test(theme) || "FONT_REGULAR is not Manrope");

check("Playfair Display is loaded and exposed for headers", () => {
  if (!/PlayfairDisplay_700Bold/.test(app)) return "Playfair not loaded in App.tsx useFonts";
  if (!/FONT_DISPLAY/.test(theme)) return "no FONT_DISPLAY token in theme.ts";
  return true;
});

check("no Instrument Sans remnants", () =>
  !/InstrumentSans/.test(theme + app) || "Instrument Sans still referenced");

// ── Consensus map ─────────────────────────────────────────────────────────
check("map x-axis uses agreement, not token overlap", () =>
  /agreementAffinity/.test(consensus) || "force layout still fed by bag-of-words sim()");

check("dissent y-axis normalizes within the band (uses full height)", () =>
  /DISSENT_THRESHOLD/.test(consensus) && /norm/.test(consensus)
    ? true : "y still normalized across [0,1]; top half of field unreachable");

check("center node has the spec-required blue/red duality", () =>
  /255,90,77/.test(consensus) || "no red component in center node gradient");

check("Dissent | Total tab pair exists", () =>
  /mapTab/.test(consensus) || "no map tab state");

// ── Collections & favorites (spec: media-gen action bar minimum) ──────────
check("AssetActionBar template exists (one form, not per-surface rebuilds)", () =>
  existsSync(join(ROOT, "src/components/AssetActionBar.tsx")) || "missing");

check("action bar covers the spec's minimum action set", () => {
  const b = read("src/components/AssetActionBar.tsx");
  const need = ["view", "context", "source", "favorite", "save", "share", "delete"];
  const missing = need.filter((n) => !new RegExp(`"${n}"`).test(b));
  return missing.length === 0 || `missing actions: ${missing.join(", ")}`;
});

check("collections + favorites exist in state", () => {
  const st = read("src/state.tsx");
  const need = ["toggleFavoriteAsset", "saveToCollection", "createCollection", "removeFromCollection", "deleteCollection"];
  const missing = need.filter((n) => !st.includes(`case "${n}"`));
  return missing.length === 0 || `missing reducer cases: ${missing.join(", ")}`;
});

check("market exposes favorites + collections tabs", () => {
  const m = read("src/screens/MarketScreen.tsx");
  if (!/"favorites"/.test(m)) return "no favorites tab";
  if (!/"collections"/.test(m)) return "no collections tab";
  if (!/CollectionsPane/.test(m)) return "collections tab has no pane";
  return true;
});

// ── Assets ────────────────────────────────────────────────────────────────
check("real premium wallpaper assets exist (not sample media)", () => {
  const t = read("src/styles/theme.ts");
  // Strip comments first — prose *about* the removed mock is fine; a live URL
  // is not.
  const code = t.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  if (/commondatastorage\.googleapis\.com|soundhelix\.com|premium_mock/.test(code))
    return "still shipping public sample media";
  const dir = join(ROOT, "assets/themes/premium");
  if (!existsSync(dir)) return "assets/themes/premium missing";
  const vids = readdirSync(dir).filter((f) => f.endsWith(".mp4"));
  return vids.length >= 1 || "no live wallpaper videos";
});

check("each premium wallpaper ships >= 5 tracks (spec)", () => {
  const dir = join(ROOT, "assets/themes/premium/tracks");
  if (!existsSync(dir)) return "tracks dir missing";
  const n = readdirSync(dir).filter((f) => /\.(mp3|m4a)$/.test(f)).length;
  return n >= 5 || `only ${n} tracks`;
});

// ── Report ────────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.ok).length;
console.log(`\nCollider invariants: ${pass}/${results.length} passing\n`);
for (const r of results) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `\n        -> ${r.msg}`}`);
}
console.log("");
process.exit(results.every((r) => r.ok) ? 0 : 1);
