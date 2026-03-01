/**
 * Phaser colour and font constants mirroring tokens.css.
 * Use in Phaser Graphics.fillStyle() / strokeStyle() and Text style objects.
 */

export const Colors = {
  // Backgrounds
  bgDeepest:   0x0f0d0a,
  bgBase:      0x1a1814,
  bgPanel:     0x252119,
  bgPanelAlt:  0x2f2a21,
  bgInset:     0x1a1612,

  // Text (as CSS hex strings — Phaser Text accepts these)
  textPrimary:   '#f5e6c8',
  textSecondary: '#c8b89a',
  textMuted:     '#9b8b72',
  textDisabled:  '#5a5040',

  // Gold accent (integer for Graphics, string for Text)
  goldBright:    0xf0c060,
  goldBrightStr: '#f0c060',
  goldPrimary:   0xd4a84b,
  goldPrimaryStr:'#d4a84b',
  goldDim:       0x8b7355,
  goldSubtle:    0x5c4d3d,

  // HP bar
  hpHigh: 0xc0392b,
  hpMid:  0x922b21,
  hpLow:  0x7b241c,
  hpBg:   0x2c1010,

  // MP bar
  mpHigh: 0x1f6fa6,
  mpBg:   0x0a1a2e,

  // XP bar
  xpFill: 0xd4a84b,
  xpBg:   0x2a2010,
} as const;

export const Fonts = {
  display:  "'Cinzel', 'Palatino Linotype', serif",
  body:     "'Crimson Text', 'Georgia', serif",
  number:   "'Rajdhani', 'Oswald', sans-serif",
} as const;
