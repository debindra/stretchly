import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefers(m.matches);
    const onChange = () => setPrefers(m.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);
  return prefers;
}

interface ExerciseAnimationProps {
  exerciseId: string;
  isPlaying: boolean;
}

export function ExerciseAnimation({ exerciseId, isPlaying }: ExerciseAnimationProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const effectivePlaying = isPlaying && !prefersReducedMotion;

  const animations = {
    'neck-tilt': <NeckTilt isPlaying={effectivePlaying} />,
    'neck-rotation': <NeckRotation isPlaying={effectivePlaying} />,
    'chin-tuck': <ChinTuck isPlaying={effectivePlaying} />,
    'shoulder-rolls': <ShoulderRolls isPlaying={effectivePlaying} />,
    'shoulder-shrugs': <ShoulderShrugs isPlaying={effectivePlaying} />,
    'shoulder-squeeze': <ShoulderSqueeze isPlaying={effectivePlaying} />,
    'wrist-flexor': <WristFlexor isPlaying={effectivePlaying} />,
    'wrist-extensor': <WristExtensor isPlaying={effectivePlaying} />,
    'wrist-circles': <WristCircles isPlaying={effectivePlaying} />,
    'spinal-twist': <SpinalTwist isPlaying={effectivePlaying} />,
    'thoracic-extension': <ThoracicExtension isPlaying={effectivePlaying} />,
    'cat-cow': <CatCow isPlaying={effectivePlaying} />,
    'pelvic-tilt': <PelvicTilt isPlaying={effectivePlaying} />,
    'knee-to-chest': <KneeToChest isPlaying={effectivePlaying} />,
    'standing-back-extension': <StandingBackExtension isPlaying={effectivePlaying} />,
    'eye-20-20-20': <Eye202020 isPlaying={effectivePlaying} />,
    'blink-reset': <BlinkReset isPlaying={effectivePlaying} />,
    'eye-rolls': <EyeRolls isPlaying={effectivePlaying} />,
  };

  return (
    <div
      className="w-full h-44 flex items-center justify-center bg-gradient-to-br from-muted to-[var(--input-background)] rounded-xl overflow-hidden"
      aria-hidden="true"
    >
      {animations[exerciseId as keyof typeof animations] || <DefaultAnimation />}
    </div>
  );
}

// Human figure sitting on chair - base component
function SeatedHuman({ 
  headRotation = 0, 
  headTiltX = 0,
  headTiltY = 0,
  torsoRotation = 0, 
  leftArmRotation = 0,
  rightArmRotation = 0,
  shoulderY = 0,
  isPlaying = false,
  animateProps = {},
  transition = { duration: 3, repeat: Infinity, ease: 'easeInOut' as const }
}: {
  headRotation?: number;
  headTiltX?: number;
  headTiltY?: number;
  torsoRotation?: number;
  leftArmRotation?: number;
  rightArmRotation?: number;
  shoulderY?: number;
  isPlaying?: boolean;
  animateProps?: Record<string, unknown>;
  transition?: Record<string, unknown>;
}) {
  const skinColor = '#E8D4C4';
  const skinDark = '#D4C0B0';
  const shirtColor = '#4F87E5';
  const pantsColor = '#3D5A99';
  const hairColor = '#4A3728';
  
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Chair */}
      <rect x="55" y="145" width="90" height="8" rx="4" fill="#B8A082" />
      <rect x="130" y="100" width="8" height="55" rx="4" fill="#B8A082" />
      <rect x="62" y="153" width="6" height="30" rx="3" fill="#9A8770" />
      <rect x="132" y="153" width="6" height="30" rx="3" fill="#9A8770" />
      
      {/* Legs */}
      <rect x="75" y="135" width="18" height="45" rx="6" fill={pantsColor} />
      <rect x="107" y="135" width="18" height="45" rx="6" fill={pantsColor} />
      
      {/* Feet */}
      <ellipse cx="84" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      <ellipse cx="116" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      
      {/* Torso */}
      <motion.g
        animate={isPlaying ? { rotate: animateProps.torsoRotate || [0, torsoRotation, 0, -torsoRotation, 0] } : {}}
        transition={transition}
        style={{ originX: '100px', originY: '130px' }}
      >
        <path
          d="M 70 85 Q 65 100 70 130 L 130 130 Q 135 100 130 85 Q 100 75 70 85"
          fill={shirtColor}
        />
        
        {/* Shoulders */}
        <motion.g
          animate={isPlaying && animateProps.shoulderY ? { y: animateProps.shoulderY } : {}}
          transition={transition}
        >
          {/* Left Shoulder & Arm */}
          <motion.g
            animate={isPlaying && animateProps.leftArm ? { rotate: animateProps.leftArm } : {}}
            transition={transition}
            style={{ originX: '65px', originY: '90px' }}
          >
            <ellipse cx="60" cy="90" rx="12" ry="10" fill={shirtColor} />
            <rect x="50" y="90" width="14" height="35" rx="6" fill={shirtColor} />
            <ellipse cx="57" cy="125" rx="7" ry="8" fill={skinColor} />
          </motion.g>
          
          {/* Right Shoulder & Arm */}
          <motion.g
            animate={isPlaying && animateProps.rightArm ? { rotate: animateProps.rightArm } : {}}
            transition={transition}
            style={{ originX: '135px', originY: '90px' }}
          >
            <ellipse cx="140" cy="90" rx="12" ry="10" fill={shirtColor} />
            <rect x="136" y="90" width="14" height="35" rx="6" fill={shirtColor} />
            <ellipse cx="143" cy="125" rx="7" ry="8" fill={skinColor} />
          </motion.g>
        </motion.g>
        
        {/* Neck */}
        <rect x="90" y="70" width="20" height="18" rx="5" fill={skinColor} />
        
        {/* Head */}
        <motion.g
          animate={isPlaying ? { 
            rotate: animateProps.headRotate || [0, headRotation, 0, -headRotation, 0],
            x: animateProps.headX || [0, headTiltX, 0, -headTiltX, 0],
            y: animateProps.headY || [0, headTiltY, 0]
          } : {}}
          transition={transition}
          style={{ originX: '100px', originY: '70px' }}
        >
          {/* Head shape */}
          <ellipse cx="100" cy="50" rx="24" ry="28" fill={skinColor} />
          
          {/* Hair */}
          <path
            d="M 78 45 Q 78 25 100 22 Q 122 25 122 45 Q 115 35 100 35 Q 85 35 78 45"
            fill={hairColor}
          />
          
          {/* Face */}
          {/* Eyes */}
          <ellipse cx="92" cy="48" rx="3" ry="2" fill="#3D3D3D" />
          <ellipse cx="108" cy="48" rx="3" ry="2" fill="#3D3D3D" />
          
          {/* Eyebrows */}
          <path d="M 88 44 Q 92 42 96 44" stroke={hairColor} strokeWidth="1.5" fill="none" />
          <path d="M 104 44 Q 108 42 112 44" stroke={hairColor} strokeWidth="1.5" fill="none" />
          
          {/* Nose */}
          <path d="M 100 50 L 100 56 Q 98 58 100 58" stroke={skinDark} strokeWidth="1" fill="none" />
          
          {/* Mouth */}
          <path d="M 95 63 Q 100 66 105 63" stroke="#C9A090" strokeWidth="1.5" fill="none" />
          
          {/* Ears */}
          <ellipse cx="76" cy="52" rx="4" ry="6" fill={skinColor} />
          <ellipse cx="124" cy="52" rx="4" ry="6" fill={skinColor} />
        </motion.g>
      </motion.g>
    </svg>
  );
}

// Neck Tilt Animation - Human tilting head side to side
function NeckTilt({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        headRotate: [0, -20, 0, 20, 0],
        headX: [0, -8, 0, 8, 0]
      }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Neck Rotation Animation - Human turning head left and right
function NeckRotation({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Chair */}
      <rect x="55" y="145" width="90" height="8" rx="4" fill="#B8A082" />
      <rect x="130" y="100" width="8" height="55" rx="4" fill="#B8A082" />
      
      {/* Legs */}
      <rect x="75" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <rect x="107" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <ellipse cx="84" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      <ellipse cx="116" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      
      {/* Torso */}
      <path d="M 70 85 Q 65 100 70 130 L 130 130 Q 135 100 130 85 Q 100 75 70 85" fill="#4F87E5" />
      
      {/* Arms */}
      <ellipse cx="60" cy="90" rx="12" ry="10" fill="#4F87E5" />
      <rect x="50" y="90" width="14" height="35" rx="6" fill="#4F87E5" />
      <ellipse cx="57" cy="125" rx="7" ry="8" fill="#E8D4C4" />
      <ellipse cx="140" cy="90" rx="12" ry="10" fill="#4F87E5" />
      <rect x="136" y="90" width="14" height="35" rx="6" fill="#4F87E5" />
      <ellipse cx="143" cy="125" rx="7" ry="8" fill="#E8D4C4" />
      
      {/* Neck */}
      <rect x="90" y="70" width="20" height="18" rx="5" fill="#E8D4C4" />
      
      {/* Head - rotating */}
      <motion.g
        animate={isPlaying ? { scaleX: [1, 0.7, 1, 0.7, 1] } : {}}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '100px', originY: '50px' }}
      >
        {/* Head shape */}
        <ellipse cx="100" cy="50" rx="24" ry="28" fill="#E8D4C4" />
        
        {/* Hair */}
        <path d="M 78 45 Q 78 25 100 22 Q 122 25 122 45 Q 115 35 100 35 Q 85 35 78 45" fill="#4A3728" />
        
        {/* Face - moves to show rotation */}
        <motion.g
          animate={isPlaying ? { x: [0, -8, 0, 8, 0] } : {}}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Eyes */}
          <ellipse cx="92" cy="48" rx="3" ry="2" fill="#3D3D3D" />
          <ellipse cx="108" cy="48" rx="3" ry="2" fill="#3D3D3D" />
          
          {/* Nose */}
          <path d="M 100 50 L 100 56 Q 98 58 100 58" stroke="#D4C0B0" strokeWidth="1" fill="none" />
          
          {/* Mouth */}
          <path d="M 95 63 Q 100 66 105 63" stroke="#C9A090" strokeWidth="1.5" fill="none" />
        </motion.g>
        
        {/* Ears */}
        <ellipse cx="76" cy="52" rx="4" ry="6" fill="#E8D4C4" />
        <ellipse cx="124" cy="52" rx="4" ry="6" fill="#E8D4C4" />
      </motion.g>
      
      {/* Direction indicator */}
      <motion.path
        d="M 140 35 C 145 25 155 25 160 35"
        stroke="#8B5CF6"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        markerEnd="url(#arrowhead)"
        animate={isPlaying ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </svg>
  );
}

// Chin Tuck Animation - Human tucking chin back
function ChinTuck({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Chair */}
      <rect x="55" y="145" width="90" height="8" rx="4" fill="#B8A082" />
      <rect x="130" y="100" width="8" height="55" rx="4" fill="#B8A082" />
      
      {/* Body base */}
      <rect x="75" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <rect x="107" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <ellipse cx="84" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      <ellipse cx="116" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      <path d="M 70 85 Q 65 100 70 130 L 130 130 Q 135 100 130 85 Q 100 75 70 85" fill="#4F87E5" />
      
      {/* Arms resting */}
      <ellipse cx="60" cy="90" rx="12" ry="10" fill="#4F87E5" />
      <rect x="50" y="90" width="14" height="35" rx="6" fill="#4F87E5" />
      <ellipse cx="57" cy="125" rx="7" ry="8" fill="#E8D4C4" />
      <ellipse cx="140" cy="90" rx="12" ry="10" fill="#4F87E5" />
      <rect x="136" y="90" width="14" height="35" rx="6" fill="#4F87E5" />
      <ellipse cx="143" cy="125" rx="7" ry="8" fill="#E8D4C4" />
      
      {/* Neck and Head - moving back */}
      <motion.g
        animate={isPlaying ? { x: [0, -8, 0] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Neck */}
        <rect x="90" y="70" width="20" height="18" rx="5" fill="#E8D4C4" />
        
        {/* Head */}
        <ellipse cx="100" cy="50" rx="24" ry="28" fill="#E8D4C4" />
        <path d="M 78 45 Q 78 25 100 22 Q 122 25 122 45 Q 115 35 100 35 Q 85 35 78 45" fill="#4A3728" />
        
        {/* Face */}
        <ellipse cx="92" cy="48" rx="3" ry="2" fill="#3D3D3D" />
        <ellipse cx="108" cy="48" rx="3" ry="2" fill="#3D3D3D" />
        <path d="M 100 50 L 100 56" stroke="#D4C0B0" strokeWidth="1" fill="none" />
        <path d="M 95 63 Q 100 66 105 63" stroke="#C9A090" strokeWidth="1.5" fill="none" />
        <ellipse cx="76" cy="52" rx="4" ry="6" fill="#E8D4C4" />
        <ellipse cx="124" cy="52" rx="4" ry="6" fill="#E8D4C4" />
      </motion.g>
      
      {/* Backward movement indicator */}
      <motion.path
        d="M 65 50 L 55 50"
        stroke="#10B981"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        animate={isPlaying ? { 
          opacity: [0.3, 1, 0.3],
          x: [0, -5, 0]
        } : { opacity: 0.3 }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />
      <motion.polygon
        points="55,46 48,50 55,54"
        fill="#10B981"
        animate={isPlaying ? { 
          opacity: [0.3, 1, 0.3],
          x: [0, -5, 0]
        } : { opacity: 0.3 }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />
    </svg>
  );
}

// Shoulder Rolls Animation
function ShoulderRolls({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Chair */}
      <rect x="55" y="145" width="90" height="8" rx="4" fill="#B8A082" />
      <rect x="130" y="100" width="8" height="55" rx="4" fill="#B8A082" />
      
      {/* Legs */}
      <rect x="75" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <rect x="107" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <ellipse cx="84" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      <ellipse cx="116" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      
      {/* Torso */}
      <path d="M 70 85 Q 65 100 70 130 L 130 130 Q 135 100 130 85 Q 100 75 70 85" fill="#4F87E5" />
      
      {/* Left Shoulder & Arm - rolling */}
      <motion.g
        animate={isPlaying ? { 
          y: [0, -10, -5, 5, 0],
          x: [0, 3, 6, 3, 0]
        } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="55" cy="88" rx="16" ry="14" fill="#F59E0B" />
        <rect x="48" y="92" width="14" height="35" rx="6" fill="#4F87E5" />
        <ellipse cx="55" cy="127" rx="7" ry="8" fill="#E8D4C4" />
      </motion.g>
      
      {/* Right Shoulder & Arm - rolling */}
      <motion.g
        animate={isPlaying ? { 
          y: [0, -10, -5, 5, 0],
          x: [0, -3, -6, -3, 0]
        } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="145" cy="88" rx="16" ry="14" fill="#F59E0B" />
        <rect x="138" y="92" width="14" height="35" rx="6" fill="#4F87E5" />
        <ellipse cx="145" cy="127" rx="7" ry="8" fill="#E8D4C4" />
      </motion.g>
      
      {/* Neck */}
      <rect x="90" y="70" width="20" height="18" rx="5" fill="#E8D4C4" />
      
      {/* Head */}
      <ellipse cx="100" cy="50" rx="24" ry="28" fill="#E8D4C4" />
      <path d="M 78 45 Q 78 25 100 22 Q 122 25 122 45 Q 115 35 100 35 Q 85 35 78 45" fill="#4A3728" />
      <ellipse cx="92" cy="48" rx="3" ry="2" fill="#3D3D3D" />
      <ellipse cx="108" cy="48" rx="3" ry="2" fill="#3D3D3D" />
      <path d="M 95 63 Q 100 66 105 63" stroke="#C9A090" strokeWidth="1.5" fill="none" />
      <ellipse cx="76" cy="52" rx="4" ry="6" fill="#E8D4C4" />
      <ellipse cx="124" cy="52" rx="4" ry="6" fill="#E8D4C4" />
      
      {/* Circular motion indicators */}
      <motion.circle
        cx="55"
        cy="88"
        r="20"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="2"
        strokeDasharray="8,4"
        animate={isPlaying ? { strokeDashoffset: [0, -24] } : {}}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        opacity="0.5"
      />
      <motion.circle
        cx="145"
        cy="88"
        r="20"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="2"
        strokeDasharray="8,4"
        animate={isPlaying ? { strokeDashoffset: [0, -24] } : {}}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        opacity="0.5"
      />
    </svg>
  );
}

// Shoulder Shrugs Animation
function ShoulderShrugs({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Chair */}
      <rect x="55" y="145" width="90" height="8" rx="4" fill="#B8A082" />
      <rect x="130" y="100" width="8" height="55" rx="4" fill="#B8A082" />
      
      {/* Legs */}
      <rect x="75" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <rect x="107" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <ellipse cx="84" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      <ellipse cx="116" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      
      {/* Torso */}
      <path d="M 70 85 Q 65 100 70 130 L 130 130 Q 135 100 130 85 Q 100 75 70 85" fill="#4F87E5" />
      
      {/* Shoulders - shrugging up */}
      <motion.g
        animate={isPlaying ? { y: [0, -15, 0] } : {}}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Left Shoulder & Arm */}
        <ellipse cx="55" cy="88" rx="16" ry="14" fill="#F59E0B" />
        <rect x="48" y="92" width="14" height="35" rx="6" fill="#4F87E5" />
        <ellipse cx="55" cy="127" rx="7" ry="8" fill="#E8D4C4" />
        
        {/* Right Shoulder & Arm */}
        <ellipse cx="145" cy="88" rx="16" ry="14" fill="#F59E0B" />
        <rect x="138" y="92" width="14" height="35" rx="6" fill="#4F87E5" />
        <ellipse cx="145" cy="127" rx="7" ry="8" fill="#E8D4C4" />
      </motion.g>
      
      {/* Neck */}
      <rect x="90" y="70" width="20" height="18" rx="5" fill="#E8D4C4" />
      
      {/* Head */}
      <ellipse cx="100" cy="50" rx="24" ry="28" fill="#E8D4C4" />
      <path d="M 78 45 Q 78 25 100 22 Q 122 25 122 45 Q 115 35 100 35 Q 85 35 78 45" fill="#4A3728" />
      <ellipse cx="92" cy="48" rx="3" ry="2" fill="#3D3D3D" />
      <ellipse cx="108" cy="48" rx="3" ry="2" fill="#3D3D3D" />
      <path d="M 95 63 Q 100 66 105 63" stroke="#C9A090" strokeWidth="1.5" fill="none" />
      <ellipse cx="76" cy="52" rx="4" ry="6" fill="#E8D4C4" />
      <ellipse cx="124" cy="52" rx="4" ry="6" fill="#E8D4C4" />
      
      {/* Up arrows */}
      <motion.g
        animate={isPlaying ? { opacity: [0.3, 1, 0.3], y: [0, -5, 0] } : { opacity: 0.3 }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <path d="M 55 65 L 55 55 L 50 60 M 55 55 L 60 60" stroke="#F59E0B" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 145 65 L 145 55 L 140 60 M 145 55 L 150 60" stroke="#F59E0B" strokeWidth="3" fill="none" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}

// Shoulder Squeeze Animation
function ShoulderSqueeze({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Chair */}
      <rect x="55" y="145" width="90" height="8" rx="4" fill="#B8A082" />
      <rect x="130" y="100" width="8" height="55" rx="4" fill="#B8A082" />
      
      {/* Legs */}
      <rect x="75" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <rect x="107" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <ellipse cx="84" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      <ellipse cx="116" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      
      {/* Torso */}
      <path d="M 70 85 Q 65 100 70 130 L 130 130 Q 135 100 130 85 Q 100 75 70 85" fill="#4F87E5" />
      
      {/* Shoulder blades indicator (back muscles) */}
      <motion.ellipse
        cx="85"
        cy="105"
        rx="12"
        ry="18"
        fill="#F59E0B"
        opacity="0.6"
        animate={isPlaying ? { cx: [85, 92, 85] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.ellipse
        cx="115"
        cy="105"
        rx="12"
        ry="18"
        fill="#F59E0B"
        opacity="0.6"
        animate={isPlaying ? { cx: [115, 108, 115] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Arms - pulling back */}
      <motion.g
        animate={isPlaying ? { x: [0, -8, 0] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="55" cy="88" rx="14" ry="12" fill="#4F87E5" />
        <rect x="45" y="92" width="14" height="35" rx="6" fill="#4F87E5" />
        <ellipse cx="52" cy="127" rx="7" ry="8" fill="#E8D4C4" />
      </motion.g>
      
      <motion.g
        animate={isPlaying ? { x: [0, 8, 0] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="145" cy="88" rx="14" ry="12" fill="#4F87E5" />
        <rect x="141" y="92" width="14" height="35" rx="6" fill="#4F87E5" />
        <ellipse cx="148" cy="127" rx="7" ry="8" fill="#E8D4C4" />
      </motion.g>
      
      {/* Neck & Head */}
      <rect x="90" y="70" width="20" height="18" rx="5" fill="#E8D4C4" />
      <ellipse cx="100" cy="50" rx="24" ry="28" fill="#E8D4C4" />
      <path d="M 78 45 Q 78 25 100 22 Q 122 25 122 45 Q 115 35 100 35 Q 85 35 78 45" fill="#4A3728" />
      <ellipse cx="92" cy="48" rx="3" ry="2" fill="#3D3D3D" />
      <ellipse cx="108" cy="48" rx="3" ry="2" fill="#3D3D3D" />
      <path d="M 95 63 Q 100 66 105 63" stroke="#C9A090" strokeWidth="1.5" fill="none" />
      <ellipse cx="76" cy="52" rx="4" ry="6" fill="#E8D4C4" />
      <ellipse cx="124" cy="52" rx="4" ry="6" fill="#E8D4C4" />
      
      {/* Squeeze together arrows */}
      <motion.g
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        <path d="M 70 105 L 80 105" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        <polygon points="80,102 86,105 80,108" fill="#F59E0B" />
        <path d="M 130 105 L 120 105" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        <polygon points="120,102 114,105 120,108" fill="#F59E0B" />
      </motion.g>
    </svg>
  );
}

// Wrist Flexor Stretch
function WristFlexor({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Arm extended */}
      <rect x="30" y="95" width="80" height="16" rx="8" fill="#E8D4C4" />
      
      {/* Other hand helping */}
      <motion.g
        animate={isPlaying ? { y: [0, 8, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="125" cy="85" rx="12" ry="10" fill="#E8D4C4" />
        <rect x="120" y="75" width="10" height="20" rx="4" fill="#E8D4C4" opacity="0.8" />
      </motion.g>
      
      {/* Hand being stretched */}
      <motion.g
        animate={isPlaying ? { rotate: [0, -35, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '110px', originY: '103px' }}
      >
        {/* Palm */}
        <rect x="105" y="88" width="30" height="30" rx="6" fill="#E8D4C4" />
        
        {/* Fingers */}
        <rect x="130" y="90" width="20" height="6" rx="3" fill="#E8D4C4" />
        <rect x="132" y="98" width="22" height="6" rx="3" fill="#E8D4C4" />
        <rect x="132" y="106" width="20" height="6" rx="3" fill="#E8D4C4" />
        <rect x="128" y="114" width="16" height="5" rx="2.5" fill="#E8D4C4" />
        
        {/* Thumb */}
        <rect x="100" y="108" width="12" height="6" rx="3" fill="#E8D4C4" transform="rotate(-45 106 111)" />
      </motion.g>
      
      {/* Stretch indicator */}
      <motion.path
        d="M 140 125 L 140 140"
        stroke="#10B981"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.polygon
        points="136,140 140,148 144,140"
        fill="#10B981"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      
      {/* Label */}
      <text x="100" y="175" fontSize="12" fill="#666" textAnchor="middle">Pull fingers back gently</text>
    </svg>
  );
}

// Wrist Extensor Stretch
function WristExtensor({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Arm extended */}
      <rect x="30" y="95" width="80" height="16" rx="8" fill="#E8D4C4" />
      
      {/* Other hand helping - pushing down */}
      <motion.g
        animate={isPlaying ? { y: [0, -8, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="125" cy="125" rx="12" ry="10" fill="#E8D4C4" />
        <rect x="120" y="115" width="10" height="20" rx="4" fill="#E8D4C4" opacity="0.8" />
      </motion.g>
      
      {/* Hand being stretched - bending down */}
      <motion.g
        animate={isPlaying ? { rotate: [0, 35, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '110px', originY: '103px' }}
      >
        {/* Palm */}
        <rect x="105" y="88" width="30" height="30" rx="6" fill="#E8D4C4" />
        
        {/* Fingers */}
        <rect x="130" y="90" width="20" height="6" rx="3" fill="#E8D4C4" />
        <rect x="132" y="98" width="22" height="6" rx="3" fill="#E8D4C4" />
        <rect x="132" y="106" width="20" height="6" rx="3" fill="#E8D4C4" />
        <rect x="128" y="114" width="16" height="5" rx="2.5" fill="#E8D4C4" />
        
        {/* Thumb */}
        <rect x="100" y="108" width="12" height="6" rx="3" fill="#E8D4C4" transform="rotate(-45 106 111)" />
      </motion.g>
      
      {/* Stretch indicator - up arrow */}
      <motion.path
        d="M 140 75 L 140 60"
        stroke="#10B981"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.polygon
        points="136,60 140,52 144,60"
        fill="#10B981"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      
      {/* Label */}
      <text x="100" y="175" fontSize="12" fill="#666" textAnchor="middle">Push hand down gently</text>
    </svg>
  );
}

// Wrist Circles
function WristCircles({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Arm */}
      <rect x="30" y="95" width="70" height="16" rx="8" fill="#E8D4C4" />
      
      {/* Hand rotating in circles */}
      <motion.g
        animate={isPlaying ? { rotate: [0, 360] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{ originX: '100px', originY: '103px' }}
      >
        {/* Palm */}
        <rect x="95" y="88" width="30" height="30" rx="6" fill="#E8D4C4" />
        
        {/* Fingers */}
        <rect x="120" y="90" width="18" height="6" rx="3" fill="#E8D4C4" />
        <rect x="122" y="98" width="20" height="6" rx="3" fill="#E8D4C4" />
        <rect x="122" y="106" width="18" height="6" rx="3" fill="#E8D4C4" />
        <rect x="118" y="112" width="14" height="5" rx="2.5" fill="#E8D4C4" />
        
        {/* Thumb */}
        <rect x="90" y="105" width="10" height="6" rx="3" fill="#E8D4C4" transform="rotate(-30 95 108)" />
      </motion.g>
      
      {/* Circular motion path */}
      <circle
        cx="115"
        cy="103"
        r="35"
        fill="none"
        stroke="#10B981"
        strokeWidth="2"
        strokeDasharray="8,4"
        opacity="0.4"
      />
      
      {/* Rotating arrow indicator */}
      <motion.g
        animate={isPlaying ? { rotate: [0, 360] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{ originX: '115px', originY: '103px' }}
      >
        <circle cx="150" cy="103" r="4" fill="#10B981" />
      </motion.g>
      
      {/* Label */}
      <text x="100" y="175" fontSize="12" fill="#666" textAnchor="middle">Rotate wrist slowly</text>
    </svg>
  );
}

// Spinal Twist - Seated
function SpinalTwist({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Chair */}
      <rect x="55" y="145" width="90" height="8" rx="4" fill="#B8A082" />
      <rect x="130" y="100" width="8" height="55" rx="4" fill="#B8A082" />
      
      {/* Legs (stationary) */}
      <rect x="75" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <rect x="107" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <ellipse cx="84" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      <ellipse cx="116" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      
      {/* Torso - twisting */}
      <motion.g
        animate={isPlaying ? { rotate: [0, -25, 0, 25, 0] } : {}}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '100px', originY: '130px' }}
      >
        <path d="M 70 85 Q 65 100 70 130 L 130 130 Q 135 100 130 85 Q 100 75 70 85" fill="#4F87E5" />
        
        {/* Arms crossing body */}
        <motion.g
          animate={isPlaying ? { x: [0, 15, 0, -15, 0] } : {}}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Left arm reaching to right */}
          <ellipse cx="55" cy="88" rx="12" ry="10" fill="#4F87E5" />
          <rect x="55" y="92" width="40" height="12" rx="6" fill="#4F87E5" />
          <ellipse cx="95" cy="98" rx="8" ry="7" fill="#E8D4C4" />
        </motion.g>
        
        {/* Right arm on chair back */}
        <ellipse cx="140" cy="88" rx="12" ry="10" fill="#4F87E5" />
        <rect x="130" y="90" width="12" height="30" rx="5" fill="#4F87E5" />
        <ellipse cx="136" cy="120" rx="7" ry="6" fill="#E8D4C4" />
        
        {/* Neck */}
        <rect x="90" y="70" width="20" height="18" rx="5" fill="#E8D4C4" />
        
        {/* Head - twisting more */}
        <motion.g
          animate={isPlaying ? { rotate: [0, -10, 0, 10, 0] } : {}}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '100px', originY: '70px' }}
        >
          <ellipse cx="100" cy="50" rx="24" ry="28" fill="#E8D4C4" />
          <path d="M 78 45 Q 78 25 100 22 Q 122 25 122 45 Q 115 35 100 35 Q 85 35 78 45" fill="#4A3728" />
          <ellipse cx="92" cy="48" rx="3" ry="2" fill="#3D3D3D" />
          <ellipse cx="108" cy="48" rx="3" ry="2" fill="#3D3D3D" />
          <path d="M 95 63 Q 100 66 105 63" stroke="#C9A090" strokeWidth="1.5" fill="none" />
          <ellipse cx="76" cy="52" rx="4" ry="6" fill="#E8D4C4" />
          <ellipse cx="124" cy="52" rx="4" ry="6" fill="#E8D4C4" />
        </motion.g>
      </motion.g>
      
      {/* Twist direction indicator */}
      <motion.path
        d="M 150 80 C 160 75 165 85 160 95"
        stroke="#3B82F6"
        strokeWidth="2"
        fill="none"
        strokeDasharray="5,3"
        animate={isPlaying ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />
    </svg>
  );
}

// Thoracic Extension
function ThoracicExtension({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Chair with back */}
      <rect x="55" y="145" width="90" height="8" rx="4" fill="#B8A082" />
      <rect x="125" y="85" width="12" height="68" rx="5" fill="#B8A082" />
      
      {/* Legs */}
      <rect x="75" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <rect x="107" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <ellipse cx="84" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      <ellipse cx="116" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      
      {/* Torso - arching back */}
      <motion.g
        animate={isPlaying ? { rotate: [0, -15, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '100px', originY: '130px' }}
      >
        {/* Spine/Back arching */}
        <motion.path
          d="M 75 85 Q 70 105 75 130 L 125 130 Q 130 105 125 85 Q 100 75 75 85"
          fill="#4F87E5"
          animate={isPlaying ? {
            d: [
              'M 75 85 Q 70 105 75 130 L 125 130 Q 130 105 125 85 Q 100 75 75 85',
              'M 75 85 Q 60 100 75 130 L 125 130 Q 140 100 125 85 Q 100 70 75 85',
              'M 75 85 Q 70 105 75 130 L 125 130 Q 130 105 125 85 Q 100 75 75 85'
            ]
          } : {}}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Arms behind head */}
        <motion.g
          animate={isPlaying ? { y: [0, -5, 0] } : {}}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ellipse cx="80" cy="55" rx="10" ry="8" fill="#E8D4C4" />
          <ellipse cx="120" cy="55" rx="10" ry="8" fill="#E8D4C4" />
          <rect x="70" y="55" width="60" height="8" rx="4" fill="#4F87E5" />
        </motion.g>
        
        {/* Neck */}
        <rect x="90" y="62" width="20" height="18" rx="5" fill="#E8D4C4" />
        
        {/* Head */}
        <motion.g
          animate={isPlaying ? { y: [0, -8, 0] } : {}}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ellipse cx="100" cy="45" rx="22" ry="25" fill="#E8D4C4" />
          <path d="M 80 40 Q 80 22 100 20 Q 120 22 120 40 Q 114 32 100 32 Q 86 32 80 40" fill="#4A3728" />
          <ellipse cx="93" cy="43" rx="2.5" ry="2" fill="#3D3D3D" />
          <ellipse cx="107" cy="43" rx="2.5" ry="2" fill="#3D3D3D" />
          <path d="M 95 55 Q 100 58 105 55" stroke="#C9A090" strokeWidth="1.5" fill="none" />
        </motion.g>
      </motion.g>
      
      {/* Extension direction */}
      <motion.path
        d="M 150 90 L 160 80"
        stroke="#3B82F6"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.polygon
        points="157,75 165,78 160,85"
        fill="#3B82F6"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </svg>
  );
}

// Cat-Cow - Seated Version
function CatCow({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Chair */}
      <rect x="55" y="145" width="90" height="8" rx="4" fill="#B8A082" />
      
      {/* Legs */}
      <rect x="75" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <rect x="107" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <ellipse cx="84" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      <ellipse cx="116" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      
      {/* Spine - alternating between arched and rounded */}
      <motion.path
        d="M 85 75 Q 100 90 115 75 L 115 130 L 85 130 Z"
        fill="#4F87E5"
        animate={isPlaying ? {
          d: [
            'M 85 75 Q 100 60 115 75 L 115 130 L 85 130 Z', // Cow - arched back
            'M 85 75 Q 100 95 115 75 L 115 130 L 85 130 Z', // Cat - rounded back
            'M 85 75 Q 100 60 115 75 L 115 130 L 85 130 Z'
          ]
        } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Arms on knees */}
      <rect x="55" y="118" width="25" height="10" rx="5" fill="#4F87E5" />
      <rect x="120" y="118" width="25" height="10" rx="5" fill="#4F87E5" />
      <ellipse cx="55" cy="123" rx="8" ry="7" fill="#E8D4C4" />
      <ellipse cx="145" cy="123" rx="8" ry="7" fill="#E8D4C4" />
      
      {/* Neck */}
      <motion.rect
        x="92"
        y="62"
        width="16"
        height="16"
        rx="5"
        fill="#E8D4C4"
        animate={isPlaying ? { y: [58, 68, 58] } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Head - moving up and down */}
      <motion.g
        animate={isPlaying ? { y: [0, 12, 0] } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="100" cy="45" rx="22" ry="24" fill="#E8D4C4" />
        <path d="M 80 40 Q 80 22 100 20 Q 120 22 120 40 Q 114 32 100 32 Q 86 32 80 40" fill="#4A3728" />
        <ellipse cx="93" cy="43" rx="2.5" ry="2" fill="#3D3D3D" />
        <ellipse cx="107" cy="43" rx="2.5" ry="2" fill="#3D3D3D" />
        <path d="M 95 53 Q 100 56 105 53" stroke="#C9A090" strokeWidth="1.5" fill="none" />
        <ellipse cx="78" cy="47" rx="4" ry="5" fill="#E8D4C4" />
        <ellipse cx="122" cy="47" rx="4" ry="5" fill="#E8D4C4" />
      </motion.g>
      
      {/* Labels */}
      <motion.text
        x="155"
        y="70"
        fontSize="11"
        fill="#3B82F6"
        fontWeight="500"
        animate={isPlaying ? { opacity: [1, 0, 1] } : {}}
        transition={{ duration: 4, repeat: Infinity }}
      >
        Cow
      </motion.text>
      <motion.text
        x="155"
        y="100"
        fontSize="11"
        fill="#3B82F6"
        fontWeight="500"
        animate={isPlaying ? { opacity: [0, 1, 0] } : {}}
        transition={{ duration: 4, repeat: Infinity }}
      >
        Cat
      </motion.text>
    </svg>
  );
}

// Pelvic Tilt - Seated
function PelvicTilt({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Chair */}
      <rect x="55" y="145" width="90" height="8" rx="4" fill="#B8A082" />
      <rect x="62" y="153" width="6" height="30" rx="3" fill="#9A8770" />
      <rect x="132" y="153" width="6" height="30" rx="3" fill="#9A8770" />
      
      {/* Legs */}
      <rect x="75" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <rect x="107" y="135" width="18" height="45" rx="6" fill="#3D5A99" />
      <ellipse cx="84" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      <ellipse cx="116" cy="178" rx="12" ry="6" fill="#5C4A3D" />
      
      {/* Pelvis area - highlighted and tilting */}
      <motion.ellipse
        cx="100"
        cy="128"
        rx="28"
        ry="15"
        fill="#EC4899"
        opacity="0.7"
        animate={isPlaying ? { rotate: [0, -12, 0, 12, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '100px', originY: '128px' }}
      />
      
      {/* Lower torso */}
      <motion.g
        animate={isPlaying ? { rotate: [0, -8, 0, 8, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '100px', originY: '130px' }}
      >
        <path d="M 75 85 Q 70 105 75 125 L 125 125 Q 130 105 125 85 Q 100 78 75 85" fill="#4F87E5" />
        
        {/* Arms */}
        <ellipse cx="58" cy="92" rx="12" ry="10" fill="#4F87E5" />
        <rect x="50" y="95" width="12" height="30" rx="5" fill="#4F87E5" />
        <ellipse cx="56" cy="125" rx="7" ry="6" fill="#E8D4C4" />
        
        <ellipse cx="142" cy="92" rx="12" ry="10" fill="#4F87E5" />
        <rect x="138" y="95" width="12" height="30" rx="5" fill="#4F87E5" />
        <ellipse cx="144" cy="125" rx="7" ry="6" fill="#E8D4C4" />
        
        {/* Neck & Head */}
        <rect x="90" y="68" width="20" height="18" rx="5" fill="#E8D4C4" />
        <ellipse cx="100" cy="48" rx="22" ry="25" fill="#E8D4C4" />
        <path d="M 80 43 Q 80 25 100 23 Q 120 25 120 43 Q 114 35 100 35 Q 86 35 80 43" fill="#4A3728" />
        <ellipse cx="93" cy="46" rx="2.5" ry="2" fill="#3D3D3D" />
        <ellipse cx="107" cy="46" rx="2.5" ry="2" fill="#3D3D3D" />
        <path d="M 95 57 Q 100 60 105 57" stroke="#C9A090" strokeWidth="1.5" fill="none" />
      </motion.g>
      
      {/* Tilt direction arc */}
      <motion.path
        d="M 65 128 A 35 15 0 0 1 135 128"
        stroke="#EC4899"
        strokeWidth="2"
        fill="none"
        strokeDasharray="6,4"
        animate={isPlaying ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </svg>
  );
}

// Knee to Chest - Seated
function KneeToChest({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Chair */}
      <rect x="55" y="145" width="90" height="8" rx="4" fill="#B8A082" />
      <rect x="130" y="100" width="8" height="55" rx="4" fill="#B8A082" />
      
      {/* Left leg (stationary) */}
      <rect x="75" y="135" width="16" height="45" rx="6" fill="#3D5A99" />
      <ellipse cx="83" cy="178" rx="11" ry="6" fill="#5C4A3D" />
      
      {/* Right leg lifting */}
      <motion.g
        animate={isPlaying ? { rotate: [0, -85, 0] } : {}}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '115px', originY: '135px' }}
      >
        {/* Thigh */}
        <rect x="107" y="135" width="16" height="40" rx="6" fill="#3D5A99" />
        {/* Lower leg */}
        <rect x="107" y="170" width="16" height="35" rx="6" fill="#3D5A99" />
        <ellipse cx="115" cy="203" rx="11" ry="6" fill="#5C4A3D" />
      </motion.g>
      
      {/* Torso */}
      <path d="M 75 85 Q 70 105 75 130 L 130 130 Q 135 105 130 85 Q 100 78 75 85" fill="#4F87E5" />
      
      {/* Left arm resting */}
      <ellipse cx="58" cy="90" rx="12" ry="10" fill="#4F87E5" />
      <rect x="50" y="92" width="12" height="33" rx="5" fill="#4F87E5" />
      <ellipse cx="56" cy="125" rx="7" ry="6" fill="#E8D4C4" />
      
      {/* Right arm pulling knee */}
      <motion.g
        animate={isPlaying ? { rotate: [0, -35, 0] } : {}}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '135px', originY: '90px' }}
      >
        <ellipse cx="140" cy="90" rx="12" ry="10" fill="#4F87E5" />
        <rect x="130" y="90" width="12" height="35" rx="5" fill="#4F87E5" />
        <ellipse cx="136" cy="125" rx="7" ry="6" fill="#E8D4C4" />
      </motion.g>
      
      {/* Neck & Head */}
      <rect x="90" y="68" width="20" height="18" rx="5" fill="#E8D4C4" />
      <ellipse cx="100" cy="48" rx="22" ry="25" fill="#E8D4C4" />
      <path d="M 80 43 Q 80 25 100 23 Q 120 25 120 43 Q 114 35 100 35 Q 86 35 80 43" fill="#4A3728" />
      <ellipse cx="93" cy="46" rx="2.5" ry="2" fill="#3D3D3D" />
      <ellipse cx="107" cy="46" rx="2.5" ry="2" fill="#3D3D3D" />
      <path d="M 95 57 Q 100 60 105 57" stroke="#C9A090" strokeWidth="1.5" fill="none" />
      <ellipse cx="78" cy="50" rx="4" ry="5" fill="#E8D4C4" />
      <ellipse cx="122" cy="50" rx="4" ry="5" fill="#E8D4C4" />
      
      {/* Pull indicator */}
      <motion.path
        d="M 125 105 Q 115 95 120 85"
        stroke="#EC4899"
        strokeWidth="2"
        fill="none"
        strokeDasharray="5,3"
        animate={isPlaying ? { opacity: [0.3, 0.9, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 1.75, repeat: Infinity }}
      />
    </svg>
  );
}

// Standing Back Extension
function StandingBackExtension({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Ground line */}
      <line x1="40" y1="185" x2="160" y2="185" stroke="#CBD5E1" strokeWidth="2" />
      
      {/* Legs - standing */}
      <rect x="85" y="135" width="14" height="50" rx="6" fill="#3D5A99" />
      <rect x="101" y="135" width="14" height="50" rx="6" fill="#3D5A99" />
      
      {/* Feet */}
      <ellipse cx="92" cy="183" rx="12" ry="5" fill="#5C4A3D" />
      <ellipse cx="108" cy="183" rx="12" ry="5" fill="#5C4A3D" />
      
      {/* Lower body (hips) */}
      <ellipse cx="100" cy="138" rx="22" ry="12" fill="#3D5A99" />
      
      {/* Torso - arching backward */}
      <motion.g
        animate={isPlaying ? { rotate: [0, -20, 0] } : {}}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '100px', originY: '130px' }}
      >
        <path d="M 80 65 Q 75 95 80 130 L 120 130 Q 125 95 120 65 Q 100 55 80 65" fill="#4F87E5" />
        
        {/* Hands on lower back */}
        <ellipse cx="100" cy="118" rx="30" ry="12" fill="#E8D4C4" opacity="0.9" />
        
        {/* Arms going back */}
        <rect x="60" y="85" width="12" height="35" rx="5" fill="#4F87E5" transform="rotate(-15 66 102)" />
        <rect x="128" y="85" width="12" height="35" rx="5" fill="#4F87E5" transform="rotate(15 134 102)" />
        
        {/* Neck */}
        <rect x="92" y="50" width="16" height="18" rx="5" fill="#E8D4C4" />
        
        {/* Head - tilting back */}
        <motion.g
          animate={isPlaying ? { rotate: [0, -15, 0] } : {}}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '100px', originY: '50px' }}
        >
          <ellipse cx="100" cy="35" rx="20" ry="22" fill="#E8D4C4" />
          <path d="M 82 30 Q 82 15 100 12 Q 118 15 118 30 Q 112 22 100 22 Q 88 22 82 30" fill="#4A3728" />
          <ellipse cx="94" cy="33" rx="2" ry="1.5" fill="#3D3D3D" />
          <ellipse cx="106" cy="33" rx="2" ry="1.5" fill="#3D3D3D" />
          <path d="M 96 42 Q 100 44 104 42" stroke="#C9A090" strokeWidth="1.5" fill="none" />
        </motion.g>
      </motion.g>
      
      {/* Extension direction arrow */}
      <motion.path
        d="M 135 70 L 145 55"
        stroke="#3B82F6"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />
      <motion.polygon
        points="142,50 150,52 146,60"
        fill="#3B82F6"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />
    </svg>
  );
}

// Eye 20-20-20 Rule
function Eye202020({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Face silhouette */}
      <ellipse cx="80" cy="100" rx="35" ry="45" fill="#E8D4C4" />
      <path d="M 50 85 Q 50 55 80 50 Q 110 55 110 85 Q 100 70 80 70 Q 60 70 50 85" fill="#4A3728" />
      
      {/* Eye socket area */}
      <ellipse cx="80" cy="90" rx="25" ry="12" fill="#fff" stroke="#D4C0B0" strokeWidth="1" />
      
      {/* Iris looking at distant object */}
      <motion.circle
        cx="80"
        cy="90"
        r="8"
        fill="#6366F1"
        animate={isPlaying ? { cx: [80, 90, 80] } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Pupil */}
      <motion.circle
        cx="80"
        cy="90"
        r="3"
        fill="#1F2933"
        animate={isPlaying ? { cx: [80, 90, 80] } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Nose */}
      <path d="M 80 100 L 82 115" stroke="#D4C0B0" strokeWidth="2" fill="none" />
      
      {/* Mouth */}
      <path d="M 70 130 Q 80 135 90 130" stroke="#C9A090" strokeWidth="2" fill="none" />
      
      {/* Ear */}
      <ellipse cx="45" cy="100" rx="6" ry="10" fill="#E8D4C4" />
      
      {/* Distant object (window/screen) */}
      <rect x="135" y="60" width="40" height="50" rx="5" fill="#E0E7FF" stroke="#6366F1" strokeWidth="2" />
      <line x1="145" y1="70" x2="165" y2="70" stroke="#6366F1" strokeWidth="1" opacity="0.5" />
      <line x1="145" y1="80" x2="160" y2="80" stroke="#6366F1" strokeWidth="1" opacity="0.5" />
      <line x1="145" y1="90" x2="165" y2="90" stroke="#6366F1" strokeWidth="1" opacity="0.5" />
      
      {/* Distance line */}
      <motion.line
        x1="105"
        y1="90"
        x2="135"
        y2="85"
        stroke="#6366F1"
        strokeWidth="2"
        strokeDasharray="4,4"
        animate={isPlaying ? { 
          strokeDashoffset: [0, -16],
          opacity: [0.4, 0.8, 0.4]
        } : { opacity: 0.4 }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* 20 feet label */}
      <motion.text
        x="155"
        y="130"
        fontSize="11"
        fill="#6366F1"
        textAnchor="middle"
        fontWeight="500"
        animate={isPlaying ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.5 }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        20 feet away
      </motion.text>
      
      <text x="100" y="175" fontSize="10" fill="#666" textAnchor="middle">Look 20 ft away for 20 sec</text>
    </svg>
  );
}

// Blink Reset
function BlinkReset({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Face */}
      <ellipse cx="100" cy="100" rx="50" ry="60" fill="#E8D4C4" />
      <path d="M 55 80 Q 55 45 100 40 Q 145 45 145 80 Q 130 60 100 60 Q 70 60 55 80" fill="#4A3728" />
      
      {/* Eye sockets */}
      <ellipse cx="80" cy="90" rx="18" ry="10" fill="#fff" stroke="#D4C0B0" strokeWidth="1" />
      <ellipse cx="120" cy="90" rx="18" ry="10" fill="#fff" stroke="#D4C0B0" strokeWidth="1" />
      
      {/* Irises */}
      <circle cx="80" cy="90" r="6" fill="#6366F1" />
      <circle cx="120" cy="90" r="6" fill="#6366F1" />
      
      {/* Pupils */}
      <circle cx="80" cy="90" r="2.5" fill="#1F2933" />
      <circle cx="120" cy="90" r="2.5" fill="#1F2933" />
      
      {/* Eyelids - blinking */}
      <motion.ellipse
        cx="80"
        cy="80"
        rx="20"
        ry="12"
        fill="#E8D4C4"
        animate={isPlaying ? { cy: [75, 92, 75] } : {}}
        transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' }}
      />
      <motion.ellipse
        cx="120"
        cy="80"
        rx="20"
        ry="12"
        fill="#E8D4C4"
        animate={isPlaying ? { cy: [75, 92, 75] } : {}}
        transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' }}
      />
      
      {/* Eyebrows */}
      <path d="M 62 75 Q 80 70 95 75" stroke="#4A3728" strokeWidth="2" fill="none" />
      <path d="M 105 75 Q 120 70 138 75" stroke="#4A3728" strokeWidth="2" fill="none" />
      
      {/* Nose */}
      <path d="M 100 95 L 100 115 Q 95 118 100 118" stroke="#D4C0B0" strokeWidth="2" fill="none" />
      
      {/* Mouth - relaxed */}
      <path d="M 85 135 Q 100 140 115 135" stroke="#C9A090" strokeWidth="2" fill="none" />
      
      {/* Ears */}
      <ellipse cx="50" cy="95" rx="6" ry="12" fill="#E8D4C4" />
      <ellipse cx="150" cy="95" rx="6" ry="12" fill="#E8D4C4" />
      
      {/* Blink indicator */}
      <motion.text
        x="100"
        y="175"
        fontSize="12"
        fill="#6366F1"
        textAnchor="middle"
        fontWeight="500"
        animate={isPlaying ? { opacity: [1, 0, 1] } : {}}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        Blink slowly and fully
      </motion.text>
    </svg>
  );
}

// Eye Rolls
function EyeRolls({ isPlaying }: { isPlaying: boolean }) {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Face */}
      <ellipse cx="100" cy="100" rx="50" ry="60" fill="#E8D4C4" />
      <path d="M 55 80 Q 55 45 100 40 Q 145 45 145 80 Q 130 60 100 60 Q 70 60 55 80" fill="#4A3728" />
      
      {/* Eye sockets */}
      <ellipse cx="80" cy="90" rx="18" ry="12" fill="#fff" stroke="#D4C0B0" strokeWidth="1" />
      <ellipse cx="120" cy="90" rx="18" ry="12" fill="#fff" stroke="#D4C0B0" strokeWidth="1" />
      
      {/* Irises - rolling in circles */}
      <motion.circle
        cx="80"
        cy="85"
        r="7"
        fill="#6366F1"
        animate={isPlaying ? {
          cx: [80, 88, 80, 72, 80],
          cy: [82, 90, 98, 90, 82]
        } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      <motion.circle
        cx="120"
        cy="85"
        r="7"
        fill="#6366F1"
        animate={isPlaying ? {
          cx: [120, 128, 120, 112, 120],
          cy: [82, 90, 98, 90, 82]
        } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Pupils */}
      <motion.circle
        cx="80"
        cy="85"
        r="3"
        fill="#1F2933"
        animate={isPlaying ? {
          cx: [80, 88, 80, 72, 80],
          cy: [82, 90, 98, 90, 82]
        } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      <motion.circle
        cx="120"
        cy="85"
        r="3"
        fill="#1F2933"
        animate={isPlaying ? {
          cx: [120, 128, 120, 112, 120],
          cy: [82, 90, 98, 90, 82]
        } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Eyebrows */}
      <path d="M 62 75 Q 80 70 95 75" stroke="#4A3728" strokeWidth="2" fill="none" />
      <path d="M 105 75 Q 120 70 138 75" stroke="#4A3728" strokeWidth="2" fill="none" />
      
      {/* Nose */}
      <path d="M 100 95 L 100 115 Q 95 118 100 118" stroke="#D4C0B0" strokeWidth="2" fill="none" />
      
      {/* Mouth */}
      <path d="M 85 135 Q 100 140 115 135" stroke="#C9A090" strokeWidth="2" fill="none" />
      
      {/* Ears */}
      <ellipse cx="50" cy="95" rx="6" ry="12" fill="#E8D4C4" />
      <ellipse cx="150" cy="95" rx="6" ry="12" fill="#E8D4C4" />
      
      {/* Circular motion indicators */}
      <circle cx="80" cy="90" r="12" fill="none" stroke="#6366F1" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
      <circle cx="120" cy="90" r="12" fill="none" stroke="#6366F1" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
      
      <text x="100" y="175" fontSize="12" fill="#666" textAnchor="middle">Roll eyes slowly in circles</text>
    </svg>
  );
}

// Default Animation
function DefaultAnimation() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Simple human figure doing a stretch */}
      <motion.g
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Head */}
        <circle cx="100" cy="50" r="20" fill="#E8D4C4" />
        
        {/* Body */}
        <rect x="85" y="68" width="30" height="50" rx="8" fill="#4F87E5" />
        
        {/* Arms stretching up */}
        <motion.rect
          x="60"
          y="55"
          width="12"
          height="35"
          rx="5"
          fill="#4F87E5"
          animate={{ rotate: [-10, -20, -10] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '66px', originY: '90px' }}
        />
        <motion.rect
          x="128"
          y="55"
          width="12"
          height="35"
          rx="5"
          fill="#4F87E5"
          animate={{ rotate: [10, 20, 10] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '134px', originY: '90px' }}
        />
        
        {/* Hands */}
        <motion.circle
          cx="66"
          cy="52"
          r="7"
          fill="#E8D4C4"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.circle
          cx="134"
          cy="52"
          r="7"
          fill="#E8D4C4"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Legs */}
        <rect x="85" y="115" width="12" height="40" rx="5" fill="#3D5A99" />
        <rect x="103" y="115" width="12" height="40" rx="5" fill="#3D5A99" />
        
        {/* Feet */}
        <ellipse cx="91" cy="155" rx="10" ry="5" fill="#5C4A3D" />
        <ellipse cx="109" cy="155" rx="10" ry="5" fill="#5C4A3D" />
      </motion.g>
      
      {/* Decorative circles */}
      <motion.circle
        cx="100"
        cy="100"
        r="70"
        fill="none"
        stroke="#8B5CF6"
        strokeWidth="2"
        strokeDasharray="10,5"
        opacity="0.2"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
    </svg>
  );
}
