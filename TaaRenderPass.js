/**
 * Effects pass that renders the scene with temporal antialising applied. This
 * is somewhat based on the existing Three.js TAARenderPass but is much less
 * garbage. This version is sutiable for moving scenes and does basic motion
 * vector based image reprojection.
 *
 * @param renderLoop the RenderLoop whose scene is used
 * @param numFrames the number of frames to accumulate
 */
function TaaRenderPass(renderLoop) {
    this.renderToScreen = false;

    this._renderLoop = renderLoop;
    this._reprojectionMaterial = this._baseReprojectionMaterial.clone();
    this._targetCopier = new TargetCopier(renderLoop);
    this._vecRenderer = new MotionVectorRenderer(renderLoop);
    this._jitterIndex = 0;

    // Use Halton Sequence [2, 3] for jitter amounts  (Based on UE and
    // Uncharted Presentations)
    this._jitterOffsets = this._generateHaltonJiters(16);

    let {width, height} = renderLoop.renderer.getSize();
    this._oldFrameTarget = new THREE.WebGLRenderTarget(width, height);
    this._vecRenderTarget = new THREE.WebGLRenderTarget(width, height, {
        format: THREE.RGBFormat,
        type: THREE.FloatType
    });
}

TaaRenderPass.prototype = Object.create(THREE.Pass.prototype);


/**
 * Dispose of the render pass. This must be done before garbage collection in
 * order to avoid memory leaks
 */
TaaRenderPass.prototype.dispose = function() {
    this._oldFrameTarget.dispose();
    this._reprojectionMaterial.dispose();
    this._targetCopier.dispose();
    this._vecRenderer.dispose();
    this._vecRenderTarget.dispose();
}


/**
 * Material that composites a past frame with motion map to a current frame.
 * This material is compatible with TargetCopier.
 */
TaaRenderPass.prototype._baseReprojectionMaterial = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,

    vertexShader: `
    varying vec2 Uv;

    void main() {
        Uv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,

    fragmentShader: `
    uniform float opacity;
    uniform float numFrames;
    uniform float height;
    uniform float width;
    uniform sampler2D tDiffuse;
    uniform sampler2D tMotion;
    uniform sampler2D tLastFrame;
    varying vec2 Uv;

    void main() {
        vec4 pixelMovement = texture2D(tMotion, Uv);

        vec2 oldPixelUv = Uv - ((pixelMovement.xy * 2.0) - 1.0);

        // Use simple neighbor clamping
        vec4 maxNeighbor = vec4(0.0, 0.0, 0.0, 1.0);
        vec4 minNeighbor = vec4(1.0);

        for (int x = -1; x < 1; x++) {
            for (int y = -1; y < 1; y++) {
                vec2 neighborUv = Uv + vec2(float(x) / width, float(y) / height);
                vec4 neighborTexel = texture2D(tDiffuse, neighborUv);

                maxNeighbor.r = max(maxNeighbor.r, neighborTexel.r);
                maxNeighbor.g = max(maxNeighbor.g, neighborTexel.g);
                maxNeighbor.b = max(maxNeighbor.b, neighborTexel.b);
                
                minNeighbor.r = min(minNeighbor.r, neighborTexel.r);
                minNeighbor.g = min(minNeighbor.g, neighborTexel.g);
                minNeighbor.b = min(minNeighbor.b, neighborTexel.b);
            }
        }


        vec4 oldTexel = texture2D(tLastFrame, oldPixelUv);
        oldTexel = clamp(oldTexel, minNeighbor, maxNeighbor);
        vec4 texel = texture2D(tDiffuse, Uv);

        if (oldPixelUv.x < 0.0 || oldPixelUv.x > 1.0 || oldPixelUv.y < 0.0 || oldPixelUv.y > 1.0)
            oldTexel = texel;

        // This number is pretty much just magic. Adjusting it will change the
        // balance of sharp and responsive to smooth and blurry
        vec4 compositeColor = mix(oldTexel, texel, 0.10);

        gl_FragColor = opacity * compositeColor;
    }`
});


/**
 * Render the frame to the writeBuffer or to the screen if this.renderToScreen
 * is set.
 */
TaaRenderPass.prototype.render = function (renderer, writeBuffer, readBuffer) {
    let {scene, camera} = this._renderLoop;

    this._vecRenderer.renderMotionMap(1.0 /*colorScale*/, this._vecRenderTarget);

    // Apply a jitter to the projection matrix
    let [jitterX, jitterY] = this._jitterOffsets[this._jitterIndex];
    camera.setViewOffset(readBuffer.width,
                         readBuffer.height,
                         jitterX,
                         jitterY,
                         readBuffer.width,
                         readBuffer.height);

    // Since this is the first pass we can render to the read buffer and avoid
    // needing to create an extra render target
    renderer.setClearColor(0x000000);
    renderer.render(scene, camera, readBuffer);
    camera.clearViewOffset();
    this._jitterIndex = (this._jitterIndex + 1) % this._jitterOffsets.length;

    // Reporoject the frame
    let uniforms = this._reprojectionMaterial.uniforms;
    uniforms.numFrames = {value: this._numFrames};
    uniforms.tMotion = {value: this._vecRenderTarget.texture};
    uniforms.tLastFrame = {value: this._oldFrameTarget.texture};
    uniforms.height = {value: readBuffer.height};
    uniforms.width = {value: readBuffer.width};

    this._targetCopier.copy(readBuffer, writeBuffer, this._reprojectionMaterial);
    this._targetCopier.copy(writeBuffer, this._oldFrameTarget);
    if (this.renderToScreen)
        this._targetCopier.copy(writeBuffer, null);
}


/**
 * Generate jitter amounts based on the Halton Sequence. The sequence is
 * normalized such that it can directly be applied as a pixel offset.
 * 
 * @param length the number of offsets to generate
 */
TaaRenderPass.prototype._generateHaltonJiters = function(length) {
    let jitters = [];

    for (let i = 1; i <= length; i++)
        jitters.push([this._haltonNumber(2, i) - 0.5, this._haltonNumber(3, i) - 0.5]);
    
    return jitters;
}


/**
 * Generate a number in the Halton Sequence at a given index. This is
 * shamelessly stolen from the pseudocode on the Wikipedia page
 * 
 * @param base the base to use for the Halton Sequence
 * @param index the index into the sequence
 */
TaaRenderPass.prototype._haltonNumber = function(base, index) {
    let result = 0;
    let f = 1;
    while (index > 0) {
        f /= base;
        result += f * (index % base);
        index = Math.floor(index / base);
    }

    return result;
}
