// Glasses UI controller: a menu (list container) and a paged sheet viewer
// (two text containers). Works against the real EvenAppBridge or the
// browser mock in mock-bridge.ts.

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
import { SHEETS, calculatorSheet, paginate, type Sheet } from './content';

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

const HEADER_ID = 1;
const HEADER_NAME = 'header';
const BODY_ID = 2;
const BODY_NAME = 'body';
const MENU_ID = 2;
const MENU_NAME = 'menu';

/** Short labels for the glasses menu (list item names). */
const MENU_LABELS: Record<string, string> = {
  cidr: 'Subnet / CIDR table',
  octet: 'Mask octets & blocks',
  wildcard: 'Wildcard masks',
  ranges: 'Private & special IPv4',
  classes: 'Classful ranges',
  ports: 'Common ports',
  ipv6: 'IPv6 cheat sheet',
  osi: 'OSI model',
  commands: 'Troubleshooting cmds',
  mtu: 'MTU, headers & VLAN',
  calc: 'Calculator result',
};

type Action = 'click' | 'double' | 'up' | 'down';

export class GlassesApp {
  private mode: 'menu' | 'sheet' = 'menu';
  private sheet: Sheet | null = null;
  private pages: string[][] = [];
  private page = 0;
  private started = false;
  private lastAction = { action: '', at: 0 };
  private calcInput = '192.168.1.10/24';
  private menuIds: string[] = [...SHEETS.map((s) => s.id), 'calc'];

  constructor(private bridge: Bridge) {}

  async start(calcInput?: string): Promise<void> {
    if (calcInput) this.calcInput = calcInput;
    this.bridge.onEvenHubEvent((e) => this.handleEvent(e));
    const res = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer(this.menuLayout()),
    );
    if (res !== StartUpPageCreateResult.success) {
      console.warn('createStartUpPageContainer failed:', res);
    }
    this.started = true;
  }

  /** Called from the phone UI: show a calculator result on the glasses. */
  async showCalculator(input: string): Promise<void> {
    this.calcInput = input;
    await this.openSheet(calculatorSheet(input));
  }

  async openSheetById(id: string): Promise<void> {
    if (id === 'calc') return this.openSheet(calculatorSheet(this.calcInput));
    const sheet = SHEETS.find((s) => s.id === id);
    if (sheet) await this.openSheet(sheet);
  }

  // ---- layouts -----------------------------------------------------------

  private menuLayout() {
    const labels = this.menuIds.map((id) => MENU_LABELS[id] ?? id);
    return {
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_W,
          height: 40,
          containerID: HEADER_ID,
          containerName: HEADER_NAME,
          zOrderIndex: 1,
          content: 'NET TOOLS  ·  click = open  ·  2× = exit',
          textColor: 3,
          isEventCapture: 0,
        }),
      ],
      listObject: [
        new ListContainerProperty({
          xPosition: 0,
          yPosition: 44,
          width: DISPLAY_W,
          height: DISPLAY_H - 44,
          containerID: MENU_ID,
          containerName: MENU_NAME,
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

  private sheetLayout() {
    return {
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_W,
          height: 40,
          containerID: HEADER_ID,
          containerName: HEADER_NAME,
          zOrderIndex: 1,
          content: this.headerText(),
          textColor: 3,
          isEventCapture: 0,
        }),
        new TextContainerProperty({
          xPosition: 0,
          yPosition: 44,
          width: DISPLAY_W,
          height: DISPLAY_H - 44,
          containerID: BODY_ID,
          containerName: BODY_NAME,
          zOrderIndex: 2,
          content: this.bodyText(),
          isEventCapture: 1,
        }),
      ],
    };
  }

  private headerText(): string {
    const title = this.sheet?.title ?? '';
    return this.pages.length > 1 ? `${title}   ${this.page + 1}/${this.pages.length}` : title;
  }

  private bodyText(): string {
    return (this.pages[this.page] ?? []).join('\n');
  }

  // ---- navigation --------------------------------------------------------

  private async openSheet(sheet: Sheet): Promise<void> {
    this.sheet = sheet;
    this.pages = paginate(sheet.lines, LINES_PER_PAGE);
    this.page = 0;
    this.mode = 'sheet';
    if (!this.started) return;
    await this.bridge.rebuildPageContainer(new RebuildPageContainer(this.sheetLayout()));
  }

  private async openMenu(): Promise<void> {
    this.mode = 'menu';
    this.sheet = null;
    await this.bridge.rebuildPageContainer(new RebuildPageContainer(this.menuLayout()));
  }

  private async turnPage(delta: number): Promise<void> {
    const next = this.page + delta;
    if (next < 0 || next >= this.pages.length) return;
    this.page = next;
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
      containerID: HEADER_ID,
      containerName: HEADER_NAME,
      content: this.headerText(),
      }),
    );
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
      containerID: BODY_ID,
      containerName: BODY_NAME,
      content: this.bodyText(),
      }),
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

  /** Some hosts report one gesture on more than one channel; drop repeats. */
  private isDuplicate(action: string): boolean {
    const now = Date.now();
    const dup = this.lastAction.action === action && now - this.lastAction.at < 200;
    this.lastAction = { action, at: now };
    return dup;
  }

  handleEvent(e: EvenHubEvent): void {
    void this.dispatch(e).catch((err) => console.error('event handling failed', err));
  }

  private async dispatch(e: EvenHubEvent): Promise<void> {
    if (e.sysEvent?.eventType === OsEventTypeList.SYSTEM_EXIT_EVENT) return;

    if (e.listEvent && this.mode === 'menu') {
      const action = GlassesApp.toAction(e.listEvent.eventType);
      if (!action || this.isDuplicate(action)) return;
      if (action === 'click') {
        const byName = this.menuIds.findIndex(
          (id) => MENU_LABELS[id] === e.listEvent?.currentSelectItemName,
        );
        const idx = byName >= 0 ? byName : (e.listEvent.currentSelectItemIndex ?? 0);
        const id = this.menuIds[idx];
        if (id) await this.openSheetById(id);
      } else if (action === 'double') {
        await this.bridge.shutDownPageContainer(1);
      }
      return;
    }

    const src = e.textEvent ?? e.sysEvent;
    if (!src) return;
    const action = GlassesApp.toAction(src.eventType);
    if (!action || this.isDuplicate(action)) return;

    if (this.mode === 'sheet') {
      if (action === 'double') await this.openMenu();
      else if (action === 'down') await this.turnPage(1);
      else if (action === 'up') await this.turnPage(-1);
      else if (action === 'click') {
        // Click advances; on the last page it returns to the menu.
        if (this.page < this.pages.length - 1) await this.turnPage(1);
        else await this.openMenu();
      }
    } else if (action === 'double') {
      await this.bridge.shutDownPageContainer(1);
    }
  }
}
