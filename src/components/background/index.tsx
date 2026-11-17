import { Effects } from "@react-three/drei";
import { Canvas, extend } from "@react-three/fiber";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { Particles } from "./particles";
import { VignetteShader } from "./shaders/vignetteShader";

// Register ShaderPass for R3F JSX
extend({ ShaderPass });

export interface ParticleBackgroundProps {
  /** Activa el modo "introspect" (transición dinámica de brillo/iluminación) */
  hovering?: boolean;
  /** Velocidad global de la animación */
  speed?: number;
  /** Distancia de enfoque (depth of field) */
  focus?: number;
  /** Intensidad del desenfoque */
  aperture?: number;
  /** Resolución del FBO de simulación: 256 | 512 | 1024 */
  size?: number;
  /** Escala del ruido de desplazamiento */
  noiseScale?: number;
  /** Intensidad del ruido de desplazamiento */
  noiseIntensity?: number;
  /** Escala de tiempo del ruido */
  timeScale?: number;
  /** Tamaño de los puntos */
  pointSize?: number;
  /** Opacidad global de las partículas */
  opacity?: number;
  /** Escala del plano de partículas */
  planeScale?: number;
  /** Oscuridad de la viñeta */
  vignetteDarkness?: number;
  /** Offset de la viñeta */
  vignetteOffset?: number;
  /** Clase adicional para el contenedor */
  className?: string;
}

/**
 * Fondo 3D de partículas WebGL clonado directamente de:
 * https://github.com/Geki27/skal-ventures-template/tree/main/background
 * Con soporte completo para el modo `introspect`.
 */
export const ParticleBackground = ({
  hovering = false,
  speed = 1.0,
  focus = 3.8,
  aperture = 1.79,
  size = 512,
  noiseScale = 0.6,
  noiseIntensity = 0.52,
  timeScale = 1.0,
  pointSize = 10.0,
  opacity = 0.8,
  planeScale = 10.0,
  vignetteDarkness = 1.5,
  vignetteOffset = 0.4,
  className = "",
}: ParticleBackgroundProps) => {
  return (
    <div id="particle-background" className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{
          position: [
            1.2629783123314589, 2.664606471394044, -1.8178993743288914,
          ],
          fov: 50,
          near: 0.01,
          far: 300,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#030303"]} />
        <Particles
          speed={speed}
          aperture={aperture}
          focus={focus}
          size={size}
          noiseScale={noiseScale}
          noiseIntensity={noiseIntensity}
          timeScale={timeScale}
          pointSize={pointSize}
          opacity={opacity}
          planeScale={planeScale}
          introspect={hovering}
        />
        <Effects multisamping={0} disableGamma>
          <shaderPass
            args={[VignetteShader]}
            uniforms-darkness-value={vignetteDarkness}
            uniforms-offset-value={vignetteOffset}
          />
        </Effects>
      </Canvas>
    </div>
  );
};

export default ParticleBackground;
