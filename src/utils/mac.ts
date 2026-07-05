export function normalizeMac(input: string | null | undefined): string | null {
  if (!input) return null;
  const hex = input.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  if (hex.length === 14 && hex.startsWith("01")) return splitMac(hex.slice(2));
  if (hex.length !== 12) return null;
  return splitMac(hex);
}

export function isValidMac(input: string | null | undefined): boolean {
  return normalizeMac(input) !== null;
}

function splitMac(hex: string): string {
  return hex.match(/.{2}/g)?.join(":") ?? hex;
}
