const requestAnimationFrame = (function () {
    const requestFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame;
    let isNative = !!requestFrame;

    if (requestFrame && !/requestAnimationFrame\(\)\s*\{\s*\[native code\]\s*\}/i.test(requestFrame.toString())) {
        isNative = false;
    }

    if (isNative) {
        return function (callback, root) {
            requestFrame(callback, root)
        };
    }

    const TARGET_FPS = 60;
    let requests = {};
    let requestCount = 0;
    let rafHandle = 1;
    let intervalHandle = null;
    let lastActive = +new Date();

    return function (callback, root) {
        const callbackHandle = rafHandle++;
        requests[callbackHandle] = callback;
        requestCount++;
        if (intervalHandle === null) {
            intervalHandle = setInterval(function () {
                const time = +new Date();
                const currentRequests = requests;

                requests = {};
                requestCount = 0;

                for (let key in currentRequests) {
                    if (currentRequests.hasOwnProperty(key)) {
                        currentRequests[key](time);
                        lastActive = time;
                    }
                }

                if (time - lastActive > 2500) {
                    clearInterval(intervalHandle);
                    intervalHandle = null;
                }
            }, 1000 / TARGET_FPS);
        }
        return callbackHandle;
    };
})();

class Animate {
    time = Date.now || function () {
        return new Date().getTime();
    };
    desiredFrames = 60;
    millisecondsPerSecond = 1000;
    running = {};
    counter = 1;

    start(stepCallback, verifyCallback, completedCallback, duration, easingMethod, root) {
        const start = this.time();
        const id = this.counter++;
        let lastFrame = start;
        let percent = 0;
        let dropCounter = 0;

        if (!root) {
            root = document.body;
        }

        // Compacting running db automatically every few new animations
        if (id % 20 === 0) {
            const newRunning = {};
            Object.keys(this.running).forEach(key => newRunning[key] = true);
            this.running = newRunning;
        }

        // This is the internal step method which is called every few milliseconds
        const step = (virtual) => {
            const render = virtual !== true;
            const now = this.time();

            if (!this.running[id] || (verifyCallback && !verifyCallback(id))) {
                this.running[id] = null;
                completedCallback && completedCallback(this.desiredFrames - (dropCounter / ((now - start) / this.millisecondsPerSecond)), id, false);
                return;
            }

            // For the current rendering to apply let's update omitted steps in memory.
            // This is important to bring internal state variables up-to-date with progress in time.
            if (render) {
                const droppedFrames = Math.round((now - lastFrame) / (this.millisecondsPerSecond / this.desiredFrames)) - 1;
                for (var j = 0; j < Math.min(droppedFrames, 4); j++) {
                    step(true);
                    dropCounter++;
                }
            }

            // Compute percent value
            if (duration) {
                percent = (now - start) / duration;
                if (percent > 1) {
                    percent = 1;
                }
            }

            // Execute step callback, then...
            const value = easingMethod ? easingMethod(percent) : percent;
            if ((stepCallback(value, now, render) === false || percent === 1) && render) {
                this.running[id] = null;
                completedCallback && completedCallback(this.desiredFrames - (dropCounter / ((now - start) / this.millisecondsPerSecond)), id, percent === 1 || duration == null);
            } else if (render) {
                lastFrame = now;
                requestAnimationFrame(step, root);
            }
        };

        this.running[id] = true;
        requestAnimationFrame(step, root);
        return id;
    }

    stop(id) {
        const cleared = this.isRunning(id);
        if (cleared) {
            this.running[id] = null;
        }
        return cleared;
    }

    isRunning(id) {
        return this.running[id] != null;
    }
}

export default Animate;
