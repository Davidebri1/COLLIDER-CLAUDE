import React from "react";
import { Text, View, StyleSheet, type TextStyle } from "react-native";

// ── Inline renderer ─────────────────────────────────────────────────────────
// Handles: **bold**, __bold__, *italic*, _italic_, ~~strike~~, `code`, [text](url)
function InlineText({ text, baseStyle }: { text: string; baseStyle: TextStyle }) {
  const INLINE_RE = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(INLINE_RE).filter(Boolean);

  return (
    <Text style={baseStyle}>
      {parts.map((part, i) => {
        // Bold: **text** or __text__
        if ((part.startsWith("**") && part.endsWith("**")) ||
            (part.startsWith("__") && part.endsWith("__"))) {
          // Bold suppressed for now — a chat where one model's reply
          // happens to use ** or a # header and another doesn't was
          // rendering wildly inconsistent-looking bubbles side by side
          // (one huge/bold, one normal). Kept visually distinct via opacity
          // instead of weight until there's a real glow/emphasis treatment.
          return <Text key={i} style={{ opacity: 0.92 }}>{part.slice(2, -2)}</Text>;
        }
        // Strikethrough: ~~text~~
        if (part.startsWith("~~") && part.endsWith("~~")) {
          return <Text key={i} style={{ textDecorationLine: "line-through", opacity: 0.7 }}>{part.slice(2, -2)}</Text>;
        }
        // Inline code: `code`
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <Text key={i} style={{
              fontFamily: "monospace",
              backgroundColor: "rgba(255,255,255,0.10)",
              color: "#e2e8f0",
              fontSize: (baseStyle.fontSize as number || 14) - 1,
              borderRadius: 3,
            }}>
              {" "}{part.slice(1, -1)}{" "}
            </Text>
          );
        }
        // Italic: *text* or _text_
        if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
            (part.startsWith("_") && part.endsWith("_") && part.length > 2)) {
          return <Text key={i} style={{ fontStyle: "italic", opacity: 0.85 }}>{part.slice(1, -1)}</Text>;
        }
        // Link: [text](url) — accent coloured
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <Text key={i} style={{ color: "#e2e8f0", textDecorationLine: "underline" }}>
              {link[1]}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

// ── Block renderer ───────────────────────────────────────────────────────────
export function Markdown({ content, color = "#fff", fontSize = 14 }: {
  content: string;
  color?: string;
  fontSize?: number;
}) {
  const base: TextStyle = { color, fontSize, lineHeight: fontSize * 1.55 };
  const lines = (content || "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Fenced code block ──────────────────────────────────────────────────
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim(); // strip language tag
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <View key={key++} style={s.codeBlock}>
          {lang ? <Text style={s.codeLang}>{lang}</Text> : null}
          <Text selectable style={s.codeText}>{codeLines.join("\n")}</Text>
        </View>
      );
      continue;
    }

    // ── Horizontal rule ────────────────────────────────────────────────────
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<View key={key++} style={s.hr} />);
      i++;
      continue;
    }

    // ── Blockquote ─────────────────────────────────────────────────────────
    if (trimmed.startsWith("> ")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        bqLines.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <View key={key++} style={s.blockquote}>
          <InlineText text={bqLines.join(" ")} baseStyle={[base, { fontStyle: "italic", opacity: 0.75 }] as any} />
        </View>
      );
      continue;
    }

    // ── Headers ────────────────────────────────────────────────────────────
    const h = trimmed.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      const level = h[1].length;
      // Weight/size bump kept modest — one model's reply using a "#" header
      // and another's not was rendering as one huge/bold bubble next to a
      // plain one. No bold for now (see InlineText's bold case); size still
      // differentiates level, just not dramatically.
      const hSize = level === 1 ? fontSize + 2 : level === 2 ? fontSize + 1 : fontSize;
      blocks.push(
        <InlineText key={key++} text={h[2]} baseStyle={{
          color, fontSize: hSize,
          lineHeight: hSize * 1.3, marginTop: 10, marginBottom: 2,
        }} />
      );
      i++;
      continue;
    }

    // ── Bullet list ────────────────────────────────────────────────────────
    const bullet = trimmed.match(/^[-*+]\s+(.*)/);
    if (bullet) {
      blocks.push(
        <View key={key++} style={s.listRow}>
          <Text style={[base, s.bulletDot]}>•</Text>
          <InlineText text={bullet[1]} baseStyle={[base, { flex: 1 }] as any} />
        </View>
      );
      i++;
      continue;
    }

    // ── Numbered list ──────────────────────────────────────────────────────
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)/);
    if (numbered) {
      blocks.push(
        <View key={key++} style={s.listRow}>
          <Text style={[base, s.bulletDot]}>{numbered[1]}.</Text>
          <InlineText text={numbered[2]} baseStyle={[base, { flex: 1 }] as any} />
        </View>
      );
      i++;
      continue;
    }

    // ── Blank line ─────────────────────────────────────────────────────────
    if (!trimmed) {
      blocks.push(<View key={key++} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // ── Paragraph — join consecutive plain lines so prose wraps naturally ──
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(">") &&
      !/^[-*+]\s/.test(lines[i].trim()) &&
      !/^\d+[.)]\s/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <InlineText key={key++} text={paraLines.join(" ")} baseStyle={base} />
    );
  }

  return <View style={{ gap: 3 }}>{blocks}</View>;
}

const s = StyleSheet.create({
  codeBlock: {
    backgroundColor: "rgba(0,0,0,0.40)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 12,
    marginVertical: 5,
  },
  codeLang: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
    fontFamily: "monospace",
  },
  codeText: {
    color: "#f2f0f5",
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 19,
  },
  hr: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: 8,
    borderRadius: 1,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "rgba(255,255,255,0.4)",
    paddingLeft: 12,
    marginVertical: 4,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  bulletDot: {
    marginRight: 8,
    marginTop: 1,
    opacity: 0.55,
  },
});

