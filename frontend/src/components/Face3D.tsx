// frontend/src/components/Face3D.tsx
import React, { useRef } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';

const hueToColor = (hue: number, sat: number = 0.8, light: number = 0.5) => {
  return new THREE.Color().setHSL(hue % 1.0, sat, light);
};

interface Face3DProps {
  parameters: any;
  showLabels?: boolean;
}

const Annotation: React.FC<{ 
  text: string; 
  target: [number, number, number]; 
  offset: [number, number, number]; 
  visible: boolean 
}> = ({ text, target, offset, visible }) => {
  if (!visible) return null;
  const labelPos: [number, number, number] = [target[0] + offset[0], target[1] + offset[1], target[2] + offset[2]];
  
  return (
    <group>
      <Line 
        points={[new THREE.Vector3(...target), new THREE.Vector3(...labelPos)]} 
        color="#0adb46" 
        lineWidth={1} 
        transparent 
        opacity={0.6} 
      />
      <mesh position={target}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#0adb46" />
      </mesh>
      <Html position={labelPos} center distanceFactor={10}>
        <div className="face-label">
          {text}
        </div>
      </Html>
    </group>
  );
};

export const Face3D: React.FC<Face3DProps> = ({ parameters: p, showLabels = false }) => {
  const groupRef = useRef<THREE.Group>(null);

  // --- Parameter Mapping ---
  const faceWidth = 1.0 + (p.face_width ?? 0.5) * 0.8;
  const faceHeight = 1.2 + (p.face_height ?? 0.5) * 1.0;
  const jawMod = 0.5 + (p.jaw_shape ?? 0.5) * 1.0;
  
  const eyeSize = 0.15 + (p.eye_size ?? 0.5) * 0.15;
  const eyeSpacing = 0.5 + (p.eye_spacing ?? 0.5) * 0.6;
  const eyeColor = hueToColor(p.eye_color_hue ?? 0.2, 0.9, 0.4);

  const skinColor = hueToColor(p.skin_tone_hue ?? 0.1, p.skin_tone_saturation ?? 0.4, 0.6);
  const chinColor = skinColor.clone().multiplyScalar(0.8);
  const featureColor = skinColor.clone().multiplyScalar(0.6).add(new THREE.Color(0.1, 0, 0));
  const secondaryColor = skinColor.clone().multiplyScalar(0.7);

  const mouthWidth = 0.4 + (p.mouth_width ?? 0.5) * 0.6;
  const mouthCurve = ((p.mouth_curve ?? 0.5) - 0.5) * 2.0;

  const noseSize = 0.15 + (p.asymmetry_factor ?? 0.1) * 1.5;

  // --- Functional Mapping ---
  const armorLevel = p.armor_plating ?? 0;
  const glow = p.glow_intensity ?? 0.5;

  const antLen = 0.8 + (p.antenna_length ?? 0.5) * 1.2;
  const antTheta = 0.6;
  const antTipX = faceWidth * 0.5 - Math.sin(antTheta) * antLen;
  const antTipY = faceHeight * 0.7 + Math.cos(antTheta) * antLen;

  return (
    <group ref={groupRef}>
      {/* 1. MAIN HEAD */}
      <mesh scale={[faceWidth, faceHeight, 1.0]}>
        {p.face_shape_type < 0.33 ? (
          <sphereGeometry args={[1, 32, 32]} />
        ) : p.face_shape_type < 0.66 ? (
          <boxGeometry args={[1.5, 1.5, 1.5]} />
        ) : (
          <octahedronGeometry args={[1.2]} />
        )}
        <meshStandardMaterial color={skinColor} roughness={0.7} />
      </mesh>
      <Annotation 
        visible={showLabels} 
        target={[0, faceHeight * 0.5, 0]} 
        offset={[3.0, 3.5, 1.0]} 
        text={`Skin Hue (Identity): ${p.skin_tone_hue?.toFixed(3)}`} 
      />
      <Annotation 
        visible={showLabels} 
        target={[0, faceHeight * 0.3, 0]} 
        offset={[3.5, 3.0, 1.0]} 
        text={`Skin Sat (Complexity): ${p.skin_tone_saturation?.toFixed(3)}`} 
      />
      <Annotation 
        visible={showLabels} 
        target={[faceWidth * 0.8, 0, 0]} 
        offset={[2.5, 0.5, 0]} 
        text={`Head Width (GC): ${p.face_width?.toFixed(3)}`} 
      />
      <Annotation 
        visible={showLabels} 
        target={[0, faceHeight * 0.8, 0]} 
        offset={[3.0, 1.5, 0.5]} 
        text={`Head Height (CpG): ${p.face_height?.toFixed(3)}`} 
      />
      <Annotation 
        visible={showLabels} 
        target={[0, faceHeight, 0]} 
        offset={[-3.5, 3.5, 0]} 
        text={`Head Shape (Species): ${p.face_shape_type?.toFixed(3)}`} 
      />

      {/* 1.1 ARMOR PLATES */}
      {armorLevel > 0.15 && (
        <>
          <group>
            <mesh position={[0, faceHeight * 0.5, 1.0]} rotation={[-0.4, 0, 0]}>
              <boxGeometry args={[faceWidth * 0.7, armorLevel * 0.6 + 0.1, 0.2]} />
              <meshStandardMaterial color="#666" metalness={1} roughness={0.2} />
            </mesh>
            <mesh position={[0, faceHeight * 0.5, 1.1]} rotation={[-0.4, 0, 0]}>
              <boxGeometry args={[faceWidth * 0.5, armorLevel * 0.3 + 0.05, 0.12]} />
              <meshStandardMaterial color="#0adb46" emissive="#0adb46" emissiveIntensity={glow * 4} />
            </mesh>
            {[-1, 1].map(side => (
              <mesh key={side} position={[side * faceWidth * 0.75, -0.1, 0.9]} rotation={[0, side * 0.7, 0]}>
                <boxGeometry args={[0.6, 0.7, 0.25]} />
                <meshStandardMaterial color="#555" metalness={1} roughness={0.1} />
              </mesh>
            ))}
          </group>
          <Annotation 
            visible={showLabels} 
            target={[0, faceHeight * 0.5, 1.0]} 
            offset={[-4.0, -0.5, 0.5]} 
            text={`Armor (Robustness): ${armorLevel.toFixed(3)}`} 
          />
        </>
      )}

      {/* 2. JAW / CHIN */}
      <group position={[0, -faceHeight * 0.7, 0.1]}>
        <mesh scale={[faceWidth * jawMod * 0.8, 0.6, 0.7]}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshStandardMaterial color={chinColor} roughness={0.8} />
        </mesh>
      </group>
      <Annotation 
        visible={showLabels} 
        target={[0, -faceHeight * 0.7, 0.1]} 
        offset={[0, -3.5, 0.5]} 
        text={`Jaw (GC Skew): ${p.jaw_shape?.toFixed(3)}`} 
      />

      {/* 3. EYES */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (eyeSpacing / 2), 0.25, 0.95]}>
          <mesh>
            <sphereGeometry args={[eyeSize, 24, 24]} />
            <meshStandardMaterial color="white" roughness={0.1} />
          </mesh>
          <mesh position={[0, 0, eyeSize * 0.8]}>
            <circleGeometry args={[eyeSize * 0.85, 16]} />
            <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={3.0 + (glow * 2.0)} />
          </mesh>
          <mesh position={[0, 0, eyeSize * 0.85]}>
            <circleGeometry args={[eyeSize * 0.3, 16]} />
            <meshStandardMaterial color="black" />
          </mesh>
        </group>
      ))}
      <Annotation 
        visible={showLabels} 
        target={[-eyeSpacing/2, 0.25, 0.95]} 
        offset={[-4.0, 2.5, 0.5]} 
        text={`Eye Scale (Entropy): ${p.eye_size?.toFixed(3)}`} 
      />
      <Annotation 
        visible={showLabels} 
        target={[-eyeSpacing/2, 0.25, 1.05]} 
        offset={[-4.5, 1.5, 0.5]} 
        text={`Eye Color (Hash): ${p.eye_color_hue?.toFixed(3)}`} 
      />
      <Annotation 
        visible={showLabels} 
        target={[0, 0.25, 0.95]} 
        offset={[-4.5, 0.5, 0.5]} 
        text={`Eye Spacing (Hash): ${p.eye_spacing?.toFixed(3)}`} 
      />

      {/* 4. NOSE */}
      <mesh position={[0, -0.15, 1.05]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[noseSize * 0.3, noseSize * 0.8, 16]} />
        <meshStandardMaterial color={secondaryColor} />
      </mesh>
      <Annotation 
        visible={showLabels} 
        target={[0, -0.15, 1.05]} 
        offset={[3.5, -0.5, 1.0]} 
        text={`Nose (Asymmetry): ${p.asymmetry_factor?.toFixed(3)}`} 
      />

      {/* 5. MOUTH */}
      <group position={[0, -0.65, 0.95]}>
        <mesh position={[0, 0, -0.05]} scale={[mouthWidth, 0.2, 0.1]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color="#000" />
        </mesh>
        <mesh rotation={[Math.PI / 2 + (mouthCurve * 0.4), 0, Math.PI]}>
          <torusGeometry args={[mouthWidth / 2, 0.06, 12, 32, Math.PI]} />
          <meshStandardMaterial color="#501111" roughness={0.3} />
        </mesh>
      </group>
      <Annotation 
        visible={showLabels} 
        target={[0, -0.65, 0.95]} 
        offset={[3.5, -2.5, 0.5]} 
        text={`Mouth Curve (Hash): ${p.mouth_curve?.toFixed(3)}`} 
      />
      <Annotation 
        visible={showLabels} 
        target={[0, -0.65, 0.95]} 
        offset={[3.0, -3.5, 0.5]} 
        text={`Mouth Width (GC Mid): ${p.mouth_width?.toFixed(3)}`} 
      />

      {/* 6. EARS */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * faceWidth * 0.95, -0.1, -0.2]} rotation={[0, side * 0.4, 0]} scale={[0.12, 0.5, 0.4]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={featureColor} roughness={0.9} />
        </mesh>
      ))}
      <Annotation 
        visible={showLabels} 
        target={[faceWidth * 0.95, -0.1, -0.2]} 
        offset={[3.0, -1.5, -0.5]} 
        text={`Ears (Identity Color)`} 
      />

      {/* 7. FOREHEAD */}
      {p.forehead_pattern > 0.2 && (
        <>
          <mesh position={[0, faceHeight * 0.7, 0.2]} rotation={[Math.PI / 2.5, 0, 0]}>
              <torusGeometry args={[faceWidth * 0.55, 0.08, 12, 32]} />
              <meshStandardMaterial color={secondaryColor} />
          </mesh>
          <Annotation 
            visible={showLabels} 
            target={[0, faceHeight * 0.7 + 0.1, 0.35]} 
            offset={[0, 3.5, 0.5]} 
            text={`Forehead (Lineage/Pattern): ${p.forehead_pattern?.toFixed(3)}`} 
          />
        </>
      )}

      {/* 8. ANTENNAS */}
      {p.antenna_type > 0.3 && (
        <>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * faceWidth * 0.5, faceHeight * 0.7, 0]} rotation={[0, 0, side * 0.6]}>
              <mesh position={[0, antLen / 2, 0]}>
                  <cylinderGeometry args={[0.015, 0.03, antLen, 8]} />
                  <meshStandardMaterial color={secondaryColor} />
              </mesh>
              <mesh position={[0, antLen, 0]}>
                  <sphereGeometry args={[0.1, 12, 12]} />
                  <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={glow * 2.5} />
              </mesh>
            </group>
          ))}
          <Annotation 
            visible={showLabels} 
            target={[antTipX, antTipY, 0]} 
            offset={[-1.5, 2.5, 0.5]} 
            text={`Antenna Glow (Hydrophobic): ${p.glow_intensity?.toFixed(3)}`} 
          />
          <Annotation 
            visible={showLabels} 
            target={[antTipX, antTipY, 0]} 
            offset={[-2.5, 2.0, 0.5]} 
            text={`Antenna Type (Skew): ${p.antenna_type?.toFixed(3)}`} 
          />
          <Annotation 
            visible={showLabels} 
            target={[antTipX, antTipY, 0]} 
            offset={[-3.0, 1.5, 0.5]} 
            text={`Antenna Length (Skew): ${p.antenna_length?.toFixed(3)}`} 
          />
        </>
      )}
    </group>
  );
};
