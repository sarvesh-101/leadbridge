"use client";

import { useEffect, useRef, useCallback } from "react";

export default function GlobeCanvas({ scale = 1 }: { scale?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useRef(0);
  const mouseY = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.current = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    mouseY.current = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationId: number | null = null;
    let scene: any = null;
    let camera: any = null;
    let renderer: any = null;
    let objects: any[] = [];
    let isMounted = true;

    const init = async () => {
      const THREE = await import("three");

      if (!isMounted || !container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      // Scene
      scene = new THREE.Scene();

      // Camera
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);

      // Renderer
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Globe - Wireframe Sphere
      const geometry = new THREE.SphereGeometry(2, 32, 32);
      const material = new THREE.MeshBasicMaterial({
        color: 0x4f6ef7,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      });
      const globe = new THREE.Mesh(geometry, material);
      scene.add(globe);
      objects.push(globe, geometry, material);

      // Inner wireframe
      const innerGeo = new THREE.SphereGeometry(1.95, 24, 24);
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0x4f6ef7,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
      });
      const innerGlobe = new THREE.Mesh(innerGeo, innerMat);
      scene.add(innerGlobe);
      objects.push(innerGlobe, innerGeo, innerMat);

      // Particles
      const particlePositions: number[] = [];
      const particleColors: number[] = [];
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        if (i % 2 === 0) {
          particlePositions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
          const brightness = 0.4 + Math.random() * 0.6;
          particleColors.push(0.31 * brightness, 0.43 * brightness, 0.97 * brightness);
        }
      }
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute("position", new THREE.Float32BufferAttribute(particlePositions, 3));
      particleGeo.setAttribute("color", new THREE.Float32BufferAttribute(particleColors, 3));
      const particleMat = new THREE.PointsMaterial({
        size: 0.04,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
      });
      const particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);
      objects.push(particles, particleGeo, particleMat);

      // Lat/Long rings
      const ringMaterial = new THREE.LineBasicMaterial({
        color: 0x4f6ef7,
        transparent: true,
        opacity: 0.1,
      });
      for (let angle = -60; angle <= 60; angle += 30) {
        if (angle === 0) continue;
        const ringPoints: number[] = [];
        const rad = (angle * Math.PI) / 180;
        for (let i = 0; i <= 64; i++) {
          const theta = (i / 64) * Math.PI * 2;
          const x = 2 * Math.cos(theta) * Math.cos(rad);
          const y = 2 * Math.sin(rad);
          const z = 2 * Math.sin(theta) * Math.cos(rad);
          ringPoints.push(x, y, z);
        }
        const ringGeo = new THREE.BufferGeometry();
        ringGeo.setAttribute("position", new THREE.Float32BufferAttribute(ringPoints, 3));
        const ringLine = new THREE.Line(ringGeo, ringMaterial);
        scene.add(ringLine);
        objects.push(ringLine, ringGeo, ringMaterial);
      }

      // Event listeners
      window.addEventListener("mousemove", handleMouseMove);

      // Animation
      const animate = () => {
        if (!isMounted || !scene) return;

        globe.rotation.y += 0.002;
        innerGlobe.rotation.y += 0.0015;
        particles.rotation.y += 0.002;

        const targetRotX = mouseY.current * 0.05;
        const targetRotY = mouseX.current * 0.05;
        globe.rotation.x += (targetRotX - globe.rotation.x) * 0.05;
        globe.rotation.z += (-targetRotY - globe.rotation.z) * 0.05;
        innerGlobe.rotation.x += (targetRotX - innerGlobe.rotation.x) * 0.05;
        innerGlobe.rotation.z += (-targetRotY - innerGlobe.rotation.z) * 0.05;
        particles.rotation.x += (targetRotX - particles.rotation.x) * 0.05;
        particles.rotation.z += (-targetRotY - particles.rotation.z) * 0.05;

        renderer.render(scene, camera);
        animationId = requestAnimationFrame(animate);
      };

      animate();
    };

    init();

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
      isMounted = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (animationId !== null) cancelAnimationFrame(animationId);
      if (renderer && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      // Dispose all objects
      objects.forEach((obj) => {
        if (obj?.dispose) obj.dispose();
      });
      if (renderer?.dispose) renderer.dispose();
    };
  }, [handleMouseMove]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ transform: `scale(${scale})` }}
    />
  );
}
