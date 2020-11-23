import { WebGLRenderer } from "three";
export declare type FullScreenPass = (renderer: WebGLRenderer, uniforms: any) => void;
/**
 * Render a full screen pass with the fragmentShader provided.
 * @param fragmentShader GLSL fragment shader, iResolution uniform is added to the top.
 * @param uniforms THREE.JS uniforms (iResolution vec2 should be provided)
 * @param materialProps Extra material props to set for the pass.
 * @returns A closure you call with the THREE.Renderer and new uniform values.
 */
export declare function fullScreenPass(fragmentShader: string, uniforms: any, materialProps?: any): FullScreenPass;
