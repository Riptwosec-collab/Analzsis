export type SanitizationMode = "mask" | "replace" | "remove" | "keep";

export interface SanitizationHit {
  type: string;
  line: number;
  preview: string;
}

interface SensitivePattern {
  type: string;
  pattern: RegExp;
  replacement: string;
}

const patterns: SensitivePattern[] = [
  {
    type: "Enable Credential",
    pattern: /(\benable\s+(?:secret|password)(?:\s+\d+)?\s+)\S+/gi,
    replacement: "$1[REDACTED]"
  },
  {
    type: "Local User Credential",
    pattern: /(\busername\s+\S+[^\n]*?\b(?:secret|password)(?:\s+\d+)?\s+)\S+/gi,
    replacement: "$1[REDACTED]"
  },
  {
    type: "AAA Shared Key",
    pattern: /(\b(?:tacacs-server|radius-server|server-private)[^\n]*?\bkey(?:\s+\d+)?\s+)\S+/gi,
    replacement: "$1[REDACTED]"
  },
  {
    type: "AAA Shared Key",
    pattern: /(\b(?:tacacs-server|radius-server)\s+key(?:\s+\d+)?\s+)\S+/gi,
    replacement: "$1[REDACTED]"
  },
  {
    type: "SNMP Community",
    pattern: /(\bsnmp-server\s+community\s+)\S+/gi,
    replacement: "$1[REDACTED]"
  },
  {
    type: "Pre-shared Key or Token",
    pattern: /(\b(?:pre-shared-key|key-string|wpa-psk|api[-_ ]?key|bearer|token)(?:\s+\d+)?\s+)\S+/gi,
    replacement: "$1[REDACTED]"
  },
  {
    type: "Generic Password or Secret",
    pattern: /(\b(?:password|secret)(?:\s+\d+)?\s+)\S+/gi,
    replacement: "$1[REDACTED]"
  },
  {
    type: "Email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[REDACTED_EMAIL]"
  },
  {
    type: "Private Key",
    pattern: /-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]+?-----END [^-]+ PRIVATE KEY-----/gi,
    replacement: "[REDACTED_PRIVATE_KEY]"
  },
  {
    type: "Public IP",
    pattern: /\b(?!(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.)((?:\d{1,3}\.){3}\d{1,3})\b/g,
    replacement: "[PUBLIC_IP]"
  }
];

export function scanSensitiveData(input: string): SanitizationHit[] {
  const hits: SanitizationHit[] = [];
  const lines = input.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const item of patterns) {
      if (matches(item.pattern, line)) {
        hits.push({
          type: item.type,
          line: index + 1,
          preview: maskLine(line).slice(0, 140)
        });
      }
    }
  });
  return hits;
}

export function sanitizeCli(input: string, mode: SanitizationMode): string {
  if (mode === "keep") return input;
  if (mode === "remove") {
    return input
      .split(/\r?\n/)
      .filter(line => !patterns.some(item => matches(item.pattern, line)))
      .join("\n");
  }

  return patterns.reduce((text, item) => {
    const replacement = mode === "mask"
      ? item.replacement
      : `[${item.type.toUpperCase().replace(/\W+/g, "_")}]`;
    return text.replace(cloneRegex(item.pattern), replacement);
  }, input);
}

function maskLine(line: string): string {
  return patterns.reduce(
    (text, item) => text.replace(cloneRegex(item.pattern), item.replacement),
    line
  );
}

function matches(pattern: RegExp, text: string): boolean {
  return cloneRegex(pattern).test(text);
}

function cloneRegex(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags);
}
