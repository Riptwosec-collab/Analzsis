export type SanitizationMode = "mask" | "replace" | "remove" | "keep";

export type SanitizationCategory =
  | "credentials"
  | "snmpCommunity"
  | "apiToken"
  | "email"
  | "publicIp"
  | "hostname"
  | "serialNumber"
  | "macAddress";

export type SanitizationOptions = Record<SanitizationCategory, boolean>;

export interface SanitizationHit {
  type: SanitizationCategory;
  line: number;
  preview: string;
}

export interface SanitizationPreview {
  sanitizedText: string;
  hits: SanitizationHit[];
  counts: Partial<Record<SanitizationCategory, number>>;
}

interface SensitivePattern {
  type: SanitizationCategory;
  pattern: RegExp;
  replacement: string;
}

export const DEFAULT_SANITIZATION_OPTIONS: SanitizationOptions = {
  credentials: true,
  snmpCommunity: true,
  apiToken: true,
  email: true,
  publicIp: true,
  hostname: true,
  serialNumber: true,
  macAddress: true
};

const redactionPatterns: SensitivePattern[] = [
  { type: "credentials", pattern: /(\benable\s+(?:secret|password)(?:\s+\d+)?\s+)\S+/gi, replacement: "$1[REDACTED]" },
  { type: "credentials", pattern: /(\busername\s+\S+[^\n]*?\b(?:secret|password)(?:\s+\d+)?\s+)\S+/gi, replacement: "$1[REDACTED]" },
  { type: "credentials", pattern: /(\b(?:tacacs-server|radius-server|server-private)[^\n]*?\bkey(?:\s+\d+)?\s+)\S+/gi, replacement: "$1[REDACTED]" },
  { type: "credentials", pattern: /(\b(?:tacacs-server|radius-server)\s+key(?:\s+\d+)?\s+)\S+/gi, replacement: "$1[REDACTED]" },
  { type: "snmpCommunity", pattern: /(\bsnmp-server\s+community\s+)\S+/gi, replacement: "$1[REDACTED]" },
  { type: "apiToken", pattern: /(\b(?:pre-shared-key|key-string|wpa-psk|api[-_ ]?key|bearer|token)(?:\s+\d+)?\s+)\S+/gi, replacement: "$1[REDACTED]" },
  { type: "credentials", pattern: /(\b(?:password|secret)(?:\s+\d+)?\s+)\S+/gi, replacement: "$1[REDACTED]" },
  { type: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_EMAIL]" },
  { type: "credentials", pattern: /-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]+?-----END [^-]+ PRIVATE KEY-----/gi, replacement: "[REDACTED_PRIVATE_KEY]" },
  { type: "serialNumber", pattern: /(\b(?:serial(?:\s+number)?|sn)\b\s*[:#]?\s*)[A-Z0-9._-]{4,}/gi, replacement: "$1[REDACTED_SERIAL]" }
];

const publicIpPattern = /\b(?!(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.)(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const macPattern = /\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b|\b(?:[0-9a-f]{4}\.){2}[0-9a-f]{4}\b/gi;
const hostnameDeclaration = /(^\s*hostname\s+)([A-Za-z][A-Za-z0-9_.-]{1,95})\b/gim;
const promptHostname = /(^|\n)([A-Za-z][A-Za-z0-9_.-]{1,95})(?:\([^)]+\))?[#>]/g;

export function scanSensitiveData(input: string, options: SanitizationOptions = DEFAULT_SANITIZATION_OPTIONS): SanitizationHit[] {
  const hits: SanitizationHit[] = [];
  const lines = input.split(/\r?\n/);
  lines.forEach((line, index) => {
    const types = matchingTypes(line, options);
    for (const type of types) hits.push({ type, line: index + 1, preview: maskLine(line, options).slice(0, 140) });
  });
  return hits;
}

export function createSanitizationPreview(input: string, options: SanitizationOptions = DEFAULT_SANITIZATION_OPTIONS): SanitizationPreview {
  const hits = scanSensitiveData(input, options);
  return {
    sanitizedText: sanitizeCli(input, "mask", options),
    hits,
    counts: hits.reduce<Partial<Record<SanitizationCategory, number>>>((counts, hit) => {
      counts[hit.type] = (counts[hit.type] ?? 0) + 1;
      return counts;
    }, {})
  };
}

export function sanitizeCli(input: string, mode: SanitizationMode, options: SanitizationOptions = DEFAULT_SANITIZATION_OPTIONS): string {
  if (mode === "keep") return input;
  if (mode === "remove") {
    return input.split(/\r?\n/).filter(line => !matchingTypes(line, options).length).join("\n");
  }

  let sanitized = input;
  for (const item of redactionPatterns) {
    if (!options[item.type]) continue;
    const replacement = mode === "mask" ? item.replacement : `[${item.type.toUpperCase()}]`;
    sanitized = sanitized.replace(cloneRegex(item.pattern), replacement);
  }
  if (options.publicIp) sanitized = replaceDeterministically(sanitized, publicIpPattern, index => publicIpAlias(index), isPublicIp);
  if (options.macAddress) sanitized = replaceDeterministically(sanitized, macPattern, index => macAlias(index));
  if (options.hostname) sanitized = sanitizeHostnames(sanitized);
  return sanitized;
}

function matchingTypes(line: string, options: SanitizationOptions): SanitizationCategory[] {
  const types = new Set<SanitizationCategory>();
  for (const item of redactionPatterns) if (options[item.type] && matches(item.pattern, line)) types.add(item.type);
  if (options.publicIp && matchesPublicIp(line)) types.add("publicIp");
  if (options.macAddress && matches(macPattern, line)) types.add("macAddress");
  if (options.hostname && (matches(hostnameDeclaration, line) || matches(promptHostname, `\n${line}`))) types.add("hostname");
  return [...types];
}

function maskLine(line: string, options: SanitizationOptions): string {
  return sanitizeCli(line, "mask", options);
}

function sanitizeHostnames(input: string): string {
  const aliases = new Map<string, string>();
  const aliasFor = (value: string) => {
    const key = value.toUpperCase();
    if (!aliases.has(key)) aliases.set(key, `DEVICE-${String(aliases.size + 1).padStart(3, "0")}`);
    return aliases.get(key)!;
  };
  const sanitized = input.replace(hostnameDeclaration, (_, prefix: string, hostname: string) => `${prefix}${aliasFor(hostname)}`);
  return sanitized.replace(promptHostname, (_, prefix: string, hostname: string) => `${prefix}${aliasFor(hostname)}#`);
}

function replaceDeterministically(input: string, pattern: RegExp, alias: (index: number) => string, shouldReplace: (value: string) => boolean = () => true): string {
  const aliases = new Map<string, string>();
  return input.replace(cloneRegex(pattern), value => {
    if (!shouldReplace(value)) return value;
    const key = value.toLowerCase();
    if (!aliases.has(key)) aliases.set(key, alias(aliases.size));
    return aliases.get(key)!;
  });
}

function matchesPublicIp(input: string): boolean {
  return [...input.matchAll(cloneRegex(publicIpPattern))].some(match => isPublicIp(match[0]));
}

function isPublicIp(value: string): boolean {
  const octets = value.split(".").map(Number);
  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  if (first === 0 || first === 10 || first === 127 || first >= 224 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)) return false;
  return value !== "255.255.255.0" && value !== "255.255.0.0" && value !== "255.0.0.0";
}

function publicIpAlias(index: number): string {
  const block = Math.floor(index / 245);
  const host = 10 + (index % 245);
  return block === 0 ? `192.0.2.${host}` : block === 1 ? `198.51.100.${host}` : `203.0.113.${host}`;
}

function macAlias(index: number): string {
  const value = index + 1;
  return `02:00:${hexByte(value >> 16)}:${hexByte(value >> 8)}:${hexByte(value)}`;
}

function hexByte(value: number): string {
  return (value & 0xff).toString(16).padStart(2, "0");
}

function matches(pattern: RegExp, text: string): boolean {
  return cloneRegex(pattern).test(text);
}

function cloneRegex(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags);
}
