/* ============================================================
   Iconographie · stroke 1.7, ronde, line-style.
   Optimisée pour les boutons 18-22px.
   ============================================================ */
const s = 'stroke="currentColor" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  chevronLeft:  `<svg viewBox="0 0 24 24" ${s}><polyline points="15 6 9 12 15 18"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" ${s}><polyline points="9 6 15 12 9 18"/></svg>`,
  close:        `<svg viewBox="0 0 24 24" ${s}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`,
  check:        `<svg viewBox="0 0 24 24" ${s}><polyline points="5 12 10 17 19 7"/></svg>`,
  plus:         `<svg viewBox="0 0 24 24" ${s}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  search:       `<svg viewBox="0 0 24 24" ${s}><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>`,
  filter:       `<svg viewBox="0 0 24 24" ${s}><polygon points="3 5 21 5 14 13 14 19 10 21 10 13 3 5"/></svg>`,
  home:         `<svg viewBox="0 0 24 24" ${s}><path d="M3 11 12 4l9 7"/><path d="M5 10v9h14v-9"/></svg>`,
  image:        `<svg viewBox="0 0 24 24" ${s}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><polyline points="21 17 15 11 7 19"/></svg>`,
  map:          `<svg viewBox="0 0 24 24" ${s}><polygon points="3 7 9 4 15 7 21 4 21 17 15 20 9 17 3 20"/><line x1="9" y1="4" x2="9" y2="17"/><line x1="15" y1="7" x2="15" y2="20"/></svg>`,
  send:         `<svg viewBox="0 0 24 24" ${s}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  calendar:     `<svg viewBox="0 0 24 24" ${s}><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>`,
  chat:         `<svg viewBox="0 0 24 24" ${s}><path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.6-4.6A8 8 0 1 1 21 12z"/></svg>`,
  briefcase:    `<svg viewBox="0 0 24 24" ${s}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`,
  user:         `<svg viewBox="0 0 24 24" ${s}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  users:        `<svg viewBox="0 0 24 24" ${s}><circle cx="9" cy="8" r="4"/><path d="M1 21a8 8 0 0 1 16 0"/><circle cx="17" cy="6" r="3"/><path d="M22 19a6 6 0 0 0-6-6"/></svg>`,
  shield:       `<svg viewBox="0 0 24 24" ${s}><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6Z"/><polyline points="9 12 11.5 14.5 16 10"/></svg>`,
  shieldFull:   `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6Z"/></svg>`,
  chart:        `<svg viewBox="0 0 24 24" ${s}><line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3" height="8"/><rect x="11" y="6" width="3" height="13"/><rect x="16" y="14" width="3" height="5"/></svg>`,
  car:          `<svg viewBox="0 0 24 24" ${s}><path d="M5 16h14l-2-7H7Z"/><circle cx="8" cy="17.5" r="1.5"/><circle cx="16" cy="17.5" r="1.5"/></svg>`,
  notebook:     `<svg viewBox="0 0 24 24" ${s}><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>`,
  folder:       `<svg viewBox="0 0 24 24" ${s}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>`,
  book:         `<svg viewBox="0 0 24 24" ${s}><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3Z"/><line x1="4" y1="17" x2="18" y2="17"/></svg>`,
  pdf:          `<svg viewBox="0 0 24 24" ${s}><path d="M7 3h7l5 5v13H7z"/><text x="9" y="17" font-size="6" fill="currentColor" stroke="none">PDF</text></svg>`,
  video:        `<svg viewBox="0 0 24 24" ${s}><rect x="3" y="6" width="13" height="12" rx="2"/><polygon points="16 9 22 6 22 18 16 15" fill="currentColor"/></svg>`,
  bell:         `<svg viewBox="0 0 24 24" ${s}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>`,
  help:         `<svg viewBox="0 0 24 24" ${s}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4"/><line x1="12" y1="17" x2="12" y2="17.5"/></svg>`,
  compass:      `<svg viewBox="0 0 24 24" ${s}><circle cx="12" cy="12" r="9"/><polygon points="16 8 13 13 8 16 11 11"/></svg>`,
  heart:        `<svg viewBox="0 0 24 24" ${s}><path d="M12 21s-7-4.5-9-9.5C1.5 7.5 5 4 8 4c2 0 3 1.5 4 3 1-1.5 2-3 4-3 3 0 6.5 3.5 5 7.5-2 5-9 9.5-9 9.5z"/></svg>`,
  pin:          `<svg viewBox="0 0 24 24" ${s}><path d="M14 4l6 6-4 1-3 4-6-6 4-3z"/><line x1="9" y1="15" x2="4" y2="20"/></svg>`,
  paperclip:    `<svg viewBox="0 0 24 24" ${s}><path d="M21 12.5 12 21a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/></svg>`,
  upload:       `<svg viewBox="0 0 24 24" ${s}><path d="M12 16V4"/><polyline points="6 10 12 4 18 10"/><line x1="4" y1="20" x2="20" y2="20"/></svg>`,
  download:     `<svg viewBox="0 0 24 24" ${s}><path d="M12 4v12"/><polyline points="6 14 12 20 18 14"/><line x1="4" y1="20" x2="20" y2="20"/></svg>`,
  signal:       `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="14" width="3" height="6" rx="1"/><rect x="7" y="11" width="3" height="9" rx="1"/><rect x="12" y="7" width="3" height="13" rx="1"/><rect x="17" y="3" width="3" height="17" rx="1"/></svg>`,
  wifi:         `<svg viewBox="0 0 24 24" ${s}><path d="M2 9a16 16 0 0 1 20 0"/><path d="M5 13a12 12 0 0 1 14 0"/><path d="M8.5 16.5a7 7 0 0 1 7 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>`,
  battery:      `<svg viewBox="0 0 26 14" ${s}><rect x="1" y="1" width="22" height="12" rx="3"/><rect x="24" y="5" width="2" height="4" rx="1" fill="currentColor"/><rect x="3" y="3" width="18" height="8" rx="1.5" fill="currentColor" stroke="none"/></svg>`,
};
