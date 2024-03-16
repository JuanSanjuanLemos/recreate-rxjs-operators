/**
 *  @param { EventTarget } target
 *  @param { string } eventName
 *  @returns { ReadableStream }
 */

const fromEvent = (target, eventName) => {
    let _listener;
    return new ReadableStream({
        start(controller) {
            _listener = (e) => controller.enqueue(e);
            target.addEventListener(eventName, _listener);

        },
        cancel() {
            target.removeEventListener(eventName, _listener);
        }
    });
}

/**
 *  @param { number } ms
 *  @returns { ReadableStream }
 */
const interval = (ms) => {
    let _intervalid;
    return new ReadableStream({
        start(controller) {
            _intervalid = setInterval( () => {
                controller.enqueue(Date.now());
            }, ms );
        },
        cancel() {  
            clearInterval( _intervalid );
        }
    })
}

/**
 * 
 * @param {Function} fn
 * @returns {TransformStream} 
 */
const map = (fn) => {
    return new TransformStream({
        transform(chunck, controller) {
            controller.enqueue(fn.bind(fn)(chunck))
        }
    })
}

/**
 * @typedef {ReadableStream | TransformStream} Stream
 * @param {Stream[]} streams
 * @returns {ReadableStream}
 */
const merge = (streams) => {
    return new ReadableStream({
        async start(controller) {
            for (const stream of streams) {
                const reader = (stream.readable || stream).getReader();
                async function read() {
                    const {value, done} = await reader.read();
                    if (done) return;

                    if (!controller.desiredSize) return
                    controller.enqueue(value);
                    return read();
                }

                read();
            }
        }
    })
}


/**
 * @typedef {function(): ReadableStream | TransformStream} StreamFunction
 * @param {StreamFunction} fn
 * @param {object} options
 * @param {boolean} options.pairwise
 * 
 * @returns {TransformStream}
 */
const switchMap = (fn, options = { pairwise: true }) => {
    return new TransformStream({
        transform(chunck, controller) {
            const stream = fn.bind(fn)(chunck);
            const reader = (stream.readable || stream).getReader();
            async function read() {
                const {value, done} = await reader.read();
                if (done) return;
                const result = options.pairwise ? [chunck, value] : value;
                controller.enqueue(result);
                return read();
            }

            return read();
        }
    })
}

/**
 * @param {ReadableStream | TransformStream} stream
 * @returns {TransformStream}
 */
const takeUntil = (stream) => {
    const readAndTerminate = async (stream, controller) => {
        const reader = (stream.readable || stream).getReader();
        const { value } = await reader.read();
        controller.enqueue(value);
        controller.terminate();
    }
    return new TransformStream({
        start(controller) {
            readAndTerminate(stream, controller)
        },
        transform(chunck, controller){
            controller.enqueue(chunck)
        }
    })
}

export { 
    fromEvent,
    interval,
    map,
    merge,
    switchMap,
    takeUntil
 };
