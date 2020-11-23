import { Vector2, WebGLRenderer, WebGLRenderTarget, Scene, Camera } from "three";
import { FullScreenPass } from "./fullScreenPass";
export declare class JFAOutline {
    private uvPass;
    private jumpFloodPass;
    private outlinePass;
    private selectedMaterial;
    constructor(targets: WebGLRenderTarget[], iResolution: Vector2, outlinePass?: FullScreenPass);
    outline(renderer: WebGLRenderer, scene: Scene, camera: Camera, targets: WebGLRenderTarget[], iResolution: Vector2, selectedLayer: number, outlineUniforms?: any): void;
    setOutlinePass(outlinePass: FullScreenPass): void;
    renderSelected(renderer: WebGLRenderer, scene: Scene, camera: Camera, targets: WebGLRenderTarget[], selectedLayer: number): void;
    renderDistanceTex(renderer: WebGLRenderer, targets: WebGLRenderTarget[], iResolution: Vector2, outlineUniforms?: any): number;
    renderOutline(renderer: WebGLRenderer, distanceIndex: number, targets: WebGLRenderTarget[], outlineUniforms?: any): void;
}
