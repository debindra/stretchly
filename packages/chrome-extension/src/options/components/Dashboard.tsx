import { useState, useRef } from 'react';
import type { Exercise, ReliefEntry, UserSettings } from '@stretchly/shared';
import { exercises, painRoutines } from '@stretchly/shared';
import {
  Clock,
} from 'lucide-react';
import { PainScale } from './PainScale';

interface DashboardProps {
  onStartRoutine: (exercises: Exercise[], painArea: string, painLevel: number) => void;
  reliefData: ReliefEntry[];
  settings: UserSettings;
}

type PainArea = 'neck' | 'shoulders' | 'wrists' | 'upperBack' | 'lowerBack' | 'eyes';

export function Dashboard({ onStartRoutine, reliefData, settings }: DashboardProps) {
  const [selectedPain, setSelectedPain] = useState<PainArea | null>(null);
  const [painLevel, setPainLevel] = useState<number>(5);
  const painAreaSectionRef = useRef<HTMLDivElement>(null);

  const painAreas: { key: PainArea; label: string; iconPath: string; description: string }[] = [
    { key: 'neck', label: 'Neck', iconPath: '/icons/neck.png', description: 'Stiff or tight neck' },
    { key: 'shoulders', label: 'Shoulders', iconPath: '/icons/shoulders.png', description: 'Tense, hunched shoulders' },
    { key: 'wrists', label: 'Wrists', iconPath: '/icons/wrist.png', description: 'Typing strain or pain' },
    { key: 'upperBack', label: 'Upper Back', iconPath: '/icons/upper-back.png', description: 'Between shoulder blades' },
    { key: 'lowerBack', label: 'Lower Back', iconPath: '/icons/lower-back.png', description: 'Lower spine discomfort' },
    { key: 'eyes', label: 'Eyes', iconPath: '/icons/eye.png', description: 'Screen fatigue' },
  ];

  const handleStartRelief = () => {
    if (!selectedPain) return;

    const exerciseIds = painRoutines[selectedPain];
    const exerciseList = exerciseIds
      .map(id => exercises.find(ex => ex.id === id))
      .filter((ex): ex is Exercise => ex !== undefined);

    onStartRoutine(exerciseList, selectedPain, painLevel);
  };


  return (
    <div className="space-y-6 h-full">
      {/* Pain Area Selection - Hero Element */}
      <div ref={painAreaSectionRef} className="bg-card rounded-xl p-6 md:p-8 shadow-sm border border-border">

        {/* Pain Area Selection */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
          {painAreas.map(area => {
            const isSelected = selectedPain === area.key;
            const routineDuration = Math.round(
              (painRoutines[area.key] || []).reduce((sum, id) => {
                const ex = exercises.find(e => e.id === id);
                return sum + (ex?.duration || 0);
              }, 0)
            );
            return (
              <button
                key={area.key}
                onClick={() => {
                  setSelectedPain(area.key);
                  if (!isSelected) setPainLevel(5);
                }}
                className={`p-4 md:p-5 rounded-lg border-2 transition-all duration-200 text-left min-h-[100px] md:min-h-[120px] flex flex-col cursor-pointer group ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-md hover:scale-[1.02] bg-background active:scale-[0.98]'
                }`}
                aria-pressed={isSelected}
              >
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-lg flex items-center justify-center mb-3 transition-all overflow-hidden shrink-0 ${
                  isSelected ? 'bg-primary/20' : 'bg-muted group-hover:bg-primary/10'
                }`}>
                  <img 
                    src={area.iconPath} 
                    alt={area.label}
                    width={56}
                    height={56}
                    className="w-full h-full object-contain p-1.5"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="text-foreground mb-2 text-base md:text-lg font-semibold">{area.label}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-3 flex-1">{area.description}</p>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{routineDuration}s</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Pain Level */}
        {selectedPain && (
          <div className="mb-6 animate-in fade-in">
            <PainScale
              id="dashboard-pain-level"
              value={painLevel}
              onChange={setPainLevel}
              min={1}
              max={10}
              label="Pain level"
              variant="mild-severe"
              className="compact"
            />
          </div>
        )}

        {/* Primary CTA */}
        {selectedPain && (
          <button
            onClick={handleStartRelief}
            className="w-full bg-accent text-accent-foreground py-4 rounded-lg hover:bg-accent active:scale-[0.98] transition-all duration-200 shadow-lg font-bold text-lg"
          >
            Start Relief Routine
          </button>
        )}
      </div>
    </div>
  );
}