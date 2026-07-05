export function isValidIPv4(ip: string): boolean {
  const match = ip.trim().match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/);
  if (!match) return false;
  return ip.split(".").every(part => {
    if (!/^\d+$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255 && String(value) === String(Number(part));
  });
}

export function ipToNumber(ip: string): number | null {
  if (!isValidIPv4(ip)) return null;
  return ip.split(".").reduce((acc, part) => ((acc << 8) + Number(part)) >>> 0, 0);
}

export function numberToIp(value: number): string {
  const n = value >>> 0;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function prefixToMask(prefix: number): number | null {
  if (prefix < 0 || prefix > 32) return null;
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function maskToPrefix(mask: string): number | null {
  const maskNumber = ipToNumber(mask);
  if (maskNumber === null) return null;
  let prefix = 0;
  let seenZero = false;
  for (let bit = 31; bit >= 0; bit -= 1) {
    const isOne = ((maskNumber >>> bit) & 1) === 1;
    if (isOne && seenZero) return null;
    if (isOne) prefix += 1;
    else seenZero = true;
  }
  return prefix;
}

export function cidrFromIpMask(ip: string, mask: string): string | null {
  const prefix = maskToPrefix(mask);
  if (prefix === null) return null;
  const subnet = calculateSubnet(ip, prefix);
  return subnet?.cidr ?? null;
}

export function calculateSubnet(ip: string, prefix: number) {
  const ipNumber = ipToNumber(ip);
  const mask = prefixToMask(prefix);
  if (ipNumber === null || mask === null) return null;
  const networkNumber = (ipNumber & mask) >>> 0;
  const broadcastNumber = (networkNumber | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  const firstHost = prefix >= 31 ? networkNumber : networkNumber + 1;
  const lastHost = prefix >= 31 ? broadcastNumber : broadcastNumber - 1;
  const totalUsable = prefix === 32 ? 1 : prefix === 31 ? 2 : Math.max(total - 2, 0);
  return {
    cidr: `${numberToIp(networkNumber)}/${prefix}`,
    network: numberToIp(networkNumber),
    prefix,
    firstHost: numberToIp(firstHost),
    lastHost: numberToIp(lastHost),
    broadcast: numberToIp(broadcastNumber),
    networkNumber,
    firstHostNumber: firstHost >>> 0,
    lastHostNumber: lastHost >>> 0,
    totalUsable
  };
}

export function ipInSubnet(ip: string, network: string, prefix: number): boolean {
  const ipNumber = ipToNumber(ip);
  const networkNumber = ipToNumber(network);
  const mask = prefixToMask(prefix);
  if (ipNumber === null || networkNumber === null || mask === null) return false;
  return ((ipNumber & mask) >>> 0) === ((networkNumber & mask) >>> 0);
}
