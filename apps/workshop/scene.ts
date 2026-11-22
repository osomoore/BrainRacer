/**
 * Markup for the Coming Soon page: an inline SVG workshop scene (1920x1080 user units) with the
 * text and the "Back to games" hint layered on top. Only transform/opacity are animated.
 */

const ART = `
<svg class="art" viewBox="0 0 1920 1080" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4fc3ff"/>
      <stop offset="1" stop-color="#cdf3ff"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#sky)"/>
  <circle cx="1740" cy="300" r="90" fill="#ffd23f"/>
  <rect x="0" y="880" width="1920" height="200" fill="#6cc644"/>

  <!-- treasure map on the wall -->
  <rect x="90" y="500" width="280" height="210" rx="12" fill="#f7e0a3" stroke="#b07a2a" stroke-width="8"/>
  <path d="M120 660 Q190 540 265 580 T345 540" fill="none" stroke="#c0392b" stroke-width="6" stroke-dasharray="16 12" stroke-linecap="round"/>
  <path d="M250 560 L290 600 M290 560 L250 600" stroke="#e8493a" stroke-width="10" stroke-linecap="round"/>

  <!-- workbench -->
  <rect x="300" y="730" width="1320" height="44" rx="10" fill="#c8803e"/>
  <rect x="340" y="774" width="36" height="126" fill="#9a5a26"/>
  <rect x="1544" y="774" width="36" height="126" fill="#9a5a26"/>

  <!-- toolbox -->
  <rect x="380" y="600" width="420" height="130" rx="18" fill="#e8493a"/>
  <rect x="380" y="660" width="420" height="12" fill="#b8301f"/>
  <rect x="380" y="560" width="420" height="56" rx="18" fill="#ff6b5b"/>
  <path d="M540 560 Q590 500 640 560" fill="none" stroke="#3a3a5c" stroke-width="14" stroke-linecap="round"/>
  <rect x="576" y="620" width="28" height="40" rx="6" fill="#ffd23f"/>

  <!-- hammer leaning on the bench -->
  <g transform="rotate(14 943 730)">
    <rect x="930" y="520" width="26" height="210" rx="12" fill="#b5763a"/>
    <rect x="890" y="488" width="106" height="56" rx="12" fill="#56657a"/>
  </g>

  <!-- paint pot and brush -->
  <rect x="1080" y="640" width="90" height="90" rx="10" fill="#3d8bfd"/>
  <path d="M1125 650 L1200 430" stroke="#8b5a2b" stroke-width="16" stroke-linecap="round"/>
  <ellipse cx="1200" cy="410" rx="26" ry="46" fill="#ff6fb1" transform="rotate(20 1200 410)"/>

  <!-- building blocks -->
  <rect x="1420" y="640" width="110" height="90" rx="8" fill="#3d8bfd"/>
  <circle cx="1450" cy="630" r="9" fill="#2b6fd6"/>
  <circle cx="1490" cy="630" r="9" fill="#2b6fd6"/>
  <rect x="1436" y="550" width="110" height="90" rx="8" fill="#ffc93c"/>
  <circle cx="1466" cy="540" r="9" fill="#e8a800"/>
  <circle cx="1506" cy="540" r="9" fill="#e8a800"/>
  <rect x="1550" y="660" width="90" height="70" rx="8" fill="#46c46b"/>
  <circle cx="1575" cy="650" r="9" fill="#2f9d4e"/>
  <circle cx="1615" cy="650" r="9" fill="#2f9d4e"/>

  <!-- bouncing block -->
  <g class="bounce">
    <rect x="1450" y="300" width="90" height="90" rx="10" fill="#a66cff"/>
    <rect x="1466" y="316" width="58" height="10" rx="5" fill="#d8bfff"/>
  </g>

  <!-- sparkles -->
  <circle class="blink" cx="640" cy="460" r="10" fill="#ffffff"/>
  <circle class="blink delay" cx="1820" cy="470" r="12" fill="#ffffff"/>
  <circle class="blink" cx="1000" cy="380" r="8" fill="#ffffff"/>
</svg>`;

export function sceneMarkup(): string {
  return `
${ART}
<h1 class="title">Adventure Workshop</h1>
<div class="soon">Coming Soon</div>
<button class="hint" id="back-hint" type="button">
  <span class="badge" aria-hidden="true">B</span>
  <span>Back to games</span>
</button>`;
}
