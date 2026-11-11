import { describe, expect, it } from 'vitest';
import { calculate, maskToPrefix, parseInput, prefixToMask, split, usableHosts, addressScope, ipToInt } from '../src/subnet';
import { PAGE_BREAK, SHEETS, SUBNET_PREFIXES, calculatorSheet, paginate, subnetDetail, subnetLabel } from '../src/content';

describe('subnet math', () => {
  it('converts prefixes and masks', () => {
    expect(prefixToMask(0)).toBe('0.0.0.0');
    expect(prefixToMask(24)).toBe('255.255.255.0');
    expect(prefixToMask(26)).toBe('255.255.255.192');
    expect(prefixToMask(32)).toBe('255.255.255.255');
    expect(maskToPrefix('255.255.240.0')).toBe(20);
    expect(() => maskToPrefix('255.0.255.0')).toThrow(/Non-contiguous/);
  });

  it('calculates a /26', () => {
    const r = calculate('192.168.1.77/26');
    expect(r.network).toBe('192.168.1.64');
    expect(r.broadcast).toBe('192.168.1.127');
    expect(r.firstHost).toBe('192.168.1.65');
    expect(r.lastHost).toBe('192.168.1.126');
    expect(r.wildcard).toBe('0.0.0.63');
    expect(r.usableHosts).toBe(62);
    expect(r.scope).toBe('Private (RFC 1918)');
    expect(r.binaryMask).toBe('11111111.11111111.11111111.11000000');
  });

  it('accepts dotted masks and bare IPs', () => {
    expect(parseInput('10.1.2.3 255.255.0.0')).toEqual({ ip: ipToInt('10.1.2.3'), prefix: 16 });
    expect(calculate('172.20.5.5').prefix).toBe(16);
    expect(calculate('8.8.8.8').scope).toBe('Public');
  });

  it('handles /31 and /32', () => {
    expect(usableHosts(31)).toBe(2);
    expect(usableHosts(32)).toBe(1);
    const p2p = calculate('10.0.0.1/31');
    expect([p2p.firstHost, p2p.lastHost]).toEqual(['10.0.0.0', '10.0.0.1']);
    const host = calculate('10.0.0.9/32');
    expect([host.firstHost, host.lastHost, host.network]).toEqual(['10.0.0.9', '10.0.0.9', '10.0.0.9']);
  });

  it('handles the top of the address space without overflow', () => {
    const r = calculate('255.255.255.255/0');
    expect(r.network).toBe('0.0.0.0');
    expect(r.broadcast).toBe('255.255.255.255');
    expect(r.totalAddresses).toBe(2 ** 32);
    expect(addressScope(ipToInt('100.100.1.1'))).toBe('CGNAT (RFC 6598)');
  });

  it('rejects bad input', () => {
    expect(() => calculate('300.1.1.1/24')).toThrow();
    expect(() => calculate('1.2.3/24')).toThrow();
    expect(() => calculate('1.2.3.4/33')).toThrow();
  });

  it('splits networks', () => {
    expect(split('192.168.0.0/24', 26)).toEqual([
      '192.168.0.0/26', '192.168.0.64/26', '192.168.0.128/26', '192.168.0.192/26',
    ]);
    expect(split('10.0.0.0/8', 30)).toHaveLength(64);
    expect(() => split('10.0.0.0/24', 20)).toThrow();
  });
});

describe('glasses content', () => {
  it('keeps lines short enough for the display', () => {
    for (const s of SHEETS) for (const l of s.lines) expect(l.length, `${s.id}: ${l}`).toBeLessThanOrEqual(42);
    for (const l of calculatorSheet('10.20.30.40/22').lines) expect(l.length).toBeLessThanOrEqual(42);
    for (const p of SUBNET_PREFIXES) {
      for (const l of subnetDetail(p).lines) expect(l.length, `/${p}: ${l}`).toBeLessThanOrEqual(42);
      expect(subnetLabel(p).length).toBeLessThanOrEqual(64);
    }
  });

  it('lists subnets smallest first', () => {
    expect(SUBNET_PREFIXES[0]).toBe(32);
    expect(SUBNET_PREFIXES.at(-1)).toBe(8);
    expect(subnetLabel(26)).toBe('/26  255.255.255.192  ·  62 hosts');
    expect(subnetLabel(32)).toBe('/32  255.255.255.255  ·  1 host');
  });

  it('shows example addresses for a /26', () => {
    const d = subnetDetail(26);
    expect(d.title).toBe('/26  ·  255.255.255.192');
    expect(d.lines).toEqual(expect.arrayContaining([
      'Wildcard  ·  0.0.0.63',
      'Usable hosts  ·  62',
      'Block size  ·  64 (4th octet)',
      'Subnets per /24  ·  4',
      'Example  ·  192.168.1.0/26',
      'Network  ·  192.168.1.0',
      'First host  ·  192.168.1.1',
      'Last host  ·  192.168.1.62',
      'Broadcast  ·  192.168.1.63',
      'Next subnet  ·  192.168.1.64',
      '192.168.1.192 – 192.168.1.255',
    ]));
    expect(d.prevId).toBe('subnet-27');
    expect(d.nextId).toBe('subnet-25');
  });

  it('handles octet boundaries and special prefixes', () => {
    expect(subnetDetail(24).lines).toEqual(expect.arrayContaining([
      'Block size  ·  1 (3rd octet)',
      'Subnets per /16  ·  256',
      'Broadcast  ·  192.168.1.255',
      '… 250 more',
    ]));
    expect(subnetDetail(20).lines).toEqual(expect.arrayContaining([
      'Block size  ·  16 (3rd octet)',
      'Example  ·  172.16.0.0/20',
      'Broadcast  ·  172.16.15.255',
    ]));
    expect(subnetDetail(31).lines).toEqual(expect.arrayContaining(['Host A  ·  192.168.1.0', 'Host B  ·  192.168.1.1']));
    expect(subnetDetail(32).lines).toContain('Address  ·  192.168.1.10');
    expect(subnetDetail(32).prevId).toBeUndefined();
    const eight = subnetDetail(8);
    expect(eight.nextId).toBeUndefined();
    expect(eight.lines).toEqual(expect.arrayContaining(['Broadcast  ·  10.255.255.255', 'Next subnet  ·  11.0.0.0']));
  });

  it('paginates', () => {
    expect(paginate(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
    expect(paginate([], 8)).toEqual([[]]);
    expect(paginate(['a', PAGE_BREAK, 'b', 'c', 'd'], 2)).toEqual([['a'], ['b', 'c'], ['d']]);
  });

  it('splits subnet details into facts, example and ranges pages', () => {
    const pages = paginate(subnetDetail(26).lines, 8);
    expect(pages).toHaveLength(3);
    expect(pages[0][0]).toBe('Mask  ·  255.255.255.192');
    expect(pages[1][0]).toBe('Example  ·  192.168.1.0/26');
    expect(pages[2][0]).toBe('In 192.168.1.0/24  (net – broadcast):');
    for (const p of SUBNET_PREFIXES) for (const page of paginate(subnetDetail(p).lines, 8)) expect(page.length).toBeLessThanOrEqual(8);
  });

  it('shows errors in the calculator sheet', () => {
    expect(calculatorSheet('nope').lines[0]).toMatch(/^Error/);
  });
});
