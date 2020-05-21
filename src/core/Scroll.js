import Animate from './Animate';

const defaultOptions = {
    /** 允许X轴方向的滚动 */
    scrollingX: true,

    /** 允许Y轴方向的滚动 */
    scrollingY: true,

    /** 允许鼠标滚动，优先级低于zooming，开启缩放后，此设置无效 */
    scrollingW: true,

    /** 开启动画，包括减速动画、缩放动画、回弹动画等等 */
    animating: true,

    /** 动画时长，单位：ms */
    animationDuration: 250,

    /** 允许回弹 */
    bouncing: true,

    /** X轴最大回弹值，<=0则无限制，单位：px */
    bouncingX: 0,

    /** Y轴最大回弹值，<=0则无限制，单位：px */
    bouncingY: 0,

    /** 滚动锁定，即只允许在主轴滚动，适用于移动端 */
    locking: true,

    /** 开启分页模式 */
    paging: false,

    /** 开启网格滚动模式 */
    snapping: false,

    /** 允许缩放，包括手指缩放或是鼠标滚轮缩放，此设置开启时，鼠标滚轮操作为缩放而不是滚动 */
    zooming: false,

    /** 最小缩放倍数，仅在允许缩放时可用 */
    minZoom: 0.5,

    /** 最大缩放倍数，仅在允许缩放时可用 */
    maxZoom: 3,

    /** 滚动速度 **/
    speedMultiplier: 1,

    /** 到达边界时应用于减速的变化量 **/
    penetrationDeceleration: 0.03,

    /** 到达边界时应用于加速的变化量 **/
    penetrationAcceleration: 0.08,

    /** 在触摸或是缩放时触发的回调 */
    onChange: v => v,

    /** 在触摸或减速结束时触发的回调，前提是尚未开始其他滚动操作，主要用于通知滚动条淡出 */
    onScrollingComplete: v => v
};

class Scroll {
    /** {Boolean} 是否单指触摸 */
    __isSingleTouch = false;

    /** {Boolean} 是否正在触摸状态 */
    __isTracking = false;

    /** {Boolean} 减速动画是否完成 */
    __didDecelerationComplete = false;

    /**
     * {Boolean} 是否在手势缩放、旋转中，优先级比拖动更高
     */
    __isGesturing = false;

    /**
     * {Boolean} 是否正在拖动状态
     */
    __isDragging = false;

    /**
     * {Boolean} 不在触摸或是拖动，并在减速中
     */
    __isDecelerating = false;

    /**
     * {Boolean} 是否在动画中
     */
    __isAnimating = false;

    /** {Integer} Available outer left position (from document perspective) */
    __clientLeft = 0;

    /** {Integer} Available outer top position (from document perspective) */
    __clientTop = 0;

    /** {Integer} Available outer width */
    __clientWidth = 0;

    /** {Integer} Available outer height */
    __clientHeight = 0;

    /** {Integer} Outer width of content */
    __contentWidth = 0;

    /** {Integer} Outer height of content */
    __contentHeight = 0;

    /** {Integer} Snapping width for content */
    __snapWidth = 100;

    /** {Integer} Snapping height for content */
    __snapHeight = 100;

    /** {Integer} Height to assign to refresh area */
    __refreshHeight = null;

    /** {Boolean} Whether the refresh process is enabled when the event is released now */
    __refreshActive = false;

    /** {Function} Callback to execute on activation. This is for signalling the user about a refresh is about to happen when he release */
    __refreshActivate = null;

    /** {Function} Callback to execute on deactivation. This is for signalling the user about the refresh being cancelled */
    __refreshDeactivate = null;

    /** {Function} Callback to execute to start the actual refresh. Call {@link #refreshFinish} when done */
    __refreshStart = null;

    /** {Number} Zoom level */
    __zoomLevel = 1;

    /** {Number} Scroll position on x-axis */
    __scrollLeft = 0;

    /** {Number} Scroll position on y-axis */
    __scrollTop = 0;

    /** {Integer} Maximum allowed scroll position on x-axis */
    __maxScrollLeft = 0;

    /** {Integer} Maximum allowed scroll position on y-axis */
    __maxScrollTop = 0;

    /* {Number} Scheduled left position (final position when animating) */
    __scheduledLeft = 0;

    /* {Number} Scheduled top position (final position when animating) */
    __scheduledTop = 0;

    /* {Number} Scheduled zoom level (final scale when animating) */
    __scheduledZoom = 0;

    /** {Number} Left position of finger at start */
    __lastTouchLeft = null;

    /** {Number} Top position of finger at start */
    __lastTouchTop = null;

    /** {Date} Timestamp of last move of finger. Used to limit tracking range for deceleration speed. */
    __lastTouchMove = null;

    /** {Array} List of positions, uses three indexes for each state: left, top, timestamp */
    __positions = null;

    /** {Integer} Minimum left scroll position during deceleration */
    __minDecelerationScrollLeft = null;

    /** {Integer} Minimum top scroll position during deceleration */
    __minDecelerationScrollTop = null;

    /** {Integer} Maximum left scroll position during deceleration */
    __maxDecelerationScrollLeft = null;

    /** {Integer} Maximum top scroll position during deceleration */
    __maxDecelerationScrollTop = null;

    /** {Number} Current factor to modify horizontal scroll position with on every step */
    __decelerationVelocityX = null;

    /** {Number} Current factor to modify vertical scroll position with on every step */
    __decelerationVelocityY = null;

    constructor(options) {
        this.options = Object.assign({}, defaultOptions, options);
        this.animate = new Animate();
    }

    /**
     * Applies the scroll position to the content element
     *
     * @param left {Number} Left scroll position
     * @param top {Number} Top scroll position
     * @param zoom {Number} zoom level
     * @param animate {Boolean?false} Whether animation should be used to move to the new coordinates
     */
    __publish(left, top, zoom, animate) {
        const self = this;
        const wasAnimating = this.__isAnimating;
        if (wasAnimating) {
            this.animate.stop(wasAnimating);
            this.__isAnimating = false;
        }

        if (animate && this.options.animating) {
            this.__scheduledLeft = left;
            this.__scheduledTop = top;
            this.__scheduledZoom = zoom;

            const oldLeft = this.__scrollLeft;
            const oldTop = this.__scrollTop;
            const oldZoom = this.__zoomLevel;

            const diffLeft = left - oldLeft;
            const diffTop = top - oldTop;
            const diffZoom = zoom - oldZoom;

            const step = function (percent, now, render) {
                if (render) {
                    self.__scrollLeft = oldLeft + (diffLeft * percent);
                    self.__scrollTop = oldTop + (diffTop * percent);
                    self.__zoomLevel = oldZoom + (diffZoom * percent);

                    // Push values out
                    self.__change(self.__scrollLeft, self.__scrollTop, self.__zoomLevel);
                }
            };

            const verify = function (id) {
                return self.__isAnimating === id;
            };

            const completed = function (renderedFramesPerSecond, animationId, wasFinished) {
                if (animationId === self.__isAnimating) {
                    self.__isAnimating = false;
                }
                if (self.__didDecelerationComplete || wasFinished) {
                    self.options.onScrollingComplete();
                }

                if (self.options.zooming) {
                    self.__computeScrollMax();
                    if (self.__zoomComplete) {
                        self.__zoomComplete();
                        self.__zoomComplete = null;
                    }
                }
            };

            this.__isAnimating = this.animate.start(step, verify, completed, this.options.animationDuration, wasAnimating ? this.easeOutCubic : this.easeInOutCubic);
        } else {
            this.__scheduledLeft = this.__scrollLeft = left;
            this.__scheduledTop = this.__scrollTop = top;
            this.__scheduledZoom = this.__zoomLevel = zoom;

            self.__change(left, top, zoom);

            if (this.options.zooming) {
                this.__computeScrollMax();
                if (this.__zoomComplete) {
                    this.__zoomComplete();
                    this.__zoomComplete = null;
                }
            }
        }
    }

    __change(left, top, zoom) {
        const { onChange } = this.options;
        if (typeof onChange === 'function') {
            let _left = left;
            let _top = top;
            if (this.options.bouncingX > 0 && this.__contentWidth > this.__clientWidth) {
                _left = _left < 0
                    ? Math.max(_left, -this.options.bouncingX)
                    : Math.min(_left, this.__contentWidth - this.__clientWidth + this.options.bouncingX);
            }
            if (this.options.bouncingY > 0 && this.__contentHeight > this.__clientHeight) {
                _top = _top < 0
                    ? Math.max(_top, -this.options.bouncingY)
                    : Math.min(_top, this.__contentHeight - this.__clientHeight + this.options.bouncingY);
            }
            onChange(_left, _top, zoom);
        }
    }

    /**
     * Recomputes scroll minimum values based on client dimensions and content dimensions.
     */
    __computeScrollMax(zoomLevel) {
        if (zoomLevel == null) {
            zoomLevel = this.__zoomLevel;
        }

        this.__maxScrollLeft = Math.max((this.__contentWidth * zoomLevel) - this.__clientWidth, 0);
        this.__maxScrollTop = Math.max((this.__contentHeight * zoomLevel) - this.__clientHeight, 0);
    }

    /**
     * Called when a touch sequence end and the speed of the finger was high enough
     * to switch into deceleration mode.
     */
    __startDeceleration(timeStamp) {
        const self = this;

        if (this.options.paging) {
            const scrollLeft = Math.max(Math.min(this.__scrollLeft, this.__maxScrollLeft), 0);
            const scrollTop = Math.max(Math.min(this.__scrollTop, this.__maxScrollTop), 0);
            const clientWidth = this.__clientWidth;
            const clientHeight = this.__clientHeight;

            // We limit deceleration not to the min/max values of the allowed range, but to the size of the visible client area.
            // Each page should have exactly the size of the client area.
            this.__minDecelerationScrollLeft = Math.floor(scrollLeft / clientWidth) * clientWidth;
            this.__minDecelerationScrollTop = Math.floor(scrollTop / clientHeight) * clientHeight;
            this.__maxDecelerationScrollLeft = Math.ceil(scrollLeft / clientWidth) * clientWidth;
            this.__maxDecelerationScrollTop = Math.ceil(scrollTop / clientHeight) * clientHeight;
        } else {
            this.__minDecelerationScrollLeft = 0;
            this.__minDecelerationScrollTop = 0;
            this.__maxDecelerationScrollLeft = this.__maxScrollLeft;
            this.__maxDecelerationScrollTop = this.__maxScrollTop;
        }

        const step = function (percent, now, render) {
            self.__stepThroughDeceleration(render);
        };

        const minVelocityToKeepDecelerating = this.options.snapping ? 4 : 0.001;

        // Detect whether it's still worth to continue animating steps
        // If we are already slow enough to not being user perceivable anymore, we stop the whole process here.
        const verify = function () {
            const shouldContinue = Math.abs(self.__decelerationVelocityX) >= minVelocityToKeepDecelerating || Math.abs(self.__decelerationVelocityY) >= minVelocityToKeepDecelerating;
            if (!shouldContinue) {
                self.__didDecelerationComplete = true;
            }
            return shouldContinue;
        };
        const completed = function (renderedFramesPerSecond, animationId, wasFinished) {
            self.__isDecelerating = false;
            if (self.__didDecelerationComplete) {
                self.options.onScrollingComplete();
            }
            self.scrollTo(self.__scrollLeft, self.__scrollTop, self.options.snapping);
        };

        // Start animation and switch on flag
        this.__isDecelerating = this.animate.start(step, verify, completed);
    }

    /**
     * Called on every step of the animation
     *
     * @param inMemory {Boolean?false} Whether to not render the current step, but keep it in memory only. Used internally only!
     */
    __stepThroughDeceleration(inMemory) {
        let scrollLeft = this.__scrollLeft + this.__decelerationVelocityX;
        let scrollTop = this.__scrollTop + this.__decelerationVelocityY;

        if (!this.options.bouncing) {
            const scrollLeftFixed = Math.max(Math.min(this.__maxDecelerationScrollLeft, scrollLeft), this.__minDecelerationScrollLeft);
            if (scrollLeftFixed !== scrollLeft) {
                scrollLeft = scrollLeftFixed;
                this.__decelerationVelocityX = 0;
            }

            const scrollTopFixed = Math.max(Math.min(this.__maxDecelerationScrollTop, scrollTop), this.__minDecelerationScrollTop);
            if (scrollTopFixed !== scrollTop) {
                scrollTop = scrollTopFixed;
                this.__decelerationVelocityY = 0;
            }
        }

        if (inMemory) {
            this.__publish(scrollLeft, scrollTop, this.__zoomLevel);
        } else {
            this.__scrollLeft = scrollLeft;
            this.__scrollTop = scrollTop;
        }

        if (!this.options.paging) {
            const frictionFactor = 0.95;
            this.__decelerationVelocityX *= frictionFactor;
            this.__decelerationVelocityY *= frictionFactor;
        }

        if (this.options.bouncing) {
            let scrollOutsideX = 0;
            let scrollOutsideY = 0;

            const penetrationDeceleration = this.options.penetrationDeceleration;
            const penetrationAcceleration = this.options.penetrationAcceleration;

            if (scrollLeft < this.__minDecelerationScrollLeft) {
                scrollOutsideX = this.__minDecelerationScrollLeft - scrollLeft;
            } else if (scrollLeft > this.__maxDecelerationScrollLeft) {
                scrollOutsideX = this.__maxDecelerationScrollLeft - scrollLeft;
            }

            if (scrollTop < this.__minDecelerationScrollTop) {
                scrollOutsideY = this.__minDecelerationScrollTop - scrollTop;
            } else if (scrollTop > this.__maxDecelerationScrollTop) {
                scrollOutsideY = this.__maxDecelerationScrollTop - scrollTop;
            }

            if (scrollOutsideX !== 0) {
                if (scrollOutsideX * this.__decelerationVelocityX <= 0) {
                    this.__decelerationVelocityX += scrollOutsideX * penetrationDeceleration;
                } else {
                    this.__decelerationVelocityX = scrollOutsideX * penetrationAcceleration;
                }
            }

            if (scrollOutsideY !== 0) {
                if (scrollOutsideY * this.__decelerationVelocityY <= 0) {
                    this.__decelerationVelocityY += scrollOutsideY * penetrationDeceleration;
                } else {
                    this.__decelerationVelocityY = scrollOutsideY * penetrationAcceleration;
                }
            }
        }
    }


    /**
     * Configures the dimensions of the client (outer) and content (inner) elements.
     * Requires the available space for the outer element and the outer size of the inner element.
     * All values which are falsy (null or zero etc.) are ignored and the old value is kept.
     *
     * @param clientWidth {Number ? null} Inner width of outer element
     * @param clientHeight {Number ? null} Inner height of outer element
     * @param contentWidth {Number ? null} Outer width of inner element
     * @param contentHeight {Number ? null} Outer height of inner element
     */
    setDimensions(clientWidth, clientHeight, contentWidth, contentHeight) {
        if (clientWidth === +clientWidth) {
            this.__clientWidth = clientWidth;
        }

        if (clientHeight === +clientHeight) {
            this.__clientHeight = clientHeight;
        }

        if (contentWidth === +contentWidth) {
            this.__contentWidth = contentWidth;
        }

        if (contentHeight === +contentHeight) {
            this.__contentHeight = contentHeight;
        }

        this.__computeScrollMax();
        this.scrollTo(this.__scrollLeft, this.__scrollTop, true);
    }

    /**
     * Sets the client coordinates in relation to the document.
     *
     * @param left {Number ? 0} Left position of outer element
     * @param top {Number ? 0} Top position of outer element
     */
    setPosition(left, top) {
        this.__clientLeft = left || 0;
        this.__clientTop = top || 0;
    }

    /**
     * Configures the snapping (when snapping is active)
     *
     * @param width {Number} Snapping width
     * @param height {Number} Snapping height
     */
    setSnapSize(width, height) {
        this.__snapWidth = width;
        this.__snapHeight = height;
    }

    /**
     * Activates pull-to-refresh. A special zone on the top of the list to start a list refresh whenever
     * the user event is released during visibility of this zone. This was introduced by some apps on iOS like
     * the official Twitter client.
     *
     * @param height {Number} Height of pull-to-refresh zone on top of rendered list
     * @param activateCallback {Function} Callback to execute on activation. This is for signalling the user about a refresh is about to happen when he release.
     * @param deactivateCallback {Function} Callback to execute on deactivation. This is for signalling the user about the refresh being cancelled.
     * @param startCallback {Function} Callback to execute to start the real async refresh action. Call {@link #finishPullToRefresh} after finish of refresh.
     */
    activatePullToRefresh(height, activateCallback, deactivateCallback, startCallback) {
        this.__refreshHeight = height;
        this.__refreshActivate = activateCallback;
        this.__refreshDeactivate = deactivateCallback;
        this.__refreshStart = startCallback;
    }

    /**
     * Starts pull-to-refresh manually.
     */
    triggerPullToRefresh() {
        // Use publish instead of scrollTo to allow scrolling to out of boundary position
        // We don't need to normalize scrollLeft, zoomLevel, etc. here because we only y-scrolling when pull-to-refresh is enabled
        this.__publish(this.__scrollLeft, -this.__refreshHeight, this.__zoomLevel, true);

        if (this.__refreshStart) {
            this.__refreshStart();
        }
    }

    /**
     * Signalizes that pull-to-refresh is finished.
     */
    finishPullToRefresh() {
        this.__refreshActive = false;
        if (this.__refreshDeactivate) {
            this.__refreshDeactivate();
        }
        this.scrollTo(this.__scrollLeft, this.__scrollTop, true);
    }

    /**
     * Returns the scroll position and zooming values
     *
     * @return {Map} `left` and `top` scroll position and `zoom` level
     */
    getValues() {
        return {
            left: this.__scrollLeft,
            top: this.__scrollTop,
            zoom: this.__zoomLevel
        };
    }

    /**
     * Returns the maximum scroll values
     *
     * @return {Map} `left` and `top` maximum scroll values
     */
    getScrollMax() {
        return {
            left: this.__maxScrollLeft,
            top: this.__maxScrollTop
        };
    }

    /**
     * Zooms to the given level. Supports optional animation. Zooms
     * the center when no coordinates are given.
     *
     * @param level {Number} Level to zoom to
     * @param animate {Boolean ? false} Whether to use animation
     * @param originLeft {Number ? null} Zoom in at given left coordinate
     * @param originTop {Number ? null} Zoom in at given top coordinate
     * @param callback {Function ? null} A callback that gets fired when the zoom is complete.
     */
    zoomTo(level, animate, originLeft, originTop, callback) {
        if (!this.options.zooming) {
            throw new Error('Zooming is not enabled!');
        }

        if (callback) {
            this.__zoomComplete = callback;
        }

        if (this.__isDecelerating) {
            this.animate.stop(this.__isDecelerating);
            this.__isDecelerating = false;
        }

        let oldLevel = this.__zoomLevel;

        if (originLeft == null) {
            originLeft = this.__clientWidth / 2;
        }

        if (originTop == null) {
            originTop = this.__clientHeight / 2;
        }

        level = Math.max(Math.min(level, this.options.maxZoom), this.options.minZoom);
        this.__computeScrollMax(level);

        // Recompute left and top coordinates based on new zoom level
        let left = ((originLeft + this.__scrollLeft) * level / oldLevel) - originLeft;
        let top = ((originTop + this.__scrollTop) * level / oldLevel) - originTop;

        if (left > this.__maxScrollLeft) {
            left = this.__maxScrollLeft;
        } else if (left < 0) {
            left = 0;
        }

        if (top > this.__maxScrollTop) {
            top = this.__maxScrollTop;
        } else if (top < 0) {
            top = 0;
        }

        this.__publish(left, top, level, animate);
    }

    /**
     * Zooms the content by the given factor.
     *
     * @param factor {Number} Zoom by given factor
     * @param animate {Boolean ? false} Whether to use animation
     * @param originLeft {Number ? 0} Zoom in at given left coordinate
     * @param originTop {Number ? 0} Zoom in at given top coordinate
     * @param callback {Function ? null} A callback that gets fired when the zoom is complete.
     */
    zoomBy(factor, animate, originLeft, originTop, callback) {
        this.zoomTo(this.__zoomLevel * factor, animate, originLeft, originTop, callback);
    }


    /**
     * Scrolls to the given position. Respect limitations and snapping automatically.
     *
     * @param left {Number?null} Horizontal scroll position, keeps current if value is <code>null</code>
     * @param top {Number?null} Vertical scroll position, keeps current if value is <code>null</code>
     * @param animate {Boolean?false} Whether the scrolling should happen using an animation
     * @param zoom {Number?null} Zoom level to go to
     */
    scrollTo(left, top, animate, zoom) {
        if (this.__isDecelerating) {
            this.animate.stop(this.__isDecelerating);
            this.__isDecelerating = false;
        }

        // Correct coordinates based on new zoom level
        if (zoom != null && zoom !== this.__zoomLevel) {
            if (!this.options.zooming) {
                throw new Error('Zooming is not enabled!');
            }
            left *= zoom;
            top *= zoom;

            // Recompute maximum values while temporary tweaking maximum scroll ranges
            this.__computeScrollMax(zoom);
        } else {
            zoom = this.__zoomLevel;
        }

        if (!this.options.scrollingX) {
            left = this.__scrollLeft;
        } else {
            if (this.options.paging) {
                left = Math.round(left / this.__clientWidth) * this.__clientWidth;
            } else if (this.options.snapping) {
                left = Math.round(left / this.__snapWidth) * this.__snapWidth;
            }
        }

        if (!this.options.scrollingY) {
            top = this.__scrollTop;
        } else {
            if (this.options.paging) {
                top = Math.round(top / this.__clientHeight) * this.__clientHeight;
            } else if (this.options.snapping) {
                top = Math.round(top / this.__snapHeight) * this.__snapHeight;
            }
        }

        // Limit for allowed ranges
        left = Math.max(Math.min(this.__maxScrollLeft, left), 0);
        top = Math.max(Math.min(this.__maxScrollTop, top), 0);

        // Don't animate when no change detected, still call publish to make sure
        // that rendered position is really in-sync with internal data
        if (left === this.__scrollLeft && top === this.__scrollTop) {
            animate = false;
        }

        if (!this.__isTracking) {
            this.__publish(left, top, zoom, animate);
        }
    }

    /**
     * Scroll by the given offset
     *
     * @param left {Number ? 0} Scroll x-axis by given offset
     * @param top {Number ? 0} Scroll x-axis by given offset
     * @param animate {Boolean ? false} Whether to animate the given change
     */
    scrollBy(left, top, animate) {
        const startLeft = this.__isAnimating ? this.__scheduledLeft : this.__scrollLeft;
        const startTop = this.__isAnimating ? this.__scheduledTop : this.__scrollTop;

        this.scrollTo(startLeft + (left || 0), startTop + (top || 0), animate);
    }

    easeOutCubic(pos) {
        return (Math.pow((pos - 1), 3) + 1);
    }

    easeInOutCubic(pos) {
        if ((pos /= 0.5) < 1) {
            return 0.5 * Math.pow(pos, 3);
        }

        return 0.5 * (Math.pow((pos - 2), 3) + 2);
    }
}

export default Scroll;
