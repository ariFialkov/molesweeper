/**
 * Hand-drawn SVG icon sprite in the game's cartoon style: thick dark outlines, flat fills,
 * rounded shapes. Injected once into the HUD and referenced with <use>.
 */
export type IconName =
  | 'firecracker'
  | 'grenade'
  | 'rocket'
  | 'disco'
  | 'mine'
  | 'mole'
  | 'groundhog'
  | 'treasure'
  | 'aqueduct'
  | 'oil'
  | 'tree'
  | 'rock'
  | 'flag'
  | 'search'
  | 'boom'
  | 'cash'
  | 'sound-on'
  | 'sound-off'
  | 'hole'
  | 'home'
  | 'help';

const S = 'stroke="#2b1d12" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';

const symbols: Record<IconName, string> = {
  firecracker: `
    <g transform="rotate(-35 16 16)">
      <rect x="11" y="7" width="10" height="20" rx="3" fill="#e63946" ${S}/>
      <rect x="11" y="13" width="10" height="4" fill="#ffd23f" stroke="none"/>
      <rect x="11" y="20" width="10" height="3" fill="#ffd23f" stroke="none"/>
      <path d="M16 7 C16 4 19 4 19 2" fill="none" ${S}/>
    </g>
    <circle cx="23.5" cy="5.5" r="2.4" fill="#ffd23f" ${S}/>
    <path d="M23.5 1.5v1.5M27 3l-1 1M28 6h-1.5" fill="none" ${S}/>`,
  grenade: `
    <ellipse cx="15" cy="19" rx="8.5" ry="9.5" fill="#4b5d2a" ${S}/>
    <path d="M9 15h12M9 20h12M11 25h8" fill="none" stroke="#2b1d12" stroke-width="1.6" opacity="0.6"/>
    <rect x="12" y="6" width="6" height="5" rx="1.5" fill="#9aa0a6" ${S}/>
    <path d="M18 6 C24 6 25 10 24 14" fill="none" ${S}/>
    <circle cx="23" cy="5" r="2.2" fill="#dfe3e8" ${S}/>`,
  rocket: `
    <path d="M16 3 C21 7 22 14 21 22 H11 C10 14 11 7 16 3 Z" fill="#f4f4f6" ${S}/>
    <path d="M16 3 C19 5.5 20 8.5 20.5 11 H11.5 C12 8.5 13 5.5 16 3 Z" fill="#e63946" stroke="none"/>
    <path d="M11 17 L6 23 L11 22 Z" fill="#e63946" ${S}/>
    <path d="M21 17 L26 23 L21 22 Z" fill="#e63946" ${S}/>
    <circle cx="16" cy="14.5" r="2.3" fill="#8fd3ff" ${S}/>
    <path d="M13 23 L16 30 L19 23 Z" fill="#ffa322" ${S}/>`,
  disco: `
    <path d="M16 2v3" fill="none" ${S}/>
    <circle cx="16" cy="17" r="11" fill="#cfd6e4" ${S}/>
    <path d="M6 13h20M5 17h22M6 21h20M9 9.5h14M9 24.5h14M12 6.5v21M16 6v22M20 6.5v21M8.5 9v16M23.5 9v16" fill="none" stroke="#2b1d12" stroke-width="1.3" opacity="0.6"/>
    <rect x="12" y="13" width="4" height="4" fill="#ffffff" stroke="none"/>
    <rect x="20" y="17" width="3" height="4" fill="#ffffff" stroke="none"/>
    <path d="M26.5 4.5v3M25 6h3" fill="none" ${S}/>`,
  mine: `
    <path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M25.2 6.8l-2.8 2.8M9.6 22.4l-2.8 2.8" fill="none" ${S}/>
    <circle cx="16" cy="16" r="9" fill="#2b2b33" ${S}/>
    <circle cx="16" cy="16" r="3" fill="#ff5c5c" ${S}/>
    <circle cx="12.5" cy="12" r="1.5" fill="#6b6b78" stroke="none"/>`,
  mole: `
    <ellipse cx="16" cy="18" rx="10" ry="9" fill="#5a3a22" ${S}/>
    <ellipse cx="16" cy="25" rx="12" ry="4" fill="#3f2a18" ${S}/>
    <circle cx="12" cy="15" r="1.6" fill="#2b1d12" stroke="none"/>
    <circle cx="20" cy="15" r="1.6" fill="#2b1d12" stroke="none"/>
    <ellipse cx="16" cy="19.5" rx="2.6" ry="2" fill="#ff8fb0" ${S}/>
    <ellipse cx="9.5" cy="22" rx="2.2" ry="1.6" fill="#e8b898" ${S}/>
    <ellipse cx="22.5" cy="22" rx="2.2" ry="1.6" fill="#e8b898" ${S}/>`,
  groundhog: `
    <ellipse cx="16" cy="19" rx="9.5" ry="10" fill="#9c6a34" ${S}/>
    <ellipse cx="16" cy="22" rx="5" ry="5.5" fill="#d8b27a" stroke="none"/>
    <circle cx="9" cy="10" r="2.6" fill="#9c6a34" ${S}/>
    <circle cx="23" cy="10" r="2.6" fill="#9c6a34" ${S}/>
    <circle cx="12.5" cy="15" r="1.6" fill="#2b1d12" stroke="none"/>
    <circle cx="19.5" cy="15" r="1.6" fill="#2b1d12" stroke="none"/>
    <circle cx="16" cy="18" r="1.6" fill="#2b1d12" stroke="none"/>
    <rect x="13.5" y="19.5" width="2.3" height="3.5" fill="#ffffff" stroke="#2b1d12" stroke-width="1"/>
    <rect x="16.2" y="19.5" width="2.3" height="3.5" fill="#ffffff" stroke="#2b1d12" stroke-width="1"/>`,
  treasure: `
    <path d="M5 13 C5 9 8 7 12 7 H20 C24 7 27 9 27 13 V14 H5 Z" fill="#8a5a33" ${S}/>
    <rect x="5" y="14" width="22" height="12" rx="2" fill="#7a4a22" ${S}/>
    <rect x="5" y="14" width="22" height="3" fill="#ffc63a" stroke="none"/>
    <rect x="13.5" y="13" width="5" height="6" rx="1" fill="#ffc63a" ${S}/>
    <circle cx="16" cy="16" r="1" fill="#2b1d12" stroke="none"/>
    <path d="M9 11h14" fill="none" stroke="#ffc63a" stroke-width="2"/>`,
  aqueduct: `
    <ellipse cx="16" cy="21" rx="12" ry="6.5" fill="#3aa8ff" ${S}/>
    <ellipse cx="16" cy="21" rx="7" ry="3.6" fill="none" stroke="#d8f1ff" stroke-width="1.6"/>
    <ellipse cx="16" cy="21" rx="3" ry="1.5" fill="none" stroke="#d8f1ff" stroke-width="1.4"/>
    <path d="M16 3 C19.5 8 21 10 21 12.5 A5 5 0 0 1 11 12.5 C11 10 12.5 8 16 3 Z" fill="#6cc3ff" ${S}/>
    <path d="M13.5 12.5 C13.5 11 14 10 15 9" fill="none" stroke="#ffffff" stroke-width="1.6"/>`,
  oil: `
    <ellipse cx="16" cy="24" rx="11" ry="4.5" fill="#15151a" ${S}/>
    <path d="M16 3 C21 10 23 13 23 17 A7 7 0 0 1 9 17 C9 13 11 10 16 3 Z" fill="#26262c" ${S}/>
    <path d="M12.5 17 C12.5 14.5 13.5 12.5 15 10.5" fill="none" stroke="#7d7d8c" stroke-width="1.8"/>`,
  tree: `
    <rect x="13.5" y="20" width="5" height="9" rx="1.5" fill="#6b4423" ${S}/>
    <circle cx="16" cy="12" r="8.5" fill="#4caf50" ${S}/>
    <circle cx="10" cy="16" r="5" fill="#66bb6a" ${S}/>
    <circle cx="22" cy="16" r="5" fill="#66bb6a" ${S}/>
    <circle cx="16" cy="9" r="4" fill="#7ccf7a" stroke="none"/>`,
  rock: `
    <path d="M6 23 L9 13 L16 8 L24 11 L27 20 L23 26 H9 Z" fill="#8d8d8d" ${S}/>
    <path d="M9 13 L16 15 L24 11 M16 15 L14 26" fill="none" stroke="#2b1d12" stroke-width="1.5" opacity="0.5"/>
    <path d="M12 12 L16 10" fill="none" stroke="#c4c4c4" stroke-width="2"/>`,
  flag: `
    <path d="M9 29V4" fill="none" ${S}/>
    <path d="M9 5 H25 L21 10.5 L25 16 H9 Z" fill="#e63946" ${S}/>
    <circle cx="15" cy="10.5" r="2" fill="#ffffff" stroke="none"/>
    <ellipse cx="9" cy="29" rx="4" ry="1.5" fill="#2b1d12" stroke="none"/>`,
  search: `
    <circle cx="13.5" cy="13.5" r="8.5" fill="#8fd3ff" ${S}/>
    <circle cx="13.5" cy="13.5" r="5" fill="#d8f1ff" stroke="none"/>
    <path d="M20 20 L28 28" fill="none" stroke="#2b1d12" stroke-width="4" stroke-linecap="round"/>
    <path d="M20.5 20.5 L27.5 27.5" fill="none" stroke="#ffd23f" stroke-width="1.6" stroke-linecap="round"/>`,
  boom: `
    <path d="M16 2 L19 10 L27 6 L23 14 L31 16 L23 18 L27 26 L19 22 L16 30 L13 22 L5 26 L9 18 L1 16 L9 14 L5 6 L13 10 Z" fill="#ffa322" ${S}/>
    <path d="M16 9 L18 14 L23 13 L19.5 16 L23 19 L18 18 L16 23 L14 18 L9 19 L12.5 16 L9 13 L14 14 Z" fill="#ffe066" stroke="none"/>`,
  cash: `
    <path d="M12 6 H20 L22 10 C27 13 28 19 26 24 C24 28 8 28 6 24 C4 19 5 13 10 10 Z" fill="#ffd23f" ${S}/>
    <path d="M12 6 L13 3 H19 L20 6" fill="#ffd23f" ${S}/>
    <path d="M16 13v10M13.5 15.5c0-1.5 5-1.5 5 0s-5 1-5 2.5 5 1.5 5 0" fill="none" stroke="#2b1d12" stroke-width="2"/>`,
  'sound-on': `
    <path d="M5 12 H10 L17 6 V26 L10 20 H5 Z" fill="#ffd23f" ${S}/>
    <path d="M21 11 C23.5 13.5 23.5 18.5 21 21M25 8 C29 12 29 20 25 24" fill="none" ${S}/>`,
  'sound-off': `
    <path d="M5 12 H10 L17 6 V26 L10 20 H5 Z" fill="#9aa0a6" ${S}/>
    <path d="M21 12 L28 20M28 12 L21 20" fill="none" stroke="#e63946" stroke-width="2.5" stroke-linecap="round"/>`,
  hole: `
    <ellipse cx="16" cy="19" rx="12" ry="7" fill="#4e3420" ${S}/>
    <ellipse cx="16" cy="19" rx="8" ry="4" fill="#2b1d12" stroke="none"/>
    <ellipse cx="22" cy="12" rx="2" ry="1.3" fill="#8a5a33" ${S}/>
    <ellipse cx="7" cy="13" rx="1.6" ry="1" fill="#8a5a33" ${S}/>`,
  home: `
    <path d="M4 15 L16 5 L28 15" fill="none" ${S}/>
    <path d="M7 14 V27 H25 V14" fill="#c94f3d" ${S}/>
    <rect x="13" y="18" width="6" height="9" fill="#5b3a22" ${S}/>
    <rect x="20" y="7" width="3" height="5" fill="#4a3a30" ${S}/>`,
  help: `
    <circle cx="16" cy="16" r="12" fill="#ffd23f" ${S}/>
    <path d="M12 13 c0-3 2-4.5 4.5-4.5s4 1.5 4 3.5c0 2.5-4 3-4 6" fill="none" stroke="#2b1d12" stroke-width="2.6"/>
    <circle cx="16.5" cy="22.5" r="1.6" fill="#2b1d12" stroke="none"/>`,
};

export function iconSprite(): string {
  const defs = Object.entries(symbols)
    .map(([name, body]) => `<symbol id="ico-${name}" viewBox="0 0 32 32">${body}</symbol>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">${defs}</svg>`;
}

export function icon(name: IconName, cls = ''): string {
  return `<svg class="ico ${cls}" aria-hidden="true"><use href="#ico-${name}"/></svg>`;
}
