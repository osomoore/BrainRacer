/**
 * Mobile shell shared by every page: a "turn your phone sideways" overlay on coarse-pointer devices held
 * in portrait, and fullscreen + landscape lock on the first tap (both best-effort; iOS Safari has neither).
 */
const STYLE_ID = 'bt-mobile-style';

const CSS = `
#bt-rotate{position:fixed;inset:0;z-index:100000;display:none;flex-direction:column;align-items:center;justify-content:center;
  gap:3vh;background:#14213d;color:#fff;font-family:"Arial Rounded MT Bold",Arial,sans-serif;text-align:center;touch-action:none}
#bt-rotate.on{display:flex}
#bt-rotate svg{width:40vmin;height:40vmin}
#bt-rotate .ph{transform-origin:100px 100px;animation:bt-turn 2.4s ease-in-out infinite}
#bt-rotate p{font-size:7vmin;font-weight:900;margin:0;padding:0 6vmin;line-height:1.15}
@keyframes bt-turn{0%,20%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}
`;

const ROTATE_HTML = `
<svg viewBox="0 0 200 200" aria-hidden="true">
  <g class="ph">
    <rect x="62" y="20" width="76" height="160" rx="14" fill="#ffd43b" stroke="#fff" stroke-width="6"/>
    <rect x="72" y="38" width="56" height="116" rx="4" fill="#2b8cff"/>
    <circle cx="100" cy="166" r="6" fill="#14213d"/>
  </g>
</svg>
<p>Turn your phone sideways!</p>`;

/** True for phones/tablets (touch as the primary pointer). */
export function isCoarsePointer(): boolean {
  try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

export function installMobileShell(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'bt-rotate';
  overlay.innerHTML = ROTATE_HTML;
  document.body.appendChild(overlay);

  const update = () => {
    const portrait = window.innerHeight > window.innerWidth;
    overlay.classList.toggle('on', portrait && isCoarsePointer());
  };
  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);

  // First real touch: go fullscreen and lock to landscape (ignore every failure).
  const onTouch = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    window.removeEventListener('pointerup', onTouch, true);
    try {
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
      if (!document.fullscreenElement) {
        const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
        Promise.resolve(p)
          .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
          .catch(() => {});
      }
    } catch { /* unsupported */ }
  };
  window.addEventListener('pointerup', onTouch, true);
}
