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

// custom floating context for hoverable popovers.
// uses floating-ui's useHover + safePolygon for close handling (geometric safe
// zone between trigger and content), but handles multi-trigger open/restMs
// ourselves via onHoverReference since useHover's listeners aren't attached
// when PopperAnchor switches the reference element mid-hover.

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
      // suppresses safePolygon/mouseleave closes during multi-trigger switching.
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

      // parse hoverable config
      const delay = hoverable && typeof hoverable === 'object' ? hoverable.delay : 0
      const restMs = hoverable && typeof hoverable === 'object' ? hoverable.restMs : 0
      const openDelay = typeof delay === 'number' ? delay : ((delay as any)?.open ?? 0)

      return {
        ...floating,
        open,
        getReferenceProps,
        getFloatingProps,

        // multi-trigger open: useHover attaches listeners via useEffect, so they
        // miss the initial mouseenter when PopperAnchor switches reference mid-hover.
        // we handle open ourselves here; useHover + safePolygon handle close.
        onHoverReference: hoverable
          ? (_event: any) => {
              onTriggerRef.current = true
              if (open) return
              if (restMs && !openDelay) {
                clearTimeout(restTimerRef.current)
                restTimerRef.current = setTimeout(() => {
                  setOpen(true, 'hover')
                }, restMs)
              } else if (openDelay) {
                clearTimeout(restTimerRef.current)
                restTimerRef.current = setTimeout(() => {
                  setOpen(true, 'hover')
                }, openDelay)
              } else {
                setOpen(true, 'hover')
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
