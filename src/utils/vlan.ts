export function parseVlanId(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(?:vlan)?(\d{1,4})/i);
  if (!match) return undefined;
  const id = Number(match[1]);
  return id >= 1 && id <= 4094 ? id : undefined;
}

export function expandVlanRange(input: string): number[] {
  return input.split(",").flatMap(part => {
    const trimmed = part.trim();
    const range = trimmed.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
    }
    const id = Number(trimmed);
    return Number.isFinite(id) ? [id] : [];
  }).filter(id => id >= 1 && id <= 4094);
}
