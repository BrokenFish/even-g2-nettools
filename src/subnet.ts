// Pure IPv4 subnet math. No DOM, no SDK — easy to unit test.

export interface SubnetInfo {
  input: string;
  ip: string;
  prefix: number;
  mask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalAddresses: number;
  usableHosts: number;
  ipClass: string;
  scope: string;
  binaryMask: string;
}

export function ipToInt(ip: string): number {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) throw new Error(`Invalid IPv4 address: ${ip}`);
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) throw new Error(`Invalid IPv4 address: ${ip}`);
    const v = Number(p);
    if (v > 255) throw new Error(`Invalid IPv4 address: ${ip}`);
    n = n * 256 + v;
  }
  return n >>> 0;
}

export function intToIp(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
}

export function prefixToMaskInt(prefix: number): number {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid prefix length: /${prefix}`);
  }
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function prefixToMask(prefix: number): string {
  return intToIp(prefixToMaskInt(prefix));
}

export function maskToPrefix(mask: string): number {
  const m = ipToInt(mask);
  const inverted = ~m >>> 0;
  // A valid mask is contiguous ones followed by zeros: inverted+1 is a power of two.
  if ((inverted & (inverted + 1)) !== 0) throw new Error(`Non-contiguous subnet mask: ${mask}`);
  let bits = 0;
  for (let i = 31; i >= 0; i--) if ((m >>> i) & 1) bits++;
  return bits;
}

export function usableHosts(prefix: number): number {
  if (prefix === 32) return 1;
  if (prefix === 31) return 2; // RFC 3021 point-to-point
  return 2 ** (32 - prefix) - 2;
}

export function ipClass(ipInt: number): string {
  const first = ipInt >>> 24;
  if (first < 128) return 'A';
  if (first < 192) return 'B';
  if (first < 224) return 'C';
  if (first < 240) return 'D (multicast)';
  return 'E (reserved)';
}

const SCOPES: Array<[string, number, string]> = [
  ['0.0.0.0', 8, 'This network'],
  ['10.0.0.0', 8, 'Private (RFC 1918)'],
  ['100.64.0.0', 10, 'CGNAT (RFC 6598)'],
  ['127.0.0.0', 8, 'Loopback'],
  ['169.254.0.0', 16, 'Link-local (APIPA)'],
  ['172.16.0.0', 12, 'Private (RFC 1918)'],
  ['192.0.0.0', 24, 'IETF protocol assign.'],
  ['192.0.2.0', 24, 'Documentation (TEST-NET-1)'],
  ['192.168.0.0', 16, 'Private (RFC 1918)'],
  ['198.18.0.0', 15, 'Benchmarking'],
  ['198.51.100.0', 24, 'Documentation (TEST-NET-2)'],
  ['203.0.113.0', 24, 'Documentation (TEST-NET-3)'],
  ['224.0.0.0', 4, 'Multicast'],
  ['255.255.255.255', 32, 'Limited broadcast'],
  ['240.0.0.0', 4, 'Reserved'],
];

export function addressScope(ipInt: number): string {
  for (const [net, prefix, label] of SCOPES) {
    const mask = prefixToMaskInt(prefix);
    if (((ipInt & mask) >>> 0) === ipToInt(net)) return label;
  }
  return 'Public';
}

/**
 * Parse "192.168.1.10/24", "192.168.1.10 255.255.255.0", or a bare IP
 * (bare IP defaults to its classful prefix).
 */
export function parseInput(input: string): { ip: number; prefix: number } {
  const s = input.trim();
  const cidr = s.match(/^(\S+)\s*\/\s*(\d{1,2})$/);
  if (cidr) {
    const prefix = Number(cidr[2]);
    prefixToMaskInt(prefix);
    return { ip: ipToInt(cidr[1]), prefix };
  }
  const withMask = s.match(/^(\S+)\s+(\S+)$/);
  if (withMask) return { ip: ipToInt(withMask[1]), prefix: maskToPrefix(withMask[2]) };
  const ip = ipToInt(s);
  const first = ip >>> 24;
  const prefix = first < 128 ? 8 : first < 192 ? 16 : first < 224 ? 24 : 32;
  return { ip, prefix };
}

export function calculate(input: string): SubnetInfo {
  const { ip, prefix } = parseInput(input);
  const mask = prefixToMaskInt(prefix);
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);

  let first = network + 1;
  let last = broadcast - 1;
  if (prefix === 32) first = last = network;
  if (prefix === 31) {
    first = network;
    last = broadcast;
  }

  const bin = mask.toString(2).padStart(32, '0');
  return {
    input: input.trim(),
    ip: intToIp(ip),
    prefix,
    mask: intToIp(mask),
    wildcard: intToIp(~mask >>> 0),
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    firstHost: intToIp(first),
    lastHost: intToIp(last),
    totalAddresses: total,
    usableHosts: usableHosts(prefix),
    ipClass: ipClass(ip),
    scope: addressScope(ip),
    binaryMask: bin.match(/.{8}/g)!.join('.'),
  };
}

/** Split a network into equal subnets of a longer prefix (max 64 results). */
export function split(input: string, newPrefix: number): string[] {
  const { ip, prefix } = parseInput(input);
  if (newPrefix < prefix || newPrefix > 32) {
    throw new Error(`New prefix must be between /${prefix} and /32`);
  }
  const network = (ip & prefixToMaskInt(prefix)) >>> 0;
  const step = 2 ** (32 - newPrefix);
  const count = Math.min(2 ** (newPrefix - prefix), 64);
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(`${intToIp(network + i * step)}/${newPrefix}`);
  return out;
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}
