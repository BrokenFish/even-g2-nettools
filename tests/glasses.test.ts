import { describe, expect, it } from 'vitest';
import {
  List_ItemEvent,
  OsEventTypeList,
  StartUpPageCreateResult,
  Text_ItemEvent,
  type CreateStartUpPageContainer,
  type EvenHubEvent,
  type RebuildPageContainer,
} from '@evenrealities/even_hub_sdk';
import { GlassesApp, MAX_LIST_ITEMS, MAX_LIST_LABEL, listDef, type Bridge } from '../src/glasses';

type Page = CreateStartUpPageContainer | RebuildPageContainer;

/** Records what the app sends to the glasses. */
class FakeBridge implements Bridge {
  pages: Page[] = [];
  texts: string[] = [];
  exited = false;
  async createStartUpPageContainer(c: CreateStartUpPageContainer) { this.pages.push(c); return StartUpPageCreateResult.success; }
  async rebuildPageContainer(c: RebuildPageContainer) { this.pages.push(c); return true; }
  async textContainerUpgrade(c: { content?: string }) { this.texts.push(c.content ?? ''); return true; }
  async shutDownPageContainer() { this.exited = true; return true; }
  onEvenHubEvent() { return () => {}; }
  get lastList(): string[] {
    return this.pages.at(-1)?.listObject?.[0]?.itemContainer?.itemName ?? [];
  }
  get lastBody(): string {
    return this.pages.at(-1)?.textObject?.find((t) => t.isEventCapture === 1)?.content ?? '';
  }
}

const listClick = (index: number, name?: string): EvenHubEvent => ({
  // Mimic the firmware: index 0 and CLICK (0) are omitted.
  listEvent: new List_ItemEvent({ currentSelectItemIndex: index || undefined, currentSelectItemName: name }),
});
const text = (eventType: OsEventTypeList): EvenHubEvent => ({ textEvent: new Text_ItemEvent({ eventType }) });

async function setup() {
  const bridge = new FakeBridge();
  const app = new GlassesApp(bridge);
  await app.start();
  // Gestures within 300 ms of each other are debounced; step the clock instead of waiting.
  let t = 1_000_000;
  const realNow = Date.now;
  Date.now = () => (t += 1000);
  const send = async (e: EvenHubEvent) => app.dispatch(e);
  return { bridge, app, send, restore: () => (Date.now = realNow) };
}

describe('glasses navigation', () => {
  it('respects firmware list limits on every list', () => {
    for (const id of ['menu', 'subnets', 'subnets-large']) {
      const { items } = listDef(id);
      expect(items.length, id).toBeLessThanOrEqual(MAX_LIST_ITEMS);
      for (const i of items) expect(i.label.length).toBeLessThanOrEqual(MAX_LIST_LABEL);
    }
  });

  it('menu → subnets (smallest first) → /26 details → back', async () => {
    const { bridge, app, send, restore } = await setup();
    try {
      expect(bridge.lastList[0]).toMatch(/^Subnets/);

      await send(listClick(0)); // index 0 omitted, like the device
      expect(app.current).toEqual({ kind: 'list', id: 'subnets' });
      expect(bridge.lastList.slice(0, 3).map((l) => l.split(' ')[0])).toEqual(['/32', '/31', '/30']);

      const idx26 = bridge.lastList.findIndex((l) => l.startsWith('/26 '));
      await send(listClick(idx26));
      expect(app.current).toMatchObject({ kind: 'sheet', id: 'subnet-26', page: 0 });

      // Page through the details; the last page shows example ranges.
      const { pageCount } = app.current as { pageCount: number };
      expect(pageCount).toBeGreaterThan(1);
      for (let i = 1; i < pageCount; i++) await send(text(OsEventTypeList.SCROLL_BOTTOM_EVENT));
      expect(bridge.texts.join('\n')).toContain('Broadcast  ·  192.168.1.63');

      // Scrolling past the end moves on to the next larger subnet.
      await send(text(OsEventTypeList.SCROLL_BOTTOM_EVENT));
      expect(app.current).toMatchObject({ kind: 'sheet', id: 'subnet-25', page: 0 });
      // ...and scrolling up from the first page goes back to the smaller one.
      await send(text(OsEventTypeList.SCROLL_TOP_EVENT));
      expect(app.current).toMatchObject({ kind: 'sheet', id: 'subnet-26' });

      await send(text(OsEventTypeList.DOUBLE_CLICK_EVENT));
      expect(app.current).toEqual({ kind: 'list', id: 'subnets' });
      await send({ listEvent: new List_ItemEvent({ eventType: OsEventTypeList.DOUBLE_CLICK_EVENT }) });
      expect(app.current).toEqual({ kind: 'list', id: 'menu' });
      await send({ listEvent: new List_ItemEvent({ eventType: OsEventTypeList.DOUBLE_CLICK_EVENT }) });
      expect(bridge.exited).toBe(true);
    } finally {
      restore();
    }
  });

  it('reaches /15–/8 through the last item and opens a /12', async () => {
    const { bridge, app, send, restore } = await setup();
    try {
      await send(listClick(0));
      const n = bridge.lastList.length;
      await send(listClick(n - 1, bridge.lastList[n - 1]));
      expect(app.current).toEqual({ kind: 'list', id: 'subnets-large' });
      expect(bridge.lastList[0].startsWith('/15 ')).toBe(true);
      await send(listClick(3, bridge.lastList[3]));
      expect(app.current).toMatchObject({ kind: 'sheet', id: 'subnet-12' });
      expect(bridge.lastBody).toContain('Mask  ·  255.240.0.0');
    } finally {
      restore();
    }
  });

  it('opening a subnet from the phone sets up a sensible back path', async () => {
    const { app, send, restore } = await setup();
    try {
      await app.openSheetById('subnet-10');
      await send(text(OsEventTypeList.DOUBLE_CLICK_EVENT));
      expect(app.current).toEqual({ kind: 'list', id: 'subnets-large' });
      await app.openSheetById('subnet-29');
      await send(text(OsEventTypeList.DOUBLE_CLICK_EVENT));
      expect(app.current).toEqual({ kind: 'list', id: 'subnets' });
    } finally {
      restore();
    }
  });
});
