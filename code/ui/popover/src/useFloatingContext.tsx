import React from 'react'
import type { UseFloatingOptions } from '@floating-ui/react'
import {
  safePolygon,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react'

// Custom floating context to override the Popper on web
// Note: dismiss handling (ESC, outside click) is done by Tamagui's Dismissable
// so it participates in the shared layer system with Dialog
export const useFloatingContext = ({
  open,
  setOpen,
  disable,
  disableFocus,
  hoverable,
}) => {
  'use no memo'

  return React.useCallback(
    (props: UseFloatingOptions) => {
      // multi-trigger switching: when moving between trigger elements while the
      // popover is open, useHover fires a close (mouseleave on old trigger, or
      // safePolygon's mousemove handler). we suppress hover closes during a brief
      // window that starts on mouseleave of a trigger (while open) and ends when
      // either a new trigger is entered or the window expires.
      const switchingRef = React.useRef(false)
      const pendingCloseRef = React.useRef(false)
      const switchTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
      const restTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
      const disposedRef = React.useRef(false)

      // clean up timers on unmount to prevent stale callbacks
      React.useEffect(() => {
        disposedRef.current = false
        return () => {
          disposedRef.current = true
          clearTimeout(switchTimerRef.current)
          clearTimeout(restTimerRef.current)
        }
      }, [])

      const floating = useFloating({
        ...props,
        open,
        onOpenChange: (val, event) => {
          if (
            !val &&
            switchingRef.current &&
            (event?.type === 'mousemove' || event?.type === 'mouseleave')
          ) {
            pendingCloseRef.current = true
            return
          }
          const type =
            event?.type === 'mousemove' ||
            event?.type === 'mouseenter' ||
            event?.type === 'mouseleave'
              ? 'hover'
              : 'press'
          setOpen(val, type)
        },
      }) as any
      const { getReferenceProps, getFloatingProps } = useInteractions([
        hoverable
          ? useHover(floating.context, {
              enabled: !disable && hoverable,
              handleClose: safePolygon({
                requireIntent: true,
                blockPointerEvents: false,
                buffer: 1,
              }),
              ...(hoverable && typeof hoverable === 'object' && hoverable),
            })
          : useHover(floating.context, {
              enabled: false,
            }),
        useFocus(floating.context, {
          enabled: !disable && !disableFocus,
          visibleOnly: true,
        }),
        useRole(floating.context, { role: 'dialog' }),
      ])
      return {
        ...floating,
        open,
        getReferenceProps,
        getFloatingProps,
        // multi-trigger: useHover attaches DOM mouseenter listeners via useEffect.
        // when PopperAnchor switches the reference on hover, the event fires
        // before the listener is attached. this opens immediately for non-delay
        // hoverable. delay case is handled by a synthetic mouseenter dispatch
        // in PopperAnchor that lets useHover process it natively.
        onHoverReference: hoverable
          ? (event: any) => {
              if (open) {
                // entering a new trigger while open - clear any pending close
                pendingCloseRef.current = false
                clearTimeout(switchTimerRef.current)
                switchTimerRef.current = setTimeout(() => {
                  if (disposedRef.current) return
                  switchingRef.current = false
                  pendingCloseRef.current = false
                }, 200)
                return
              }
              const delay = typeof hoverable === 'object' ? hoverable.delay : 0
              const restMs = typeof hoverable === 'object' ? hoverable.restMs : 0
              const openDelay =
                typeof delay === 'number' ? delay : ((delay as any)?.open ?? 0)
              if (!openDelay && !restMs) {
                floating.context.onOpenChange(true, event, 'hover')
              } else if (restMs && !openDelay) {
                // floating-ui's restMs won't fire on synthetic mouseenter,
                // so we handle it ourselves for multi-trigger popovers
                clearTimeout(restTimerRef.current)
                restTimerRef.current = setTimeout(() => {
                  if (disposedRef.current) return
                  floating.context.onOpenChange(true, event, 'hover')
                }, restMs)
              }
            }
          : undefined,
        // called when mouse leaves a trigger element
        onLeaveReference: hoverable
          ? () => {
              clearTimeout(restTimerRef.current)
              if (!open) return
              switchingRef.current = true
              pendingCloseRef.current = false
              clearTimeout(switchTimerRef.current)
              switchTimerRef.current = setTimeout(() => {
                if (disposedRef.current) return
                switchingRef.current = false
                if (pendingCloseRef.current) {
                  pendingCloseRef.current = false
                  setOpen(false, 'hover')
                }
              }, 150)
            }
          : undefined,
      }
    },
    [open, setOpen, disable, disableFocus, hoverable]
  )
}
