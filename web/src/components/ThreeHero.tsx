"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function ThreeHero() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(4.45, 4.85, 7.55);
    camera.lookAt(0, 0.12, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const courtGroup = new THREE.Group();
    courtGroup.rotation.x = -0.02;
    courtGroup.position.y = 0.72;
    scene.add(courtGroup);

    const courtWidth = 4.4;
    const courtLength = 8.4;

    const court = new THREE.Mesh(
      new THREE.BoxGeometry(courtWidth, 0.04, courtLength),
      new THREE.MeshStandardMaterial({
        color: 0x2f8c82,
        roughness: 0.84,
        metalness: 0.02,
      })
    );
    courtGroup.add(court);

    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const addLine = (width: number, depth: number, x: number, z: number) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.022, depth), lineMaterial);
      line.position.set(x, 0.046, z);
      courtGroup.add(line);
    };

    addLine(courtWidth + 0.08, 0.055, 0, -courtLength / 2);
    addLine(courtWidth + 0.08, 0.055, 0, courtLength / 2);
    addLine(0.055, courtLength + 0.08, -courtWidth / 2, 0);
    addLine(0.055, courtLength + 0.08, courtWidth / 2, 0);
    addLine(courtWidth + 0.08, 0.055, 0, -1.16);
    addLine(courtWidth + 0.08, 0.055, 0, 1.16);
    addLine(0.055, 3.04, 0, -2.68);
    addLine(0.055, 3.04, 0, 2.68);

    const netMaterial = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      opacity: 0.2,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const netPanel = new THREE.Mesh(new THREE.PlaneGeometry(courtWidth + 0.14, 0.42), netMaterial);
    netPanel.position.set(0, 0.36, 0);
    courtGroup.add(netPanel);

    const netBandMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42 });
    const netTopBand = new THREE.Mesh(new THREE.BoxGeometry(courtWidth + 0.26, 0.06, 0.075), netBandMaterial);
    netTopBand.position.set(0, 0.59, 0);
    courtGroup.add(netTopBand);

    const netCordMaterial = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      opacity: 0.62,
      transparent: true,
    });
    const netWidth = courtWidth + 0.14;
    for (let index = 0; index <= 10; index += 1) {
      const x = -netWidth / 2 + (netWidth / 10) * index;
      const cord = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.4, 0.014), netCordMaterial);
      cord.position.set(x, 0.36, 0.01);
      courtGroup.add(cord);
    }
    for (let index = 0; index <= 3; index += 1) {
      const y = 0.18 + index * 0.1;
      const cord = new THREE.Mesh(new THREE.BoxGeometry(netWidth, 0.01, 0.014), netCordMaterial);
      cord.position.set(0, y, 0.012);
      courtGroup.add(cord);
    }

    const postGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.68, 16);
    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.36 });
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(side * (courtWidth / 2 + 0.12), 0.36, 0);
      courtGroup.add(post);
    });

    const ballRadius = 0.24;
    const ballGroup = new THREE.Group();
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballRadius, 48, 48),
      new THREE.MeshStandardMaterial({
        color: 0xc4ff31,
        roughness: 0.68,
        emissive: 0x254400,
        emissiveIntensity: 0.11,
      })
    );
    ballGroup.add(ball);

    const holeMaterial = new THREE.MeshBasicMaterial({ color: 0x345a08 });
    const holeRimMaterial = new THREE.MeshBasicMaterial({
      color: 0x94c91f,
      opacity: 0.28,
      transparent: true,
    });
    const seamMaterial = new THREE.MeshBasicMaterial({
      color: 0x89ca1b,
      opacity: 0.35,
      transparent: true,
    });

    const wobble = (seed: number) => {
      const value = Math.sin(seed * 12.9898) * 43758.5453;
      return value - Math.floor(value);
    };

    for (let index = 0; index < 34; index += 1) {
      const seed = index + 1;
      const y = 1 - (2 * (index + 0.5)) / 34 + (wobble(seed + 8) - 0.5) * 0.12;
      const radiusAtLatitude = Math.sqrt(Math.max(0, 1 - y * y));
      const angle = index * 2.399963 + (wobble(seed + 13) - 0.5) * 0.48;
      const normal = new THREE.Vector3(
        Math.cos(angle) * radiusAtLatitude,
        THREE.MathUtils.clamp(y, -0.92, 0.92),
        Math.sin(angle) * radiusAtLatitude
      ).normalize();
      const size = 0.023 + wobble(seed + 21) * 0.011;

      const rim = new THREE.Mesh(new THREE.CircleGeometry(size * 1.45, 18), holeRimMaterial);
      rim.position.copy(normal.clone().multiplyScalar(ballRadius + 0.004 + index * 0.00001));
      rim.lookAt(normal.clone().multiplyScalar(2));
      ballGroup.add(rim);

      const hole = new THREE.Mesh(new THREE.CircleGeometry(size, 18), holeMaterial);
      hole.position.copy(normal.clone().multiplyScalar(ballRadius + 0.006 + index * 0.00001));
      hole.lookAt(normal.clone().multiplyScalar(2));
      ballGroup.add(hole);
    }

    const speckMaterial = new THREE.MeshBasicMaterial({
      color: 0xe1ff80,
      opacity: 0.28,
      transparent: true,
    });
    for (let index = 0; index < 34; index += 1) {
      const seed = index + 100;
      const y = wobble(seed) * 1.8 - 0.9;
      const radiusAtLatitude = Math.sqrt(Math.max(0, 1 - y * y));
      const angle = wobble(seed + 1) * Math.PI * 2;
      const normal = new THREE.Vector3(Math.cos(angle) * radiusAtLatitude, y, Math.sin(angle) * radiusAtLatitude);
      const speck = new THREE.Mesh(new THREE.CircleGeometry(0.004 + wobble(seed + 2) * 0.003, 8), speckMaterial);
      speck.position.copy(normal.clone().multiplyScalar(ballRadius + 0.007 + index * 0.00001));
      speck.lookAt(normal.clone().multiplyScalar(2));
      ballGroup.add(speck);
    }

    const seam = new THREE.Mesh(new THREE.TorusGeometry(ballRadius * 1.01, 0.0024, 8, 96), seamMaterial);
    seam.rotation.set(0.28, 0.12, -0.56);
    ballGroup.add(seam);
    ballGroup.position.set(1.35, 1.68, -1.75);
    scene.add(ballGroup);

    const spot = new THREE.PointLight(0xa3e635, 8, 9);
    spot.position.set(1.8, 2.4, -2.1);
    scene.add(spot);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x123132, 2.6));

    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(4, 6, 5.4);
    scene.add(key);

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    let frameId = 0;
    const clock = new THREE.Clock();

    const render = () => {
      const elapsed = clock.getElapsedTime();
      if (!reducedMotion) {
        ballGroup.position.y = 1.68 + Math.abs(Math.sin(elapsed * 1.2)) * 0.3;
        ballGroup.position.x = 1.48 + Math.sin(elapsed * 0.65) * 0.24;
        ballGroup.rotation.x += 0.018;
        ballGroup.rotation.y += 0.014;
        courtGroup.rotation.y = Math.sin(elapsed * 0.18) * 0.03;
      }
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => materials.add(material));
          } else {
            materials.add(object.material);
          }
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    };
  }, []);

  return <div ref={containerRef} className="home-three" aria-hidden="true" />;
}
