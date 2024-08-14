start = () => {
    if(canvas.width > canvas.height) _element.style.width = _container.clientHeight + 'px';
    else _element.style.height = _container.clientWidth + 'px';
}
end = () => {
    _element.style.width = _element.style.height = '100%';
}
draw = (view, glLayer) => {
    const viewport = glLayer.getViewport(view);
    gl.viewport(viewport.x + (view.eye == 'left' ? eyeOffset : -eyeOffset), viewport.y, viewport.width, viewport.height);
    if(view.eye == firstEye) {
        const orientation = view.transform.orientation;
        const hprOrigin = Cesium.HeadingPitchRoll.fromQuaternion(new Cesium.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w));
        const hpr = new Cesium.HeadingPitchRoll(hprOrigin.pitch, hprOrigin.roll, hprOrigin.heading);
        camera.setView({
            destination: camera.position,
            orientation: {
                heading: hpr.roll,
                pitch: hpr.pitch - Math.PI / 2,
                roll: 2 * Math.PI
            }
        });
        camera.lookRight(hpr.heading);
    }
    context.draw(context._drawCommand, context._passState);
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

let memory = 2;
if(navigator.userAgent.search('OculusBrowser') != -1) {
    memory = 3;
}
widget.resolutionScale = 1 * memory;
widget.useDefaultRenderLoop = false;

_container.style.align = 'center';
_container.style.background = 'black';
_element.style.margin = 'auto';

initXR(
    'cesiumContainer',
    context._gl,
    () => {
        widget.resize(), widget.render();
    }
);
