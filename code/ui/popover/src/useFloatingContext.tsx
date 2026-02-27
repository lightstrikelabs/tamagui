import React from 'react'
import type { UseFloatingOptions } from '@floating-ui/react'
import { useFloating, useFocus, useInteractions, useRole } from '@floating-ui/react'

// custom floating context for hoverable popovers.
// replaces floating-ui's useHover + safePolygon with simple timer-based hover.
// a close delay (min 100ms) acts as a "safe bridge" between trigger and content,
// replacing the complex polygon math with something that works just as well.
// this also natively handles multi-trigger switching and restMs.

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
      const openTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
      const closeTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
      const restTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)

      React.useEffect(() => {
        return () => {
          clearTimeout(openTimerRef.current)
          clearTimeout(closeTimerRef.current)
          clearTimeout(restTimerRef.current)
        }
      }, [])

      const floating = useFloating({
        ...props,
        open,
        onOpenChange: (val, event) => {
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
      const closeDelay = typeof delay === 'number' ? delay : ((delay as any)?.close ?? 0)
      // minimum 100ms close delay acts as safe bridge between trigger and content
      const effectiveCloseDelay = hoverable ? Math.max(closeDelay, 100) : 0

      const doClose = () => {
        clearTimeout(openTimerRef.current)
        clearTimeout(restTimerRef.current)
        if (effectiveCloseDelay > 0) {
          closeTimerRef.current = setTimeout(() => {
            setOpen(false, 'hover')
          }, effectiveCloseDelay)
        } else {
          setOpen(false, 'hover')
        }
      }

      return {
        ...floating,
        open,
        getReferenceProps,
        getFloatingProps: hoverable
          ? (props: any) =>
              getFloatingProps({
                ...props,
                onMouseEnter: () => {
                  clearTimeout(closeTimerRef.current)
                },
                onMouseLeave: () => {
                  doClose()
                },
              })
          : getFloatingProps,

        onHoverReference: hoverable
          ? (_event: any) => {
              clearTimeout(closeTimerRef.current)
              if (open) return
              if (restMs && !openDelay) {
                clearTimeout(restTimerRef.current)
                restTimerRef.current = setTimeout(() => {
                  setOpen(true, 'hover')
                }, restMs)
              } else if (openDelay) {
                clearTimeout(openTimerRef.current)
                openTimerRef.current = setTimeout(() => {
                  setOpen(true, 'hover')
                }, openDelay)
              } else {
                setOpen(true, 'hover')
              }
            }
          : undefined,

        onLeaveReference: hoverable
          ? () => {
              doClose()
            }
          : undefined,
      }
    },
    [open, setOpen, disable, disableFocus, hoverable]
  )
}
