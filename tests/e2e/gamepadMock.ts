import type { Page } from '@playwright/test';

/**
 * Installs a fake navigator.getGamepads() with standard-mapping Xbox pads.
 * Buttons: 0 A, 1 B, 2 X, 3 Y, 6 LT, 7 RT, 9 Start, 12-15 D-pad (up,down,left,right). Axes: 0 LX, 1 LY.
 * Call before page.goto(). Drive with setPad(page, index, {buttons:{7:1}, axes:{0:-1}}).
 */
export async function installGamepadMock(page: Page, count = 2): Promise<void> {
  await page.addInitScript((n: number) => {
    const pads = Array.from({ length: n }, (_, i) => ({
      id: `Xbox Mock Controller ${i} (STANDARD GAMEPAD)`,
      index: i,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      vibrationActuator: null,
      hapticActuators: [],
    }));
    (window as any).__pads = pads;
    Object.defineProperty(navigator, 'getGamepads', { value: () => pads, configurable: true });
  }, count);
}

export async function setPad(
  page: Page,
  index: number,
  state: { buttons?: Record<number, number>; axes?: Record<number, number> },
): Promise<void> {
  await page.evaluate(([i, s]) => {
    const pad = (window as any).__pads[i as number];
    const st = s as { buttons?: Record<number, number>; axes?: Record<number, number> };
    for (const [b, v] of Object.entries(st.buttons ?? {})) {
      pad.buttons[+b] = { pressed: v > 0.5, touched: v > 0, value: v };
    }
    for (const [a, v] of Object.entries(st.axes ?? {})) pad.axes[+a] = v;
    pad.timestamp = performance.now();
  }, [index, state] as const);
}

/** Press and release a button across a few frames. */
export async function tapPad(page: Page, index: number, button: number): Promise<void> {
  await setPad(page, index, { buttons: { [button]: 1 } });
  await page.waitForTimeout(80);
  await setPad(page, index, { buttons: { [button]: 0 } });
  await page.waitForTimeout(50);
}
