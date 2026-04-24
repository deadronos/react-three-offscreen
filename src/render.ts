import * as THREE from 'three'
import mitt from 'mitt'
import { extend, createRoot } from '@react-three/fiber'
import type { ReconcilerRoot } from '@react-three/fiber'
import type { DomEvent } from '@react-three/fiber'
import { createPointerEvents } from './events'

interface Size { width: number; height: number; top: number; left: number }

export function render(children: React.ReactNode) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extend(THREE as any)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: ReconcilerRoot<any>
  let dpr: [number, number] = [1, 2]
  let size: Size = { width: 0, height: 0, top: 0, left: 0 }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emitter = mitt<Record<string, any>>()

  const handleInit = (payload: any) => {
    const { props, drawingSurface: canvas, width, top, left, height, pixelRatio } = payload
    try {
      if (root) {
        root.unmount()
      }

      Object.assign(canvas, {
        pageXOffset: left,
        pageYOffset: top,
        clientLeft: left,
        clientTop: top,
        clientWidth: width,
        clientHeight: height,
        style: { touchAction: 'none' },
        ownerDocument: canvas,
        documentElement: canvas,
        getBoundingClientRect() {
          return size
        },
        setAttribute() {},
        setPointerCapture() {},
        releasePointerCapture() {},
        addEventListener(event: string, callback: () => void) {
          emitter.on(event, callback)
        },
        removeEventListener(event: string, callback: () => void) {
          emitter.off(event, callback)
        },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      root = createRoot(canvas as any)
      root.configure({
        events: createPointerEvents(emitter),
        size: (size = { width, height, top, left }),
        dpr: (dpr = [Math.min(Math.max(1, pixelRatio), 2), 2]),
        ...props,
        onCreated: (state) => {
          if (props.eventPrefix) {
            state.setEvents({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              compute: (event: DomEvent, st: any) => {
                const x = event[(props.eventPrefix + 'X') as keyof DomEvent] as number
                const y = event[(props.eventPrefix + 'Y') as keyof DomEvent] as number
                st.pointer.set((x / st.size.width) * 2 - 1, -(y / st.size.height) * 2 + 1)
                st.raycaster.setFromCamera(st.pointer, st.camera)
              },
            })
          }
        },
      })

      root.render(children)
    } catch (e: any) {
      postMessage({ type: 'error', payload: e?.message })
    }

    self.window = canvas
  }

  const handleResize = ({ width, height, top, left }: Size) => {
    if (!root) return
    root.configure({ size: (size = { width, height, top, left }), dpr })
  }

  const handleEvents = (payload: any) => {
    emitter.emit(payload.eventName, { ...payload, preventDefault() {}, stopPropagation() {} })
  }

  const handleProps = (payload: any) => {
    if (!root) return
    if (payload.dpr) dpr = payload.dpr
    root.configure({ size, dpr, ...payload })
  }

  const handlerMap = {
    resize: handleResize,
    init: handleInit,
    dom_events: handleEvents,
    props: handleProps,
  }

  self.onmessage = (event) => {
    const { type, payload } = event.data
    const handler = handlerMap[type as keyof typeof handlerMap]
    if (handler) handler(payload)
  }

  // Shims for threejs
  // @ts-ignore
  THREE.ImageLoader.prototype.load = function (
    url: string,
    onLoad: (img: ImageBitmap) => void,
    onProgress: () => void,
    onError: (e: Error) => void
  ) {
    if (this.path !== undefined) url = this.path + url
    url = this.manager.resolveURL(url)
    const scope = this
    const cached = THREE.Cache.get(url)

    if (cached !== undefined) {
      scope.manager.itemStart(url)
      if (onLoad) onLoad(cached)
      scope.manager.itemEnd(url)
      return cached
    }

    fetch(url)
      .then((res) => res.blob())
      .then((res) => createImageBitmap(res, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
      .then((bitmap) => {
        THREE.Cache.add(url, bitmap)
        if (onLoad) onLoad(bitmap)
        scope.manager.itemEnd(url)
      })
      .catch(onError)
    return {}
  }

  // Shims for web offscreen canvas
  // @ts-ignore
  self.window = {}
  // @ts-ignore
  self.document = {}
  // @ts-ignore
  self.Image = class {
    height = 1
    width = 1
    set onload(callback: any) {
      callback(true)
    }
  }
}
