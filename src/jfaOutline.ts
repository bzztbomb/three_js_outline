import {
  NormalBlending,
  Vector2,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
  MeshBasicMaterial,
  Scene,
  Camera,
} from "three";
import { FullScreenPass, fullScreenPass } from "./fullScreenPass";

export class JFAOutline {
  private uvPass: FullScreenPass;
  private jumpFloodPass: FullScreenPass;
  private outlinePass: FullScreenPass;
  private selectedMaterial = new MeshBasicMaterial({color: 0xFFFFFF});

  /**
   * Construct an instance of JFAOutline
   * @param targets The targets to ping pong between. 
   * @param iResolution Three.Vector2 containing width and height of the screen.
   * @param outlinePass Optional custom outlining shader.
   */
  constructor(
    targets: WebGLRenderTarget[],
    iResolution: Vector2,
    outlinePass?: FullScreenPass
  ) {    
    this.uvPass = fullScreenPass(
      `
      uniform sampler2D tex;
    
      void main() {
        // sample silhouette texture for sobel
        mat3 values;
        for(int u=0; u<3; u++)
        {
            for(int v=0; v<3; v++)
            {
                vec2 offset = vec2(float(u-1), float(v-1));
                vec2 sampleUV = clamp(gl_FragCoord.xy + offset, vec2(0.0), iResolution.xy - vec2(1.0));
                values[u][v] = texture2D(tex, sampleUV / iResolution).x;
            }
        }    
    
        vec4 outColor = vec4(gl_FragCoord.xy, 0.0, 0.0);
    
        if (values[1][1] > 0.99) {
          gl_FragColor = outColor;
          return;
        }
    
        if (values[1][1] < 0.01) {
          gl_FragColor = vec4(1.0);
          return;
        }
          
        vec2 dir = -vec2(
          values[0][0] + values[0][1] * 2.0 + values[0][2] - values[2][0] - values[2][1] * 2.0 - values[2][2],
          values[0][0] + values[1][0] * 2.0 + values[2][0] - values[0][2] - values[1][2] * 2.0 - values[2][2]
          );
    
        // if dir length is small, this is either a sub pixel dot or line
        // no way to estimate sub pixel edge, so output position
        if (abs(dir.x) <= 0.005 && abs(dir.y) <= 0.005) {
          gl_FragColor = outColor;
          return;
        }
            
    
      // normalize direction
      dir = normalize(dir);
    
      // sub pixel offset
      vec2 offset = dir * (1.0 - values[1][1]);
    
      gl_FragColor = vec4(outColor.x + offset.x, outColor.y + offset.y, 0.0, 0.0);    
      }
    `,
      {
        tex: { value: targets[0].texture },
        iResolution: { value: iResolution },
      }
    );

    this.jumpFloodPass = fullScreenPass(
      `
    uniform sampler2D tex;
    uniform float jumpOffset;
    
    void main() {
      float min_dist = 99999.0;
      vec4 closest_rgba = vec4(1.0);
      vec2 pixelCoord = gl_FragCoord.xy; //vUv * iResolution;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 sampleCoord = pixelCoord + vec2(x,y) * jumpOffset;
          //sampleCoord += vec2(0.5); // get center of pixel
          vec4 rgba = texture2D(tex, clamp(sampleCoord / iResolution, 0.0, 1.0));
          if (rgba.a < 1.0) {
            vec2 coord = rgba.xy;
            float dist = distance(pixelCoord, coord);
            if (dist < min_dist) {
              min_dist = dist;
              closest_rgba = rgba;
            }  
          }  
        }
      }
      gl_FragColor = closest_rgba;
    }
    `,
      {
        tex: { value: targets[0].texture },
        iResolution: { value: iResolution },
        jumpOffset: { value: 1 },
      }
    );

    this.outlinePass =
      outlinePass ??
      fullScreenPass(
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
          outlineColor: { value: new Vector4(1.0, 0.0, 0.0, 1.0) },
        },
        {
          depthTest: false,
          depthWrite: false,
          blending: NormalBlending,
          transparent: true,
        }
      );
  }

  /**
   * One call interface for rendering object outlines.
   * @param renderer Three.JS renderer
   * @param scene Three.JS scene
   * @param camera Three.JS target.
   * @param targets Render targets array (at least length two) to ping pong between, must be of type float.
   * @param iResolution Three.JS Vector2 containing width/height.
   * @param selectedLayer The layer for selected objects.
   * @param outlineUniforms Optional uniforms to pass in for the outlining shader.
   */
  public outline(renderer: WebGLRenderer, scene: Scene, camera: Camera, targets: WebGLRenderTarget[], iResolution: Vector2, selectedLayer: number, outlineUniforms?: any) {
    this.renderSelected(renderer, scene, camera, targets, selectedLayer);
    const distanceIndex = this.renderDistanceTex(renderer, targets, iResolution, outlineUniforms);
    this.renderOutline(renderer, distanceIndex, targets, outlineUniforms);
  }  

  /**
   * Allows one to update the outlining shader used.
   * @param outlinePass New outline shader
   * @returns Old outline shader
   */
  public setOutlinePass(outlinePass: FullScreenPass) {
    const oldPass = this.outlinePass;
    this.outlinePass = outlinePass;
    return oldPass;
  }

  /**
   * Render the selected objects to the first render target.
   * @param renderer Three.JS renderer
   * @param scene Three.JS scene
   * @param camera Three.JS target.
   * @param targets Render targets array (at least length two) to ping pong between, must be of type float.
   * @param selectedLayer The layer for selected objects.
   */
  public renderSelected(renderer: WebGLRenderer, scene: Scene, camera: Camera, targets: WebGLRenderTarget[], selectedLayer: number) {
    const oldClearColor = renderer.getClearColor().getHex();
    const oldOverrideMaterial = scene.overrideMaterial;
    renderer.setClearColor(0x0);
    scene.overrideMaterial = this.selectedMaterial;
    camera.layers.set(selectedLayer);
    renderer.setRenderTarget(targets[0]);
    renderer.render(scene, camera);
    camera.layers.enableAll();
    renderer.setClearColor(oldClearColor);
    scene.overrideMaterial = oldOverrideMaterial;  
  }

  /**
   * This renders the distance texture from the initial outline buffer generated by renderSelected.
   * outlineUniforms.threshHigh is used to determine how much of the distance buffer to generate, if
   * it is not passed, it will generate the distance texture for the whole screen.
   *  
   * @param renderer Three.JS renderer
   * @param targets Render targets array (at least length two) to ping pong between, must be of type float.
   * @param iResolution Three.JS Vector2 containing width/height.
   * @param outlineUniforms Optional uniforms to pass in for the outlining shader.
   * @returns Index of the final render target that contains the distance texture
   */
  public renderDistanceTex(
    renderer: WebGLRenderer,
    targets: WebGLRenderTarget[],
    iResolution: Vector2,
    outlineUniforms?: any
  ) {
    renderer.setRenderTarget(targets[1]);
    this.uvPass(renderer, {
      tex: targets[0].texture,
      iResolution,
    });
    const distance = outlineUniforms?.threshHigh ?? Math.max(iResolution.x, iResolution.y); 
    console.log(distance);
    const numPasses = Math.ceil(Math.log2(distance));
    let sampleOffset = Math.pow(2, numPasses - 1);
    let currRT = 0;
    for (let i = 0; i < numPasses; i++) {
      renderer.setRenderTarget(targets[currRT]);
      this.jumpFloodPass(renderer, {
        tex: targets[1 - currRT].texture,
        jumpOffset: sampleOffset,
      });
      currRT = 1 - currRT;
      sampleOffset >>= 1;
    }

    return 1 - currRT;
  }

  /**
   * 
   * @param renderer Three.JS renderer
   * @param distanceIndex Index into targets of the final distance texture
   * @param targets Render targets used to generate distance texture
   * @param outlineUniforms Custom uniforms for outline shader
   */
  public renderOutline(renderer: WebGLRenderer, distanceIndex: number, targets: WebGLRenderTarget[], outlineUniforms?: any) {
    renderer.setRenderTarget(null);
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    this.outlinePass(renderer, {
      ...outlineUniforms,
      tex: targets[distanceIndex],
    });
    renderer.autoClear = oldAutoClear;
  }
}
