// References:
// https://www.shadertoy.com/view/4syGWK
// https://medium.com/@bgolus/the-quest-for-very-wide-outlines-ba82ed442cd9

import "./style.css";
import * as THREE from "three";
import { Vector2 } from "three";
import { JFAOutline } from "./jfaOutline";
import { GPUPicker } from 'three_gpu_picking';

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

function animate(): void {
  requestAnimationFrame(animate);
  render();
}

var toPick;

function render(): void {
  const timer = 0.0 * Date.now();
  box.position.y = 1.0 * Math.sin(timer);
  box.position.x = 1.3 * Math.sin(timer * 2.3);
  box.rotation.x += 0.01;
  
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

  jfaOutline.outline(renderer, scene, camera, targets, iResolution, SELECTED_LAYER);
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
