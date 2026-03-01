import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function Stars() {
    const ref = useRef<THREE.Points>(null);
    
    const positions = new Float32Array(5000 * 3);
    for (let i = 0; i < 5000; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x -= delta / 10;
            ref.current.rotation.y -= delta / 15;
        }
    });

    return (
        <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
            <PointMaterial
                transparent
                color="#4a90e2"
                size={0.05}
                sizeAttenuation={true}
                depthWrite={false}
            />
        </Points>
    );
}

function Particles() {
    const ref = useRef<THREE.Points>(null);
    
    const positions = new Float32Array(1000 * 3);
    for (let i = 0; i < 1000; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }

    useFrame((state) => {
        if (ref.current) {
            ref.current.rotation.x = state.clock.elapsedTime / 20;
            ref.current.rotation.y = state.clock.elapsedTime / 30;
        }
    });

    return (
        <Points ref={ref} positions={positions} stride={3}>
            <PointMaterial
                transparent
                color="#7c3aed"
                size={0.08}
                sizeAttenuation={true}
                depthWrite={false}
                opacity={0.6}
            />
        </Points>
    );
}

export default function ThreeBackground() {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: -1,
            opacity: 0.4
        }}>
            <Canvas camera={{ position: [0, 0, 1] }}>
                <Stars />
                <Particles />
            </Canvas>
        </div>
    );
}
