import Scroll from './core/Scroll';

class Scroller extends Scroll {
    doMouseWheel(wheelDelta, timeStamp, pageX, pageY) {
        const change = wheelDelta > 0 ? 0.97 : 1.03;
        return this.zoomTo(this.__zoomLevel * change, false, pageX - this.__clientLeft, pageY - this.__clientTop);
    }

    doTouchStart(touches, timeStamp) {
        if (touches.length == null) {
            throw new Error("Invalid touch list: " + touches);
        }

        if (timeStamp instanceof Date) {
            timeStamp = timeStamp.valueOf();
        }
        if (typeof timeStamp !== "number") {
            throw new Error("Invalid timestamp value: " + timeStamp);
        }

        // Reset interruptedAnimation flag
        this.__interruptedAnimation = true;

        if (this.__isDecelerating) {
            this.animate.stop(this.__isDecelerating);
            this.__isDecelerating = false;
            this.__interruptedAnimation = true;
        }

        if (this.__isAnimating) {
            this.animate.stop(this.__isAnimating);
            this.__isAnimating = false;
            this.__interruptedAnimation = true;
        }

        // Use center point when dealing with two fingers
        const isSingleTouch = touches.length === 1;
        let currentTouchLeft;
        let currentTouchTop;
        if (isSingleTouch) {
            currentTouchLeft = touches[0].pageX;
            currentTouchTop = touches[0].pageY;
        } else {
            currentTouchLeft = Math.abs(touches[0].pageX + touches[1].pageX) / 2;
            currentTouchTop = Math.abs(touches[0].pageY + touches[1].pageY) / 2;
        }

        // Store initial positions
        this.__initialTouchLeft = currentTouchLeft;
        this.__initialTouchTop = currentTouchTop;

        // Store current zoom level
        this.__zoomLevelStart = this.__zoomLevel;

        // Store initial touch positions
        this.__lastTouchLeft = currentTouchLeft;
        this.__lastTouchTop = currentTouchTop;

        // Store initial move time stamp
        this.__lastTouchMove = timeStamp;

        // Reset initial scale
        this.__lastScale = 1;

        // Reset locking flags
        this.__enableScrollX = !isSingleTouch && this.options.scrollingX;
        this.__enableScrollY = !isSingleTouch && this.options.scrollingY;

        // Reset tracking flag
        this.__isTracking = true;

        // Reset deceleration complete flag
        this.__didDecelerationComplete = false;

        // Dragging starts directly with two fingers, otherwise lazy with an offset
        this.__isDragging = !isSingleTouch;

        // Some features are disabled in multi touch scenarios
        this.__isSingleTouch = isSingleTouch;

        // Clearing data structure
        this.__positions = [];
    }

    doTouchMove(touches, timeStamp, scale) {
        if (touches.length == null) {
            throw new Error("Invalid touch list: " + touches);
        }

        if (timeStamp instanceof Date) {
            timeStamp = timeStamp.valueOf();
        }
        if (typeof timeStamp !== "number") {
            throw new Error("Invalid timestamp value: " + timeStamp);
        }

        if (!this.__isTracking) {
            return;
        }

        let currentTouchLeft;
        let currentTouchTop;

        // Compute move based around of center of fingers
        if (touches.length === 2) {
            currentTouchLeft = Math.abs(touches[0].pageX + touches[1].pageX) / 2;
            currentTouchTop = Math.abs(touches[0].pageY + touches[1].pageY) / 2;
        } else {
            currentTouchLeft = touches[0].pageX;
            currentTouchTop = touches[0].pageY;
        }

        const positions = this.__positions;
        if (this.__isDragging) {
            const moveX = currentTouchLeft - this.__lastTouchLeft;
            const moveY = currentTouchTop - this.__lastTouchTop;

            // Read previous scroll position and zooming
            let scrollLeft = this.__scrollLeft;
            let scrollTop = this.__scrollTop;
            let level = this.__zoomLevel;

            // 缩放
            if (scale != null && this.options.zooming) {
                const oldLevel = level;
                level = level / this.__lastScale * scale;
                level = Math.max(Math.min(level, this.options.maxZoom), this.options.minZoom);

                if (oldLevel !== level) {
                    let currentTouchLeftRel = currentTouchLeft - this.__clientLeft;
                    let currentTouchTopRel = currentTouchTop - this.__clientTop;
                    scrollLeft = ((currentTouchLeftRel + scrollLeft) * level / oldLevel) - currentTouchLeftRel;
                    scrollTop = ((currentTouchTopRel + scrollTop) * level / oldLevel) - currentTouchTopRel;

                    this.__computeScrollMax(level);
                }
            }

            // X轴滚动
            if (this.__enableScrollX) {
                scrollLeft -= moveX * this.options.speedMultiplier;
                const maxScrollLeft = this.__maxScrollLeft;

                if (scrollLeft > maxScrollLeft || scrollLeft < 0) {
                    if (this.options.bouncing) {
                        scrollLeft += (moveX / 2 * this.options.speedMultiplier);
                    } else if (scrollLeft > maxScrollLeft) {
                        scrollLeft = maxScrollLeft;
                    } else {
                        scrollLeft = 0;
                    }
                }
            }

            // Y轴滚动
            if (this.__enableScrollY) {
                scrollTop -= moveY * this.options.speedMultiplier;
                const maxScrollTop = this.__maxScrollTop;

                if (scrollTop > maxScrollTop || scrollTop < 0) {
                    if (this.options.bouncing) {
                        scrollTop += (moveY / 2 * this.options.speedMultiplier);
                        // 支持下拉刷新 (only when only y is scrollable)
                        if (!this.__enableScrollX && this.__refreshHeight != null) {
                            if (!this.__refreshActive && scrollTop <= -this.__refreshHeight) {
                                this.__refreshActive = true;
                                if (this.__refreshActivate) {
                                    this.__refreshActivate();
                                }
                            } else if (this.__refreshActive && scrollTop > -this.__refreshHeight) {
                                this.__refreshActive = false;
                                if (this.__refreshDeactivate) {
                                    this.__refreshDeactivate();
                                }
                            }
                        }
                    } else if (scrollTop > maxScrollTop) {
                        scrollTop = maxScrollTop;
                    } else {
                        scrollTop = 0;
                    }
                }
            }

            // Keep list from growing infinitely (holding min 10, max 20 measure points)
            if (positions.length > 60) {
                positions.splice(0, 30);
            }

            positions.push(scrollLeft, scrollTop, timeStamp);
            this.__publish(scrollLeft, scrollTop, level);
        } else {
            const minimumTrackingForScroll = this.options.locking ? 3 : 0;
            const minimumTrackingForDrag = 5;
            const distanceX = Math.abs(currentTouchLeft - this.__initialTouchLeft);
            const distanceY = Math.abs(currentTouchTop - this.__initialTouchTop);

            this.__enableScrollX = this.options.scrollingX && distanceX >= minimumTrackingForScroll;
            this.__enableScrollY = this.options.scrollingY && distanceY >= minimumTrackingForScroll;

            positions.push(this.__scrollLeft, this.__scrollTop, timeStamp);
            this.__isDragging = (this.__enableScrollX || this.__enableScrollY) && (distanceX >= minimumTrackingForDrag || distanceY >= minimumTrackingForDrag);
            if (this.__isDragging) {
                this.__interruptedAnimation = false;
            }
        }

        this.__lastTouchLeft = currentTouchLeft;
        this.__lastTouchTop = currentTouchTop;
        this.__lastTouchMove = timeStamp;
        this.__lastScale = scale;

    }

    doTouchEnd(timeStamp) {
        if (timeStamp instanceof Date) {
            timeStamp = timeStamp.valueOf();
        }
        if (typeof timeStamp !== "number") {
            throw new Error("Invalid timestamp value: " + timeStamp);
        }

        if (!this.__isTracking) {
            return;
        }

        this.__isTracking = false;

        if (this.__isDragging) {
            this.__isDragging = false;

            if (this.__isSingleTouch && this.options.animating && (timeStamp - this.__lastTouchMove) <= 100) {
                const positions = this.__positions;
                const endPos = positions.length - 1;
                let startPos = endPos;

                // 大概找出100ms前的滚动位置
                for (let i = endPos; i > 0 && positions[i] > (this.__lastTouchMove - 100); i -= 3) {
                    startPos = i;
                }

                // 如果开始和停止的位置相同，则无法计算有效的减速度，所以直接停止滚动
                if (startPos !== endPos) {
                    const timeOffset = positions[endPos] - positions[startPos];
                    const movedLeft = this.__scrollLeft - positions[startPos - 2];
                    const movedTop = this.__scrollTop - positions[startPos - 1];

                    // 基于50ms计算要应用于每个渲染步骤的运动
                    this.__decelerationVelocityX = movedLeft / timeOffset * (1000 / 60);
                    this.__decelerationVelocityY = movedTop / timeOffset * (1000 / 60);

                    // 减速动画初速度
                    const minVelocityToStartDeceleration = this.options.paging || this.options.snapping ? 4 : 1;
                    if (Math.abs(this.__decelerationVelocityX) > minVelocityToStartDeceleration || Math.abs(this.__decelerationVelocityY) > minVelocityToStartDeceleration) {
                        if (!this.__refreshActive) {
                            this.__startDeceleration(timeStamp);
                        }
                    } else {
                        this.options.scrollingComplete();
                    }
                } else {
                    this.options.scrollingComplete();
                }
            } else if ((timeStamp - this.__lastTouchMove) > 100) {
                this.options.scrollingComplete();
            }
        }

        if (!this.__isDecelerating) {
            if (this.__refreshActive && this.__refreshStart) {
                this.__publish(this.__scrollLeft, -this.__refreshHeight, this.__zoomLevel, true);

                if (this.__refreshStart) {
                    this.__refreshStart();
                }
            } else {
                if (this.__interruptedAnimation || this.__isDragging) {
                    this.options.scrollingComplete();
                }
                this.scrollTo(this.__scrollLeft, this.__scrollTop, true, this.__zoomLevel);

                if (this.__refreshActive) {
                    this.__refreshActive = false;
                    if (this.__refreshDeactivate) {
                        this.__refreshDeactivate();
                    }
                }
            }
        }

        this.__positions.length = 0;
    }
}

export default Scroller;
