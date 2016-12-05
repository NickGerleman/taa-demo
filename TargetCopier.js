/**
 * Scene set up to emulate copying a texture to a RenderTarget
 * 
 * @renderLoop a RenderLoop whose renderer is used
 */
function TargetCopier(renderLoop) {
    this._camera = new THREE.OrthographicCamera(- 1, 1, 1, - 1, 0, 1);
    this._scene = new THREE.Scene();
    this._renderLoop = renderLoop;

    this._copyMaterial = this._baseCopyMaterial.clone();
    this._copyUniforms = this._copyMaterial.uniforms;
    this._mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._copyMaterial);
    this._scene.add(this._mesh);
}


/**
 * Dispose of the TargetCopier. This muse be called before garbage collection
 * in order to avoid memory leaks
 */
TargetCopier.prototype.dispose = function() {
    this._copyMaterial.dispose();
}


/**
 * Material used to copy an input texture
 */
TargetCopier.prototype._baseCopyMaterial = new THREE.ShaderMaterial({
    vertexShader: THREE.CopyShader.vertexShader,
    fragmentShader: THREE.CopyShader.fragmentShader,
    premultipliedAlpha: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false
});


/**
 * Copy the input target to the output target. An optional custom material may
 * be used to manipulate the texture further.
 * 
 * @param source the source render target
 * @param dest the destination render target
 * @param customMaterial an optional custom material to use in place of the
 *        copy shader
 */
TargetCopier.prototype.copy = function(source, dest, customMaterial) {
    this._mesh.material = customMaterial || this._copyMaterial;

    this._mesh.material.uniforms.tDiffuse = {value: source.texture};
    this._mesh.material.uniforms.opacity = {value: 1.0};

    let renderer = this._renderLoop.renderer;
    renderer.setClearColor(0x000000);
    renderer.render(this._scene, this._camera, dest);
}
