import type { ReliefEntry } from '@stretchly/shared';
import { Calendar, TrendingDown, Award, CheckCircle2, Info } from 'lucide-react';
import { formatPainArea } from '../utils/formatDate';

interface ProgressTrackerProps {
  reliefData: ReliefEntry[];
  onNavigateToDashboard?: () => void;
}

export function ProgressTracker({ reliefData, onNavigateToDashboard }: ProgressTrackerProps) {
  // Get exactly last 30 days
  const getLast30Days = () => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
      });
    }
    return days;
  };

  const last30Days = getLast30Days();
  
  // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
  const firstDay = new Date();
  firstDay.setDate(firstDay.getDate() - 29);
  const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Create array with empty boxes at the start to align with week grid, then exactly 30 days
  const calendarDays: Array<{ date: string; dayName: string; dayNumber: number; isEmpty?: boolean }> = [];
  
  // Add empty boxes at the start to align with Sunday
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push({ date: '', dayName: '', dayNumber: 0, isEmpty: true });
  }
  
  // Add exactly 30 days
  calendarDays.push(...last30Days);
  
  // Ensure we have exactly 30 boxes total (excluding padding)
  // With 7 columns, we need: padding + 30 days = firstDayOfWeek + 30 boxes
  // Total boxes shown will be firstDayOfWeek + 30

  // Calculate activity for each day
  const getActivityCount = (date: string) => {
    return reliefData.filter(r => r.date === date).length;
  };

  // Calculate stats
  const totalSessions = reliefData.length;
  const avgReliefAllTime =
    reliefData.length > 0
      ? reliefData.reduce((sum, r) => sum + (r.beforePain - r.afterPain), 0) / reliefData.length
      : 0;
  const currentStreak = calculateCurrentStreak();

  function calculateCurrentStreak(): number {
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      if (reliefData.some(r => r.date === dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  }

  // Pain area breakdown
  const getPainAreaBreakdown = () => {
    const counts: Record<string, number> = {};

    reliefData.forEach(r => {
      counts[r.painArea] = (counts[r.painArea] || 0) + 1;
    });

    return counts;
  };

  const painAreaBreakdown = getPainAreaBreakdown();
  const maxPainCount = Math.max(...Object.values(painAreaBreakdown), 1);

  // Get most effective area
  const getMostEffectiveArea = () => {
    const areaReliefs: Record<string, { total: number; count: number }> = {};

    reliefData.forEach(r => {
      const relief = r.beforePain - r.afterPain;
      if (!areaReliefs[r.painArea]) {
        areaReliefs[r.painArea] = { total: 0, count: 0 };
      }
      areaReliefs[r.painArea].total += relief;
      areaReliefs[r.painArea].count += 1;
    });

    let bestArea = '';
    let bestAvg = 0;

    Object.entries(areaReliefs).forEach(([area, data]) => {
      const avg = data.total / data.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestArea = area;
      }
    });

    return { area: bestArea, avgRelief: bestAvg };
  };

  const mostEffective = getMostEffectiveArea();

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Stats Overview - Brand Color */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
        <div className="bg-gradient-primary rounded-lg p-3 md:p-4 text-white shadow-md">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-white/25 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 md:w-4 md:h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-[10px] md:text-xs font-medium opacity-95">Total Sessions</p>
              <p className="text-xl md:text-2xl font-bold text-white leading-tight">{totalSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-primary rounded-lg p-3 md:p-4 text-white shadow-md">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-white/25 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-4 h-4 md:w-4 md:h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-[10px] md:text-xs font-medium opacity-95">Avg Relief</p>
              <p className="text-xl md:text-2xl font-bold text-white leading-tight">{avgReliefAllTime.toFixed(1)}</p>
              <p className="text-white text-[9px] opacity-90">points per session</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-primary rounded-lg p-3 md:p-4 text-white shadow-md">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-white/25 rounded-lg flex items-center justify-center flex-shrink-0">
              <Award className="w-4 h-4 md:w-4 md:h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-[10px] md:text-xs font-medium opacity-95">Current Streak</p>
              <p className="text-xl md:text-2xl font-bold text-white leading-tight">{currentStreak}</p>
              <p className="text-white text-[9px] opacity-90">days in a row</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Calendar - Compact */}
      <div className="bg-card rounded-lg p-3 md:p-4 shadow-sm border border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-foreground text-sm md:text-base font-bold">Relief Activity (Last 30 Days)</h2>
          <span className="text-muted-foreground text-[10px] md:text-xs">
            {last30Days.filter(d => getActivityCount(d.date) > 0).length} active days
          </span>
        </div>
        
        {/* Week day headers - 7 columns (Tu/Th to disambiguate Tuesday/Thursday) */}
        <div className="grid grid-cols-7 gap-1 mb-1.5" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {['S', 'M', 'Tu', 'W', 'Th', 'F', 'S'].map((day, idx) => (
            <div key={idx} className="text-center text-[10px] md:text-xs text-muted-foreground font-medium">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar days grid - Exactly 30 boxes (with padding for alignment), 7 per row */}
        <div className="grid grid-cols-7 gap-1 mb-3" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {calendarDays.map((day, idx) => {
            if (day.isEmpty) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="aspect-square min-h-[24px] md:min-h-[28px] w-full"
                  style={{ minWidth: 0 }}
                />
              );
            }
            
            const count = getActivityCount(day.date);
            const intensity =
              count === 0
                ? 'bg-muted'
                : count === 1
                  ? 'bg-primary/40'
                  : count === 2
                    ? 'bg-primary/60'
                    : count >= 3
                      ? 'bg-primary'
                      : 'bg-muted';

            return (
              <div
                key={`${day.date}-${idx}`}
                className="aspect-square min-h-[24px] md:min-h-[28px] w-full flex items-center justify-center rounded hover:ring-1 hover:ring-primary/50 transition-all cursor-pointer group relative"
                style={{ minWidth: 0 }}
                title={`${day.dayName}, ${day.date}: ${count} session${count !== 1 ? 's' : ''}`}
              >
                <div className={`w-full h-full rounded ${intensity} flex items-center justify-center transition-transform group-hover:scale-105`}>
                  <span className={`text-[9px] md:text-[10px] font-medium ${count > 0 ? 'text-white drop-shadow-sm' : 'text-disabled-foreground'}`}>
                    {day.dayNumber}
                  </span>
                </div>
                {count > 0 && (
                  <div className="absolute -top-0.5 -right-0.5 w-1 h-1 md:w-1.5 md:h-1.5 bg-primary rounded-full border border-card" />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border">
          <span>Less</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-muted rounded" />
            <div className="w-2 h-2 bg-primary/40 rounded" />
            <div className="w-2 h-2 bg-primary/60 rounded" />
            <div className="w-2 h-2 bg-primary rounded" />
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Pain Area Breakdown - Enhanced */}
      <div className="bg-card rounded-xl p-6 md:p-7 shadow-sm border border-border">
        <h2 className="text-foreground mb-6 text-lg font-bold">Pain Areas Addressed</h2>
        <div className="space-y-4">
          {Object.entries(painAreaBreakdown).map(([area, count]) => {
            const percentage = (count / maxPainCount) * 100;

            return (
              <div key={area}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-foreground">{formatPainArea(area)}</span>
                  <span className="text-muted-foreground">{count} session{count !== 1 ? 's' : ''}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Relief Insights - Enhanced */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-6 md:p-7 border border-primary/20">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-primary/20 rounded-lg flex items-center justify-center">
            <Info className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-foreground text-lg font-bold">Relief Insights</h2>
        </div>
        <div className="space-y-3">
          {mostEffective.area && (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-foreground">
                Your <strong>{formatPainArea(mostEffective.area)}</strong> routines provide
                the most relief (avg {mostEffective.avgRelief.toFixed(1)} point reduction)
              </p>
            </div>
          )}
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-foreground">
              {currentStreak > 0 ? (
                <>
                  You're on a <strong>{currentStreak}-day streak</strong>! Consistency is key to
                  long-term relief.
                </>
              ) : (
                <>Start using Stretchly daily to build healthy habits and reduce chronic pain.</>
              )}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-foreground">
              You've completed <strong>{totalSessions} relief sessions</strong> — each one
              contributes to better posture and comfort.
            </p>
          </div>
        </div>
      </div>

      {/* Empty State - Enhanced */}
      {reliefData.length === 0 && (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingDown className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-2xl text-foreground mb-3 font-bold">No relief data yet</h3>
          <p className="text-muted-foreground text-lg max-w-md mx-auto mb-6">
            Complete your first routine to start tracking your pain relief progress
          </p>
          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="px-6 py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent transition-colors font-medium shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              Do your first routine
            </button>
          )}
        </div>
      )}
    </div>
  );
}