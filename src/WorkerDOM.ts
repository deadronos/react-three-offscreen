import mitt from 'mitt'

export class WorkerDOM {
  emitter = mitt()

  constructor(private canvas: any) {
    this.canvas.addEventListener = (event: string, callback: any) => this.emitter.on(event, callback)
    this.canvas.removeEventListener = (event: string, callback: any) => this.emitter.off(event, callback)

    // Global polyfills
    // @ts-ignore
    self.window = this.canvas
    // @ts-ignore
    self.document = this.canvas
    // @ts-ignore
    self.Image = class {
      height = 1
      width = 1
      set onload(callback: any) {
        callback(true)
      }
    }
  }

  update(props: any) {
    const { width, height, top, left } = props

    Object.assign(this.canvas, {
      pageXOffset: left,
      pageYOffset: top,
      clientLeft: left,
      clientTop: top,
      clientWidth: width,
      clientHeight: height,
      style: { touchAction: 'none' },
      ownerDocument: this.canvas,
      documentElement: this.canvas,
      getBoundingClientRect: () => ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
      }),
      setAttribute() {},
      setPointerCapture() {},
      releasePointerCapture() {},
    })
  }

  handleEvent(payload: any) {
    this.emitter.emit(payload.eventName, {
      ...payload,
      preventDefault() {},
      stopPropagation() {},
      target: this.canvas,
      currentTarget: this.canvas,
    })
  }
}
