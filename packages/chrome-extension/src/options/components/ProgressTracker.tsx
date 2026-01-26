import type { ReliefEntry } from '@stretchly/shared';
import { TrendingDown, CheckCircle2 } from 'lucide-react';
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
    <div className="space-y-6">
      {/* Hero Stat */}
      <div className="bg-primary rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/90 text-sm mb-2 font-medium">Current Streak</p>
            <p className="text-4xl md:text-5xl font-bold text-white mb-1">{currentStreak}</p>
            <p className="text-white/80 text-sm">days in a row</p>
          </div>
          <div className="text-right">
            <p className="text-white/90 text-sm mb-2 font-medium">Total Sessions</p>
            <p className="text-3xl md:text-4xl font-bold text-white mb-1">{totalSessions}</p>
            <p className="text-white/80 text-sm">{avgReliefAllTime.toFixed(1)} avg relief</p>
          </div>
        </div>
      </div>

      {/* Activity & Pain Areas */}
      <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-foreground text-lg font-bold">Activity</h2>
          <div className="text-right">
            <p className="text-foreground text-lg font-bold">
              {last30Days.filter(d => getActivityCount(d.date) > 0).length}
            </p>
            <p className="text-muted-foreground text-sm">active days</p>
          </div>
        </div>

        {/* Two-column layout: Calendar on left, Pain Areas on right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {/* Left: Activity Calendar - Compact */}
          <div className="flex-shrink-0">
            {/* Week day headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {['S', 'M', 'Tu', 'W', 'Th', 'F', 'S'].map((day, idx) => (
                <div 
                  key={idx} 
                  className="text-center text-[10px] md:text-xs text-muted-foreground font-semibold"
                >
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar days grid - Compact but readable */}
            <div className="grid grid-cols-7 gap-0.5 mb-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {calendarDays.map((day, idx) => {
                if (day.isEmpty) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="aspect-square min-h-[18px] md:min-h-[20px] w-full"
                      style={{ minWidth: 0 }}
                    />
                  );
                }
                
                const count = getActivityCount(day.date);
                const isToday = day.date === new Date().toISOString().split('T')[0];
                
                const intensity =
                  count === 0
                    ? 'bg-muted/50 hover:bg-muted/70'
                    : count === 1
                      ? 'bg-primary/50 hover:bg-primary/65'
                      : count === 2
                        ? 'bg-primary/70 hover:bg-primary/85'
                        : count >= 3
                          ? 'bg-primary hover:bg-primary/95'
                          : 'bg-muted/50';

                return (
                  <div
                    key={`${day.date}-${idx}`}
                    className="aspect-square min-h-[18px] md:min-h-[20px] w-full flex items-center justify-center rounded-md transition-all cursor-pointer group relative"
                    style={{ minWidth: 0 }}
                  >
                    {/* Hover tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-foreground text-background text-xs font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 whitespace-nowrap">
                      <div className="text-center">
                        <div className="font-semibold">{day.dayName}, {day.date.split('-')[1]}/{day.date.split('-')[2]}</div>
                        <div className="text-[10px] opacity-90">{count} session{count !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-foreground rotate-45"></div>
                    </div>
                    
                    <div className={`w-full h-full rounded-md ${intensity} flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:shadow-md group-hover:z-10 ${
                      isToday ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-card' : ''
                    }`}>
                      <span className={`text-[9px] md:text-[10px] font-bold transition-colors ${
                        count > 0 
                          ? 'text-white drop-shadow-md' 
                          : 'text-muted-foreground group-hover:text-foreground'
                      }`}>
                        {day.dayNumber}
                      </span>
                    </div>
                    {count > 0 && (
                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full border-2 border-card shadow-md z-10" />
                    )}
                    {isToday && count === 0 && (
                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary/40 rounded-full border border-card z-10" />
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Compact Legend */}
            <div className="flex items-center justify-center gap-1.5 pt-1.5 border-t border-border">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-muted/50 rounded" />
                <span className="text-[9px] text-muted-foreground">0</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-primary/50 rounded" />
                <span className="text-[9px] text-muted-foreground">1</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-primary/70 rounded" />
                <span className="text-[9px] text-muted-foreground">2</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-primary rounded" />
                <span className="text-[9px] text-muted-foreground">3+</span>
              </div>
            </div>
          </div>

          {/* Right: Pain Areas */}
          <div>
            <h3 className="text-foreground mb-3 text-base font-bold">Pain Areas</h3>
            <div className="space-y-3">
              {Object.entries(painAreaBreakdown).map(([area, count]) => {
                const percentage = (count / maxPainCount) * 100;

                return (
                  <div key={area}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-foreground text-sm">{formatPainArea(area)}</span>
                      <span className="text-muted-foreground text-sm">{count}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
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
        </div>
      </div>

      {/* Insights */}
      {mostEffective.area && (
        <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-foreground font-semibold mb-1">{formatPainArea(mostEffective.area)}</p>
              <p className="text-muted-foreground text-sm">
                Most effective • {mostEffective.avgRelief.toFixed(1)} avg relief
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {reliefData.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingDown className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl text-foreground mb-2 font-bold">No data yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Complete your first routine to start tracking progress
          </p>
          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="px-6 py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent transition-colors font-medium shadow-md active:scale-[0.98]"
            >
              Start Routine
            </button>
          )}
        </div>
      )}
    </div>
  );
}