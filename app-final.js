// --- 1. Imports y Configuración de Módulos ---
// --- 1. Imports y Configuración de Módulos ---
// USAR SKYPACK PARA ABSOLUTAMENTE TODO
import * as THREE from 'https://cdn.skypack.dev/three@0.137.0'; 
import { GPUComputationRenderer } from 'https://cdn.skypack.dev/three@0.137.0/examples/jsm/misc/GPUComputationRenderer.js';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.137.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.137.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.137.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.137.0/examples/jsm/controls/OrbitControls.js';

// ... el resto de tu código

// --- 2. Variables Globales y Setup Inicial --- 
// ... el resto de tu código
const N = 10000;
const WIDTH = 100; 
const HEIGHT = 100;
let clock = new THREE.Clock();
const orbitRadius = 80;
let positionTexture;
let dataArray;
let positionVariable;


// --- 3. Setup de Scene, Renderer y Cámara ---
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NoToneMapping; 
renderer.outputEncoding = THREE.LinearEncoding;
document.body.appendChild(renderer.domElement);

renderer.autoClear = false;


renderer.domElement.oncontextmenu = function (e) { e.preventDefault(); };

const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(110, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 80);
camera.updateProjectionMatrix();

// Manejador de Redimensionamiento
function onWindowResize() {
    // 1. Actualiza el Aspect Ratio de la cámara
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // 2. Actualiza el tamaño del renderizador
    renderer.setSize(window.innerWidth, window.innerHeight);

    // 3. Actualiza el tamaño del compositor
    if (typeof composer !== 'undefined') { 
        composer.setSize(window.innerWidth, window.innerHeight); 
    }
}
window.addEventListener('resize', onWindowResize);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 20, 0);

controls.dampingFactor = 0.1;
controls.enableDamping = true;
/*controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
}*/
controls.enableZoom = true;

controls.update();


// --- 4. Setup de GPGPU (GPUComputationRenderer) ---
const renderTargetOptions = { 
    minFilter: THREE.NearestFilter, 
    magFilter: THREE.NearestFilter, 
    format: THREE.RGBAFormat, 
    type: THREE.FloatType 
};
const gpuCompute = new GPUComputationRenderer(WIDTH, HEIGHT, renderer, renderTargetOptions);


// --- 5. Inicialización de Textura de Posición (Semilla) ---
 dataArray = new Float32Array(N * 4);

for (let i = 0; i < N; i++) {
    let j = i * 4;
    
    // Posición inicial aleatoria dentro del rango del atractor
    dataArray[j] = 20 * (Math.random() - 0.5);
    dataArray[j + 1] = 20 * (Math.random() - 0.5);
    dataArray[j + 2] = 20 * (Math.random());
    dataArray[j + 3] = i / N; // ID normalizada
}

 positionTexture = new THREE.DataTexture(dataArray, WIDTH, HEIGHT, THREE.RGBAFormat, THREE.FloatType);
positionTexture.needsUpdate = true;
positionTexture.minFilter = THREE.NearestFilter;
positionTexture.magFilter = THREE.NearestFilter;

const fragmentShaderPosition = document.getElementById('fragmentShaderPosition')?.textContent.trim();
if (!fragmentShaderPosition) {
    throw new Error("Elemento 'fragmentShaderPosition' no encontrado.");
}

 positionVariable = gpuCompute.addVariable("texturePosition", fragmentShaderPosition, positionTexture);

// Uniforms de la simulación
positionVariable.material.uniforms.deltaTime = { value: 0.0 }; 
positionVariable.material.uniforms.time = { value: 0.0 };
positionVariable.material.uniforms.sigma = { value: 10.0 };
positionVariable.material.uniforms.rho = { value: 28.0 };
positionVariable.material.uniforms.beta = { value: 8.0 / 3.0 };
positionVariable.material.uniforms.WIDTH = { value: WIDTH };
positionVariable.material.uniforms.HEIGHT = { value: HEIGHT };

gpuCompute.setVariableDependencies(positionVariable, [positionVariable]);
if (gpuCompute.init() !== null) {
    console.error('El GPUComputationRenderer no pudo inicializarse.');
}

// Variable global para ρ
let rho = 28.0;

// En el slider
const slider = document.getElementById('convection');
const rhoDisplay = document.getElementById('rhoValue');

slider.addEventListener('input', (event) => {
  let newRho = parseFloat(event.target.value);
  
  rhoDisplay.textContent = newRho.toFixed(1);
  positionVariable.material.uniforms.rho.value = newRho;
  particlesMaterial.uniforms.rho.value = newRho;
  resetInitialConditions();

});


// --- 6. Inicialización de Partículas (Instancing) ---
const particleIDs = new Float32Array(N);
for (let i = 0; i < N; i++) {
    particleIDs[i] = i; 
}

const positions = new Float32Array([0, 0, 0]); // Punto base
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('particleID', new THREE.InstancedBufferAttribute(particleIDs, 1));
geometry.instanceCount = N; 

const fragmentShaderColor = document.getElementById('fragmentShaderParticleColor')?.textContent.trim();
const vertexShader = document.getElementById('vertexShader')?.textContent.trim();

const particlesMaterial = new THREE.ShaderMaterial({
    uniforms: {
        texturePosition: { value: positionTexture },
        WIDTH: { value: WIDTH }, 
        HEIGHT: { value: HEIGHT }, 
        color: { value: new THREE.Color(0xffffff) },
        rho: { value: 28.0 }

    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShaderColor,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    transparent: true
});

const particles = new THREE.Points(geometry, particlesMaterial); 
scene.add(particles);


// --- 7. Setup de Post-Procesamiento (Efectos) ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);

renderPass.clear = false; 

composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass( 
    new THREE.Vector2( window.innerWidth, window.innerHeight ), 
    1.5, 0.5, 0.0 
);
bloomPass.threshold = 0.0;
bloomPass.strength = 0.3; 
bloomPass.radius = 0.01;
composer.addPass(bloomPass);

function resetInitialConditions() {
    for (let i = 0; i < N; i++) {
        let j = i * 4;

        // Posición inicial aleatoria dentro del rango del atractor
        dataArray[j] = 20 * (Math.random() - 0.5);
        dataArray[j + 1] = 20 * (Math.random() - 0.5);
        dataArray[j + 2] = 20 * (Math.random());
    }
    positionTexture.needsUpdate = true;
}

// --- 8. Función de Animación y Bucle de Renderizado ---
onWindowResize();

function animate() {
    requestAnimationFrame(animate);

    // 1. GPGPU: Calcula las nuevas posiciones
    let deltaTime = clock.getDelta();
    const fixedDT = 0.005;
    positionVariable.material.uniforms.deltaTime.value = fixedDT; 
    positionVariable.material.uniforms.time.value += deltaTime;
    gpuCompute.compute();

    // 2. Visualización: Pasa la nueva textura de posiciones
    particlesMaterial.uniforms.texturePosition.value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
    const elapsedTime = clock.getElapsedTime();
    

    
    composer.render();
    controls.update();

}

// Inicia el bucle de animación
animate();