// Cheat sheet content shown on the glasses.
// The G2 font is proportional, so columns are separated with symbols rather
// than padded with spaces. Keep lines short (≈40 chars) so nothing wraps.

import { calculate, formatCount, prefixToMask, usableHosts, intToIp, prefixToMaskInt } from './subnet';

export interface Sheet {
  id: string;
  title: string;
  lines: string[];
}

function subnetTable(): string[] {
  const lines: string[] = [];
  for (let p = 8; p <= 32; p++) {
    lines.push(`/${p}  ${prefixToMask(p)}  ·  ${formatCount(usableHosts(p))}`);
  }
  return lines;
}

function wildcardTable(): string[] {
  const lines: string[] = [];
  for (let p = 16; p <= 32; p++) {
    lines.push(`/${p}  ${intToIp(~prefixToMaskInt(p) >>> 0)}`);
  }
  return lines;
}

export const SHEETS: Sheet[] = [
  {
    id: 'cidr',
    title: 'CIDR  →  Mask  ·  Hosts',
    lines: subnetTable(),
  },
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

export function paginate(lines: string[], perPage: number): string[][] {
  if (lines.length === 0) return [[]];
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  return pages;
}
