let container, gl, program, refSpace, xrSession, buttons, xrButton, renderGL, firstEye,
    eyeOffset = 0,
    vshader = '',
    fshader = '',
    start = () => {},
    end = () => {},
    draw = () => {},
    drawStart = () => {},
    drawEnd = () => {},
    init = () => {},
    runGamepad = () => {},
    onInputChange = () => {};

function initXR(_container, _gl, _renderGL) {
    container = _container ? document.getElementById(_container) : createContainer();
    gl = _gl ? _gl : createGL();
    if(!gl) initXR(_container, _gl, _renderGL);
    init();
    if(!_gl) processGL();
    createXRBtn();
    createFullscreenBtn();
    renderGL = _renderGL ? _renderGL : () => {
        if(checkSession()) return cancelAnimationFrame(renderGL);
        requestAnimationFrame(renderGL);
        draw();
    };
    requestAnimationFrame(render);
    if(navigator.xr) navigator.xr.isSessionSupported('immersive-vr')
        .then(supported => xrButton.textContent = 'Enter VR', xrButton.disabled = false, xrButton.onclick = onClick)
        .catch(() => xrButton.textContent = 'Session not Supported');
    else xrButton.textContent = 'Browser not supported';
}

function createContainer() {
    const c = document.createElement('div');
    c.style.cssText = 'position:absolute;top:0;left:0;height:100%;width:100%;';
    document.body.appendChild(c);
    return c;
}

function createGL() {
    const canvas = document.createElement('canvas');
    canvas.innerHTML = 'canvas not available';
    canvas.setAttribute('style', 'height:100%;width:100%;display:block;');
    container.appendChild(canvas);
    canvas.addEventListener('webglcontextlost', e => e.preventDefault());
    canvas.addEventListener("webglcontextrestored", () => console.log('webglcontextrestored'));
    return canvas.getContext('webgl', {
        xrCompatible: true
    });
}

function processGL() {
    const shaderv = gl.createShader(gl.VERTEX_SHADER);
    if(!vshader) vshader = 'void main(){}';
    if(!fshader) fshader = 'void main(){}';
    gl.shaderSource(shaderv, vshader);
    gl.compileShader(shaderv);
    const shaderf = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(shaderf, fshader);
    gl.compileShader(shaderf);
    program = gl.createProgram();
    gl.attachShader(program, shaderv);
    gl.attachShader(program, shaderf);
    gl.linkProgram(program);
    gl.enable(gl.DEPTH_TEST);
    if(gl.getProgramParameter(program, gl.LINK_STATUS)) gl.useProgram(program);
    else console.log(gl.getProgramInfoLog(program));
    end = () => {
        const c = gl.canvas;
        if(c.width !== c.clientWidth || c.height !== c.clientHeight) c.width = container.clientWidth, c.height = container.clientHeight;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, c.width, c.height);
    };
    new ResizeObserver(end).observe(document.body);
}

function createXRBtn() {
    buttons = document.createElement('div');
    buttons.style.cssText = 'position:absolute;bottom:0;right:0;padding:2px;';
    container.appendChild(buttons);
    xrButton = createButton('Loading...');
    xrButton.disabled = true;
}

function createFullscreenBtn() {
    let fstatus = false;
    createButton('Fullscreen').onclick = () => {
        if(fstatus && document.exitFullscreen) document.exitFullscreen();
        else if(container.requestFullscreen) container.requestFullscreen();
        fstatus = !fstatus;
    };
}

function createButton(txt) {
    const btn = document.createElement('button');
    btn.innerHTML = txt;
    btn.style.cssText = 'cursor:pointer;user-select:none;font-weight:bold;padding:6px 8px;margin:0;outline:none;border:1px solid #000;background:#fff;';
    btn.onmouseover = () => {
        btn.style.background = '#ddd';
    };
    btn.onmouseleave = () => {
        btn.style.background = '#fff';
    };
    buttons.appendChild(btn);
    return btn;
}

function checkSession() {
    let session = false;
    if(xrSession)
        if(xrSession.inputSources) session = true;
    return session;
}

function render() {
    requestAnimationFrame(render);
    renderGL();
}

function renderSession() {
    xrSession.requestAnimationFrame(renderSession);
    renderGL();
}

function onClick() {
    if(xrSession) {
        if(renderGL) xrSession.cancelAnimationFrame(renderSession);
        xrSession.end();
        if(renderGL) requestAnimationFrame(renderGL);
    } else {
        if(renderGL) cancelAnimationFrame(renderGL);
        navigator.xr.requestSession('immersive-vr').then(onStart);
    }
}

function onStart(session) {
    xrSession = session;
    xrButton.textContent = 'Exit VR';
    if(renderGL) session.requestAnimationFrame(renderSession);
    start();
    session.addEventListener('end', onEnd);
    session.addEventListener('selectstart', onSelectStart);
    session.addEventListener('selectend', onSelectEnd);
    session.addEventListener('select', onSelect);
    session.addEventListener('squeezestart', onSqueezeStart);
    session.addEventListener('squeezeend', onSqueezeEnd);
    session.addEventListener('squeeze', onSqueeze);
    session.addEventListener('inputsourceschange', onInputSourcesChange);
    session.addEventListener('visibilitychange', onVisibilityChange);
    session.updateRenderState({
        baseLayer: new XRWebGLLayer(session, gl)
    });
    session.requestReferenceSpace('local').then(ref => {
        refSpace = ref;
        session.requestAnimationFrame(onDraw);
    });
}

function onEnd() {
    if(renderGL) xrSession.cancelAnimationFrame(renderSession);
    xrSession = null;
    if(renderGL) requestAnimationFrame(renderGL);
    xrButton.textContent = 'Enter VR';
    end();
}

function onDraw(time, frame) {
    const session = frame.session,
        pose = frame.getViewerPose(refSpace);
    session.requestAnimationFrame(onDraw);
    drawStart(session, frame, refSpace);
    if(pose) {
        const glLayer = session.renderState.baseLayer;
        gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        for(let view of pose.views) getFirstEye(pose, view, glLayer) & draw(view, glLayer);
        for(let source of session.inputSources)
            if(source.gamepad) runGamepad(source.gamepad, source.handedness, frame.getPose(source.gripSpace, refSpace));
        drawEnd(frame, pose, glLayer);
    }
}

function getFirstEye(pose, view, glLayer) {
    if(!firstEye) {
        firstEye = view.eye;
        const getPos = (a) => {
            return Math.abs(pose.views[0].transform.position[a] - pose.views[1].transform.position[a]);
        };
        const xy = Math.sqrt(getPos('x') * getPos('x') + getPos('y') * getPos('y'));
        eyeOffset = (glLayer.framebufferWidth / 2) * Math.sqrt(xy * xy + getPos('z') * getPos('z'));
    }
}

function onSelectStart(e) {
    const targetRayPose = e.frame.getPose(e.inputSource.targetRaySpace, refSpace);
    if(!targetRayPose) return;
    const point = targetRayPose.transform.inverse.position;
    const transform = new DOMMatrix('scale(2)');
    const transformedPoint = point.matrixTransform(transform);
    console.log(transformedPoint);
}

function onSelectEnd(e) {}

function onSelect(e) {}

function onSqueezeStart(e) {}

function onSqueezeEnd(e) {}

function onSqueeze(e) {}

function onInputSourcesChange(e) {
    for(let inputSource of e.added)
        if(inputSource.targetRayMode == 'tracked-pointer') onInputChange(inputSource);
}

function onVisibilityChange(e) {
    if(event.session.visibilityState === 'visible-blurred') {} else if(event.session.visibilityState === 'visible') {}
}
