/**
 * Utility used to render motion vectors for a scene
 * 
 * @param renderLoop a RenderLoop whose scene and canvas will be used
 */
function MotionVectorRenderer(renderLoop) {
    this._cachedMotionMaterials = {};
    this._renderLoop = renderLoop;
    this._lastFrameView = renderLoop.camera.matrixWorldInverse.clone();
    this._lastFrameProjection = renderLoop.camera.projectionMatrix.clone();
    this._modelMatrices = {};

    this._renderCallback = renderLoop.onPostRender(() => {
        this._lastFrameView = this._renderLoop.camera.matrixWorldInverse.clone();
        this._lastFrameProjection = this._renderLoop.camera.projectionMatrix.clone();

        this._renderLoop.scene.updateMatrixWorld(false /*force*/);
        this._renderLoop.scene.traverse(object => {
            this._modelMatrices[object.id] = object.matrixWorld.clone();
        });
    });
}


/**
 * Dispose of the MotionVectorRenderer. This must be called when done with the
 * renderer in order to avoid memory leaks.
 */
MotionVectorRenderer.prototype.dispose = function() {
    this._renderCallback.cancel();

    for (id in this._cachedMotionMaterials) {
        if (this._cachedMotionMaterials.hasOwnProperty(id))
            this._cachedMotionMaterials[id].dispose();
    }
};


/**
 * Material used to create motion vectors. This should be cloned per object in
 * order to allow new uniforms without recompiling the shader.
 */
MotionVectorRenderer.prototype._baseMaterial = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        
        vertexShader: `
        uniform mat4 lastFrameModel;
        uniform mat4 lastFrameView;
        uniform mat4 lastFrameProjection;
        varying vec4 clipPos;
        varying vec4 lastclipPos;

        void main() {
            clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            lastclipPos = lastFrameProjection * lastFrameView * lastFrameModel * vec4(position, 1.0);

            gl_Position = clipPos;
        }`,

        fragmentShader: `
        uniform float colorScale;
        varying vec4 clipPos;
        varying vec4 lastclipPos;

        void main() {
            // Make sure to account for perspective division
            vec3 motion = ((clipPos / clipPos.w) - (lastclipPos / lastclipPos.w)).xyz;

            // Adjust delta clip space to color space
            vec3 motionColor = ((colorScale * motion) + 2.0) / 4.0;

            gl_FragColor = vec4(motionColor, 1.0);
        }`
    }
)


/**
 * Render a motion map for the scene to the given renderTarget or the canvas if
 * none is specified.
 * 
 * @param colorScale An amount to scale the color of the motion by. Useful for
 *        demonstration and debugging
 * @param renderTarget an optional render target
 */
MotionVectorRenderer.prototype.renderMotionMap = function(colorScale, renderTarget) {
    let {renderer, scene, camera} = this._renderLoop;

    // Prepare scene objects to be rendered
    scene.traverse(object => {
        if (!object.material)
            return;

        object.oldMaterial = object.material;

        // Disposing of shader flyweights kills the original compiled shader.
        // We can't do that without killing our frame rate. Cache a copy of the
        // material so we don't leak shader materials but don't need to
        // recompile.
        let cachedMaterial = this._cachedMotionMaterials[object.id]
        if (cachedMaterial)
            object.material = cachedMaterial;
        else {
            object.material = this._baseMaterial.clone();
            this._cachedMotionMaterials[object.id] = object.material;
        }

        let uniforms = object.material.uniforms;
        uniforms.colorScale = {value: colorScale};
        uniforms.lastFrameModel = {value: this._modelMatrices[object.id] || object.matrixWorld};
        uniforms.lastFrameView = {value: this._lastFrameView};
        uniforms.lastFrameProjection = {value: this._lastFrameProjection};
    });

    renderer.setClearColor("rgb(50%, 50%, 50%)");
    renderer.render(scene, camera, renderTarget);

    // Restore scene objects to previous state
    scene.traverse(object => {
        if (object.material) {
            object.material = object.oldMaterial;
            delete object.oldMaterial;
        }
    });
};
