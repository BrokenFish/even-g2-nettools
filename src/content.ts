// Cheat sheet content shown on the glasses.
// The G2 font is proportional, so columns are separated with symbols rather
// than padded with spaces. Keep lines short (≈40 chars) so nothing wraps.

import { calculate, formatCount, intToIp, ipToInt, prefixToMask, prefixToMaskInt, usableHosts } from './subnet';

/** Put this in a sheet's lines to force a new page on the glasses. */
export const PAGE_BREAK = '\f';

export interface Sheet {
  id: string;
  title: string;
  lines: string[];
  /** Neighbouring sheets reached by scrolling past the first / last page. */
  prevId?: string;
  nextId?: string;
}

// ---- Subnet table & per-subnet details ------------------------------------

export const MIN_PREFIX = 8;
export const MAX_PREFIX = 32;

/** All prefixes, smallest subnet first (/32 → /8). */
export const SUBNET_PREFIXES: number[] = Array.from(
  { length: MAX_PREFIX - MIN_PREFIX + 1 },
  (_, i) => MAX_PREFIX - i,
);

function hostsLabel(p: number): string {
  const n = usableHosts(p);
  return `${formatCount(n)} ${n === 1 ? 'host' : 'hosts'}`;
}

export function subnetLabel(p: number): string {
  return `/${p}  ${prefixToMask(p)}  ·  ${hostsLabel(p)}`;
}

const SUBNET_USES: Record<number, string> = {
  32: 'Single host, loopback, host route',
  31: 'Point-to-point link (RFC 3021)',
  30: 'Classic point-to-point link',
  29: 'Small WAN / DMZ block',
  28: 'Small office, servers, mgmt',
  27: 'Small LAN segment',
  26: 'Small–medium LAN',
  25: 'Half a /24 LAN',
  24: 'Typical LAN / VLAN',
  23: 'Larger LAN (2 × /24)',
  22: 'Large LAN, Wi-Fi (4 × /24)',
  20: 'Site / building block',
  16: 'Campus, cloud VPC',
  12: '172.16.0.0/12 private block',
  8: 'Class A, 10.0.0.0/8 private',
};

const ORDINAL = ['1st', '2nd', '3rd', '4th'];

/** Example network used to illustrate each prefix size. */
export function exampleNetwork(p: number): number {
  const base = p >= 24 ? '192.168.1.0' : p >= 17 ? '172.16.0.0' : '10.0.0.0';
  return (ipToInt(base) & prefixToMaskInt(p)) >>> 0;
}

/** The larger block the example is carved out of (/24, /16 or /8). */
function parentPrefix(p: number): number | null {
  if (p >= 25) return 24;
  if (p >= 17) return 16;
  if (p >= 9) return 8;
  return null;
}

export function subnetDetail(p: number): Sheet {
  if (!Number.isInteger(p) || p < MIN_PREFIX || p > MAX_PREFIX) {
    throw new Error(`Prefix out of range: /${p}`);
  }
  const mask = prefixToMaskInt(p);
  const size = 2 ** (32 - p);
  const net = exampleNetwork(p);
  const bc = (net + size - 1) >>> 0;
  const octetIdx = Math.floor((p - 1) / 8);
  const block = 2 ** ((32 - p) % 8);
  const parent = parentPrefix(p);

  const lines: string[] = [
    `Mask  ·  ${prefixToMask(p)}`,
    `Wildcard  ·  ${intToIp(~mask >>> 0)}`,
    `Usable hosts  ·  ${formatCount(usableHosts(p))}`,
    `Total addresses  ·  ${formatCount(size)}`,
    `Block size  ·  ${block} (${ORDINAL[octetIdx]} octet)`,
  ];
  if (parent !== null) lines.push(`Subnets per /${parent}  ·  ${formatCount(2 ** (p - parent))}`);
  if (SUBNET_USES[p]) lines.push(`Use  ·  ${SUBNET_USES[p]}`);
  lines.push(calculate(`${intToIp(net)}/${p}`).binaryMask);

  // Example addresses
  lines.push(PAGE_BREAK);
  if (p === 32) {
    const host = net + 10;
    lines.push(
      `Example  ·  ${intToIp(host)}/32`,
      `Address  ·  ${intToIp(host)}`,
      'No network / broadcast address',
      'Mask 255.255.255.255 = this IP only',
    );
  } else if (p === 31) {
    lines.push(
      `Example  ·  ${intToIp(net)}/31`,
      `Host A  ·  ${intToIp(net)}`,
      `Host B  ·  ${intToIp(net + 1)}`,
      'No network / broadcast address',
      `Next subnet  ·  ${intToIp(net + 2)}`,
    );
  } else {
    lines.push(
      `Example  ·  ${intToIp(net)}/${p}`,
      `Network  ·  ${intToIp(net)}`,
      `First host  ·  ${intToIp(net + 1)}`,
      `Last host  ·  ${intToIp(bc - 1)}`,
      `Broadcast  ·  ${intToIp(bc)}`,
      `Next subnet  ·  ${bc === 0xffffffff ? '—' : intToIp(bc + 1)}`,
    );
  }

  // The first few subnets inside the parent block.
  if (parent !== null) {
    const parentNet = (net & prefixToMaskInt(parent)) >>> 0;
    const count = 2 ** (p - parent);
    const shown = Math.min(count, 6);
    lines.push(PAGE_BREAK, `In ${intToIp(parentNet)}/${parent}  (net – broadcast):`);
    for (let i = 0; i < shown; i++) {
      const start = parentNet + i * size;
      lines.push(`${intToIp(start)} – ${intToIp(start + size - 1)}`);
    }
    if (count > shown) lines.push(`… ${formatCount(count - shown)} more`);
  }

  return {
    id: `subnet-${p}`,
    title: `/${p}  ·  ${prefixToMask(p)}`,
    lines,
    prevId: p < MAX_PREFIX ? `subnet-${p + 1}` : undefined,
    nextId: p > MIN_PREFIX ? `subnet-${p - 1}` : undefined,
  };
}

function wildcardTable(): string[] {
  const lines: string[] = [];
  for (let p = 32; p >= 16; p--) {
    lines.push(`/${p}  ${intToIp(~prefixToMaskInt(p) >>> 0)}`);
  }
  return lines;
}

export const SHEETS: Sheet[] = [
  {
    id: 'octet',
    title: 'Mask octets & block size',
    lines: [
      'Bits  Octet  Block',
      '1  ·  128  ·  128',
      '2  ·  192  ·  64',
      '3  ·  224  ·  32',
      '4  ·  240  ·  16',
      '5  ·  248  ·  8',
      '6  ·  252  ·  4',
      '7  ·  254  ·  2',
      '8  ·  255  ·  1',
      'Bit values: 128 64 32 16 8 4 2 1',
      'Block = 256 − octet',
      'Network = floor(ip / block) × block',
    ],
  },
  {
    id: 'wildcard',
    title: 'Wildcard masks (ACL / OSPF)',
    lines: wildcardTable(),
  },
  {
    id: 'ranges',
    title: 'Private & special IPv4',
    lines: [
      '10.0.0.0/8  ·  Private',
      '172.16.0.0/12  ·  Private',
      '192.168.0.0/16  ·  Private',
      '100.64.0.0/10  ·  CGNAT',
      '127.0.0.0/8  ·  Loopback',
      '169.254.0.0/16  ·  Link-local',
      '224.0.0.0/4  ·  Multicast',
      '240.0.0.0/4  ·  Reserved',
      '192.0.2.0/24  ·  TEST-NET-1',
      '198.51.100.0/24  ·  TEST-NET-2',
      '203.0.113.0/24  ·  TEST-NET-3',
      '198.18.0.0/15  ·  Benchmark',
      '255.255.255.255  ·  Broadcast',
      '0.0.0.0/8  ·  This network',
    ],
  },
  {
    id: 'classes',
    title: 'Classful ranges',
    lines: [
      'A  1–126  ·  /8',
      'B  128–191  ·  /16',
      'C  192–223  ·  /24',
      'D  224–239  ·  Multicast',
      'E  240–255  ·  Reserved',
      '127.x  ·  Loopback',
      'First octet bits:',
      'A 0xxx  B 10xx  C 110x',
      'D 1110  E 1111',
    ],
  },
  {
    id: 'ports',
    title: 'Common ports',
    lines: [
      '20/21 FTP  ·  22 SSH/SFTP',
      '23 Telnet  ·  25 SMTP',
      '53 DNS (tcp/udp)',
      '67/68 DHCP (udp)',
      '69 TFTP (udp)  ·  123 NTP',
      '80 HTTP  ·  443 HTTPS',
      '110 POP3  ·  995 POP3S',
      '143 IMAP  ·  993 IMAPS',
      '161/162 SNMP (udp)',
      '179 BGP  ·  389 LDAP',
      '445 SMB  ·  636 LDAPS',
      '465/587 SMTP submission',
      '514 Syslog (udp)',
      '1812/1813 RADIUS',
      '1433 MSSQL  ·  1521 Oracle',
      '3306 MySQL  ·  5432 Postgres',
      '3389 RDP  ·  5900 VNC',
      '6379 Redis  ·  27017 Mongo',
      '500/4500 IPsec IKE/NAT-T',
      '1194 OpenVPN  ·  51820 WG',
      '5060/5061 SIP',
      '8080/8443 HTTP alt',
    ],
  },
  {
    id: 'ipv6',
    title: 'IPv6 cheat sheet',
    lines: [
      '::1/128  ·  Loopback',
      '::/128  ·  Unspecified',
      'fe80::/10  ·  Link-local',
      'fc00::/7  ·  Unique local (ULA)',
      'ff00::/8  ·  Multicast',
      '2000::/3  ·  Global unicast',
      '2001:db8::/32  ·  Documentation',
      '64:ff9b::/96  ·  NAT64',
      '::ffff:0:0/96  ·  IPv4-mapped',
      'ff02::1  ·  All nodes',
      'ff02::2  ·  All routers',
      'ff02::1:2  ·  DHCPv6 agents',
      '/48 site  ·  /56 home  ·  /64 LAN',
      '/64 = 2^64 hosts (SLAAC)',
      '/127  ·  Point-to-point',
      '/128  ·  Single host',
    ],
  },
  {
    id: 'osi',
    title: 'OSI model',
    lines: [
      '7 Application  ·  HTTP DNS SSH',
      '6 Presentation  ·  TLS, encoding',
      '5 Session  ·  RPC, sockets',
      '4 Transport  ·  TCP UDP  ·  Segment',
      '3 Network  ·  IP ICMP  ·  Packet',
      '2 Data link  ·  Ethernet  ·  Frame',
      '1 Physical  ·  Cable, radio  ·  Bits',
      'TCP/IP: App · Transport · Internet · Link',
    ],
  },
  {
    id: 'commands',
    title: 'Troubleshooting commands',
    lines: [
      'Linux / macOS:',
      'ip a  ·  ip r  ·  ip neigh',
      'ss -tulpn  ·  ping -c 4 host',
      'traceroute / mtr host',
      'dig host  ·  dig -x ip',
      'curl -v https://host',
      'tcpdump -i eth0 port 53',
      'nc -zv host 443',
      'Windows:',
      'ipconfig /all  ·  /flushdns',
      'route print  ·  arp -a',
      'tracert host  ·  pathping host',
      'nslookup host',
      'netstat -ano',
      'Test-NetConnection host -Port 443',
    ],
  },
  {
    id: 'mtu',
    title: 'MTU, headers & VLAN',
    lines: [
      'Ethernet MTU  ·  1500',
      'Jumbo frame  ·  9000',
      'IPv4 header  ·  20–60 B',
      'IPv6 header  ·  40 B',
      'TCP header  ·  20–60 B',
      'UDP header  ·  8 B',
      'TCP MSS (1500)  ·  1460',
      'PPPoE MTU  ·  1492',
      '802.1Q tag  ·  4 B',
      'VLAN IDs  ·  1–4094',
      'Ping DF test (Linux):',
      'ping -M do -s 1472 host',
      'Ping DF test (Windows):',
      'ping -f -l 1472 host',
    ],
  },
];

/** Render a calculator result as a sheet for the glasses. */
export function calculatorSheet(input: string): Sheet {
  try {
    const r = calculate(input);
    return {
      id: 'calc',
      title: `Calc: ${r.ip}/${r.prefix}`,
      lines: [
        `Network  ·  ${r.network}/${r.prefix}`,
        `Mask  ·  ${r.mask}`,
        `Wildcard  ·  ${r.wildcard}`,
        `First host  ·  ${r.firstHost}`,
        `Last host  ·  ${r.lastHost}`,
        `Broadcast  ·  ${r.broadcast}`,
        `Usable hosts  ·  ${formatCount(r.usableHosts)}`,
        `Total  ·  ${formatCount(r.totalAddresses)}`,
        `Class ${r.ipClass}  ·  ${r.scope}`,
        r.binaryMask,
      ],
    };
  } catch (e) {
    return {
      id: 'calc',
      title: 'Calculator',
      lines: [`Error: ${(e as Error).message}`, '', 'Enter an address in the phone app,', 'e.g. 192.168.1.10/26'],
    };
  }
}

/** Look up any sheet by id: static sheets, `subnet-<n>`, or `calc`. */
export function sheetById(id: string, calcInput: string): Sheet | undefined {
  if (id === 'calc') return calculatorSheet(calcInput);
  const m = id.match(/^subnet-(\d+)$/);
  if (m) {
    const p = Number(m[1]);
    return p >= MIN_PREFIX && p <= MAX_PREFIX ? subnetDetail(p) : undefined;
  }
  return SHEETS.find((s) => s.id === id);
}

export function paginate(lines: string[], perPage: number): string[][] {
  const pages: string[][] = [];
  let section: string[] = [];
  const flush = () => {
    for (let i = 0; i < section.length; i += perPage) pages.push(section.slice(i, i + perPage));
    section = [];
  };
  for (const line of lines) {
    if (line === PAGE_BREAK) flush();
    else section.push(line);
  }
  flush();
  return pages.length ? pages : [[]];
}

/** Plain-text version of a sheet for the phone UI. */
export function sheetText(sheet: Sheet): string {
  return sheet.lines.map((l) => (l === PAGE_BREAK ? '' : l)).join('\n');
}
