import type { DomEvent, RootState, EventManager, Events, RootStore } from '@react-three/fiber'
import { createEvents } from '@react-three/fiber'
import mitt, { Emitter } from 'mitt'

export const EVENTS = {
  onClick: ['click', false],
  onContextMenu: ['contextmenu', false],
  onDoubleClick: ['dblclick', false],
  onWheel: ['wheel', true],
  onPointerDown: ['pointerdown', true],
  onPointerUp: ['pointerup', true],
  onPointerLeave: ['pointerleave', true],
  onPointerMove: ['pointermove', true],
  onPointerCancel: ['pointercancel', true],
  onLostPointerCapture: ['lostpointercapture', true],
} as const

// In r3f v9, createEvents receives the store directly
export function createPointerEvents(emitter: Emitter<Record<any, unknown>>) {
  return (store: RootStore): EventManager<HTMLElement> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { handlePointer } = createEvents(store as any)

    return {
      priority: 1,
      enabled: true,
      compute(event: any, state: RootState) {
        state.pointer.set((event.offsetX / state.size.width) * 2 - 1, -(event.offsetY / state.size.height) * 2 + 1)
        state.raycaster.setFromCamera(state.pointer, state.camera)
      },

      connected: undefined,
      handlers: Object.keys(EVENTS).reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc, key) => ({ ...acc, [key]: handlePointer(key as any) }),
        {}
      ) as unknown as Events,
      connect: (target: HTMLElement) => {
        const { set, events } = store.getState()
        events.disconnect?.()
        set((state) => ({ events: { ...state.events, connected: target } }))
        Object.entries(events?.handlers ?? []).forEach(([name, event]) => {
          const [eventName] = EVENTS[name as keyof typeof EVENTS]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          emitter.emit(eventName as string, event as any)
        })
      },
      disconnect: () => {
        const { set, events } = store.getState()
        if (events.connected) {
          Object.entries(events.handlers ?? []).forEach(([name, event]) => {
            const [eventName] = EVENTS[name as keyof typeof EVENTS]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            emitter.off(eventName as string, event as any)
          })
          set((state) => ({ events: { ...state.events, connected: undefined } }))
        }
      },
    }
  }
}
