"use client";

import { useEffect, useRef, useCallback } from "react";

// ─── LeadPulseCanvas ────────────────────────────────────────────────────────
// Replaces GlobeCanvas on the landing page.
//
// Idea: Converza AI calls leads. Show that visually — phone-call bubbles
// rising from a central hub, rings rippling outward, and Hinglish
// WhatsApp-style text bubbles popping up like leads being picked up and
// qualified.
//
// Tech: Three.js (dynamic import inside useEffect), vanilla requestAnimationFrame.
// Cheap: ~120 ambient particles + spawned phone-bubble dots + text sprites.
// ─────────────────────────────────────────────────────────────────────────────

const HINGLISH_LINES = [
  "ब Assigning lead...",
  "📞 Calling Rajesh now",
  "हाँ साइट विजिट बुक हो गया",
  "Budget ₹45 LPA, 2BHK",
  "WhatsApp summary भेज दो",
  "✅ Call connected!",
  "Follow-up Day 3 पर",
  "Lead score: 87/100",
  "🗓️ Site visit: Tomorrow 11 AM",
  "Hinglish में कॉल हो रही है",
  "No-show → retry in 2 hrs",
  "Qualified ✓ booked ✓",
];

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

interface LeadPulseCanvasProps {
  scale?: number;
}

export default function LeadPulseCanvas({ scale = 1 }: LeadPulseCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const bubblesRef = useRef<any[]>([]);
  const ringsRef = useRef<any[]>([]);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX.current = (e.clientX - rect.left) / rect.width - 0.5;
      mouseY.current = (e.clientY - rect.top) / rect.height - 0.5;
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isMounted = true;
    let animationId: number | null = null;

    (async () => {
      const THREE = await import("three");
      if (!isMounted || !container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;
      const T = THREE;

      // Scene
      const scene = new T.Scene();
      sceneRef.current = scene;

      // Camera
      const camera = new T.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 0.5, 4.5);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Renderer
      const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.sortObjects = true;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // ─── Background glow ─────────────────────────────────────────────────
      const bgCanvas = document.createElement("canvas");
      bgCanvas.width = 512;
      bgCanvas.height = 512;
      const bgCtx = bgCanvas.getContext("2d")!;
      const bgGrad = bgCtx.createRadialGradient(256, 256, 0, 256, 256, 256);
      bgGrad.addColorStop(0, "rgba(52, 211, 153, 0.18)");
      bgGrad.addColorStop(0.4, "rgba(52, 211, 153, 0.06)");
      bgGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      bgCtx.fillStyle = bgGrad;
      bgCtx.fillRect(0, 0, 512, 512);
      const bgTexture = new T.CanvasTexture(bgCanvas);
      const bgMat = new T.SpriteMaterial({
        map: bgTexture,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      });
      const bgSprite = new T.Sprite(bgMat);
      bgSprite.scale.set(8, 8, 1);
      bgSprite.position.set(0, 0, -2);
      scene.add(bgSprite);

      // ─── Grid floor (subtle) ─────────────────────────────────────────────
      const gridHelper = new T.GridHelper(6, 20, 0x34D399, 0x1B4332);
      gridHelper.position.y = -1.2;
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.15;
      scene.add(gridHelper);

      // ─── Ring material (for expanding rings) ─────────────────────────────
      const ringMat = new T.LineBasicMaterial({
        color: 0x34D399,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });

      // ─── Ambient particle field ──────────────────────────────────────────
      const particleCount = 120;
      const positions: number[] = [];
      const colors: number[] = [];
      const sizes: number[] = [];
      for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 1.8 + Math.random() * 2.2;
        positions.push(
          r * Math.sin(phi) * Math.cos(theta),
          (Math.random() - 0.5) * 3.0,
          r * Math.sin(phi) * Math.sin(theta),
        );
        const c = new T.Color().setHSL(
          0.32 + Math.random() * 0.1,
          0.7,
          0.4 + Math.random() * 0.3,
        );
        colors.push(c.r, c.g, c.b);
        sizes.push(0.02 + Math.random() * 0.04);
      }
      const particleGeo = new T.BufferGeometry();
      particleGeo.setAttribute(
        "position",
        new T.Float32BufferAttribute(positions, 3),
      );
      particleGeo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      particleGeo.setAttribute("size", new T.Float32BufferAttribute(sizes, 1));
      const particleMat = new T.PointsMaterial({
        size: 0.035,
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
      });
      const particles = new T.Points(particleGeo, particleMat);
      scene.add(particles);

      // ─── Central hub (the "AI brain" / call origin) ─────────────────────
      const hubGeo = new T.SphereGeometry(0.25, 24, 24);
      const hubMat = new T.MeshBasicMaterial({
        color: 0x34D399,
        transparent: true,
        opacity: 0.3,
      });
      const hub = new T.Mesh(hubGeo, hubMat);
      hub.position.set(0, 0, 0);
      scene.add(hub);

      const hubOuterGeo = new T.SphereGeometry(0.35, 16, 16);
      const hubOuterMat = new T.MeshBasicMaterial({
        color: 0x34D399,
        transparent: true,
        opacity: 0.12,
        wireframe: true,
      });
      const hubOuter = new T.Mesh(hubOuterGeo, hubOuterMat);
      hubOuter.position.set(0, 0, 0);
      scene.add(hubOuter);

      // ─── Text sprite material (shared) ───────────────────────────────────
      const textSpriteMat = new T.SpriteMaterial({
        transparent: true,
        depthWrite: false,
        blending: T.NormalBlending,
      });

      // ─── Spawn helpers ───────────────────────────────────────────────────
      const spawnBubble = () => {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.3 + Math.random() * 0.4;
        const height = (Math.random() - 0.5) * 2.0;

        const pos: [number, number, number] = [
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius,
        ];
        const velocity: [number, number, number] = [
          (Math.random() - 0.5) * 0.008,
          0.006 + Math.random() * 0.012,
          (Math.random() - 0.5) * 0.008,
        ];

        // Ring at origin (the call origin ripple)
        const ringGeo = new T.RingGeometry(0.06, 0.10, 32);
        const ring = new T.Mesh(ringGeo, ringMat.clone());
        ring.position.set(0, 0, 0);
        ring.rotation.x = -Math.PI / 2;
        ring.renderOrder = 1;
        scene.add(ring);
        ringsRef.current.push(ring);

        // Bubble dot (glowing = a lead being called)
        const color = new T.Color().setHSL(
          0.32 + Math.random() * 0.08,
          0.8,
          0.55 + Math.random() * 0.25,
        );
        const dotGeo = new T.SphereGeometry(0.04, 8, 8);
        const dotMat = new T.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
        });
        const dot = new T.Mesh(dotGeo, dotMat);
        dot.position.set(pos[0], pos[1], pos[2]);
        dot.renderOrder = 2;
        scene.add(dot);

        // Phone ring around the dot
        const phoneRingGeo = new T.RingGeometry(0.05, 0.075, 24);
        const phoneRingMat = ringMat.clone();
        phoneRingMat.opacity = 0.4;
        phoneRingMat.color.copy(color);
        const phoneRing = new T.Mesh(phoneRingGeo, phoneRingMat);
        phoneRing.position.copy(dot.position);
        phoneRing.rotation.x = -Math.PI / 2;
        phoneRing.renderOrder = 1;
        scene.add(phoneRing);
        ringsRef.current.push(phoneRing);

        bubblesRef.current.push({
          position: pos,
          velocity,
          phase: Math.random() * Math.PI * 2,
          ring,
          _dot: dot,
          _phoneRing: phoneRing,
          _age: 0,
        });
      };

      const spawnTextBubble = () => {
        const line =
          HINGLISH_LINES[
            Math.floor(Math.random() * HINGLISH_LINES.length)
          ];
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext("2d")!;

        ctx.clearRect(0, 0, 256, 64);

        // Bubble background
        ctx.fillStyle = "rgba(16, 23, 19, 0.85)";
        ctx.strokeStyle = "#34D399";
        ctx.lineWidth = 1.5;
        roundRect(ctx, 6, 6, 244, 52, 14);
        ctx.fill();
        ctx.stroke();

        // Tail
        ctx.fillStyle = "rgba(16, 23, 19, 0.85)";
        ctx.beginPath();
        ctx.moveTo(6, 40);
        ctx.lineTo(0, 52);
        ctx.lineTo(6, 52);
        ctx.closePath();
        ctx.fill();

        // Text
        ctx.fillStyle = "#F0F7F3";
        ctx.font = "500 18px 'Inter', 'JetBrains Mono', monospace";
        ctx.textBaseline = "middle";
        ctx.fillText(line, 24, 32);

        const texture = new T.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const mat = textSpriteMat.clone();
        mat.map = texture;
        mat.opacity = 0;
        const sprite = new T.Sprite(mat);
        sprite.position.set(
          (Math.random() - 0.5) * 1.8,
          -0.6 + Math.random() * 1.2,
          -1.5 - Math.random() * 0.8,
        );
        sprite.scale.set(1.4, 0.35, 1);
        sprite.renderOrder = 3;
        scene.add(sprite);

        // Animate in / out
        const start = performance.now();
        const duration = 1200 + Math.random() * 800;
        const fadeOutStart = start + 2500 + Math.random() * 1500;

        const animText = () => {
          const elapsed = performance.now() - start;

          if (elapsed < 400) {
            mat.opacity = elapsed / 400;
          } else if (
            elapsed > fadeOutStart - 400 &&
            elapsed < fadeOutStart
          ) {
            mat.opacity =
              1 - (elapsed - (fadeOutStart - 400)) / 400;
          } else if (elapsed > fadeOutStart) {
            mat.opacity = 0;
            sprite.visible = false;
            return;
          } else {
            mat.opacity = 1;
          }

          sprite.position.y += 0.002;
          sprite.position.x += Math.sin(elapsed * 0.002) * 0.0008;

          if (!sprite.visible) return;
          requestAnimationFrame(animText);
        };
        animText();
      };

      // ─── State ────────────────────────────────────────────────────────────
      const state = {
        lastSpawnAt: performance.now(),
        lastTextSpawnAt: performance.now(),
      };
      const spawnInterval = 650;
      const textSpawnInterval = 3200;

      // ─── Animation loop ───────────────────────────────────────────────────
      const animate = () => {
        if (!isMounted || !scene || !camera || !renderer) return;

        const now = performance.now();

        // Ambient particles rotate slowly
        particles.rotation.y += 0.0012;
        particles.rotation.x += 0.0004;

        // Pulse hub
        const pulse = 0.25 + Math.sin(now * 0.003) * 0.08;
        hub.scale.setScalar(pulse / 0.25);
        hubOuter.scale.setScalar(
          (0.35 + Math.sin(now * 0.002) * 0.05) / 0.35,
        );
        hubOuter.rotation.x += 0.005;
        hubOuter.rotation.y += 0.007;

        // Spawn new bubbles
        if (
          now - state.lastSpawnAt > spawnInterval &&
          bubblesRef.current.length < 28
        ) {
          state.lastSpawnAt = now;
          spawnBubble();
        }

        // Spawn text bubbles occasionally
        if (now - state.lastTextSpawnAt > textSpawnInterval) {
          state.lastTextSpawnAt = now;
          spawnTextBubble();
        }

        // Update existing bubbles
        for (let i = bubblesRef.current.length - 1; i >= 0; i--) {
          const b = bubblesRef.current[i];
          b._age += 1;
          b.position[0] += b.velocity[0];
          b.position[1] += b.velocity[1];
          b.position[2] += b.velocity[2];

          const ageFactor = Math.min(b._age / 180, 1);
          b._dot.material.opacity = Math.max(
            0,
            0.9 * (1 - ageFactor * 0.7),
          );
          b._phoneRing.material.opacity = Math.max(
            0,
            0.4 * (1 - ageFactor * 0.8),
          );

          if (b.ring) {
            const ringScale = 1 + ageFactor * 3;
            b.ring.scale.set(ringScale, ringScale, ringScale);
            b.ring.material.opacity = Math.max(
              0,
              0.3 * (1 - ageFactor * 0.9),
            );
          }

          b.position[1] +=
            Math.sin(now * 0.003 + b.phase) * 0.0004;

          if (ageFactor > 0.85) {
            scene.remove(b._dot);
            scene.remove(b._phoneRing);
            b._dot.geometry.dispose();
            b._dot.material.dispose();
            b._phoneRing.geometry.dispose();
            b._phoneRing.material.dispose();
            if (b.ring) {
              scene.remove(b.ring);
              b.ring.geometry.dispose();
              b.ring.material.dispose();
            }
            bubblesRef.current.splice(i, 1);
          }
        }

        // Update standalone rings
        for (let i = ringsRef.current.length - 1; i >= 0; i--) {
          const ring = ringsRef.current[i];
          if (!ring.parent) {
            ringsRef.current.splice(i, 1);
            continue;
          }
          ring.rotation.z += 0.01;
          const scale = ring.scale.x;
          if (scale > 4) {
            ring.material.opacity -= 0.02;
            if (ring.material.opacity <= 0) {
              scene.remove(ring);
              ring.geometry.dispose();
              ring.material.dispose();
              ringsRef.current.splice(i, 1);
            }
          }
        }

        // Mouse parallax on whole scene
        const targetRotX = mouseY.current * 0.08;
        const targetRotY = mouseX.current * 0.12;
        scene.rotation.x += (targetRotX - scene.rotation.x) * 0.03;
        scene.rotation.y += (targetRotY - scene.rotation.y) * 0.03;

        renderer.render(scene, camera);
        animationId = requestAnimationFrame(animate);
      };

      animate();

      // ─── Resize ───────────────────────────────────────────────────────────
      const handleResize = () => {
        if (!container || !camera || !renderer) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    })();

    return () => {
      isMounted = false;
      if (animationId !== null) cancelAnimationFrame(animationId);

      if (sceneRef.current) {
        sceneRef.current.traverse((obj: any) => {
          if (obj?.geometry) obj.geometry.dispose();
          if (obj?.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m: any) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      }
      if (rendererRef.current && container) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      bubblesRef.current = [];
      ringsRef.current = [];
    };
  }, [handleMouseMove]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ transform: `scale(${scale})` }}
      onMouseMove={handleMouseMove}
    />
  );
}
