// @supabase/supabase-js's dependency chain (postgrest-js, realtime-js, etc.)
// ships ESM (.mjs) entry points. Metro's default sourceExts doesn't include
// "mjs", so it fails to resolve those packages' `module`/`exports.import`
// fields — this is what breaks the web bundle without this config.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...config.resolver.sourceExts, "mjs"];
// Supabase's package.json "exports" maps also confuse Metro's newer
// exports-aware resolver in some versions — disabling it falls back to the
// plain main/module/browser fields, which resolve correctly here.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
