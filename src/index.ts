// Write out pixel coordinates instead of vUv, will help with outline pass.
// http://localhost:8080


// add styles
import './style.css';
// three.js
import * as THREE from 'three';

// create the scene
const scene = new THREE.Scene();

// create the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(0xFFFFFF);

// set size
renderer.setSize(window.innerWidth, window.innerHeight);

// add canvas to dom
document.body.appendChild(renderer.domElement);

// add axis to the scene
const axis = new THREE.AxesHelper(10);
axis.layers.set(0);
scene.add(axis);

const material = new THREE.MeshBasicMaterial({
  color: 0,
  wireframe: false,
});

// create a box and add it to the scene
const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
box.layers.enableAll();
scene.add(box);

box.position.x = 0.5;
box.rotation.y = 0.5;

camera.position.x = 5;
camera.position.y = 5;
camera.position.z = 5;

camera.lookAt(scene.position);

const targets = [];
for (let i = 0; i < 2; i++) {
  targets.push(new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.FloatType
  }));
}

const sceneOverlay = new THREE.Scene();
const overlayCamera = new THREE.OrthographicCamera(0, window.innerWidth, 0, window.innerHeight);
overlayCamera.position.z = -1;

const overlayMat = new THREE.MeshBasicMaterial({ map: targets[1].texture });
const overlaySz = 0.4;
const overlayGeometry = new THREE.PlaneBufferGeometry(window.innerWidth * overlaySz, window.innerHeight * overlaySz);
const overlayMesh = new THREE.Mesh(overlayGeometry, overlayMat);
overlayMesh.position.x = -window.innerWidth * overlaySz * 0.5;
overlayMesh.position.y = window.innerHeight * overlaySz * 0.5;
overlayMesh.position.z = 1.0;
overlayMesh.scale.x = -1;
overlayMesh.scale.y = -1;
sceneOverlay.add(overlayMesh);
overlayCamera.lookAt(sceneOverlay.position);

const orthoPlane = new THREE.PlaneBufferGeometry(2, 2);
const fullScreenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

function fullScreenPass(fragmentShader: string, uniforms: any) {
  const fullScreenMat = new THREE.ShaderMaterial({
    vertexShader: `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`, fragmentShader, uniforms
  });
  const fullScreenMesh = new THREE.Mesh(orthoPlane, fullScreenMat);
  const fullScreenScene = new THREE.Scene();
  fullScreenScene.add(fullScreenMesh);

  return (renderer: THREE.Renderer, newUniformValues: any) => {
    for (const key in newUniformValues) {
      if (!fullScreenMat.uniforms[key]) {
        return;
      }

      fullScreenMat.uniforms[key].value = newUniformValues[key];
    }
    renderer.render(fullScreenScene, fullScreenCam);
  }
}

function addPackFunctions(shader: string) {
  return `
  vec4 packXY(const in vec2 xy) {
    const vec2 robo = vec2(1.0, 255.0);
    vec2 rg = fract(robo * xy.x);
    vec2 ba = fract(robo * xy.y);
    //return vec4(rg.x, rg.y, ba.x, ba.y);
    return vec4(xy.x, xy.y, 0, 0.0);
  }

  vec2 unpackXY(const in vec4 rgba) { 
    const vec2 robo = vec2(1.0, 1.0/255.0);
    float x = dot(rgba.rg, robo);
    float y = dot(rgba.ba, robo);
    //return vec2(x, y);
    return rgba.xy;
  }

  ` + shader;
}

const uvTestPassWrite = fullScreenPass(
  addPackFunctions(`
  varying vec2 vUv;

  void main() {
    gl_FragColor = packXY(vUv);
  }    
  `),
  {}
);

const uvTestPassRead = fullScreenPass(
  addPackFunctions(`
  varying vec2 vUv;
  uniform sampler2D tex;

  void main() {
    vec4 c = texture2D(tex, vUv);
    vec4 w = packXY(vUv);

    gl_FragColor = distance(unpackXY(c), vUv) <= 0.0 ? vec4(1.0, 0.0, 0.0, 1.0) : vec4(0.0);
  }    
  `),
  {
    tex: { value: targets[0].texture }
  }
);

const uvPass = fullScreenPass(
  addPackFunctions(`
  varying vec2 vUv;
  uniform sampler2D tex;

  void main() {
    vec4 c = texture2D(tex, vUv);
    gl_FragColor = c.x < 1.0 ? packXY(vUv) : vec4(1.0);
  }
`),
  {
    tex: { value: targets[0].texture },
  });

const jumpFloodPass = fullScreenPass(
  addPackFunctions(`
varying vec2 vUv;
uniform sampler2D tex;
uniform float jumpOffsetX;
uniform float jumpOffsetY;

void main() {
  vec2[9] offsets = vec2[9](
    vec2(-jumpOffsetX, -jumpOffsetY), vec2(0, -jumpOffsetY), vec2(jumpOffsetX, -jumpOffsetY),
    vec2(-jumpOffsetX, 0), vec2(0,0), vec2(jumpOffsetX, 0),
    vec2(-jumpOffsetX, jumpOffsetY), vec2(0, jumpOffsetY), vec2(jumpOffsetX, jumpOffsetY)
  );
  const float maxDist = 99999999.0;
  float min_dist = maxDist;
  vec2 closest_coord = vec2(1.0, 1.0);
  vec4 closest_rgba = vec4(1.0);
  for (int i = 0; i < 9; i++) {
    vec2 c = clamp(vUv + offsets[i], 0.0, 1.0);
    vec4 rgba = texture2D(tex, c);
    if (rgba.a < 1.0) {
      vec2 coord = unpackXY(rgba);
      float dist = distance(coord, c);
      if (dist < min_dist) {
        min_dist = dist;
        closest_coord = coord;
        closest_rgba = rgba;
      }  
    }
  }
  gl_FragColor = closest_rgba;
}
`),
  {
    tex: { value: targets[0].texture },
    jumpOffsetX: { value: 1 }, // should be multiplied by 1/rez 
    jumpOffsetY: { value: 1 },
  }
)

const outlinePass = fullScreenPass(addPackFunctions(`
  varying vec2 vUv;
  uniform sampler2D tex;
  uniform float threshLow;
  uniform float threshHigh;

  void main() {
    vec4 rgba = texture2D(tex, vUv);
    vec2 coord = unpackXY(rgba);
    vec4 color = vec4(0.5);
    if (rgba.a < 1.0) {
      float dist = distance(coord.xy, vUv);
      if (dist >= threshLow && dist <= threshHigh) {
      //if ((dist <= 0.125) && (dist >= 0.01)) {
      color = vec4(0.0, 1.0, 0.0, 1.0);
      } else {
        color = vec4(0.0, 0.0, 1.0, 1.0);
      }
    } else {
      color = vec4(1.0, 0.0, 0.0, 1.0);
    }
    gl_FragColor = color; 
  }
`),
  {
    tex: { value: targets[0].texture },
    threshLow: { value: 0.0 / Math.max(window.innerWidth, window.innerHeight) }, // 0.0 / window.innerWidth,
    threshHigh: { value: 40.0 / Math.max(window.innerWidth, window.innerHeight) }, // 10000.0 / window.innerWidth,
  });

function animate(): void {
  requestAnimationFrame(animate);
  render();
}

let logged = false;

function render(): void {
  const timer = 0.00002 * Date.now();
  box.position.y = 0.5 + 0.5 * Math.sin(timer);
  box.rotation.x += 0.1;

  camera.layers.set(1);
  renderer.setRenderTarget(targets[0]);
  renderer.render(scene, camera);
  camera.layers.enableAll();

  renderer.setRenderTarget(targets[1]);
  uvPass(renderer, {});

  const numPasses = Math.floor(Math.log2(Math.max(window.innerWidth, window.innerHeight)));
  let sampleOffset = Math.pow(2, numPasses - 1);
    if (!logged) {
      console.log(numPasses, window.innerWidth, window.innerHeight);
    }
  let currRT = 0;
  for (let i = 0; i < numPasses; i++) {
    if (!logged) {
      console.log(sampleOffset);
    }
    renderer.setRenderTarget(targets[currRT]);
    jumpFloodPass(renderer, { tex: targets[1 - currRT].texture, jumpOffsetX: sampleOffset / window.innerWidth, jumpOffsetY: sampleOffset / window.innerHeight });
    currRT = 1 - currRT;
    sampleOffset >>= 1;
  }
  renderer.setRenderTarget(targets[currRT]);
  outlinePass(renderer, { tex: targets[1 - currRT] });
  logged = true;

  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  renderer.autoClear = false;
  overlayMat.map = targets[currRT].texture;
  renderer.render(sceneOverlay, overlayCamera);
  renderer.autoClear = true;
}

animate();
