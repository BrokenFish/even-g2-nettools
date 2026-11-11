// A browser stand-in for the glasses, used when the page is opened outside the
// Even app (e.g. `npm run dev` on a laptop). Renders the containers into a
// 576×288 preview and turns keys/buttons into the same events the glasses send.

import {
  List_ItemEvent,
  OsEventTypeList,
  StartUpPageCreateResult,
  Sys_ItemEvent,
  Text_ItemEvent,
  type CreateStartUpPageContainer,
  type EvenHubEvent,
  type RebuildPageContainer,
  type TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk';
import { MAX_LIST_ITEMS, MAX_LIST_LABEL, type Bridge } from './glasses';

type Page = CreateStartUpPageContainer | RebuildPageContainer;

export class MockBridge implements Bridge {
  private listeners = new Set<(e: EvenHubEvent) => void>();
  private page: Page | null = null;
  private texts = new Map<number, string>();
  private selected = 0;

  constructor(private screen: HTMLElement) {}

  async createStartUpPageContainer(c: CreateStartUpPageContainer): Promise<StartUpPageCreateResult> {
    if (!MockBridge.valid(c)) return StartUpPageCreateResult.invalid;
    this.load(c);
    return StartUpPageCreateResult.success;
  }

  async rebuildPageContainer(c: RebuildPageContainer): Promise<boolean> {
    if (!MockBridge.valid(c)) return false;
    this.load(c);
    return true;
  }

  async textContainerUpgrade(c: TextContainerUpgrade): Promise<boolean> {
    if (c.containerID !== undefined && c.content !== undefined) this.texts.set(c.containerID, c.content);
    this.render();
    return true;
  }

  async shutDownPageContainer(): Promise<boolean> {
    this.page = null;
    this.screen.innerHTML = '<div class="g-exit">App closed — reload to restart</div>';
    return true;
  }

  onEvenHubEvent(cb: (e: EvenHubEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Simulate a touchpad gesture. */
  gesture(kind: 'click' | 'double' | 'up' | 'down'): void {
    if (!this.page) return;
    const list = this.page.listObject?.find((l) => l.isEventCapture === 1);
    const names = list?.itemContainer?.itemName ?? [];

    if (list && (kind === 'up' || kind === 'down')) {
      // A list container scrolls its own selection on the device.
      this.selected = Math.max(0, Math.min(names.length - 1, this.selected + (kind === 'down' ? 1 : -1)));
      this.render();
      return;
    }

    const eventType = {
      click: OsEventTypeList.CLICK_EVENT,
      double: OsEventTypeList.DOUBLE_CLICK_EVENT,
      up: OsEventTypeList.SCROLL_TOP_EVENT,
      down: OsEventTypeList.SCROLL_BOTTOM_EVENT,
    }[kind];

    let event: EvenHubEvent;
    if (list) {
      event = {
        listEvent: new List_ItemEvent({
          containerID: list.containerID,
          containerName: list.containerName,
          currentSelectItemIndex: this.selected,
          currentSelectItemName: names[this.selected],
          eventType,
        }),
      };
    } else {
      const text = this.page.textObject?.find((t) => t.isEventCapture === 1);
      event = text
        ? { textEvent: new Text_ItemEvent({ containerID: text.containerID, containerName: text.containerName, eventType }) }
        : { sysEvent: new Sys_ItemEvent({ eventType }) };
    }
    this.listeners.forEach((cb) => cb(event));
  }

  /** Reject pages the real firmware would refuse, so problems show up in the browser too. */
  static valid(c: Page): boolean {
    for (const l of c.listObject ?? []) {
      const names = l.itemContainer?.itemName ?? [];
      if (names.length > MAX_LIST_ITEMS || names.some((n) => n.length > MAX_LIST_LABEL)) {
        console.error(`List "${l.containerName}" exceeds firmware limits (${names.length} items)`);
        return false;
      }
    }
    return true;
  }

  private load(c: Page): void {
    this.page = c;
    this.selected = 0;
    this.texts.clear();
    for (const t of c.textObject ?? []) if (t.containerID !== undefined) this.texts.set(t.containerID, t.content ?? '');
    this.render();
  }

  private render(): void {
    const c = this.page;
    if (!c) return;
    this.screen.innerHTML = '';
    const place = (el: HTMLElement, o: { xPosition?: number; yPosition?: number; width?: number; height?: number }) => {
      el.style.left = `${o.xPosition ?? 0}px`;
      el.style.top = `${o.yPosition ?? 0}px`;
      el.style.width = `${o.width ?? 0}px`;
      el.style.height = `${o.height ?? 0}px`;
      this.screen.appendChild(el);
    };
    for (const t of c.textObject ?? []) {
      const el = document.createElement('div');
      el.className = 'g-text';
      el.style.opacity = String(0.4 + 0.15 * (t.textColor ?? 4));
      el.textContent = this.texts.get(t.containerID ?? -1) ?? '';
      place(el, t);
    }
    for (const l of c.listObject ?? []) {
      const el = document.createElement('div');
      el.className = 'g-list';
      (l.itemContainer?.itemName ?? []).forEach((name, i) => {
        const item = document.createElement('div');
        item.className = 'g-item' + (i === this.selected ? ' sel' : '');
        item.textContent = name;
        el.appendChild(item);
      });
      place(el, l);
      el.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
    }
  }
}
