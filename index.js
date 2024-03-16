import { fromEvent, interval, map, merge, switchMap, takeUntil } from "./operators.js";

const canvas = document.getElementById('canvas');
const clearBtn = document.getElementById('clear-btn');
const ctx = canvas.getContext('2d');

const mouseEnvents = {
    down: 'mousedown',
    up: 'mouseup',
    move: 'mousemove',
    leave: 'mouseleave',

    touchstart: 'touchstart',
    touchmove: 'touchmove',
    touchend: 'touchend',

    click: 'click'

}

const store = {
    db: [],
    get() {
        return this.db
    },
    set(item) {
        this.db.unshift(item);
    },
    clear() {
        this.db.length = 0;
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const resetCanvas = ( width, height ) => {
    const parent = canvas.parentElement;
    canvas.width = width || parent.clientWidth * 0.9;
    canvas.height = height || parent.clientHeight * 1.5;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 4;

}

const getMousePosition = (canvasDom, eventValue) => {
    const rect = canvasDom.getBoundingClientRect();
    return {
        x: eventValue.clientX - rect.left,
        y: eventValue.clientY - rect.top
    }
}

resetCanvas();

const touchToMouse =  (touchEvent, mouseEnvent) => {
    const [touch] = touchEvent.touches.length ?
        touchEvent.touches : 
        touchEvent.changedTouches;
    return new MouseEvent(mouseEnvent, {
        clientX: touch.clientX,
        clientY: touch.clientY
    })
}

merge([
    fromEvent(canvas, mouseEnvents.down),
    fromEvent(canvas, mouseEnvents.touchstart)
        .pipeThrough( map( e => touchToMouse(e, mouseEnvents.touchstart) ))
])
    .pipeThrough(
        switchMap(e => {
            return merge([
                fromEvent(canvas, mouseEnvents.move),
                fromEvent(canvas, mouseEnvents.touchmove)
                    .pipeThrough( map( e => {
                        return touchToMouse(e, mouseEnvents.move)
                    } ))
            ])
                .pipeThrough(
                    takeUntil(
                        merge([
                            fromEvent(canvas, mouseEnvents.up),
                            fromEvent(canvas, mouseEnvents.leave),
                            fromEvent(canvas, mouseEnvents.touchend)
                                .pipeThrough( map( e => {
                                    return touchToMouse(e, mouseEnvents.up)
                                } ))
        
                        ])
                    )
                )
        })
    )
    .pipeThrough(map(function ([mouseDown, mouseMove]) {
        this._lastPosition = this._lastPosition ?? mouseDown;
        const [from, to] = [this._lastPosition, mouseMove]
            .map(item => getMousePosition(canvas, item));

        this._lastPosition = mouseMove.type == mouseEnvents.up ? null : mouseMove;

        return { from, to }
    }))
    .pipeTo( new WritableStream({
        write({from, to}) {
            store.set({ from, to});
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        }
    }));

fromEvent(clearBtn, mouseEnvents.click)
.pipeTo(new WritableStream ({
    async write(chunck){
        ctx.beginPath();
        ctx.strokeStyle = '#FFFFFF';

        for (const {from, to} of store.get()) {
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();

            await sleep(5);
        }
        store.clear();
        resetCanvas(canvas.width, canvas.height);
    }
}))