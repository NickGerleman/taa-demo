/**
 * A mode of antialiasing to use
 * @enum
 */
const AntiAliasingMode = {
    NONE: 0,
    MSAA: 1,
    SSAA: 2,
    TAA: 3,
    MOTION: 4,
}


/**
 * Render loop that handles lifetime and properties of the rendering process.
 * 
 * @property props properties related to the renderer
 * @property props.canvasElement the dom element pointing to the canvas to use
 * @property props.antialiasing the AntiAliasingMode to use
 * @property props.scene the scene to render
 * @property props.camera the camera that should be used to render the scene
 */
function RenderLoop(props) {
    this.renderer = new THREE.WebGLRenderer({
        canvas: props.canvasElement,
        antialias: props.antialiasing == AntiAliasingMode.MSAA
    });
    this.scene = props.scene;
    this.camera = props.camera;
    
    this._preRenderCallbacks = {_next: null};
    this._postRenderCallbacks = {_next: null};
    this._lastFameTime = performance.now();
    this._composer = new THREE.EffectComposer(this.renderer);
    this.renderer.shadowMap.enabled = true;
    this.setAntialiasingMode(props.antialiasing);
}


/**
 * Set the mode of antialiasing used to render frames. This may result in large
 * hangs from recreating the webgl context.
 * 
 * @param mode the mode to set
 */
RenderLoop.prototype.setAntialiasingMode = function(mode) {
    if (this.antialiasing == mode)
        return;

    if (this.antialiasing == AntiAliasingMode.MSAA || mode == AntiAliasingMode.MSAA)
        this._rebuildGlContext(mode);

    // Do some cleanup
    this._composer.passes = [];
    if (this._ssaaPass)
        this._ssaaPass.dispose();
    if (this._taaPass)
        this._taaPass.dispose();
    if (this._motionVecRenderer)
        this._motionVecRenderer.dispose();

    switch(mode) {
        case AntiAliasingMode.SSAA:
            this._ssaaPass = new THREE.SSAARenderPass(this.scene, this.camera);
            this._ssaaPass.renderToScreen = true;
            this._ssaaPass.sampleLevel = 3; // 8x SSAA
            this._composer.addPass(this._ssaaPass);
            break;

        case AntiAliasingMode.TAA:
            this._taaPass = new TaaRenderPass(this);
            this._taaPass.renderToScreen = true;
            this._composer.addPass(this._taaPass);
            break;

        case AntiAliasingMode.MOTION:
            this._motionVecRenderer = new MotionVectorRenderer(this);
            break;

        case AntiAliasingMode.NONE:
        case AntiAliasingMode.MSAA:
            break;

        default:
            console.error("Invalid AA Mode Set");
    }

    this.antialiasing = mode;
}


/**
 * Add a callback to be executed before rendering the frame. Callbacks are run
 * in LIFO order. The callback may be removed by caling cancel() on the
 * returned node. Callbacks have a single parameter of the time since the last
 * frame in ms.
 * 
 * @param callback a callback with an optional single parameter of time passed
 */
RenderLoop.prototype.onPreRender = function(callback) {
    let node = this._addCallbackNode(callback, this._preRenderCallbacks);
    return node;
}


/**
 * Add a callback to be executed after rendering the frame. Callbacks are run
 * in LIFO order. The callback may be removed by caling cancel() on the
 * returned node.
 * 
 * @param callback a no parameter callback
 */
RenderLoop.prototype.onPostRender = function(callback) {
    let node = this._addCallbackNode(callback, this._postRenderCallbacks);
    return node;
}


/**
 * Start the render loop
 */
RenderLoop.prototype.start = function() {
    if (!this._isRendering) {
        this._isRendering = true;
        this._render(performance.now());
    }
}


/**
 * Continually render frames. This cannot be stopped and should not be called
 * multiple times.
 * 
 * @param currentTime a high resolution timestamp (ie from performance.Now())
 */
RenderLoop.prototype._render = function(currentTime) {
    let timeDifference = currentTime - this._lastFameTime;
    this._lastFameTime = currentTime;

    for (let current = this._preRenderCallbacks._next; current; current = current._next)
        current.callback(timeDifference);

    switch(this.antialiasing) {
        case AntiAliasingMode.NONE:
        case AntiAliasingMode.MSAA:
            this.renderer.setClearColor(0x000000);
            this.renderer.render(this.scene, this.camera)
            break;

        case AntiAliasingMode.SSAA:
        case AntiAliasingMode.TAA:
            this._composer.render();
            break;

        case AntiAliasingMode.MOTION:
            this._motionVecRenderer.renderMotionMap(100.0 /*colorScale*/);
            break;
    }

    for (let current = this._postRenderCallbacks._next; current; current = current._next)
        current.callback();

    requestAnimationFrame(time => this._render(time));
}


/**
 * Add a callback to a list of callbacks and return the node (which is also now
 * the head of the list)
 * 
 * @param callback the callback to be added
 * @param list a linked list of callbacks
 */
RenderLoop.prototype._addCallbackNode = function(callback, list) {
    let node = {
        _previous: list,
        _next: list._next,
        callback: callback,
        cancel: () => {
            node._previous._next = node._next;
            if (node._next)
                node._next._previous = node._previous;
        }
    }

    if (list._next)
        list._next._previous = node;
    list._next = node;

    return node;
}


/**
 * Nuke and rebuild the webgl context, recreating the renderer
 * 
 * @param aaMode the antialiasing mode that should be used
 */
RenderLoop.prototype._rebuildGlContext = function(aaMode) {
    let oldCanvas = this.renderer.domElement;
    let newCanvas = oldCanvas.cloneNode(true /*deep*/);
    oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);

    this.renderer = new THREE.WebGLRenderer({
        canvas: newCanvas,
        antialias: aaMode == AntiAliasingMode.MSAA
    });
    this.renderer.shadowMap.enabled = true;
    this._composer = new THREE.EffectComposer(this.renderer);
}
