export type SanitizationMode = "mask" | "replace" | "remove" | "keep";

export interface SanitizationHit {
  type: string;
  line: number;
  preview: string;
}

const patterns: Array<{ type: string; pattern: RegExp; replacement: string }> = [
  { type: "Password/Secret", pattern: /\b(password|secret|key|string)\s+(\S+)/gi, replacement: "$1 [REDACTED]" },
  { type: "SNMP Community", pattern: /\bsnmp-server community\s+\S+/gi, replacement: "snmp-server community [REDACTED]" },
  { type: "Email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_EMAIL]" },
  { type: "Private Key", pattern: /-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]+?-----END [^-]+ PRIVATE KEY-----/gi, replacement: "[REDACTED_PRIVATE_KEY]" },
  { type: "Public IP", pattern: /\b(?!(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.)((?:\d{1,3}\.){3}\d{1,3})\b/g, replacement: "[PUBLIC_IP]" }
];

export function scanSensitiveData(input: string): SanitizationHit[] {
  const hits: SanitizationHit[] = [];
  const lines = input.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const item of patterns) {
      if (new RegExp(item.pattern).test(line)) {
        hits.push({ type: item.type, line: index + 1, preview: line.slice(0, 140) });
      }
    }
  });
  return hits;
}

export function sanitizeCli(input: string, mode: SanitizationMode): string {
  if (mode === "keep") return input;
  return patterns.reduce((text, item) => {
    if (mode === "remove") {
      return text.split(/\r?\n/).filter(line => !new RegExp(item.pattern).test(line)).join("\n");
    }
    const replacement = mode === "mask" ? item.replacement : `[${item.type.toUpperCase().replace(/\W+/g, "_")}]`;
    return text.replace(item.pattern, replacement);
  }, input);
}
