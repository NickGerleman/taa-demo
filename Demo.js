/**
 * Whether animation is paused
 */
let isPaused = true;

/**
 * Start the demo
 */
function main() {
    let canvasElement = document.getElementById('demo-canvas');
    canvasElement.setAttribute("height", window.innerHeight);
    canvasElement.setAttribute("width", window.innerWidth);

    let stats = new Stats(1);
    document.body.appendChild(stats.dom);

    let scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 0);
    bindCameraInput(camera);

    for (let i = 0; i < 6; i++) {
        let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
        light.position.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        scene.add(light);
    }

    let ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.7);
    scene.add(ambientLight);

    let renderLoop = new RenderLoop({
        scene: scene,
        camera: camera,
        canvasElement: canvasElement,
        antialiasing: AntiAliasingMode.NONE
    });

    setupSidebar(document.getElementById("sidebar"), renderLoop);
    loadSpikesAsync(renderLoop);

    renderLoop.onPreRender(() => stats.begin());
    renderLoop.onPostRender(() => stats.end());
    renderLoop.start();
}


/**
 * Fill the sidebar with buttons and bind them to the state of the renderLoop
 * 
 * @param sidebar the dom node for the sidebar
 * @param renderLoop the RenderLoop to bind the bar to
 */
function setupSidebar(sidebar, renderLoop) {
    for (let mode in AntiAliasingMode) {
        
        let aaButton = document.createElement('div');
        aaButton.classList.add('button');
        if (AntiAliasingMode[mode] == renderLoop.antialiasing)
            aaButton.classList.add('active');
        
        aaButton.innerHTML = mode;
        aaButton.addEventListener('click', () => {
            document.querySelector('.button.active').classList.remove('active');
            renderLoop.setAntialiasingMode(AntiAliasingMode[mode]);
            aaButton.classList.add('active');
        });

        sidebar.appendChild(aaButton);
    }
}


/**
 * Load spike models, animate them, and add them to the scene
 * 
 * @param renderLoop the RenderLoop whose scene will be used
 */
function loadSpikesAsync(renderLoop) {
    let {scene} = renderLoop;

    new THREE.OBJLoader().load('./SpikeBall.obj', (obj) => { 
        let mesh = obj.children[0];
        for (let i = 0; i < 300; i++) {
            let spike = mesh.clone();
            spike.material = new THREE.MeshStandardMaterial({
                color: Math.floor(0xFFFFFF * Math.random()),
                roughness: Math.random() * 0.4,
                metalness: 0.95
            });
            spike.position.set((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60);

            let randomAxis = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
            let msecs = 0;
            let moveSign = Math.random() < 0.5 ? -1 : 1;
            let moveFactor = moveSign * (Math.random() *0.8 + 0.2) / 1000;
            renderLoop.onPreRender((timePassed) => {
                if (isPaused)
                    return;

                spike.rotateOnAxis(randomAxis, moveFactor * timePassed);
                spike.translateY((Math.sin((msecs + timePassed) * moveFactor) - Math.sin(msecs * moveFactor)) * 5);
                spike.translateX((Math.cos((msecs + timePassed) * moveFactor) - Math.cos(msecs * moveFactor)) * 5);
                msecs += timePassed;
                msecs %= msecs * moveFactor * Math.PI * 2;
            })
            scene.add(spike);
        }
    });
}


/**
 * Bind the camera to keyboard input
 * 
 * @param camera the camera to bind
 */
function bindCameraInput(camera) {
    window.onkeypress = (event) => {
        var ch = String.fromCharCode(event.which);
        cameraControl(camera, ch);
    }
}


/**
 * Move the camera based on a key pressed
 * 
 * @param camera the camera to move
 * @param ch the character pressed
 */
function cameraControl(camera, ch)
{
    const TRANSLATE_INCREMENT = 0.15;
    const ROTATE_INCREMEMENT = 2 * Math.PI / 180;
    var distance = camera.position.length();
    var q, q2;
    
    switch (ch)
    {
    // camera controls
    case 'w':
        camera.translateZ(-TRANSLATE_INCREMENT);
        return true;
    case 'a':
        camera.translateX(-TRANSLATE_INCREMENT);
        return true;
    case 's':
        camera.translateZ(TRANSLATE_INCREMENT);
        return true;
    case 'd':
        camera.translateX(TRANSLATE_INCREMENT);
        return true;
    case 'r':
        camera.translateY(TRANSLATE_INCREMENT);
        return true;
    case 'f':
        camera.translateY(-TRANSLATE_INCREMENT);
        return true;
    case 'j':
        // need to do extrinsic rotation about world y axis, so multiply camera's quaternion
        // on left
        q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0),  ROTATE_INCREMEMENT);
        q2 = new THREE.Quaternion().copy(camera.quaternion);
        camera.quaternion.copy(q).multiply(q2);
        return true;
    case 'l':
        q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0),  -ROTATE_INCREMEMENT);
        q2 = new THREE.Quaternion().copy(camera.quaternion);
        camera.quaternion.copy(q).multiply(q2);
        return true;
    case 'i':
        // intrinsic rotation about camera's x-axis
        camera.rotateX(ROTATE_INCREMEMENT);
        return true;
    case 'k':
        camera.rotateX(-ROTATE_INCREMEMENT);
        return true;
    case 'O':
        camera.lookAt(new THREE.Vector3(0, 0, 0));
        return true;
    case 'p':
        camera.position.set(0, 0, 0);
        return true;
    case 'S':
        camera.fov = Math.min(80, camera.fov + 5);
        camera.updateProjectionMatrix();
        return true;
    case 'W':
        camera.fov = Math.max(5, camera.fov  - 5);
        camera.updateProjectionMatrix();
        return true;

        // alternates for arrow keys
    case 'J':
        //this.orbitLeft(5, distance)
        camera.translateZ(-distance);
        q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ROTATE_INCREMEMENT);
        q2 = new THREE.Quaternion().copy(camera.quaternion);
        camera.quaternion.copy(q).multiply(q2);
        camera.translateZ(distance);
        return true;
    case 'L':
        //this.orbitRight(5, distance)  
        camera.translateZ(-distance);
        q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ROTATE_INCREMEMENT);
        q2 = new THREE.Quaternion().copy(camera.quaternion);
        camera.quaternion.copy(q).multiply(q2);
        camera.translateZ(distance);
        return true;
    case 'I':
        //this.orbitUp(5, distance)      
        camera.translateZ(-distance);
        camera.rotateX(-ROTATE_INCREMEMENT);
        camera.translateZ(distance);
        return true;
    case 'K':
        //this.orbitDown(5, distance)  
        camera.translateZ(-distance);
        camera.rotateX(ROTATE_INCREMEMENT);
        camera.translateZ(distance);
        return true;
    case ' ':
        isPaused = !isPaused;
        return true;
    }
    return false;
}
