# @bfunjs/scroller

```javascript
import Scroller from "@bfunjs/scroller";

const wrapper = document.getElementById('scroller');
const container = document.getElementById('container');

const myScroller = new Scroller({
    scrollingY: false,
    handler: function (left, top) {
        console.log(left, top);
        container.style.left = `${-left}px`
    }
});

wrapper.addEventListener("touchstart", function (e) {
    if (e.touches[0] && e.touches[0].target && e.touches[0].target.tagName.match(/input|textarea|select/i)) {
        return;
    }
    myScroller.doTouchStart(e.touches, e.timeStamp);
}, false);

wrapper.addEventListener("touchmove", function (e) {
    e.preventDefault();
    myScroller.doTouchMove(e.touches, e.timeStamp, e.scale);
}, false);

wrapper.addEventListener("touchend", function (e) {
    myScroller.doTouchEnd(e.timeStamp);
}, false);

wrapper.addEventListener("touchcancel", function (e) {
    myScroller.doTouchEnd(e.timeStamp);
}, false);
```
