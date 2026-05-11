# Fullscreen API — Design Spec (Rodada 3)

**Date:** 2026-05-11  
**Status:** Approved

---

## Context

The app already fills the viewport (`fixed inset-0`). This spec adds native OS-level fullscreen via the browser Fullscreen API, triggered by pressing `F`. No button is added — keyboard-only.

---

## Architecture

One file modified:

```
components/ui/shader-controls.tsx   ← MODIFY: add F key branch to existing keydown effect
```

No new files, no new React state, no new effects.

---

## Implementation

In `components/ui/shader-controls.tsx`, extend the existing `H` key `useEffect`:

```ts
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "h" || e.key === "H") onToggle()
    if (e.key === "f" || e.key === "F") {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen().catch(() => {})
      }
    }
  }
  window.addEventListener("keydown", onKey)
  return () => window.removeEventListener("keydown", onKey)
}, [onToggle])
```

**Notes:**
- `document.documentElement.requestFullscreen()` requests fullscreen on the root element (entire page).
- `.catch(() => {})` silences the rejection thrown when the browser blocks the request (e.g., iframe sandbox, policy restriction) — no UI feedback needed for this edge case.
- `Escape` exits fullscreen via native browser behavior — no code required.
- No React state tracks fullscreen — the Fullscreen API is the source of truth.

---

## Verification

1. `npm run build` — zero TypeScript errors
2. Press `F` → browser enters native fullscreen (no browser chrome)
3. Press `F` again → exits fullscreen
4. Press `Escape` → also exits fullscreen (native behavior)
5. Press `H` → panel still toggles (no regression)
6. `npm run build` final — clean
