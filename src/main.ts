import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import './style.css';
import { SHEETS, SUBNET_PREFIXES, sheetText, subnetDetail, subnetLabel, type Sheet } from './content';
import { GlassesApp, type Bridge } from './glasses';
import { MockBridge } from './mock-bridge';
import { calculate, formatCount, split } from './subnet';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const STORAGE_KEY = 'nettools.lastCalc';

interface Storage {
  get(key: string): Promise<string>;
  set(key: string, value: string): Promise<void>;
}

function inEvenApp(): boolean {
  return typeof (window as unknown as { flutter_inappwebview?: unknown }).flutter_inappwebview !== 'undefined';
}

async function connect(): Promise<{ bridge: Bridge; storage: Storage; mock: MockBridge | null }> {
  if (inEvenApp()) {
    const real = await waitForEvenAppBridge();
    return {
      bridge: real,
      storage: {
        get: (k) => real.getLocalStorage(k).catch(() => ''),
        set: async (k, v) => void (await real.setLocalStorage(k, v)),
      },
      mock: null,
    };
  }
  const mock = new MockBridge($('screen'));
  return {
    bridge: mock,
    storage: {
      get: async (k) => {
        try { return localStorage.getItem(k) ?? ''; } catch { return ''; }
      },
      set: async (k, v) => {
        try { localStorage.setItem(k, v); } catch { /* ignore */ }
      },
    },
    mock,
  };
}

function renderCalc(input: string): boolean {
  const err = $('calc-error');
  const out = $('calc-result');
  out.innerHTML = '';
  try {
    const r = calculate(input);
    err.hidden = true;
    const rows: Array<[string, string]> = [
      ['Network', `${r.network}/${r.prefix}`],
      ['Mask', r.mask],
      ['Wildcard', r.wildcard],
      ['First host', r.firstHost],
      ['Last host', r.lastHost],
      ['Broadcast', r.broadcast],
      ['Usable hosts', formatCount(r.usableHosts)],
      ['Total addresses', formatCount(r.totalAddresses)],
      ['Class / type', `${r.ipClass} · ${r.scope}`],
      ['Binary mask', r.binaryMask],
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      out.append(dt, dd);
    }
    ($('split-prefix') as HTMLInputElement).min = String(r.prefix);
    return true;
  } catch (e) {
    err.textContent = (e as Error).message;
    err.hidden = false;
    return false;
  }
}

async function main(): Promise<void> {
  const { bridge, storage, mock } = await connect();
  const app = new GlassesApp(bridge);
  const input = $('calc-input') as HTMLInputElement;

  const saved = (await storage.get(STORAGE_KEY)) || '192.168.1.10/24';
  input.value = saved;
  renderCalc(saved);
  await app.start(saved);

  $('status').textContent = mock ? 'Browser preview' : 'Connected to the Even app';

  $('calc-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const v = input.value.trim();
    if (!renderCalc(v)) return;
    await storage.set(STORAGE_KEY, v);
    await app.showCalculator(v);
  });

  $('split-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const list = $('split-result');
    list.innerHTML = '';
    try {
      const prefix = Number(($('split-prefix') as HTMLInputElement).value);
      for (const net of split(input.value, prefix)) {
        const li = document.createElement('li');
        li.textContent = net;
        list.appendChild(li);
      }
      $('calc-error').hidden = true;
    } catch (e) {
      $('calc-error').textContent = (e as Error).message;
      $('calc-error').hidden = false;
    }
  });

  const sheetDetails = (title: string, sheet: Sheet, className = '') => {
    const d = document.createElement('details');
    if (className) d.className = className;
    const sum = document.createElement('summary');
    sum.textContent = title;
    const pre = document.createElement('pre');
    pre.textContent = sheetText(sheet);
    const btn = document.createElement('button');
    btn.textContent = 'Show on glasses';
    btn.addEventListener('click', () => void app.openSheetById(sheet.id));
    d.append(sum, pre, btn);
    return d;
  };

  const subnets = $('subnets');
  for (const p of SUBNET_PREFIXES) subnets.appendChild(sheetDetails(subnetLabel(p), subnetDetail(p), 'subnet'));

  const sheets = $('sheets');
  for (const s of SHEETS) sheets.appendChild(sheetDetails(s.title, s));

  if (mock) {
    $('preview-card').hidden = false;
    const frame = document.querySelector<HTMLElement>('.glasses')!;
    const fit = () => ($('screen').style.transform = `scale(${frame.clientWidth / 576})`);
    new ResizeObserver(fit).observe(frame);
    fit();
    document.querySelectorAll<HTMLButtonElement>('[data-g]').forEach((b) =>
      b.addEventListener('click', () => mock.gesture(b.dataset.g as 'click' | 'double' | 'up' | 'down')),
    );
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const map: Record<string, 'click' | 'double' | 'up' | 'down'> = {
        ArrowUp: 'up', ArrowDown: 'down', Enter: 'click', Escape: 'double',
      };
      const g = map[e.key];
      if (g) {
        e.preventDefault();
        mock.gesture(g);
      }
    });
  }
}

main().catch((e) => {
  console.error(e);
  $('status').textContent = `Error: ${(e as Error).message}`;
});
