start = () => {
    if(canvas.width > canvas.height) _element.style.width = _container.clientHeight + 'px';
    else _element.style.height = _container.clientWidth + 'px';
    if(resetOnStarted) onStarted();
    setHPR();
}
end = () => {
    _element.style.width = _element.style.height = '100%';
    if(resetOnEnded) onEnded();
}
draw = (view, glLayer) => {
    const viewport = glLayer.getViewport(view);
    gl.viewport(viewport.x + (view.eye == 'left' ? eyeOffset : -eyeOffset), viewport.y, viewport.width, viewport.height);
    if(view.eye == firstEye && !onFly) {
        if(onDrag) setHPR();
        else {
            const orientation = view.transform.orientation;
            const hprOrigin = Cesium.HeadingPitchRoll.fromQuaternion(new Cesium.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w));
            const hpr = new Cesium.HeadingPitchRoll(hprOrigin.pitch, hprOrigin.roll, hprOrigin.heading);
            const position = camera.position;
            if(tilt) {
                if(onRotate) {
                    setHPR();
                    hprHeadset.heading = hpr.heading;
                    hprHeadset.pitch = hpr.pitch;
                    hprHeadset.roll = hpr.roll;
                    setView(position, camera.heading, camera.pitch, camera.roll);
                    onRotate = false;
                } else setView(position, getHPR(hpr, 'heading'), getHPR(hpr, 'pitch'), getHPR(hpr, 'roll'));
            } else {
                setView(position, hpr.roll, hpr.pitch - Math.PI / 2, 2 * Math.PI);
                camera.lookRight(hpr.heading);
            }
        }
    }
    context.draw(context._drawCommand, context._passState);
}
runGamepad = (gamepad, hand, pose) => {
    if(!onFly) {
        if(gamepad.buttons.length > 5) {
            if(gamepad.buttons[4].pressed) switchTilt();
            if(gamepad.buttons[5].pressed) resetView();
        }
        if(gamepad.axes.length > 3) {
            const h = camera.positionCartographic.height * 0.5;
            if(tilt) {
                if(hand == 'left') camera.moveUp(calculateAmount(gamepad.axes[3] * speed * (h / 100)));
                if(hand == 'right') {
                    camera.moveBackward(calculateAmount(gamepad.axes[3] * speed * (h / 50)));
                    const rotate = gamepad.axes[2] * speed / 200;
                    camera.lookRight(rotate);
                    hprCamera.heading = hprCamera.heading + rotate;
                }
            } else {
                if(hand == 'right') {
                    camera.rotateUp(gamepad.axes[3] * speed * (h / 1e9));
                    camera.rotateRight(gamepad.axes[2] * speed * (h / 1e9));
                }
                if(hand == 'left') camera.zoomIn(-gamepad.axes[3] * speed * (h / 50));
            }
            if(camera.positionCartographic.height < 0) setHeight(0.1 + camera.positionCartographic.height), onRotate = true;
            if(camera.positionCartographic.height > 75000000) setHeight(75000000);
        }
    }
}

function setView(destination, heading, pitch, roll) {
    camera.setView({
        destination,
        orientation: {
            heading,
            pitch,
            roll
        }
    });
}

function getHPR(hpr, att) {
    return hprCamera[att] + hpr[att] - hprHeadset[att];
}

function setHPR() {
    hprCamera.heading = camera.heading;
    hprCamera.pitch = camera.pitch;
    hprCamera.roll = camera.roll;
}

function switchTilt() {
    if(!onFly) {
        onFly = true;
        if(tilt) {
            let rotateHeading = true;
            let rotatePitch = true;
            let rotateRoll = true;
            const interval = setInterval(() => {
                let addHeading = camera.heading;
                let addPitch = camera.pitch;
                let addRoll = camera.roll;
                if(rotateHeading) {
                    const statHeading = camera.heading > Math.PI;
                    addHeading = statHeading ? camera.heading + (speed * 0.01) : camera.heading - (speed * 0.01);
                    if((statHeading && addHeading > 2 * Math.PI) || (!statHeading && addHeading < 0) || addHeading == 0 || addHeading == 2 * Math.PI) addHeading = 2 * Math.PI, rotateHeading = false;
                }
                if(rotateRoll) {
                    const statRoll = camera.roll > Math.PI;
                    addRoll = statRoll ? camera.roll + (speed * 0.01) : camera.roll - (speed * 0.01);
                    if((statRoll && addRoll > 2 * Math.PI) || (!statRoll && addRoll < 0) || addRoll == 0 || addRoll == 2 * Math.PI) addRoll = 0, rotateRoll = false;
                }
                if(rotatePitch) {
                    const pitchStat = (camera.pitch > 0 && camera.pitch < Math.PI / 2) || (camera.pitch < 0 && camera.pitch > -Math.PI / 2) || camera.pitch == 0;
                    addPitch = pitchStat ? camera.pitch - (speed * 0.01) : camera.pitch + (speed * 0.01);
                    if((pitchStat && addPitch < -Math.PI / 2) || (!pitchStat && addPitch > -Math.PI / 2) || addPitch == -Math.PI / 2) addPitch = -Math.PI / 2, rotatePitch = false;
                }
                if(!rotateHeading && !rotatePitch && !rotateRoll) {
                    setView(camera.position, 2 * Math.PI, -Math.PI / 2, 0);
                    tilt = false;
                    stopFly(interval);
                } else setView(camera.position, addHeading, addPitch, addRoll);
            }, 20);
        } else if(camera.positionCartographic.height < maxTilt) {
            let count = 0;
            setView(camera.position, 2 * Math.PI, -Math.PI / 2, 0);
            const interval = setInterval(() => {
                count++;
                setView(camera.position, 2 * Math.PI, speed * count / 100 - Math.PI / 2, 0);
                if(camera.pitch > 0) {
                    setView(camera.position, 2 * Math.PI, 0, 0);
                    tilt = true;
                    stopFly(interval);
                }
            }, 20);
        } else onFly = false;
    }
}

function stopFly(interval) {
    onFly = false;
    onRotate = true;
    clearInterval(interval);
}

function calculateAmount(amount) {
    if(Math.sign(amount) > 0) amount += 0.5;
    if(Math.sign(amount) < 0) amount -= 0.5;
    return amount;
}

function setHeight(h) {
    const carto = camera.positionCartographic;
    carto.height = h;
    setView(Cesium.Cartographic.toCartesian(carto, ellipsoid), camera.heading, camera.pitch, camera.roll);
}

Cesium.DrawCommand.prototype.execute = function(ctx, passState) {
    ctx._drawCommand = this, ctx._passState = passState;
    ctx.draw(this, passState);
};
Cesium.Context.prototype.clear = function(clearCommand, passState) {
    clearCommand = Cesium.defaultValue(clearCommand, Cesium.defaultClearCommand);
    passState = Cesium.defaultValue(passState, this._defaultPassState);
    let bitmask = 0;
    const c = clearCommand.color;
    const d = clearCommand.depth;
    const s = clearCommand.stencil;
    if(Cesium.defined(c)) {
        if(!Cesium.Color.equals(this._clearColor, c)) {
            Cesium.Color.clone(c, this._clearColor);
            gl.clearColor(c.red, c.green, c.blue, c.alpha);
        }
        bitmask |= gl.COLOR_BUFFER_BIT;
    }
    if(Cesium.defined(d)) {
        if(d !== this._clearDepth) {
            this._clearDepth = d;
            gl.clearDepth(d);
        }
        bitmask |= gl.DEPTH_BUFFER_BIT;
    }
    if(Cesium.defined(s)) {
        if(s !== this._clearStencil) {
            this._clearStencil = s;
            gl.clearStencil(s);
        }
        bitmask |= gl.STENCIL_BUFFER_BIT;
    }
    const rs = Cesium.defaultValue(clearCommand.renderState, this._defaultRenderState);
    const previousRenderState = this._currentRenderState;
    const previousPassState = this._currentPassState;
    this._currentRenderState = rs;
    this._currentPassState = passState;
    Cesium.RenderState.partialApply(gl, previousRenderState, rs, previousPassState, passState, true);
    const framebuffer = Cesium.defaultValue(clearCommand.framebuffer, passState.framebuffer);
    if(framebuffer !== this._currentFramebuffer) {
        this._currentFramebuffer = framebuffer;
        let buffers = Cesium.scratchBackBufferArray;
        if(Cesium.defined(framebuffer)) {
            framebuffer._bind();
            buffers = framebuffer._getActiveColorAttachments();
        } else if(!xrSession) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if(this.drawBuffers && buffers && !xrSession) this.glDrawBuffers(buffers);
    }
    if(!xrSession) gl.clear(bitmask);
    else if(bitmask != 17408) gl.clear(bitmask); // 256,1024,16384,17408
};

const widget = new Cesium.CesiumWidget('cesiumContainer', {
    contextOptions: {
        webgl: {
            xrCompatible: true
        }
    }
});

const _container = widget.container;
const _element = widget._element;
const _scene = widget.scene;
const canvas = _scene.canvas;
const context = _scene.context;
const camera = widget.camera;
const handler = widget.screenSpaceEventHandler;
const globe = _scene.globe;
const ellipsoid = globe.ellipsoid;

let memory = 2;
let speed = 1;
if(navigator.userAgent.search('OculusBrowser') != -1) {
    memory = 3;
    speed = 2;
}
widget.resolutionScale = 1 * memory;
widget.useDefaultRenderLoop = false;

_container.style.align = 'center';
_container.style.background = 'black';
_element.style.margin = 'auto';

let onDrag = false;
let tilt = false;
let onRotate = false;
let onFly = false;

const maxTilt = 15000; // everest / highest level
const longitude = 118;
const latitude = -2;
const height = 25000000;
const resetOnStarted = true;
const resetOnEnded = false;

let hprHeadset = {
    heading: 0,
    pitch: 0,
    roll: 0
};
let hprCamera = {
    heading: 0,
    pitch: 0,
    roll: 0
};

handler.setInputAction(() => {
    onDrag = true;
    tilt = true;
    onRotate = true;
}, Cesium.ScreenSpaceEventType.LEFT_DOWN, Cesium.KeyboardEventModifier.CTRL);
handler.setInputAction(() => {
    onDrag = true;
    tilt = true;
    onRotate = true;
}, Cesium.ScreenSpaceEventType.RIGHT_DOWN, Cesium.KeyboardEventModifier.CTRL);
handler.setInputAction(() => {
    onDrag = true;
    tilt = true;
    onRotate = true;
}, Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
handler.setInputAction(() => {
    onDrag = false;
}, Cesium.ScreenSpaceEventType.LEFT_UP);
handler.setInputAction(() => {
    onDrag = false;
}, Cesium.ScreenSpaceEventType.RIGHT_UP);
handler.setInputAction(() => {
    onDrag = false;
}, Cesium.ScreenSpaceEventType.MIDDLE_UP);
document.addEventListener('keyup', e => {
    if(e.keyCode == 17) onDrag = false;
});
document.addEventListener('keydown', e => {
    if(e.keyCode == 16) switchTilt();
});

let resetView = () => {
    onFly = true;
    onRotate = true;
    tilt = false;
    camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: {
            heading: 2 * Math.PI,
            pitch: -Math.PI / 2,
            roll: 0
        },
        complete: () => onFly = false
    });
}
let onStarted = resetView;
let onEnded = resetView;

initXR(
    'cesiumContainer',
    context._gl,
    () => {
        widget.resize(), widget.render();
    }
);

setView(Cesium.Cartesian3.fromDegrees(longitude, latitude, height), 2 * Math.PI, -Math.PI / 2, 0);
createButton('Reset View').onclick = () => resetView();
