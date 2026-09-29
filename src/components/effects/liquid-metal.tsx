"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Liquid metal shader background, adapted from metal.jakubantalik.com.
 * The fragment shader (simplex-noise FBM plasma → 5-stop palette, cross-blur,
 * vignette) below is lifted verbatim from that site's production bundle. The
 * original engine also shares one small offscreen canvas across every
 * instance and samples the page behind it for a reflection glow; this port
 * keeps the shader itself faithful but gives each instance its own canvas
 * and skips the reflection-sampling machinery, since that's a page-wide
 * optimization/feature orthogonal to the visual effect itself.
 */

const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec3 u_color1, u_color2, u_color3, u_color4, u_color5, u_color6, u_color7;
  uniform float u_alpha1, u_alpha2, u_alpha3, u_alpha4, u_alpha5, u_alpha6, u_alpha7;
  uniform float u_intensity, u_scale, u_direction;
  uniform float u_softness, u_distortion, u_complexity, u_shape;
  uniform float u_vignette, u_vigOpacity, u_blur, u_shaderOpacity;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289((x * 34.0 + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289v2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x_) - 0.5;
    vec3 ox = floor(x_ + 0.5);
    vec3 a0 = x_ - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p, float oct) {
    float val = 0.0, amp = 0.5;
    int n = int(oct);
    for (int i = 0; i < 7; i++) {
      if (i >= n) break;
      val += amp * snoise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return val;
  }

  float nfbm(vec2 p) { return fbm(p, 3.0 + u_complexity * 4.0); }

  vec3 palette(float t) {
    t = clamp(t, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    float k = 64.0;
    float w1 = u_alpha1 * exp(-k * t * t);
    float w2 = u_alpha2 * exp(-k * (t - 0.25) * (t - 0.25));
    float w3 = u_alpha3 * exp(-k * (t - 0.5)  * (t - 0.5));
    float w4 = u_alpha4 * exp(-k * (t - 0.75) * (t - 0.75));
    float w5 = u_alpha5 * exp(-k * (t - 1.0)  * (t - 1.0));
    float total = w1 + w2 + w3 + w4 + w5 + 0.0001;
    return (u_color1 * w1 + u_color2 * w2 + u_color3 * w3 +
            u_color4 * w4 + u_color5 * w5) / total;
  }

  vec2 warp(vec2 p, float t) {
    float str = u_distortion * 2.0;
    return vec2(
      nfbm(p + vec2(t * 0.1, 0.0)),
      nfbm(p + vec2(0.0, t * 0.12) + 5.0)
    ) * str;
  }

  vec3 computeEffect(vec2 uv, float aspect, float t, float dist, float cpx) {
    vec2 p = (uv - 0.5) * u_scale;
    p.x *= aspect;
    p += vec2(cos(u_direction), sin(u_direction)) * t * 0.15;

    float freq = 3.0 + cpx * 8.0;
    float val = 0.0;
    val += sin(p.x * freq + t);
    val += sin(p.y * freq + t * 1.3);
    val += sin((p.x + p.y) * freq * 0.7 + t * 0.7);
    val += sin(length(p) * freq * 0.8 - t * 1.5);
    vec2 w = warp(p, t);
    val += (w.x + w.y) * dist;
    val = val * 0.2 * u_intensity + 0.5;

    return palette(clamp(val, 0.0, 1.0));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    float t = u_time;
    float dist = u_distortion;
    float cpx = u_complexity;

    vec3 col;
    if (u_blur < 0.01) {
      col = computeEffect(uv, aspect, t, dist, cpx);
    } else {
      float r = u_blur * 0.02;
      col  = computeEffect(uv,                  aspect, t, dist, cpx) * 0.4;
      col += computeEffect(uv + vec2( r, 0.0),  aspect, t, dist, cpx) * 0.15;
      col += computeEffect(uv + vec2(-r, 0.0),  aspect, t, dist, cpx) * 0.15;
      col += computeEffect(uv + vec2(0.0,  r),  aspect, t, dist, cpx) * 0.15;
      col += computeEffect(uv + vec2(0.0, -r),  aspect, t, dist, cpx) * 0.15;
    }

    col = pow(col, vec3(1.3));

    float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float vigPx = 40.0 / min(u_resolution.x, u_resolution.y);
    float vigRange = vigPx * (1.0 + u_vignette * 3.0);
    float vig = edgeDist * edgeDist / (vigRange * vigRange);
    vig = smoothstep(0.0, 1.0, vig);
    col *= mix(1.0, vig, u_vignette * u_vigOpacity);

    float colorAlpha = (u_alpha1 + u_alpha2 + u_alpha3 + u_alpha4 + u_alpha5) / 5.0;
    float alpha = colorAlpha;
    alpha += 0.0 * (u_softness + u_shape + u_alpha6 + u_alpha7 + u_color6.x + u_color7.x);

    gl_FragColor = vec4(col, alpha * u_shaderOpacity);
  }
`;

const UNIFORM_NAMES = [
	"u_resolution", "u_time",
	"u_color1", "u_color2", "u_color3", "u_color4", "u_color5", "u_color6", "u_color7",
	"u_alpha1", "u_alpha2", "u_alpha3", "u_alpha4", "u_alpha5", "u_alpha6", "u_alpha7",
	"u_intensity", "u_scale", "u_direction",
	"u_softness", "u_distortion", "u_complexity", "u_shape",
	"u_vignette", "u_vigOpacity", "u_blur", "u_shaderOpacity",
] as const;

interface PresetMode {
	colors: [string, string, string, string, string, string, string];
	alphas: [number, number, number, number, number, number, number];
	direction: number;
	speed: number;
	intensity: number;
	scale: number;
	softness: number;
	distortion: number;
	complexity: number;
	shape: number;
	blur: number;
	vignette: number;
	vigOpacity: number;
	shaderOpacity: number;
}

export type LiquidMetalVariant = "chromatic" | "silver" | "gold";

// Verbatim from the source site's chromatic/silver/gold presets.
const PRESETS: Record<LiquidMetalVariant, { dark: PresetMode; light: PresetMode }> = {
	chromatic: {
		dark: { colors: ["#000000", "#aae8ff", "#c5fe9e", "#f7888d", "#0d0d0d", "#fffdc3", "#007cff"], alphas: [1, 1, 1, 1, 1, 1, 1], direction: 80, speed: 1.2, intensity: 2, scale: 1.6, softness: 0.18, distortion: 0.3, complexity: 0.68, shape: 1, blur: 1, vignette: 0.26, vigOpacity: 0.6, shaderOpacity: 1 },
		light: { colors: ["#ffffff", "#ffffff", "#ffffff", "#ffb3b3", "#adadad", "#f5ff70", "#007cff"], alphas: [1, 1, 1, 1, 1, 1, 1], direction: 80, speed: 1.2, intensity: 2, scale: 2.5, softness: 0.18, distortion: 0.3, complexity: 0.68, shape: 1, blur: 1, vignette: 0.24, vigOpacity: 0.16, shaderOpacity: 1 },
	},
	silver: {
		dark: { colors: ["#000000", "#dedede", "#747270", "#e5e5e5", "#0d0d0d", "#ffffff", "#e6e6e6"], alphas: [1, 1, 1, 1, 1, 1, 1], direction: 80, speed: 1.2, intensity: 2, scale: 2.5, softness: 0.18, distortion: 0.3, complexity: 0.68, shape: 1, blur: 1, vignette: 0.26, vigOpacity: 0.6, shaderOpacity: 0.88 },
		light: { colors: ["#f6f6f6", "#ffffff", "#ffffff", "#f7f7f7", "#c9c9c9", "#d0d0d0", "#d1d1d1"], alphas: [1, 1, 1, 1, 1, 1, 1], direction: 80, speed: 1.2, intensity: 2, scale: 2.5, softness: 0.18, distortion: 0.3, complexity: 0.68, shape: 1, blur: 1, vignette: 0.2, vigOpacity: 0.26, shaderOpacity: 1 },
	},
	gold: {
		dark: { colors: ["#000000", "#ffffff", "#ffffff", "#f7d488", "#0d0d0d", "#fffdc3", "#ffffff"], alphas: [1, 1, 1, 1, 1, 1, 1], direction: 80, speed: 1, intensity: 2, scale: 2.5, softness: 0.18, distortion: 0.3, complexity: 0.68, shape: 1, blur: 1, vignette: 0.26, vigOpacity: 0.6, shaderOpacity: 0.92 },
		light: { colors: ["#fff8e1", "#fffbe0", "#ffffff", "#fff6d6", "#d2c7a7", "#dcd2bc", "#f9f7e5"], alphas: [1, 1, 1, 1, 1, 1, 1], direction: 80, speed: 1.2, intensity: 2, scale: 2.5, softness: 0.18, distortion: 0.3, complexity: 0.68, shape: 1, blur: 1, vignette: 0.22, vigOpacity: 0.24, shaderOpacity: 1 },
	},
};

function hexToRgb01(hex: string): [number, number, number] {
	const n = Number.parseInt(hex.slice(1), 16);
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("liquid-metal: createShader returned null");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`liquid-metal: shader compile failed: ${log ?? "(no info log)"}`);
	}
	return shader;
}

function linkProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
	const program = gl.createProgram();
	if (!program) throw new Error("liquid-metal: createProgram returned null");
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error(`liquid-metal: program link failed: ${log ?? "(no info log)"}`);
	}
	return program;
}

export interface LiquidMetalProps {
	variant?: LiquidMetalVariant;
	className?: string;
	/** Freezes the animation on the first frame — respects prefers-reduced-motion by default. */
	animate?: boolean;
}

export function LiquidMetal({ variant = "chromatic", className, animate = true }: LiquidMetalProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const { resolvedTheme } = useTheme();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false });
		if (!gl) return;

		const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
		const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
		const program = linkProgram(gl, vs, fs);
		gl.useProgram(program);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
		const positionLoc = gl.getAttribLocation(program, "a_position");
		gl.enableVertexAttribArray(positionLoc);
		gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

		const uniforms = Object.fromEntries(
			UNIFORM_NAMES.map((name) => [name, gl.getUniformLocation(program, name)]),
		) as Record<(typeof UNIFORM_NAMES)[number], WebGLUniformLocation | null>;

		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const mode = resolvedTheme === "light" ? "light" : "dark";
		const preset = PRESETS[variant][mode];
		const colors = preset.colors.map(hexToRgb01);
		const dpr = Math.min(2, window.devicePixelRatio || 1);

		let rafId = 0;
		const startMs = performance.now();

		function resize() {
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			canvas.width = Math.max(1, Math.round(rect.width * dpr));
			canvas.height = Math.max(1, Math.round(rect.height * dpr));
			gl!.viewport(0, 0, canvas.width, canvas.height);
		}

		function draw(now: number) {
			if (!gl) return;
			const elapsed = ((now - startMs) / 1000) * preset.speed;
			gl.uniform2f(uniforms.u_resolution, canvas!.width, canvas!.height);
			gl.uniform1f(uniforms.u_time, elapsed);
			colors.forEach((c, i) => gl.uniform3f(uniforms[`u_color${i + 1}` as keyof typeof uniforms], ...c));
			preset.alphas.forEach((a, i) => gl.uniform1f(uniforms[`u_alpha${i + 1}` as keyof typeof uniforms], a));
			gl.uniform1f(uniforms.u_intensity, preset.intensity);
			gl.uniform1f(uniforms.u_scale, preset.scale);
			gl.uniform1f(uniforms.u_direction, preset.direction);
			gl.uniform1f(uniforms.u_softness, preset.softness);
			gl.uniform1f(uniforms.u_distortion, preset.distortion);
			gl.uniform1f(uniforms.u_complexity, preset.complexity);
			gl.uniform1f(uniforms.u_shape, preset.shape);
			gl.uniform1f(uniforms.u_vignette, preset.vignette);
			gl.uniform1f(uniforms.u_vigOpacity, preset.vigOpacity);
			gl.uniform1f(uniforms.u_blur, preset.blur);
			gl.uniform1f(uniforms.u_shaderOpacity, preset.shaderOpacity);
			gl.drawArrays(gl.TRIANGLES, 0, 6);

			if (animate && !reduceMotion) rafId = requestAnimationFrame(draw);
		}

		resize();
		draw(performance.now());

		const resizeObserver = new ResizeObserver(() => {
			resize();
			if (!animate || reduceMotion) draw(performance.now());
		});
		resizeObserver.observe(canvas);

		return () => {
			cancelAnimationFrame(rafId);
			resizeObserver.disconnect();
			gl.deleteBuffer(buffer);
			gl.deleteProgram(program);
		};
	}, [variant, resolvedTheme, animate]);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden="true"
			className={cn("block h-full w-full", className)}
		/>
	);
}
