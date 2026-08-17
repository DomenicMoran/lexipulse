/**
 * The store-screenshot page: solid background, one big headline, one explaining
 * sentence, one device below. No collage, no floating badges, no gradient mesh — the
 * frame's whole job is to get out of the way of the screen it is holding.
 *
 * Everything is sized from the target's pixel dimensions, so the same template produces
 * a 1290x2796 iPhone frame and a 1080x1920 Android frame without a second layout.
 */

import { THEMES, ACCENTS, FONT_STACKS } from '@lexipulse/ui/tokens';
import { fontFaceCss } from '../fonts.js';
import { logoSvg, BRAND } from '../brand.js';
import type { Locale } from './screens.js';

const oled = THEMES.oled;
const coral = ACCENTS.coral;

export type DeviceKind = 'phone' | 'tablet';

export interface FrameSpec {
  /** Final image size in pixels. */
  width: number;
  height: number;
  /** CSS pixel ratio Playwright renders at. */
  scale: number;
  kind: DeviceKind;
}

/** Aspect (w/h) of the device cut-out, and how wide it sits in the frame. */
const DEVICE: Record<DeviceKind, { ratio: number; widthFraction: number; appWidth: number; radius: number }> = {
  phone: { ratio: 9 / 19.5, widthFraction: 0.72, appWidth: 390, radius: 0.115 },
  tablet: { ratio: 3 / 4, widthFraction: 0.62, appWidth: 720, radius: 0.05 },
};

function baseCss(): string {
  return `
${fontFaceCss()}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:${oled.surface}}
body{font-family:${FONT_STACKS.sans};-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
svg{display:block;width:100%;height:100%}
`;
}

/** Chrome and content of the simulated app, designed once and reused by every format. */
function appCss(): string {
  return `
/* Static flow, not absolute: an absolutely positioned child of a \`zoom\`ed box resolves
   its containing block inconsistently in Chromium and escapes the screen clip. */
.app{
  position:relative;width:100%;height:100%;overflow:hidden;
  display:flex;flex-direction:column;
  background:${oled.bg};color:${oled.text};
  font-family:${FONT_STACKS.sans};font-size:15px;line-height:1.45;
}
.app b{font-weight:600}
.app em{font-style:normal}

.statusbar{display:flex;align-items:center;justify-content:space-between;padding:14px 22px 6px;font-size:13px;font-weight:600;letter-spacing:.01em}
.status-right{display:flex;align-items:center;gap:7px}
.bars{display:flex;align-items:flex-end;gap:2px;height:11px}
.bars i{width:3px;background:${oled.text};border-radius:1px}
.bars i:nth-child(1){height:4px}.bars i:nth-child(2){height:6px}.bars i:nth-child(3){height:8px}.bars i:nth-child(4){height:11px}
.battery{width:22px;height:11px;border:1.2px solid ${oled.textMuted};border-radius:3px;padding:1.5px}
.battery i{display:block;width:72%;height:100%;background:${oled.text};border-radius:1px}

.topbar{display:flex;align-items:center;gap:14px;padding:10px 20px 16px}
.icon-btn{width:26px;height:26px;color:${oled.textMuted};flex:none}
.doc{flex:1;display:flex;flex-direction:column;align-items:center;line-height:1.25}
.doc b{font-size:14px;font-weight:600}
.doc em{font-size:11.5px;color:${oled.textMuted}}

.page-head{padding:6px 22px 18px}
.page-head h1{font-size:29px;font-weight:600;letter-spacing:-.022em;line-height:1.12}
.page-head p{margin-top:6px;font-size:13.5px;color:${oled.textMuted}}

/* ---- player stage ---------------------------------------------------- */
.stage{
  position:relative;flex:1;display:flex;align-items:center;justify-content:center;
  font-family:${FONT_STACKS.mono};font-size:34px;
  background:${oled.stage};
}
.stage .track{position:relative;width:calc(var(--cols) * 1ch);height:1.5em}
.stage .word{
  position:absolute;top:0;left:0;height:100%;
  display:flex;align-items:center;
  font-weight:500;letter-spacing:0;white-space:pre;
  color:${oled.text};
}
.stage .word b{color:${coral.base};font-weight:500}
.stage .rail{
  position:absolute;left:calc((var(--focus) + .5) * 1ch);
  width:2px;margin-left:-1px;height:1.15em;border-radius:1px;background:${oled.borderStrong};
}
.stage .rail-top{bottom:calc(50% + .9em)}
.stage .rail-bottom{top:calc(50% + .9em)}

.controls{padding:0 22px 18px}
.progress{height:3px;border-radius:2px;background:${oled.border};overflow:hidden}
.progress i{display:block;height:100%;background:${coral.base}}
.progress-meta{display:flex;justify-content:space-between;margin-top:9px;font-size:12px;color:${oled.textMuted}}
.transport{display:flex;align-items:center;justify-content:center;gap:24px;margin:22px 0 18px}
.step{width:42px;height:42px;border-radius:50%;border:1px solid ${oled.border};background:${oled.surface};color:${oled.text};font-size:20px;line-height:1;font-family:inherit}
.wpm{min-width:118px;text-align:center}
.wpm b{display:block;font-family:${FONT_STACKS.mono};font-size:26px;font-weight:500;letter-spacing:-.01em}
.wpm span{font-size:11px;color:${oled.textMuted};letter-spacing:.03em}
.primary{
  display:block;width:100%;padding:14px;border:0;border-radius:12px;
  background:${coral.base};color:${coral.on};font-family:inherit;font-size:15px;font-weight:600;
}

/* ---- import ---------------------------------------------------------- */
.dropzone{
  margin:0 22px;padding:30px 20px;border:1.4px dashed ${oled.borderStrong};border-radius:14px;
  display:flex;flex-direction:column;align-items:center;gap:9px;text-align:center;background:${oled.surface};
}
.dz-icon{width:30px;height:30px;color:${coral.base}}
.dropzone b{font-size:14.5px;font-weight:600}
.dropzone em{font-family:${FONT_STACKS.mono};font-size:11.5px;color:${oled.textMuted};letter-spacing:.02em}
.or{display:flex;align-items:center;gap:12px;margin:18px 22px;color:${oled.textFaint};font-size:12px}
.or::before,.or::after{content:"";flex:1;height:1px;background:${oled.border}}
.url-row{display:flex;gap:9px;margin:0 22px}
.url-field{flex:1;padding:12px 14px;border:1px solid ${oled.border};border-radius:11px;background:${oled.surface};color:${oled.textFaint};font-family:${FONT_STACKS.mono};font-size:12.5px;overflow:hidden;white-space:nowrap}
.url-btn{padding:12px 18px;border-radius:11px;background:${oled.surfaceHover};border:1px solid ${oled.border};font-size:13px;font-weight:600}
.section-label{margin:26px 22px 10px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${oled.textFaint}}
.list{list-style:none;margin:0 22px}
.list li{display:flex;align-items:center;gap:13px;padding:13px 0;border-top:1px solid ${oled.border}}
.li-icon{width:19px;height:19px;color:${oled.textMuted};flex:none}
.li-body{flex:1;display:flex;flex-direction:column;line-height:1.3}
.li-body b{font-size:14px;font-weight:600}
.li-body em{font-size:11.5px;color:${oled.textMuted};font-family:${FONT_STACKS.mono}}
.li-ok{width:17px;height:17px;color:${ACCENTS.cyber.base};flex:none}

/* ---- smart filter ---------------------------------------------------- */
.diff{display:flex;gap:10px;margin:0 22px 20px}
.diff-col{flex:1 1 0;min-width:0;padding:13px 13px 15px;border:1px solid ${oled.border};border-radius:12px;background:${oled.surface};font-family:${FONT_STACKS.mono};font-size:9.5px;line-height:1.85}
.diff-col p{color:${oled.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.diff-col .is-dropped{color:${oled.textFaint};text-decoration:line-through;text-decoration-color:${coral.base};text-decoration-thickness:1px}
.diff-col.is-clean{border-color:${ACCENTS.cyber.base}33}
.tag{display:inline-block;margin-bottom:9px;padding:3px 7px;border-radius:5px;background:${oled.surfaceHover};color:${oled.textMuted};font-size:8.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.tag-ok{background:${ACCENTS.cyber.soft};color:${ACCENTS.cyber.base}}

/* ---- cards, toggles, sliders ----------------------------------------- */
.card{margin:0 22px 14px;padding:16px 16px 18px;border:1px solid ${oled.border};border-radius:14px;background:${oled.surface}}
.row-label{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${oled.textFaint};margin-bottom:12px}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;font-size:14px}
.toggle-row + .toggle-row{border-top:1px solid ${oled.border}}
.switch{width:40px;height:23px;border-radius:12px;background:${oled.surfaceHover};border:1px solid ${oled.border};position:relative;flex:none}
.switch i{position:absolute;top:2.5px;left:3px;width:16px;height:16px;border-radius:50%;background:${oled.textFaint}}
.switch.is-on{background:${coral.base};border-color:${coral.base}}
.switch.is-on i{left:auto;right:3px;background:#fff}

.wpm-big{font-family:${FONT_STACKS.mono};font-size:38px;font-weight:500;letter-spacing:-.02em;display:flex;align-items:baseline;gap:9px}
.wpm-big em{font-family:${FONT_STACKS.sans};font-size:12px;font-weight:500;color:${oled.textMuted};letter-spacing:0}
.slider{margin-top:16px}
.slider .track{display:block;position:relative;height:4px;border-radius:2px;background:${oled.surfaceHover}}
.slider .track i{position:absolute;left:0;top:0;height:100%;border-radius:2px;background:${coral.base}}
.slider .track b{position:absolute;top:50%;width:19px;height:19px;margin:-9.5px 0 0 -9.5px;border-radius:50%;background:${oled.text};border:2px solid ${oled.bg}}
.slider-scale{display:flex;justify-content:space-between;margin-top:9px;font-family:${FONT_STACKS.mono};font-size:11px;color:${oled.textFaint}}

.swatches{display:flex;gap:10px}
.swatch{flex:1;text-align:center}
.swatch span{display:block;height:44px;border-radius:10px;border:1.4px solid}
.swatch em{display:block;margin-top:7px;font-size:10px;color:${oled.textMuted}}
.swatch.is-active span{border-color:${coral.base};box-shadow:0 0 0 1.5px ${coral.base}}
.swatch.is-active em{color:${oled.text}}
.accents{display:flex;gap:14px}
.accent{width:32px;height:32px;border-radius:50%}
.accent.is-active{box-shadow:0 0 0 2px ${oled.bg},0 0 0 3.5px ${oled.text}}

/* ---- library --------------------------------------------------------- */
.search{display:flex;align-items:center;gap:10px;margin:0 22px 6px;padding:11px 14px;border:1px solid ${oled.border};border-radius:11px;background:${oled.surface};color:${oled.textFaint};font-size:13.5px}
.search span{width:16px;height:16px;flex:none}
.books{list-style:none;margin:8px 22px 0}
.books li{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid ${oled.border}}
.cover{
  width:44px;height:58px;flex:none;border-radius:6px;border:1px solid ${oled.borderStrong};
  background:${oled.surface};color:${oled.textMuted};
  font-family:${FONT_STACKS.mono};font-size:14px;font-weight:500;letter-spacing:.02em;
  display:flex;align-items:center;justify-content:center;
}
.book-body{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0}
.book-body b{font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.book-body em{font-size:11.5px;color:${oled.textMuted}}
.bar{display:block;height:2.5px;border-radius:2px;background:${oled.border};margin-top:3px;overflow:hidden}
.bar i{display:block;height:100%;background:${coral.base}}
.pct{font-family:${FONT_STACKS.mono};font-size:11.5px;color:${oled.textMuted};flex:none;width:46px;text-align:right}
.footnote{margin:20px 22px 0;font-size:11.5px;color:${oled.textFaint};text-align:center}

/* --- original surface: a paper sheet with the toolbar above it --- */
.pdf-bar{display:flex;align-items:center;gap:6px;margin:0 22px 10px;padding:7px 9px;border:1px solid ${oled.border};border-radius:10px;background:${oled.surface};font-size:12px;color:${oled.textMuted};overflow:hidden}
.pdf-bar span{display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;border-radius:5px}
.pdf-bar.is-tools span:nth-child(1){background:${coral.base};color:${coral.on}}
.pdf-swatches{display:flex;gap:7px;margin:0 22px 12px}
.pdf-swatches i{width:15px;height:15px;border-radius:50%;display:block}
.pdf-swatches i:first-child{outline:2px solid ${oled.text};outline-offset:2px}
.sheet{position:relative;margin:0 22px;padding:20px 22px 26px;border-radius:6px;background:#fdfdfb;color:#17171a;font-family:${FONT_STACKS.serif};font-size:10.5px;line-height:1.62;box-shadow:0 2px 10px rgba(0,0,0,.45)}
.sheet p{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sheet .sheet-h{font-weight:700;margin-top:2px}
.sheet .sheet-gap{height:7px}
.sheet-hl{position:absolute;height:13px;border-radius:2px;background:#ffd400;opacity:.42;mix-blend-mode:multiply}
.sheet-note{position:absolute;width:14px;height:14px;border-radius:3px;background:#ffb224;border:1px solid rgba(0,0,0,.35);font-family:${FONT_STACKS.sans};font-size:9px;line-height:14px;text-align:center;color:#1a1a1a}
.sheet-sign{margin-top:16px;font-size:9.5px;color:#6b6b72;border-top:1px solid #c9c9cf;padding-top:6px;width:62%}
.sheet-ink{display:block;width:120px;height:30px;margin-top:-26px;margin-left:16px;color:#111}

/* ---- stats ----------------------------------------------------------- */
.kpis{display:flex;gap:10px;margin:0 22px 16px}
.kpis div{flex:1;padding:14px 12px;border:1px solid ${oled.border};border-radius:12px;background:${oled.surface};text-align:center}
.kpis b{display:block;font-family:${FONT_STACKS.mono};font-size:21px;font-weight:500;letter-spacing:-.02em}
.kpis em{display:block;margin-top:4px;font-size:9.5px;color:${oled.textMuted};line-height:1.3}
.chart{display:flex;align-items:flex-end;gap:8px;height:112px}
.bar-col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:8px}
.bar-col i{display:block;width:100%;border-radius:4px 4px 2px 2px;background:${coral.base}}
.bar-col:last-child i{background:${coral.base}}
.bar-col:not(:last-child) i{background:${coral.base}66}
.bar-col em{text-align:center;font-size:10px;color:${oled.textFaint}}
.streak-row{display:flex;gap:5px}
.streak-row i{flex:1;height:16px;border-radius:3px;background:${oled.surfaceHover}}
.streak-row i.is-on{background:${ACCENTS.cyber.base}59}
.streak-row i.is-on:nth-last-child(-n+3){background:${ACCENTS.cyber.base}}
.streak p{margin-top:11px;font-size:12px;color:${oled.textMuted}}
.doc-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 0;font-size:13.5px}
.doc-row + .doc-row{border-top:1px solid ${oled.border}}
.doc-row span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.doc-row em{flex:none;font-family:${FONT_STACKS.mono};font-size:11.5px;color:${oled.textMuted}}

/* ---- tab bar --------------------------------------------------------- */
.tabbar{margin-top:auto;display:flex;border-top:1px solid ${oled.border};padding:9px 0 18px;background:${oled.bg}}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:9.5px;color:${oled.textFaint}}
.tab-icon{width:20px;height:20px}
.tab.is-active{color:${coral.base}}
`;
}

export interface FramePageOptions {
  spec: FrameSpec;
  headline: string;
  sub: string;
  appHtml: string;
  /** Data URI of a real capture from the dev server; replaces `appHtml` when present. */
  screenImage?: string;
  /**
   * Width divided by height of `screenImage`. The frame is shaped to match, so a device
   * capture is shown whole instead of being cropped to the default 19.5:9 — losing the
   * tab bar off the bottom edge, which is exactly the part that proves it is the app.
   */
  screenRatio?: number;
}

/**
 * One store screenshot. Sizes are derived from the target so a 19.5:9 iPhone and a
 * 16:9 Android frame stay optically identical instead of one of them looking cramped.
 */
export function framePage(options: FramePageOptions): string {
  const { spec, headline, sub, appHtml, screenImage, screenRatio } = options;
  const w = spec.width / spec.scale;
  const h = spec.height / spec.scale;
  const device = DEVICE[spec.kind];

  const deviceW = Math.round(w * device.widthFraction);
  const deviceH = Math.round(deviceW / (screenRatio ?? device.ratio));
  const bezel = Math.max(Math.round(deviceW * 0.028), 6);
  const screenW = deviceW - bezel * 2;
  const screenH = deviceH - bezel * 2;
  const zoom = screenW / device.appWidth;

  const headlineSize = w * (spec.kind === 'tablet' ? 0.052 : 0.072);
  const subSize = w * (spec.kind === 'tablet' ? 0.026 : 0.0345);

  const screenBody = screenImage
    ? `<img class="capture" src="${screenImage}" alt="">`
    : `<div class="screen-inner"><div class="app">${appHtml}</div></div>`;

  return `<style>
${baseCss()}
${appCss()}

.frame{
  position:relative;width:${w}px;height:${h}px;overflow:hidden;
  background:${oled.surface};
  display:flex;flex-direction:column;align-items:center;
  padding:${(h * 0.058).toFixed(1)}px ${(w * 0.085).toFixed(1)}px 0;
}
.headline{
  font-size:${headlineSize.toFixed(2)}px;font-weight:600;line-height:1.13;
  letter-spacing:-.028em;color:${oled.text};text-align:center;
  max-width:${(w * 0.9).toFixed(0)}px;text-wrap:balance;
}
.sub{
  margin-top:${(w * 0.038).toFixed(1)}px;
  font-size:${subSize.toFixed(2)}px;line-height:1.45;font-weight:400;
  color:${oled.textMuted};text-align:center;max-width:${(w * 0.82).toFixed(0)}px;text-wrap:balance;
}
.device{
  position:relative;flex:none;margin-top:${(h * 0.052).toFixed(1)}px;
  width:${deviceW}px;height:${deviceH}px;
  padding:${bezel}px;
  border-radius:${(deviceW * device.radius + bezel).toFixed(1)}px;
  background:${oled.bg};
  border:1px solid ${oled.borderStrong};
}
.screen{
  position:relative;width:${screenW}px;height:${screenH}px;overflow:hidden;
  border-radius:${(deviceW * device.radius).toFixed(1)}px;
  background:${oled.bg};
}
.screen-inner{position:relative;width:${device.appWidth}px;height:${(screenH / zoom).toFixed(2)}px;overflow:hidden;zoom:${zoom.toFixed(5)}}
.capture{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center}
</style>
<div class="frame">
  <h1 class="headline">${headline}</h1>
  <p class="sub">${sub}</p>
  <div class="device"><div class="screen">${screenBody}</div></div>
</div>`;
}

/**
 * Play Store feature graphic, 1024x500. Google crops it on some surfaces, so the whole
 * lockup lives well inside the middle and nothing meaningful touches the edges.
 */
export function featureGraphicPage(locale: Locale, width = 1024, height = 500): string {
  const tagline = locale === 'de' ? BRAND.taglineDe : BRAND.tagline;
  const logo = logoSvg({ variant: 'dark', withWordmark: true });

  return `<style>
${baseCss()}
body{background:${oled.bg}}
.fg{
  position:relative;width:${width}px;height:${height}px;overflow:hidden;background:${oled.bg};
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:${Math.round(height * 0.062)}px;padding:0 ${Math.round(width * 0.11)}px;
}
/* Play crops the graphic on some surfaces, so the lockup stays inside the middle 78 %. */
.logo{width:${Math.round(width * 0.46)}px}
.logo svg{width:100%;height:auto}
.rule{width:${Math.round(width * 0.09)}px;height:1px;background:${oled.borderStrong}}
.tagline{
  font-family:${FONT_STACKS.sans};font-size:${Math.round(height * 0.049)}px;font-weight:400;
  letter-spacing:-.012em;color:${oled.textMuted};text-align:center;text-wrap:balance;
}
</style>
<div class="fg">
  <div class="logo">${logo}</div>
  <div class="rule"></div>
  <div class="tagline">${tagline}</div>
</div>`;
}
