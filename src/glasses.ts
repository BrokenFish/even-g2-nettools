// Glasses UI controller. Screens are kept on a stack:
//   menu (list) → subnet list (list) → subnet details (paged text)
//   menu (list) → cheat sheet (paged text)
// Works against the real EvenAppBridge or the browser mock in mock-bridge.ts.

import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';
import { SHEETS, paginate, sheetById, subnetLabel, type Sheet } from './content';

export type Bridge = Pick<
  EvenAppBridge,
  | 'createStartUpPageContainer'
  | 'rebuildPageContainer'
  | 'textContainerUpgrade'
  | 'onEvenHubEvent'
  | 'shutDownPageContainer'
>;

// G2 display is 576×288. Body text fits ~8 lines below a one-line header.
export const DISPLAY_W = 576;
export const DISPLAY_H = 288;
export const LINES_PER_PAGE = 8;
/** Firmware limits for list containers. */
export const MAX_LIST_ITEMS = 20;
export const MAX_LIST_LABEL = 64;

const HEADER_ID = 1;
const HEADER_NAME = 'header';
const BODY_ID = 2;
const BODY_NAME = 'body';
const LIST_ID = 2;
const LIST_NAME = 'list';

/** Prefixes shown directly in the subnet list; the rest sit one level deeper. */
const SMALL_SUBNETS = Array.from({ length: 17 }, (_, i) => 32 - i); // /32 → /16
const LARGE_SUBNETS = Array.from({ length: 8 }, (_, i) => 15 - i); // /15 → /8

const MENU_LABELS: Record<string, string> = {
  octet: 'Mask octets & blocks',
  wildcard: 'Wildcard masks',
  ranges: 'Private & special IPv4',
  classes: 'Classful ranges',
  ports: 'Common ports',
  ipv6: 'IPv6 cheat sheet',
  osi: 'OSI model',
  commands: 'Troubleshooting cmds',
  mtu: 'MTU, headers & VLAN',
};

interface ListItem {
  label: string;
  /** `list:<id>` opens another list, anything else is a sheet id. */
  target: string;
}

interface ListDef {
  header: string;
  items: ListItem[];
}

export function listDef(id: string): ListDef {
  switch (id) {
    case 'subnets':
      return {
        header: 'SUBNETS  ·  click = details  ·  2× = back',
        items: [
          ...SMALL_SUBNETS.map((p) => ({ label: subnetLabel(p), target: `subnet-${p}` })),
          { label: '/15 – /8  ·  larger networks  →', target: 'list:subnets-large' },
        ],
      };
    case 'subnets-large':
      return {
        header: 'SUBNETS /15 – /8  ·  2× = back',
        items: LARGE_SUBNETS.map((p) => ({ label: subnetLabel(p), target: `subnet-${p}` })),
      };
    default:
      return {
        header: 'NET TOOLS  ·  click = open  ·  2× = exit',
        items: [
          { label: 'Subnets  (/32 → /8)', target: 'list:subnets' },
          ...SHEETS.map((s) => ({ label: MENU_LABELS[s.id] ?? s.title, target: s.id })),
          { label: 'Calculator result', target: 'calc' },
        ],
      };
  }
}

type Screen = { kind: 'list'; id: string } | { kind: 'sheet'; sheet: Sheet; pages: string[][]; page: number };

type Action = 'click' | 'double' | 'up' | 'down';

export class GlassesApp {
  private stack: Screen[] = [{ kind: 'list', id: 'menu' }];
  private started = false;
  private lastAction = { action: '', at: 0 };
  private calcInput = '192.168.1.10/24';

  constructor(private bridge: Bridge) {}

  async start(calcInput?: string): Promise<void> {
    if (calcInput) this.calcInput = calcInput;
    this.bridge.onEvenHubEvent((e) => this.handleEvent(e));
    const res = await this.bridge.createStartUpPageContainer(new CreateStartUpPageContainer(this.layout()));
    if (res !== StartUpPageCreateResult.success) {
      console.warn('createStartUpPageContainer failed:', res);
    }
    this.started = true;
  }

  /** Called from the phone UI: show a calculator result on the glasses. */
  async showCalculator(input: string): Promise<void> {
    this.calcInput = input;
    await this.openSheetById('calc');
  }

  /**
   * Open a sheet from the phone UI. The stack is rebuilt so that "back" on the
   * glasses leads somewhere sensible (subnet details → subnet list → menu).
   */
  async openSheetById(id: string): Promise<void> {
    const sheet = sheetById(id, this.calcInput);
    if (!sheet) return;
    this.stack = [{ kind: 'list', id: 'menu' }];
    const m = id.match(/^subnet-(\d+)$/);
    if (m) {
      this.stack.push({ kind: 'list', id: 'subnets' });
      if (Number(m[1]) < 16) this.stack.push({ kind: 'list', id: 'subnets-large' });
    }
    this.stack.push(GlassesApp.sheetScreen(sheet));
    await this.render();
  }

  /** Current screen, for tests and debugging. */
  get current(): { kind: 'list'; id: string } | { kind: 'sheet'; id: string; page: number; pageCount: number } {
    const top = this.top;
    return top.kind === 'list'
      ? { kind: 'list', id: top.id }
      : { kind: 'sheet', id: top.sheet.id, page: top.page, pageCount: top.pages.length };
  }

  // ---- layouts -----------------------------------------------------------

  private get top(): Screen {
    return this.stack[this.stack.length - 1];
  }

  private static sheetScreen(sheet: Sheet): Screen {
    return { kind: 'sheet', sheet, pages: paginate(sheet.lines, LINES_PER_PAGE), page: 0 };
  }

  private layout() {
    const top = this.top;
    return top.kind === 'list' ? this.listLayout(listDef(top.id)) : this.sheetLayout(top);
  }

  private header(content: string) {
    return new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: DISPLAY_W,
      height: 40,
      containerID: HEADER_ID,
      containerName: HEADER_NAME,
      zOrderIndex: 1,
      content,
      textColor: 3,
      isEventCapture: 0,
    });
  }

  private listLayout(def: ListDef) {
    const labels = def.items.map((i) => i.label);
    if (labels.length > MAX_LIST_ITEMS) console.warn(`List has ${labels.length} items; max is ${MAX_LIST_ITEMS}`);
    return {
      containerTotalNum: 2,
      textObject: [this.header(def.header)],
      listObject: [
        new ListContainerProperty({
          xPosition: 0,
          yPosition: 44,
          width: DISPLAY_W,
          height: DISPLAY_H - 44,
          containerID: LIST_ID,
          containerName: LIST_NAME,
          zOrderIndex: 2,
          isEventCapture: 1,
          itemContainer: new ListItemContainerProperty({
            itemCount: labels.length,
            itemWidth: DISPLAY_W,
            isItemSelectBorderEn: 1,
            itemName: labels,
          }),
        }),
      ],
    };
  }

  private sheetLayout(s: Extract<Screen, { kind: 'sheet' }>) {
    return {
      containerTotalNum: 2,
      textObject: [
        this.header(GlassesApp.headerText(s)),
        new TextContainerProperty({
          xPosition: 0,
          yPosition: 44,
          width: DISPLAY_W,
          height: DISPLAY_H - 44,
          containerID: BODY_ID,
          containerName: BODY_NAME,
          zOrderIndex: 2,
          content: GlassesApp.bodyText(s),
          isEventCapture: 1,
        }),
      ],
    };
  }

  private static headerText(s: Extract<Screen, { kind: 'sheet' }>): string {
    const { title } = s.sheet;
    return s.pages.length > 1 ? `${title}   ${s.page + 1}/${s.pages.length}` : title;
  }

  private static bodyText(s: Extract<Screen, { kind: 'sheet' }>): string {
    return (s.pages[s.page] ?? []).join('\n');
  }

  // ---- navigation --------------------------------------------------------

  private async render(): Promise<void> {
    if (!this.started) return;
    await this.bridge.rebuildPageContainer(new RebuildPageContainer(this.layout()));
  }

  private async open(target: string): Promise<void> {
    if (target.startsWith('list:')) {
      this.stack.push({ kind: 'list', id: target.slice(5) });
    } else {
      const sheet = sheetById(target, this.calcInput);
      if (!sheet) return;
      this.stack.push(GlassesApp.sheetScreen(sheet));
    }
    await this.render();
  }

  private async back(): Promise<void> {
    if (this.stack.length <= 1) {
      // Root page: Even Hub requires double-tap to exit here.
      await this.bridge.shutDownPageContainer(1);
      return;
    }
    this.stack.pop();
    await this.render();
  }

  /** Swap the current sheet for a neighbour (e.g. /26 → /25). */
  private async replaceSheet(id: string | undefined): Promise<void> {
    const sheet = id ? sheetById(id, this.calcInput) : undefined;
    if (!sheet) return;
    this.stack[this.stack.length - 1] = GlassesApp.sheetScreen(sheet);
    await this.render();
  }

  private async turnPage(s: Extract<Screen, { kind: 'sheet' }>, delta: number): Promise<void> {
    s.page += delta;
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: HEADER_ID, containerName: HEADER_NAME, content: GlassesApp.headerText(s) }),
    );
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: BODY_ID, containerName: BODY_NAME, content: GlassesApp.bodyText(s) }),
    );
  }

  // ---- input -------------------------------------------------------------

  private static toAction(type: OsEventTypeList | undefined): Action | null {
    // Protobuf omits zero values, so a missing eventType means CLICK_EVENT (0).
    switch (type ?? OsEventTypeList.CLICK_EVENT) {
      case OsEventTypeList.CLICK_EVENT:
        return 'click';
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        return 'double';
      case OsEventTypeList.SCROLL_TOP_EVENT:
        return 'up';
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        return 'down';
      default:
        return null;
    }
  }

  /** Scroll events can fire in bursts and some hosts report a gesture twice. */
  private isDuplicate(action: string): boolean {
    const now = Date.now();
    const dup = this.lastAction.action === action && now - this.lastAction.at < 300;
    this.lastAction = { action, at: now };
    return dup;
  }

  handleEvent(e: EvenHubEvent): void {
    void this.dispatch(e).catch((err) => console.error('event handling failed', err));
  }

  /** Handle one event and wait for the screen update (public for tests). */
  async dispatch(e: EvenHubEvent): Promise<void> {
    const top = this.top;
    const src = e.listEvent ?? e.textEvent ?? e.sysEvent;
    if (!src) return;
    const action = GlassesApp.toAction(src.eventType);
    if (!action || this.isDuplicate(action)) return;

    if (top.kind === 'list') {
      if (action === 'double') return this.back();
      if (action !== 'click' || !e.listEvent) return; // the list scrolls natively
      const { items } = listDef(top.id);
      const byName = items.findIndex((i) => i.label === e.listEvent?.currentSelectItemName);
      // The first item's index (0) is often omitted from the event.
      const idx = byName >= 0 ? byName : (e.listEvent.currentSelectItemIndex ?? 0);
      const item = items[idx];
      if (item) await this.open(item.target);
      return;
    }

    const last = top.pages.length - 1;
    switch (action) {
      case 'double':
        return this.back();
      case 'down':
        if (top.page < last) return this.turnPage(top, 1);
        return this.replaceSheet(top.sheet.nextId);
      case 'up':
        if (top.page > 0) return this.turnPage(top, -1);
        return this.replaceSheet(top.sheet.prevId);
      case 'click':
        // Click advances; on the last page it goes back.
        if (top.page < last) return this.turnPage(top, 1);
        return this.back();
    }
  }
}
