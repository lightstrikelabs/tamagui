# Animation Bugs: Tab Hover Preview (4 fixes)

Reproduction: `TabHoverAnimationCase` in kitchen-sink
Tests: `TabHoverAnimation.animated.test.tsx` (runs across all 4 drivers)

## Bug 1: AnimatePresence picks wrong exit direction

**Symptom**: When switching between tabs, content sometimes slides the
wrong way (e.g. moving right but content exits left).

**Root cause**: In `AnimatePresence`, the `custom` prop (containing
`{ going }`) is passed to `PresenceChild` at render time. But when
a child transitions from present -> exiting, the `custom` value may
have already been updated to reflect the NEW child's direction. The
exiting child receives the new custom value instead of the one it
had when it started exiting.

**Fix**: In `PresenceChild`, freeze the `custom` value when a child
starts exiting. Don't update it once `isPresent` becomes false.

**File**: `code/ui/animate-presence/src/PresenceChild.tsx`

## Bug 2: CSS driver - x/translateX animations not firing

**Symptom**: With CSS animation driver, enterStyle/exitStyle `x`
values don't animate. Content appears/disappears without sliding.

**Root cause**: CSS driver may not be generating proper transition
for transform sub-properties (x maps to translateX within transform).
The `transitionend` event fires for 'transform' but the driver may
not be setting up the right transition property.

**Investigation needed**: Check how CSS driver handles `x` in
enterStyle/exitStyle. May need to ensure transform is included in
transition properties when x/y/scale/rotate are used.

**File**: `code/core/animations-css/src/createAnimations.tsx`

## Bug 3: Motion driver - exit animation doesn't complete

**Symptom**: TabHoverFrame sometimes shows a faded-out ghost of the
previous content just sitting there. The exit animation starts
(opacity fades) but never completes removal.

**Root cause**: The motion driver's exit completion tracking may
lose track when animations are interrupted rapidly. The
`pendingExitCountsRef` or `completionScheduledRef` can get into
a bad state during rapid tab switches.

**Investigation needed**: Check the exit cycle management in the
motion driver. May need to ensure that interrupted exits still
call `sendExitComplete()`.

**File**: `code/core/animations-motion/src/createAnimations.tsx`

## Bug 4: Popover hoverable + animatePosition race conditions

**Symptom**: With `hoverable` prop on Popover, moving between tabs
causes the popover to jump all over, stutter, or freeze. The
`animatePosition` gets into a broken state.

**Root cause**: When Popover is in hoverable mode, moving between
trigger elements causes rapid anchor changes. The position animation
starts from the current animated position but gets interrupted by
a new position before completing, causing accumulating errors.

**Fix approach**: Use rAF-based position tracking (not
getComputedStyle which causes reflows). Attach an
IntersectionObserver + rAF that reads translateX for ~4 frames
then detaches. This gives real positions without layout thrashing.

**Files**:
- `code/ui/popover/src/Popover.tsx`
- `code/ui/popper/src/Popper.tsx`
- `code/core/animations-motion/src/createAnimations.tsx`

## Stretch: Layout-style AnimatePresence

Framer Motion's `layout` prop provides FLIP-based position animations
that are much smoother for tab indicator / hover preview use cases.
The CSS driver has commented-out FLIP code (lines 615-671). If we can
make this work, it would be the ideal solution for tab hover previews.

## Test Plan

Kitchen-sink usecase `TabHoverAnimationCase`:
- Row of 5 tabs with hover triggers
- Popover with animatePosition
- AnimatePresence with directional (x) enter/exit
- Content keyed by active tab

Playwright tests (`TabHoverAnimation.animated.test.tsx`):
1. Direction test: hover tab 1 -> tab 3, verify content slides right
2. Direction test: hover tab 3 -> tab 1, verify content slides left
3. Exit completion: hover tab, move away, verify exit completes (no ghosts)
4. Rapid switching: move across tabs quickly, verify no stuck animations
5. Position tracking: verify popover position animates smoothly between anchors

Measurement approach: rAF + getComputedStyle on the animated element
to track translateX over ~4 frames. Compare direction of movement
against expected direction.
