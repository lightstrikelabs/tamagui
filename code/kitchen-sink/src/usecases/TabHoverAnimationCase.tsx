import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { Popover as PopoverType } from 'tamagui'
import {
  AnimatePresence,
  Button,
  Paragraph,
  Popover,
  SizableText,
  styled,
  XStack,
  YStack,
} from 'tamagui'

const TABS = ['Tab A', 'Tab B', 'Tab C', 'Tab D', 'Tab E']

export function TabHoverAnimationCase() {
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [going, setGoing] = useState(0)
  const prevTab = useRef<string | null>(null)
  const popoverRef = useRef<PopoverType>(null)
  const buttonRefs = useRef<Record<string, HTMLElement | null>>({})
  const displayTab = useLastValueIf(activeTab, !!activeTab) ?? activeTab

  useEffect(() => {
    if (activeTab && prevTab.current && activeTab !== prevTab.current) {
      const prevIdx = TABS.indexOf(prevTab.current)
      const nextIdx = TABS.indexOf(activeTab)
      if (prevIdx >= 0 && nextIdx >= 0) {
        setGoing(nextIdx > prevIdx ? 1 : -1)
      }
    }
    if (activeTab) {
      prevTab.current = activeTab
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [activeTab])

  const handleMouseEnter = useCallback((tab: string) => {
    setActiveTab(tab)
    const el = buttonRefs.current[tab]
    if (el && popoverRef.current) {
      const rect = el.getBoundingClientRect()
      popoverRef.current.anchorTo({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      })
    }
  }, [])

  return (
    <YStack gap="$4" padding="$4">
      <SizableText id="going-direction" data-going={going}>
        Direction: {going}
      </SizableText>

      <Popover ref={popoverRef} open={open} onOpenChange={setOpen} hoverable>
        <Popover.Trigger>
          <XStack gap="$2">
            {TABS.map((tab) => (
              <Button
                key={tab}
                id={`tab-${tab.replace(' ', '-').toLowerCase()}`}
                data-testid={`tab-${tab.replace(' ', '-').toLowerCase()}`}
                size="$3"
                ref={(el: any) => {
                  buttonRefs.current[tab] = el as HTMLElement
                }}
                onMouseEnter={() => handleMouseEnter(tab)}
                onMouseLeave={() => setActiveTab(null)}
                theme={activeTab === tab ? 'blue' : undefined}
              >
                {tab}
              </Button>
            ))}
          </XStack>
        </Popover.Trigger>

        <Popover.Content
          id="hover-content"
          data-testid="hover-content"
          animatePosition
          animateOnly={['transform', 'opacity']}
          elevation="$4"
          padding="$3"
          borderRadius="$4"
          enterStyle={{ opacity: 0, y: -5 }}
          exitStyle={{ opacity: 0, y: -5 }}
          transition="500ms"
          bg="red"
        >
          <YStack overflow="hidden" width={250} height={120}>
            <AnimatePresence initial={false} custom={{ going }}>
              {open && !!displayTab && (
                <SlideFrame
                  key={displayTab}
                  going={going}
                  id="slide-content"
                  data-testid="slide-content"
                  data-tab={displayTab}
                  data-going={going}
                  transition="200ms"
                >
                  <TabContent tab={displayTab} />
                </SlideFrame>
              )}
            </AnimatePresence>
          </YStack>
        </Popover.Content>
      </Popover>

      <ExitTracker />
    </YStack>
  )
}

const TabContent = memo(({ tab }: { tab: string }) => (
  <YStack gap="$2" padding="$2">
    <SizableText fontWeight="bold" data-testid="tab-content-title">
      {tab}
    </SizableText>
    <Paragraph size="$2">Preview content for {tab}</Paragraph>
  </YStack>
))

const SlideFrame = styled(YStack, {
  position: 'absolute',
  inset: 0,
  z: 1,

  variants: {
    going: {
      ':number': (going: number) => ({
        enterStyle: {
          x: going === 0 ? 0 : going > 0 ? 100 : -100,
          opacity: 0,
        },
        exitStyle: {
          x: going === 0 ? 0 : going < 0 ? 100 : -100,
          opacity: 0,
        },
      }),
    },
  } as const,
})

// tracks exit completions for test assertions
function ExitTracker() {
  const [exitCount, setExitCount] = useState(0)
  const [lastExitTime, setLastExitTime] = useState(0)

  useEffect(() => {
    const handler = () => {
      setExitCount((c) => c + 1)
      setLastExitTime(Date.now())
    }
    window.addEventListener('tab-hover-exit-complete', handler)
    return () => window.removeEventListener('tab-hover-exit-complete', handler)
  }, [])

  return (
    <YStack>
      <SizableText
        id="exit-count"
        data-testid="exit-count"
        data-count={exitCount}
        data-last-time={lastExitTime}
      >
        Exits: {exitCount}
      </SizableText>
    </YStack>
  )
}

// keeps the last truthy value
function useLastValueIf<T>(value: T, condition: boolean): T {
  const ref = useRef(value)
  if (condition) {
    ref.current = value
  }
  return ref.current
}
