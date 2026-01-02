
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WeekendDay, AppState, RecurringSupportSettings } from './types';
import { APP_CONFIG, Icons } from './constants';
import WeekendCard from './components/WeekendCard';
import EditModal from './components/EditModal';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const STORAGE_KEY = 'zenweekend_v8_final';

  // 1. Initial Load from Local Storage (Instant UI)
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AppState;
        Object.values(parsed.weekendDays).forEach(day => {
          day.date = new Date(day.date);
        });
        return parsed;
      } catch (e) {
        console.error("Local storage restoration failed:", e);
      }
    }
    return {
      weekendDays: {},
      recurringSupport: { 
        saturday: true, 
        sunday: true, 
        interval: 1, 
        baseDate: new Date().toISOString().split('T')[0],
        customBg: undefined
      }
    };
  });

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingDay, setEditingDay] = useState<WeekendDay | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Sync from Supabase (Merge with local)
  useEffect(() => {
    const syncWithCloud = async () => {
      setLoading(true);
      try {
        const [plansRes, settingsRes] = await Promise.all([
          supabase.from('weekend_plans').select('*'),
          supabase.from('weekend_settings').select('*').eq('id', 1).maybeSingle()
        ]);

        if (plansRes.error) {
          console.error("❌ Plans fetch error:", plansRes.error);
        }
        
        const cloudPlans: Record<string, WeekendDay> = {};
        if (plansRes.data) {
          plansRes.data.forEach(p => {
            cloudPlans[p.id] = {
              id: p.id,
              date: new Date(p.date),
              type: p.type as any,
              plan: p.plan,
              isBusy: p.is_busy,
              isSupport: p.is_support,
              recurring: 'none' 
            };
          });
        }

        const cloudSettings = settingsRes.data?.recurring_support;

        setState(prev => {
          const mergedDays = { ...prev.weekendDays, ...cloudPlans };
          const mergedSettings = cloudSettings ? { ...prev.recurringSupport, ...cloudSettings } : prev.recurringSupport;
          
          return {
            weekendDays: mergedDays,
            recurringSupport: mergedSettings
          };
        });
      } catch (err) {
        console.warn("⚠️ Sync partially failed.", err);
      } finally {
        setLoading(false);
      }
    };
    syncWithCloud();
  }, []);

  // 3. Persist to Local Storage
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, loading]);

  const groupedWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    const today = new Date();
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay() - (7 * APP_CONFIG.WEEKS_BEFORE));
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - today.getDay()) + (7 * APP_CONFIG.WEEKS_AFTER));

    const current = new Date(startDate);
    let currentWeek: Date[] = [];

    while (current <= endDate) {
      const day = current.getDay();
      if (day === 6 || day === 0) {
        currentWeek.push(new Date(current));
        if (day === 0) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }
      current.setDate(current.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return weeks;
  }, []);

  const handleUpdateDay = async (updatedDay: WeekendDay) => {
    setSyncing(true);
    setState(prev => ({
      ...prev,
      weekendDays: { ...prev.weekendDays, [updatedDay.id]: updatedDay }
    }));
    setEditingDay(null);

    try {
      const { error } = await supabase.from('weekend_plans').upsert({
        id: updatedDay.id,
        date: updatedDay.date.toISOString(),
        type: updatedDay.type,
        plan: updatedDay.plan,
        is_busy: updatedDay.isBusy,
        is_support: updatedDay.isSupport
      }, { onConflict: 'id' });
      if (error) throw error;
    } catch (e) {
      console.error("❌ Database Save Failed.", e);
    } finally {
      setSyncing(false);
    }
  };

  const updateSupportSettings = async (updates: Partial<RecurringSupportSettings>) => {
    setSyncing(true);
    const newSettings = { ...state.recurringSupport, ...updates };
    setState(prev => ({ ...prev, recurringSupport: newSettings }));
    
    try {
      const { error } = await supabase.from('weekend_settings').upsert({ 
        id: 1, 
        recurring_support: newSettings 
      }, { onConflict: 'id' });
      if (error) throw error;
    } catch (e) { 
      console.error("❌ Settings Save Failed:", e); 
    } finally {
      setSyncing(false);
    }
  };

  const isDateSupport = (targetDate: Date) => {
    const { interval, baseDate } = state.recurringSupport;
    const getWeekMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      return monday;
    };
    const startMonday = getWeekMonday(new Date(baseDate));
    const targetMonday = getWeekMonday(targetDate);
    const diffWeeks = Math.round((targetMonday.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.abs(diffWeeks) % (interval || 1) === 0;
  };

  const getWeekLabel = (dates: Date[]) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const weekSun = new Date(dates[dates.length - 1]);
    weekSun.setHours(0,0,0,0);
    
    const diffTime = weekSun.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 0 && diffDays <= 6) return "This Weekend";
    if (diffDays < 0 && diffDays >= -7) return "Last Weekend";
    if (diffDays > 6 && diffDays <= 13) return "Next Weekend";
    
    const diffWeeks = Math.floor(diffDays / 7);
    return diffWeeks > 0 ? `${diffWeeks}w Forward` : `Past`;
  };

  const bgImage = state.recurringSupport.customBg || APP_CONFIG.BG_IMAGE;

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center p-4 md:p-6 overflow-y-auto transition-all duration-1000 no-scrollbar"
      style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.9)), url(${bgImage})` }}
    >
      <header className="w-full max-w-7xl mb-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 z-10 pt-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 mb-1 drop-shadow-sm">
            ZenWeekend
          </h1>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
              {(loading || syncing) ? (loading ? 'Restoring Session...' : 'Cloud Syncing...') : 'Connected & Secure'}
            </p>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl p-4 rounded-3xl flex flex-wrap gap-4 items-center border border-white shadow-lg ring-1 ring-black/5">
          <div className="flex flex-col gap-0.5">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Rotation</span>
             <select 
                className="bg-white/80 border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-800 outline-none hover:border-slate-400 transition-all cursor-pointer shadow-sm min-w-[110px]"
                value={state.recurringSupport.interval}
                onChange={(e) => updateSupportSettings({ interval: parseInt(e.target.value) })}
              >
                 <option value="1">Weekly</option>
                 <option value="2">2 Weeks</option>
                 <option value="3">3 Weeks</option>
                 <option value="4">4 Weeks</option>
              </select>
          </div>
          
          <div className="flex flex-col gap-0.5">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Anchor</span>
             <input 
              type="date"
              className="bg-white/80 border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-800 outline-none hover:border-slate-400 transition-all cursor-pointer shadow-sm"
              value={state.recurringSupport.baseDate.split('T')[0]}
              onChange={(e) => updateSupportSettings({ baseDate: e.target.value })}
             />
          </div>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-md font-black text-[9px] uppercase tracking-widest"
          >
            <Icons.Image />
            <span>Theme</span>
          </button>
          <input type="file" ref={fileInputRef} onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => updateSupportSettings({ customBg: reader.result as string });
              reader.readAsDataURL(file);
            }
          }} accept="image/*" className="hidden" />
        </div>
      </header>

      <main className="w-full max-w-7xl pb-24 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 px-2">
          {groupedWeeks.map((weekDates, wIdx) => {
            const weekLabel = getWeekLabel(weekDates);
            const isTodayWeek = weekLabel === "This Weekend";

            return (
              <React.Fragment key={`week-block-${wIdx}`}>
                {/* Visual separator for new weeks in the sequence */}
                <div className="col-span-full mt-4 flex items-center gap-4">
                  <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] shadow-sm backdrop-blur-md transition-all ${
                    isTodayWeek ? 'bg-slate-900 text-white border-slate-900' : 'bg-white/80 text-slate-400 border-white'
                  }`}>
                    {weekLabel}
                  </div>
                  <div className={`h-[1px] flex-1 ${isTodayWeek ? 'bg-slate-900/20' : 'bg-slate-200/50'}`} />
                </div>
                
                {weekDates.map((date, dIdx) => {
                  const id = date.toISOString().split('T')[0];
                  const storedDay = state.weekendDays[id];
                  const hasRecurringSupport = isDateSupport(date);

                  const dayData: WeekendDay = storedDay || {
                    id, date, type: date.getDay() === 6 ? 'Saturday' : 'Sunday', 
                    plan: '', isBusy: false, isSupport: false, recurring: 'none'
                  };

                  return (
                    <div 
                      key={id} 
                      className="animate-in fade-in zoom-in duration-300"
                    >
                      <WeekendCard 
                        day={dayData}
                        activeSupport={dayData.isSupport || hasRecurringSupport}
                        onEdit={() => setEditingDay(dayData)}
                      />
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </main>

      {editingDay && (
        <EditModal 
          day={editingDay} 
          onClose={() => setEditingDay(null)} 
          onSave={handleUpdateDay} 
        />
      )}
      
      <footer className="fixed bottom-6 z-30 pointer-events-none w-full flex justify-center">
        <div className="bg-slate-900/95 backdrop-blur-2xl px-8 py-3 rounded-2xl flex items-center gap-8 shadow-2xl border border-white/10 animate-in slide-in-from-bottom duration-700 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${APP_CONFIG.COLORS.OPEN}`}></div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/70">Open</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${APP_CONFIG.COLORS.BUSY}`}></div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/70">Busy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/70">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
