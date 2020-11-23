// References:
// https://www.shadertoy.com/view/4syGWK
// https://medium.com/@bgolus/the-quest-for-very-wide-outlines-ba82ed442cd9

import "./style.css";
import * as THREE from "three";
import { Vector2, Vector4, NormalBlending } from "three";
import { GPUPicker } from 'three_gpu_picking';
import { JFAOutline, fullScreenPass } from 'three_js_outline';

import * as dat from 'dat.gui';
 
const SELECTED_LAYER = 1;

// create the scene
const scene = new THREE.Scene();

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

const iResolution = new Vector2(WIDTH, HEIGHT);

// create the camera
const camera = new THREE.PerspectiveCamera(75, WIDTH / HEIGHT, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xffffff);

// set size
renderer.setSize(WIDTH, HEIGHT);

// add canvas to dom
document.body.appendChild(renderer.domElement);

const material = new THREE.MeshBasicMaterial({
  color: 0,
  wireframe: false,
});

// create a box and add it to the scene
const box = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), material);
box.layers.enable(SELECTED_LAYER);
scene.add(box);

box.position.x = -1.0;
box.rotation.y = 0.5;
box.position.z = -1.0;

camera.position.x = 5;
camera.position.y = 5;
camera.position.z = 5;

camera.lookAt(scene.position);
const targets = [];
for (let i = 0; i < 2; i++) {
  targets.push(
    new THREE.WebGLRenderTarget(WIDTH, HEIGHT, {
      type: THREE.FloatType,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
    })
  );
}

const jfaOutline = new JFAOutline(targets, iResolution);
const gpuPicker = new GPUPicker(THREE, renderer, scene, camera, idFromObject);

renderer.domElement.addEventListener('mouseup', onMouseUp);
renderer.domElement.addEventListener('touchend', onMouseUp);

const outlineUniforms = {
  threshLow: 1,
  threshHigh: 200,
  outlineColor: new Vector4(1.0,0.0,0.0),
};
const outlineHelper = {
  outlineColor: [1.0, 0.0, 0.0],
  animateOutline: false,
}

const gui = new dat.GUI();
gui.add(outlineUniforms, 'threshLow', 0, 1000);
gui.add(outlineUniforms, 'threshHigh', 0, 1000);
gui.addColor(outlineHelper, 'outlineColor');
gui.add(outlineHelper, 'animateOutline');

function animate(): void {
  requestAnimationFrame(animate);
  render();
}

var toPick;

function render(): void {
  const timer = 0.002 * Date.now();
  box.rotation.x += 0.01;

  if (outlineHelper.animateOutline) {
    outlineUniforms.threshLow = 15 * Math.sin(timer) + 15;
    outlineUniforms.threshHigh = 20 + (100 * Math.sin(timer) + 100);
  }
  
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  if (toPick) {
    var objId = gpuPicker.pick(toPick[0], toPick[1]);
    const obj = scene.getObjectById(objId);  
    if (obj) {
      obj.layers.enable(SELECTED_LAYER);
    } else {
      for (const child of scene.children) {
        child.layers.disable(SELECTED_LAYER);
      }
    }
    toPick = undefined;
  }

  outlineUniforms.outlineColor.set(outlineHelper.outlineColor[0], outlineHelper.outlineColor[1], outlineHelper.outlineColor[2], 1.0);
  jfaOutline.outline(renderer, scene, camera, targets, iResolution, SELECTED_LAYER, outlineUniforms);
}

function onMouseUp(ev) {
  var pixelRatio = window.devicePixelRatio ? 1.0 / window.devicePixelRatio : 1.0;
  toPick = [ev.clientX * pixelRatio, ev.clientY * pixelRatio];
}

function idFromObject(obj) {
  var ret = obj;
  while (ret) {
    if (ret.type === 'Mesh') {
      return ret.id;
    } else {
      ret = ret.parent;
    }
  }
}

animate();

const fancyOutline = fullScreenPass(
  `
uniform sampler2D tex;
uniform float threshLow;
uniform float threshHigh;
uniform vec4 outlineColor;

void main() {
  vec2 vUv = gl_FragCoord.xy / iResolution;
  vec4 rgba = texture2D(tex, vUv);
  vec2 coord = rgba.xy;
  vec4 color = vec4(0.0);
  if (rgba.a < 1.0) {
    float dist = distance(coord, gl_FragCoord.xy);
    if (dist >= threshLow && dist <= threshHigh) {
      color = outlineColor;
      color.a = clamp(threshHigh - dist, 0.0, 1.0);
    }
  }
  gl_FragColor = color;  
}
`,
  {
    tex: { value: targets[0].texture },
    iResolution: { value: iResolution },
    threshLow: { value: 1.0 },
    threshHigh: { value: 200.0 },
    outlineColor: { value: new Vector4(1.0, 1.0, 0.0, 1.0) },
  },
  {
    depthTest: false,
    depthWrite: false,
    blending: NormalBlending,
    transparent: true,
  }
);
