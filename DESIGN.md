---
name: Nakili
description: Local-first dictation with a broadcast desk for the voice.
colors:
  studio-black: "#12100e"
  studio-wall: "#eef0ec"
  surface-dark: "#1a1714"
  surface-light: "#f7f8f4"
  signal-red: "#e05a45"
  signal-red-light: "#c8402f"
  amber: "#d9a441"
  ink-dark: "#f2ece1"
  ink-light: "#171a16"
  muted-dark: "#a89f90"
  muted-light: "#565c52"
  rule-dark: "#332e28"
  rule-light: "#d1d5cc"
  overlay: "rgba(0, 0, 0, 0.55)"
typography:
  display:
    fontFamily: "Archivo Narrow, Arial Narrow, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.02em"
  display-lg:
    fontFamily: "Archivo Narrow, Arial Narrow, system-ui, sans-serif"
    fontSize: "48px"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  display-xl:
    fontFamily: "Archivo Narrow, Arial Narrow, system-ui, sans-serif"
    fontSize: "80px"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  wordmark:
    fontFamily: "Archivo Narrow, Arial Narrow, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.04em"
  wordmark-sm:
    fontFamily: "Archivo Narrow, Arial Narrow, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.04em"
  headline:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline-sm:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  dialog-title:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.35rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.12em"
  meta:
    fontFamily: "Archivo Narrow, Arial Narrow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
  micro:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.06em"
  ui:
    fontFamily: "Archivo Narrow, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  xs: "4px"
  sm: "2px"
  md: "2px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.signal-red}"
    textColor: "{colors.studio-black}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  clip-row:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  clip-row-active:
    backgroundColor: "{colors.signal-red}"
    textColor: "{colors.studio-black}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: Nakili

## Overview

Nakili is a broadcast desk for the voice. The transcript is the program, the
clips are the cue sheet, and the tally light is the only saturated red on the
page. The world is warm and mechanical, not neon and not dot-matrix: a studio
wall in light mode, a control room in dark mode, and a serif reading surface
that keeps the writing at the centre.

The system is deliberately flat. Depth comes from rules, spacing and type
weight, never from shadows or gradients. The one expressive move is the cue
sheet: a stack of clip cards with timecode, a play control and a waveform-like
seek strip, where the active clip is a red-tinted tally.

## Colors

- **Studio black** `#12100e` — the dark ground.
- **Studio wall** `#eef0ec` — the light ground, a cool paper rather than cream.
- **Signal red** `#e05a45` dark / `#c8402f` light — the tally, the primary
  action, the active clip, and the focus ring. It is the only saturated colour
  in the interface.
- **Amber** `#d9a441` — a secondary signal for warnings and the recording
  timer, used sparingly.
- **Ink** `#f2ece1` dark / `#171a16` light — body and display text.
- **Muted** `#a89f90` dark / `#565c52` light — metadata, labels, secondary copy.
- **Rule** `#332e28` dark / `#d1d5cc` light — hairlines and borders.

## Typography

- **Display / wordmark:** Archivo Narrow, uppercase, 700, tight leading. Used
  for the NAKILI wordmark and the landing headline.
- **Headline:** Source Serif 4, 600. Used for page titles and the editor title.
- **Body / transcript:** Source Serif 4, 400, 1.6 leading. The transcript is the
  reading surface; it is set at 1.25rem and can be enlarged in Settings.
- **Label:** IBM Plex Mono, uppercase, 0.12em tracking. Used for `CUE SHEET`,
  `RECORDING`, timecode, status lines and metadata.
- **UI:** Archivo Narrow, 500. Used for navigation, buttons, inputs and menus.

## Layout

- A full-width app shell with a top bar, a centred content column (max 1100px)
  and a footer that stays at the bottom of the viewport.
- The editor is a two-column split: a flexible transcript column and a 300px
  cue sheet. Below 900px the cue sheet becomes a bottom sheet.
- Spacing follows an 8px base: 4, 8, 16, 24, 32, 48, 64.
- The landing uses a two-column hero (copy and a product preview) that stacks
  below 860px.

## Elevation & Depth

There is no elevation. Surfaces are flat; separation comes from 1px rules,
tonal surface shifts and spacing. No box-shadows, no gradients, no glow.

## Shapes

Corners are 2px. Buttons, fields, dialogs, clip cards and the cue sheet share
the same small radius. The interface is rectilinear; circles are reserved for
the recording tally and the play glyph.

## Components

- **Primary button:** signal red ground, studio-black text, 2px radius, 10×18
  padding. Used for Start dictating and New recording.
- **Secondary button:** transparent ground, 1px rule border, ink text. Used for
  Download, Rename, Import audio and dialog actions.
- **Ghost button:** no border until hover; muted text. Used for footer controls
  and destructive secondary actions.
- **Cue sheet:** a bordered panel with a mono `CUE SHEET` label and a stack of
  clip cards. Each card carries the clip number, timecode, play control and a
  waveform-like seek strip. The active card is red-tinted with a red border.
- **Transcript:** a serif textarea on the surface colour, with a transparent
  mirror overlay for playback highlighting. The overlay uses the same serif
  metrics as the textarea.
- **Status line:** IBM Plex Mono, uppercase, inline. Errors use the danger red;
  success uses ink. No toasts.

## Do's and Don'ts

- **Do** keep the transcript serif and the interface condensed sans.
- **Do** use signal red for one job at a time: the tally, the primary action,
  or the active clip.
- **Do** keep the light mode a cool studio wall, not a cream page.
- **Do** support system, light and dark modes; system follows the device.
- **Don't** add gradients, shadows, glow or glass.
- **Don't** use a second saturated accent; amber is a signal, not decoration.
- **Don't** round cards beyond 2px or nest cards inside cards.
- **Don't** replace the cue sheet with a generic waveform wallpaper.
