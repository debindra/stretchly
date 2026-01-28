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
  const skinColor = '#E8BEAA';
  const skinLight = '#F5D6C6';
  const skinDark = '#D4A893';
  const shirtColor = '#4A9FE8';
  const shirtDark = '#3A8AD8';
  const pantsColor = '#6B7B8A';
  const pantsDark = '#5A6A79';
  const hairColor = '#2D2319';
  const chairSeat = '#6B7B8A';
  const chairBack = '#5A6A79';
  const chairBase = '#C0C0C0';
  
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      <defs>
        {/* Gradients for realistic shading */}
        <linearGradient id="skinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={skinLight} />
          <stop offset="100%" stopColor={skinColor} />
        </linearGradient>
        <linearGradient id="shirtGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={shirtColor} />
          <stop offset="100%" stopColor={shirtDark} />
        </linearGradient>
        <linearGradient id="pantsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={pantsColor} />
          <stop offset="100%" stopColor={pantsDark} />
        </linearGradient>
        <radialGradient id="shadowGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.15)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      
      {/* Floor shadow */}
      <ellipse cx="100" cy="188" rx="55" ry="8" fill="url(#shadowGradient)" />
      
      {/* Chair base - chrome star base with wheels */}
      <g>
        {/* Center pole */}
        <rect x="96" y="160" width="8" height="22" fill={chairBase} />
        <rect x="94" y="158" width="12" height="4" rx="1" fill="#D8D8D8" />
        
        {/* Star base legs */}
        <line x1="100" y1="180" x2="60" y2="185" stroke={chairBase} strokeWidth="3" strokeLinecap="round" />
        <line x1="100" y1="180" x2="140" y2="185" stroke={chairBase} strokeWidth="3" strokeLinecap="round" />
        <line x1="100" y1="180" x2="75" y2="188" stroke={chairBase} strokeWidth="3" strokeLinecap="round" />
        <line x1="100" y1="180" x2="125" y2="188" stroke={chairBase} strokeWidth="3" strokeLinecap="round" />
        
        {/* Wheels */}
        <circle cx="60" cy="186" r="4" fill="#3A3A3A" />
        <circle cx="140" cy="186" r="4" fill="#3A3A3A" />
        <circle cx="75" cy="189" r="4" fill="#3A3A3A" />
        <circle cx="125" cy="189" r="4" fill="#3A3A3A" />
      </g>
      
      {/* Chair seat */}
      <path 
        d="M 55 148 Q 55 155 60 158 L 140 158 Q 145 155 145 148 L 145 145 Q 100 142 55 145 Z" 
        fill={chairSeat} 
      />
      
      {/* Chair back */}
      <path 
        d="M 125 148 Q 130 145 132 100 Q 133 90 128 88 L 128 145 Q 125 148 125 148" 
        fill={chairBack} 
      />
      <rect x="126" y="88" width="8" height="62" rx="4" fill={chairBack} />
      
      {/* Legs - sitting position */}
      <path 
        d="M 70 145 Q 68 155 68 165 L 68 172 Q 68 176 72 176 L 82 176 Q 86 176 86 172 L 86 155 Q 86 148 80 145 Z" 
        fill="url(#pantsGradient)" 
      />
      <path 
        d="M 130 145 Q 132 155 132 165 L 132 172 Q 132 176 128 176 L 118 176 Q 114 176 114 172 L 114 155 Q 114 148 120 145 Z" 
        fill="url(#pantsGradient)" 
      />
      
      {/* Feet/Shoes */}
      <ellipse cx="77" cy="178" rx="14" ry="5" fill="#2D2D2D" />
      <ellipse cx="123" cy="178" rx="14" ry="5" fill="#2D2D2D" />
      <ellipse cx="77" cy="176" rx="12" ry="4" fill="#3D3D3D" />
      <ellipse cx="123" cy="176" rx="12" ry="4" fill="#3D3D3D" />
      
      {/* Torso */}
      <motion.g
        animate={isPlaying ? { rotate: animateProps.torsoRotate || [0, torsoRotation, 0, -torsoRotation, 0] } : {}}
        transition={transition}
        style={{ originX: '100px', originY: '130px' }}
      >
        {/* Body/Torso */}
        <path
          d="M 68 82 Q 62 95 62 110 Q 62 130 68 145 L 132 145 Q 138 130 138 110 Q 138 95 132 82 Q 115 72 100 72 Q 85 72 68 82"
          fill="url(#shirtGradient)"
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
            style={{ originX: '58px', originY: '88px' }}
          >
            {/* Left shoulder */}
            <ellipse cx="58" cy="88" rx="14" ry="10" fill="url(#shirtGradient)" />
            {/* Left upper arm */}
            <path d="M 48 88 Q 44 100 46 115 Q 48 125 54 130 L 62 130 Q 66 120 64 105 Q 62 92 58 88 Z" fill="url(#shirtGradient)" />
            {/* Left forearm (skin) */}
            <path d="M 50 125 Q 48 132 52 140 L 62 140 Q 66 132 62 125 Z" fill="url(#skinGradient)" />
            {/* Left hand on thigh */}
            <ellipse cx="57" cy="143" rx="9" ry="6" fill="url(#skinGradient)" />
          </motion.g>
          
          {/* Right Shoulder & Arm */}
          <motion.g
            animate={isPlaying && animateProps.rightArm ? { rotate: animateProps.rightArm } : {}}
            transition={transition}
            style={{ originX: '142px', originY: '88px' }}
          >
            {/* Right shoulder */}
            <ellipse cx="142" cy="88" rx="14" ry="10" fill="url(#shirtGradient)" />
            {/* Right upper arm */}
            <path d="M 152 88 Q 156 100 154 115 Q 152 125 146 130 L 138 130 Q 134 120 136 105 Q 138 92 142 88 Z" fill="url(#shirtGradient)" />
            {/* Right forearm (skin) */}
            <path d="M 150 125 Q 152 132 148 140 L 138 140 Q 134 132 138 125 Z" fill="url(#skinGradient)" />
            {/* Right hand on thigh */}
            <ellipse cx="143" cy="143" rx="9" ry="6" fill="url(#skinGradient)" />
          </motion.g>
        </motion.g>
        
        {/* Neck */}
        <path d="M 88 72 Q 88 68 92 65 L 108 65 Q 112 68 112 72 L 112 80 L 88 80 Z" fill="url(#skinGradient)" />
        
        {/* Head */}
        <motion.g
          animate={isPlaying ? { 
            ...(animateProps.headRotate ? { rotate: animateProps.headRotate } : 
                (headRotation ? { rotate: [0, headRotation, 0, -headRotation, 0] } : {})),
            ...(animateProps.headX ? { x: animateProps.headX } : 
                (headTiltX ? { x: [0, headTiltX, 0, -headTiltX, 0] } : {})),
            ...(animateProps.headY ? { y: animateProps.headY } : 
                (headTiltY ? { y: [0, headTiltY, 0] } : {}))
          } : {}}
          transition={transition}
          style={{ originX: '100px', originY: '62px' }}
        >
          {/* Head shape */}
          <ellipse cx="100" cy="42" rx="26" ry="30" fill="url(#skinGradient)" />
          
          {/* Hair */}
          <path
            d="M 76 38 Q 74 18 100 12 Q 126 18 124 38 Q 124 28 115 22 Q 100 18 85 22 Q 76 28 76 38"
            fill={hairColor}
          />
          {/* Hair sides */}
          <path d="M 74 40 Q 72 35 75 30 Q 76 38 74 45" fill={hairColor} />
          <path d="M 126 40 Q 128 35 125 30 Q 124 38 126 45" fill={hairColor} />
          
          {/* Face */}
          {/* Eyes */}
          <ellipse cx="90" cy="42" rx="4" ry="3" fill="#FFFFFF" />
          <ellipse cx="110" cy="42" rx="4" ry="3" fill="#FFFFFF" />
          <ellipse cx="90" cy="42" rx="2.5" ry="2.5" fill="#3D2314" />
          <ellipse cx="110" cy="42" rx="2.5" ry="2.5" fill="#3D2314" />
          <ellipse cx="90.5" cy="41.5" rx="1" ry="1" fill="#000000" />
          <ellipse cx="110.5" cy="41.5" rx="1" ry="1" fill="#000000" />
          
          {/* Eyebrows */}
          <path d="M 84 36 Q 90 34 96 36" stroke={hairColor} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 104 36 Q 110 34 116 36" stroke={hairColor} strokeWidth="2" fill="none" strokeLinecap="round" />
          
          {/* Nose */}
          <path d="M 100 44 L 100 52 Q 97 54 100 55 Q 103 54 100 52" stroke={skinDark} strokeWidth="1.5" fill="none" />
          
          {/* Mouth - slight smile */}
          <path d="M 93 60 Q 100 64 107 60" stroke="#C9908A" strokeWidth="2" fill="none" strokeLinecap="round" />
          
          {/* Ears */}
          <ellipse cx="74" cy="44" rx="4" ry="7" fill="url(#skinGradient)" />
          <ellipse cx="126" cy="44" rx="4" ry="7" fill="url(#skinGradient)" />
          <ellipse cx="74" cy="44" rx="2" ry="4" fill={skinDark} />
          <ellipse cx="126" cy="44" rx="2" ry="4" fill={skinDark} />
        </motion.g>
      </motion.g>
    </svg>
  );
}


// Human Head component - matches SeatedHuman character for eye exercises
function HumanHead({ 
  isPlaying = false,
  eyeAnimateProps = {},
  eyelidAnimateProps = {},
  transition = { duration: 3, repeat: Infinity, ease: 'easeInOut' as const }
}: {
  isPlaying?: boolean;
  eyeAnimateProps?: Record<string, unknown>;
  eyelidAnimateProps?: Record<string, unknown>;
  transition?: Record<string, unknown>;
}) {
  const skinColor = '#E8BEAA';
  const skinLight = '#F5D6C6';
  const skinDark = '#D4A893';
  const hairColor = '#2D2319';
  
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="headSkinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={skinLight} />
          <stop offset="100%" stopColor={skinColor} />
        </linearGradient>
      </defs>
      
      {/* Neck */}
      <path d="M 88 160 Q 88 155 92 150 L 108 150 Q 112 155 112 160 L 112 175 L 88 175 Z" fill="url(#headSkinGradient)" />
      
      {/* Head shape */}
      <ellipse cx="100" cy="95" rx="45" ry="55" fill="url(#headSkinGradient)" />
      
      {/* Hair */}
      <path
        d="M 58 85 Q 55 45 100 35 Q 145 45 142 85 Q 140 60 125 50 Q 100 42 75 50 Q 60 60 58 85"
        fill={hairColor}
      />
      {/* Hair sides */}
      <path d="M 55 90 Q 52 80 56 70 Q 58 85 55 95" fill={hairColor} />
      <path d="M 145 90 Q 148 80 144 70 Q 142 85 145 95" fill={hairColor} />
      
      {/* Ears */}
      <ellipse cx="55" cy="95" rx="6" ry="12" fill="url(#headSkinGradient)" />
      <ellipse cx="145" cy="95" rx="6" ry="12" fill="url(#headSkinGradient)" />
      <ellipse cx="55" cy="95" rx="3" ry="7" fill={skinDark} />
      <ellipse cx="145" cy="95" rx="3" ry="7" fill={skinDark} />
      
      {/* Eye sockets (white part) */}
      <ellipse cx="80" cy="90" rx="16" ry="10" fill="#FFFFFF" />
      <ellipse cx="120" cy="90" rx="16" ry="10" fill="#FFFFFF" />
      
      {/* Irises */}
      <motion.circle
        cx="80"
        cy="90"
        r="7"
        fill="#3D2314"
        animate={isPlaying && eyeAnimateProps.leftIris ? eyeAnimateProps.leftIris : {}}
        transition={transition}
      />
      <motion.circle
        cx="120"
        cy="90"
        r="7"
        fill="#3D2314"
        animate={isPlaying && eyeAnimateProps.rightIris ? eyeAnimateProps.rightIris : {}}
        transition={transition}
      />
      
      {/* Pupils */}
      <motion.circle
        cx="80"
        cy="90"
        r="3"
        fill="#000000"
        animate={isPlaying && eyeAnimateProps.leftPupil ? eyeAnimateProps.leftPupil : {}}
        transition={transition}
      />
      <motion.circle
        cx="120"
        cy="90"
        r="3"
        fill="#000000"
        animate={isPlaying && eyeAnimateProps.rightPupil ? eyeAnimateProps.rightPupil : {}}
        transition={transition}
      />
      
      {/* Eyelids (for blink animation) */}
      <motion.ellipse
        cx="80"
        cy="80"
        rx="18"
        ry="12"
        fill="url(#headSkinGradient)"
        animate={isPlaying && eyelidAnimateProps.left ? eyelidAnimateProps.left : {}}
        transition={eyelidAnimateProps.transition || transition}
      />
      <motion.ellipse
        cx="120"
        cy="80"
        rx="18"
        ry="12"
        fill="url(#headSkinGradient)"
        animate={isPlaying && eyelidAnimateProps.right ? eyelidAnimateProps.right : {}}
        transition={eyelidAnimateProps.transition || transition}
      />
      
      {/* Eyebrows */}
      <path d="M 64 75 Q 80 70 94 75" stroke={hairColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 106 75 Q 120 70 136 75" stroke={hairColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      
      {/* Nose */}
      <path d="M 100 95 L 100 115 Q 96 118 100 120 Q 104 118 100 115" stroke={skinDark} strokeWidth="2" fill="none" />
      
      {/* Mouth - slight smile */}
      <path d="M 85 135 Q 100 142 115 135" stroke="#C9908A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
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

// Neck Rotation Animation - Human turning head to look over shoulders
function NeckRotation({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        // Look over right shoulder (head turns left on screen), hold, center,
        // then look over left shoulder (head turns right on screen), hold, center
        headRotate: [0, -30, -30, 0, 30, 30, 0],
      }}
      transition={{
        duration: 12,
        repeat: Infinity,
        ease: 'easeInOut',
        times: [0, 0.12, 0.38, 0.5, 0.62, 0.88, 1],
      }}
    />
  );
}

// Chin Tuck Animation - Human tucking chin back
function ChinTuck({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        headX: [0, -8, 0]
      }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Shoulder Rolls Animation
function ShoulderRolls({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        shoulderY: [0, -8, -4, 4, 0]
      }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Shoulder Shrugs Animation
function ShoulderShrugs({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        shoulderY: [0, -12, 0]
      }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Shoulder Squeeze Animation
function ShoulderSqueeze({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        leftArm: [0, -10, 0],
        rightArm: [0, 10, 0]
      }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Wrist Flexor Stretch
function WristFlexor({ isPlaying }: { isPlaying: boolean }) {
  const skinColor = '#E8BEAA';
  const skinDark = '#D4A893';
  const shirtColor = '#4A9FE8';
  
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Upper arm (shirt sleeve) */}
      <rect x="20" y="88" width="45" height="24" rx="10" fill={shirtColor} />
      
      {/* Forearm */}
      <rect x="60" y="90" width="55" height="20" rx="8" fill={skinColor} />
      
      {/* Wrist joint */}
      <ellipse cx="115" cy="100" rx="10" ry="12" fill={skinColor} />
      
      {/* Hand being stretched - bending up (flexor stretch) */}
      <motion.g
        animate={isPlaying ? { rotate: [0, -40, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '115px', originY: '100px' }}
      >
        {/* Palm */}
        <ellipse cx="140" cy="100" rx="22" ry="18" fill={skinColor} />
        
        {/* Fingers */}
        <ellipse cx="162" cy="88" rx="5" ry="12" fill={skinColor} />
        <ellipse cx="168" cy="95" rx="5" ry="14" fill={skinColor} />
        <ellipse cx="170" cy="105" rx="5" ry="13" fill={skinColor} />
        <ellipse cx="166" cy="114" rx="5" ry="11" fill={skinColor} />
        
        {/* Thumb */}
        <ellipse cx="130" cy="118" rx="8" ry="6" fill={skinColor} transform="rotate(-30 130 118)" />
        
        {/* Palm lines */}
        <path d="M 130 95 Q 140 92 150 95" stroke={skinDark} strokeWidth="1" fill="none" opacity="0.5" />
        <path d="M 128 105 Q 140 108 152 105" stroke={skinDark} strokeWidth="1" fill="none" opacity="0.5" />
      </motion.g>
      
      {/* Other hand helping - pushing fingers back */}
      <motion.g
        animate={isPlaying ? { y: [0, 5, 0], x: [0, -3, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="155" cy="65" rx="15" ry="12" fill={skinColor} />
        <ellipse cx="145" cy="58" rx="4" ry="8" fill={skinColor} />
        <ellipse cx="152" cy="53" rx="4" ry="10" fill={skinColor} />
        <ellipse cx="160" cy="52" rx="4" ry="10" fill={skinColor} />
        <ellipse cx="168" cy="55" rx="4" ry="9" fill={skinColor} />
        <ellipse cx="170" cy="68" rx="6" ry="5" fill={skinColor} transform="rotate(20 170 68)" />
      </motion.g>
      
      {/* Direction indicator */}
      <motion.path
        d="M 165 125 L 165 145"
        stroke="#10B981"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.polygon
        points="160,145 165,155 170,145"
        fill="#10B981"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </svg>
  );
}

// Wrist Extensor Stretch
function WristExtensor({ isPlaying }: { isPlaying: boolean }) {
  const skinColor = '#E8BEAA';
  const skinDark = '#D4A893';
  const shirtColor = '#4A9FE8';
  
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Upper arm (shirt sleeve) */}
      <rect x="20" y="88" width="45" height="24" rx="10" fill={shirtColor} />
      
      {/* Forearm */}
      <rect x="60" y="90" width="55" height="20" rx="8" fill={skinColor} />
      
      {/* Wrist joint */}
      <ellipse cx="115" cy="100" rx="10" ry="12" fill={skinColor} />
      
      {/* Hand being stretched - bending down (extensor stretch) */}
      <motion.g
        animate={isPlaying ? { rotate: [0, 40, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '115px', originY: '100px' }}
      >
        {/* Palm */}
        <ellipse cx="140" cy="100" rx="22" ry="18" fill={skinColor} />
        
        {/* Fingers */}
        <ellipse cx="162" cy="88" rx="5" ry="12" fill={skinColor} />
        <ellipse cx="168" cy="95" rx="5" ry="14" fill={skinColor} />
        <ellipse cx="170" cy="105" rx="5" ry="13" fill={skinColor} />
        <ellipse cx="166" cy="114" rx="5" ry="11" fill={skinColor} />
        
        {/* Thumb */}
        <ellipse cx="130" cy="82" rx="8" ry="6" fill={skinColor} transform="rotate(30 130 82)" />
        
        {/* Palm lines */}
        <path d="M 130 95 Q 140 92 150 95" stroke={skinDark} strokeWidth="1" fill="none" opacity="0.5" />
        <path d="M 128 105 Q 140 108 152 105" stroke={skinDark} strokeWidth="1" fill="none" opacity="0.5" />
      </motion.g>
      
      {/* Other hand helping - pushing hand down */}
      <motion.g
        animate={isPlaying ? { y: [0, -5, 0], x: [0, -3, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="155" cy="135" rx="15" ry="12" fill={skinColor} />
        <ellipse cx="145" cy="142" rx="4" ry="8" fill={skinColor} />
        <ellipse cx="152" cy="147" rx="4" ry="10" fill={skinColor} />
        <ellipse cx="160" cy="148" rx="4" ry="10" fill={skinColor} />
        <ellipse cx="168" cy="145" rx="4" ry="9" fill={skinColor} />
        <ellipse cx="170" cy="132" rx="6" ry="5" fill={skinColor} transform="rotate(-20 170 132)" />
      </motion.g>
      
      {/* Direction indicator */}
      <motion.path
        d="M 165 55 L 165 75"
        stroke="#10B981"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.polygon
        points="160,55 165,45 170,55"
        fill="#10B981"
        animate={isPlaying ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </svg>
  );
}

// Wrist Circles
function WristCircles({ isPlaying }: { isPlaying: boolean }) {
  const skinColor = '#E8BEAA';
  const skinDark = '#D4A893';
  const shirtColor = '#4A9FE8';
  
  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Upper arm (shirt sleeve) */}
      <rect x="20" y="88" width="45" height="24" rx="10" fill={shirtColor} />
      
      {/* Forearm */}
      <rect x="60" y="90" width="45" height="20" rx="8" fill={skinColor} />
      
      {/* Wrist joint */}
      <ellipse cx="105" cy="100" rx="10" ry="12" fill={skinColor} />
      
      {/* Hand rotating in circles */}
      <motion.g
        animate={isPlaying ? { rotate: [0, 360] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        style={{ originX: '105px', originY: '100px' }}
      >
        {/* Palm */}
        <ellipse cx="130" cy="100" rx="20" ry="16" fill={skinColor} />
        
        {/* Fingers */}
        <ellipse cx="150" cy="88" rx="4" ry="11" fill={skinColor} />
        <ellipse cx="156" cy="94" rx="4" ry="13" fill={skinColor} />
        <ellipse cx="158" cy="104" rx="4" ry="12" fill={skinColor} />
        <ellipse cx="154" cy="113" rx="4" ry="10" fill={skinColor} />
        
        {/* Thumb */}
        <ellipse cx="120" cy="116" rx="7" ry="5" fill={skinColor} transform="rotate(-30 120 116)" />
        
        {/* Palm lines */}
        <path d="M 120 95 Q 130 92 140 95" stroke={skinDark} strokeWidth="1" fill="none" opacity="0.5" />
        <path d="M 118 105 Q 130 108 142 105" stroke={skinDark} strokeWidth="1" fill="none" opacity="0.5" />
      </motion.g>
      
      {/* Circular motion path indicator */}
      <circle cx="130" cy="100" r="40" fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="8,4" opacity="0.3" />
      
      {/* Rotating dot indicator */}
      <motion.g
        animate={isPlaying ? { rotate: [0, 360] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        style={{ originX: '130px', originY: '100px' }}
      >
        <circle cx="170" cy="100" r="5" fill="#10B981" />
        {/* Arrow head showing direction */}
        <polygon points="170,95 175,100 170,105" fill="#10B981" />
      </motion.g>
    </svg>
  );
}

// Spinal Twist - Seated
function SpinalTwist({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        torsoRotate: [0, -20, 0, 20, 0],
        headRotate: [0, -25, 0, 25, 0]
      }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Thoracic Extension
function ThoracicExtension({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        torsoRotate: [0, -12, 0],
        headY: [0, -5, 0]
      }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Cat-Cow - Seated Version
function CatCow({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        torsoRotate: [0, -10, 0, 10, 0],
        headY: [0, -8, 0, 8, 0]
      }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Pelvic Tilt - Seated
function PelvicTilt({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        torsoRotate: [0, -8, 0, 8, 0]
      }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Knee to Chest - Seated
function KneeToChest({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        rightArm: [0, -25, 0]
      }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Standing Back Extension (shown seated for character consistency)
function StandingBackExtension({ isPlaying }: { isPlaying: boolean }) {
  return (
    <SeatedHuman
      isPlaying={isPlaying}
      animateProps={{
        torsoRotate: [0, -15, 0],
        headY: [0, -8, 0]
      }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Eye 20-20-20 Rule
function Eye202020({ isPlaying }: { isPlaying: boolean }) {
  return (
    <HumanHead
      isPlaying={isPlaying}
      eyeAnimateProps={{
        leftIris: { cx: [80, 92, 80] },
        rightIris: { cx: [120, 132, 120] },
        leftPupil: { cx: [80, 92, 80] },
        rightPupil: { cx: [120, 132, 120] }
      }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Blink Reset
function BlinkReset({ isPlaying }: { isPlaying: boolean }) {
  return (
    <HumanHead
      isPlaying={isPlaying}
      eyelidAnimateProps={{
        left: { cy: [68, 95, 68] },
        right: { cy: [68, 95, 68] },
        transition: { duration: 0.6, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' }
      }}
    />
  );
}

// Eye Rolls
function EyeRolls({ isPlaying }: { isPlaying: boolean }) {
  return (
    <HumanHead
      isPlaying={isPlaying}
      eyeAnimateProps={{
        leftIris: { cx: [80, 90, 80, 70, 80], cy: [83, 90, 97, 90, 83] },
        rightIris: { cx: [120, 130, 120, 110, 120], cy: [83, 90, 97, 90, 83] },
        leftPupil: { cx: [80, 90, 80, 70, 80], cy: [83, 90, 97, 90, 83] },
        rightPupil: { cx: [120, 130, 120, 110, 120], cy: [83, 90, 97, 90, 83] }
      }}
      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
    />
  );
}

// Default Animation
function DefaultAnimation() {
  return (
    <SeatedHuman
      isPlaying={true}
      animateProps={{
        shoulderY: [0, -3, 0]
      }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
