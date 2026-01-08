import * as THREE from 'three'
import { extend, createRoot, ReconcilerRoot, Dpr, Size } from '@react-three/fiber'
import { createPointerEvents } from './events'
import { WorkerDOM } from './WorkerDOM'

export function render(children: React.ReactNode) {
  extend(THREE as any)

  let root: ReconcilerRoot<HTMLCanvasElement>
  let dpr: Dpr = [1, 2]
  let size: Size = { width: 0, height: 0, top: 0, left: 0 }
  let dom: WorkerDOM

  const handleInit = (payload: any) => {
    const { props, drawingSurface: canvas, width, top, left, height, pixelRatio } = payload
    try {
      // Unmount root if already mounted
      if (root) {
        root.unmount()
      }

      dom = new WorkerDOM(canvas)
      dom.update({ width, height, top, left })

      // Create react-three-fiber root
      root = createRoot(canvas)
      // Configure root
      root.configure({
        events: createPointerEvents(dom.emitter),
        size: (size = { width, height, top, left }),
        dpr: (dpr = Math.min(Math.max(1, pixelRatio), 2)),
        ...props,
        onCreated: (state) => {
          if (props.eventPrefix) {
            state.setEvents({
              compute: (event, state) => {
                const x = (event as any)[`${props.eventPrefix}X`] ?? (event as any).offsetX ?? (event as any).clientX
                const y = (event as any)[`${props.eventPrefix}Y`] ?? (event as any).offsetY ?? (event as any).clientY
                state.pointer.set((x / state.size.width) * 2 - 1, -(y / state.size.height) * 2 + 1)
                state.raycaster.setFromCamera(state.pointer, state.camera)
              },
            })
          }
        },
      })

      // Render children once
      root.render(children)
    } catch (e: any) {
      postMessage({ type: 'error', payload: e?.message })
    }
  }

  const handleResize = ({ width, height, top, left }: Size) => {
    if (!root) return
    dom.update({ width, height, top, left })
    root.configure({ size: (size = { width, height, top, left }), dpr })
  }

  const handleEvents = (payload: any) => {
    dom.handleEvent(payload)
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
}
