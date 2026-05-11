# Fullscreen API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native browser fullscreen toggled by pressing `F`, with no UI button.

**Architecture:** Extend the existing `H` key `useEffect` in `ShaderControls` with a second `if` branch for `F`/`f` that calls `requestFullscreen` / `exitFullscreen` on `document.documentElement`. One file, one change.

**Tech Stack:** Next.js 16, React 19, TypeScript, Browser Fullscreen API (no new dependencies)

---

## File Map

| File | Action |
|------|--------|
| `components/ui/shader-controls.tsx` | Modify — add `F` key branch to existing keydown effect (lines 50–56) |

---

## Task 1: Add F key fullscreen toggle

**Files:**
- Modify: `components/ui/shader-controls.tsx:50-56`

- [ ] **Step 1: Replace the H key effect**

In `components/ui/shader-controls.tsx`, find:

```ts
  // ── H key toggles panel ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "h" || e.key === "H") onToggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onToggle])
```

Replace with:

```ts
  // ── H key toggles panel, F key toggles fullscreen ─────────────────────────
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

- [ ] **Step 2: Build — must be zero errors**

```bash
cd /Users/adrianovenosa/Code/Shader
npm run build 2>&1 | tail -10
```

Expected: clean build, zero TypeScript errors, route `/` listed.

- [ ] **Step 3: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "feat: add F key fullscreen toggle via Fullscreen API"
```

---

## Task 2: End-to-end verification

**Files:** none — manual verification

- [ ] **Step 1: Start dev server**

```bash
cd /Users/adrianovenosa/Code/Shader
npm run dev
```

Open `http://localhost:3000`.

- [ ] **Step 2: Verify F key**

| Action | Expected |
|--------|----------|
| Press `F` | Browser enters native fullscreen (no address bar, no browser chrome) |
| Press `F` again | Exits fullscreen |
| Press `Escape` | Also exits fullscreen (native browser behavior) |

- [ ] **Step 3: Verify no regression**

| Action | Expected |
|--------|----------|
| Press `H` | Panel opens/closes |
| Click ⚙ gear | Panel opens/closes |
| All 4 shader thumbnails | Switch shaders |
| All 5 sliders | Affect active shader in real time |

- [ ] **Step 4: Final build**

```bash
npm run build 2>&1 | tail -10
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: fullscreen feature verified and complete"
```
