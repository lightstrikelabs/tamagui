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
      // tracks whether pointer is currently over any trigger element.
      // while true, suppress hover-initiated closes (safePolygon/mouseleave)
      // so the popover stays open during multi-trigger switching.
      const onTriggerRef = React.useRef(false)
      const restTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)

      React.useEffect(() => {
        return () => {
          clearTimeout(restTimerRef.current)
        }
      }, [])

      const floating = useFloating({
        ...props,
        open,
        onOpenChange: (val, event) => {
          // suppress hover closes while pointer is on a trigger
          if (
            !val &&
            onTriggerRef.current &&
            (event?.type === 'mousemove' || event?.type === 'mouseleave')
          ) {
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
              onTriggerRef.current = true
              if (open) return
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
                  floating.context.onOpenChange(true, event, 'hover')
                }, restMs)
              }
            }
          : undefined,
        onLeaveReference: hoverable
          ? () => {
              onTriggerRef.current = false
              clearTimeout(restTimerRef.current)
            }
          : undefined,
      }
    },
    [open, setOpen, disable, disableFocus, hoverable]
  )
}
