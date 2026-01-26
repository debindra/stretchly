import { useState, useMemo, useRef } from 'react';
import type { Exercise, ReliefEntry, UserSettings } from '@stretchly/shared';
import { exercises, painRoutines } from '@stretchly/shared';
import {
  AlertCircle,
  TrendingDown,
  Zap,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { PainScale } from './PainScale';
import { formatPainArea, formatReliefDate } from '../utils/formatDate';

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

  // Calculate today's stats
  const today = new Date().toISOString().split('T')[0];
  const todayRelief = reliefData.filter(r => r.date === today);
  const avgReliefToday =
    todayRelief.length > 0
      ? todayRelief.reduce((sum, r) => sum + (r.beforePain - r.afterPain), 0) / todayRelief.length
      : 0;

  // Calculate weekly streak
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const last7Days = getLast7Days();
  const activeDays = last7Days.filter(day => reliefData.some(r => r.date === day)).length;

  // Hero stat - most important
  const totalSessions = reliefData.length;
  const todaySessions = todayRelief.length;

  // Get most common pain area for quick action
  const mostCommonPainArea = useMemo(() => {
    if (reliefData.length === 0) return null;
    const counts: Record<string, number> = {};
    reliefData.forEach(r => {
      counts[r.painArea] = (counts[r.painArea] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(counts));
    const mostCommon = Object.entries(counts).find(([_, count]) => count === maxCount)?.[0];
    return mostCommon as PainArea | null;
  }, [reliefData]);

  // Get recent unique routines (all different pain areas)
  const recentRoutines = useMemo(() => {
    const seen = new Set<string>();
    const recent: Array<{ painArea: string; date: string; relief: number }> = [];
    
    for (let i = reliefData.length - 1; i >= 0; i--) {
      const entry = reliefData[i];
      if (!seen.has(entry.painArea)) {
        seen.add(entry.painArea);
        recent.push({
          painArea: entry.painArea,
          date: entry.date,
          relief: entry.beforePain - entry.afterPain,
        });
      }
    }
    return recent.reverse();
  }, [reliefData]);

  const handleQuickRelief = (painArea: PainArea) => {
    setSelectedPain(painArea);
    setPainLevel(5);
  };

  return (
    <div className="space-y-4 md:space-y-6 h-full">
      {/* Hero Stat - Today's Focus - Simplified */}
      {todaySessions > 0 && (
        <div className="bg-gradient-primary rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/90 text-xs mb-1 font-medium">Today's Relief</p>
              <p className="text-3xl md:text-4xl font-bold text-white mb-1">{avgReliefToday.toFixed(1)}</p>
              <p className="text-white/80 text-xs">points reduced • {todaySessions} session{todaySessions !== 1 ? 's' : ''}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions - Recent Routines */}
      {recentRoutines.length > 0 && (
        <div className="bg-card rounded-xl p-4 md:p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-foreground font-semibold text-sm md:text-base">Quick Relief</h2>
            <span className="text-muted-foreground text-xs">Recent areas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentRoutines.map((routine) => {
              const area = painAreas.find(a => a.key === routine.painArea);
              if (!area) return null;
              const routineDuration = Math.round(
                (painRoutines[routine.painArea as PainArea] || []).reduce((sum, id) => {
                  const ex = exercises.find(e => e.id === id);
                  return sum + (ex?.duration || 0);
                }, 0)
              );
              return (
                <button
                  key={routine.painArea}
                  onClick={() => handleQuickRelief(routine.painArea as PainArea)}
                  className="flex items-center gap-2 px-3 py-2 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg transition-all duration-200 text-left group"
                >
                  <img 
                    src={area.iconPath} 
                    alt={area.label}
                    width={20}
                    height={20}
                    className="w-5 h-5 object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-xs font-medium truncate">{area.label}</p>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px]">{routineDuration}s</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pain-First Entry - Enhanced */}
      <div ref={painAreaSectionRef} className="bg-card rounded-xl p-4 md:p-6 shadow-sm border border-border">
        <div className="mb-3 md:mb-4 text-center">
          <h2 className="text-lg md:text-xl text-foreground mb-1 font-bold">What&apos;s bothering you?</h2>
          <p className="text-muted-foreground text-xs md:text-sm">Select an area, then rate your pain to get instant relief</p>
        </div>

        {/* Pain Area Selection - Enhanced with better spacing */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-3 mb-3 md:mb-4">
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
                className={`p-2.5 md:p-3 rounded-lg border-2 transition-all duration-200 text-left transform hover:scale-[1.02] active:scale-[0.98] min-h-[80px] md:min-h-[95px] flex flex-col ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/40 bg-background hover:shadow-sm'
                }`}
                aria-pressed={isSelected}
              >
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center mb-1.5 transition-all overflow-hidden flex-shrink-0 ${
                  isSelected ? 'bg-primary/20' : 'bg-muted'
                }`}>
                  <img 
                    src={area.iconPath} 
                    alt={area.label}
                    width={48}
                    height={48}
                    className="w-full h-full object-contain p-1"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="text-foreground mb-0.5 text-sm md:text-base font-semibold">{area.label}</h3>
                  <p className="text-muted-foreground text-xs leading-tight mb-1.5 flex-1">{area.description}</p>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Clock className="w-3 h-3" />
                    <span>{routineDuration}s</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Pain Level - Only shown when area is selected */}
        {selectedPain && (
          <div className="bg-muted rounded-lg p-3 border border-primary/30 bg-primary/5 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2">
            <p id="dashboard-pain-hint" className="text-muted-foreground text-xs mb-2">Rate your discomfort (1 = mild, 10 = severe).</p>
            <PainScale
              id="dashboard-pain-level"
              value={painLevel}
              onChange={setPainLevel}
              min={1}
              max={10}
              label="Pain level"
              variant="mild-severe"
              ariaDescribedBy="dashboard-pain-hint"
            />
          </div>
        )}

        {/* Enhanced Primary CTA */}
        {selectedPain && (
          <div className="mt-3 md:mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button
              onClick={handleStartRelief}
              className="w-full bg-accent text-accent-foreground py-3 md:py-4 rounded-lg hover:bg-accent active:scale-[0.98] transition-all duration-200 shadow-lg hover:shadow-xl font-bold text-base md:text-lg"
            >
              <span className="flex items-center justify-center gap-2">
                <Zap className="w-5 h-5" />
                Start Relief Routine
              </span>
              <span className="block text-xs font-normal text-accent-foreground/90 mt-1.5">
                ~{Math.round(painRoutines[selectedPain].reduce((sum, id) => {
                  const ex = exercises.find(e => e.id === id);
                  return sum + (ex?.duration || 0);
                }, 0))} seconds • {painRoutines[selectedPain].length} exercise{painRoutines[selectedPain].length !== 1 ? 's' : ''}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Recent Relief Sessions - Enhanced */}
      {reliefData.length > 0 && (
        <div className="bg-card rounded-xl p-4 md:p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-foreground font-semibold text-sm md:text-base">Recent Sessions</h2>
            {reliefData.length > 3 && (
              <span className="text-muted-foreground text-xs">{reliefData.length} total sessions</span>
            )}
          </div>
          <div className="space-y-2">
            {reliefData
              .slice(-5)
              .reverse()
              .map((entry, idx) => {
                const relief = entry.beforePain - entry.afterPain;
                const isToday = entry.date === today;
                return (
                  <button
                    key={idx}
                    onClick={() => handleQuickRelief(entry.painArea as PainArea)}
                    className="w-full flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-primary/5 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <TrendingDown className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground font-medium text-sm truncate">{formatPainArea(entry.painArea)}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-muted-foreground text-xs">{formatReliefDate(entry.date)}</p>
                          {isToday && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">
                              Today
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p
                        className={`font-semibold text-base ${
                          relief > 0 ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {relief > 0 ? `−${relief}` : '0'}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {entry.beforePain} → {entry.afterPain}
                      </p>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Reminder Notice */}
      {settings.remindersEnabled && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-foreground text-xs">
            Break reminders active — you'll be prompted every {settings.reminderInterval}{' '}
            minutes to check in on your body
          </p>
        </div>
      )}

      {/* First-time Empty State - Simplified & More Actionable */}
      {/* {reliefData.length === 0 && (
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-5 md:p-6 text-center border border-primary/20">
          <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg md:text-xl text-foreground mb-2 font-bold">Ready to get started?</h3>
          <p className="text-muted-foreground mb-4 text-sm max-w-sm mx-auto">
            Select a pain area above and start your first relief routine. Most sessions take 60-180 seconds.
          </p>
          <button
            type="button"
            onClick={() => painAreaSectionRef.current?.focus()}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover active:scale-[0.98] transition-all font-medium text-sm shadow-sm"
          >
            Choose your first area
          </button>
        </div>
      )} */}
    </div>
  );
}