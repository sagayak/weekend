
/**
 * SUPABASE SQL SCHEMA
 * Run this in your Supabase SQL Editor to ensure the tables are ready:
 * 
 * CREATE TABLE IF NOT EXISTS public.weekend_plans (
 *   id text PRIMARY KEY,
 *   date date NOT NULL,
 *   type text NOT NULL,
 *   plan text,
 *   is_busy boolean DEFAULT false,
 *   is_support boolean DEFAULT false
 * );
 * 
 * CREATE TABLE IF NOT EXISTS public.weekend_settings (
 *   id bigint PRIMARY KEY,
 *   recurring_support jsonb
 * );
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WeekendDay, AppState, RecurringSupportSettings } from './types';
import { APP_CONFIG, Icons } from './constants';
import WeekendCard from './components/WeekendCard';
import EditModal from './components/EditModal';
import { supabase } from './supabaseClient';

// Helper to ensure IDs are ALWAYS YYYY-MM-DD regardless of local timezone/offset
const formatDateId = (date: Date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const App: React.FC = () => {
  const STORAGE_KEY = 'zenweekend_v11_stable';

  // 1. Initial Load from Local Storage (Instant UI)
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AppState;
        const normalizedDays: Record<string, WeekendDay> = {};
        Object.values(parsed.weekendDays).forEach(day => {
          const d = new Date(day.date);
          const id = formatDateId(d);
          normalizedDays[id] = { ...day, id, date: d };
        });
        return { ...parsed, weekendDays: normalizedDays };
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
        baseDate: formatDateId(new Date()),
        customBg: undefined
      }
    };
  });

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<WeekendDay | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Sync from Supabase (Cloud -> Local)
  useEffect(() => {
    const syncWithCloud = async () => {
      setLoading(true);
      try {
        const [plansRes, settingsRes] = await Promise.all([
          supabase.from('weekend_plans').select('*'),
          supabase.from('weekend_settings').select('*').eq('id', 1).maybeSingle()
        ]);

        const cloudPlans: Record<string, WeekendDay> = {};
        if (plansRes.data) {
          plansRes.data.forEach(p => {
            const d = new Date(p.date);
            const id = formatDateId(d);
            cloudPlans[id] = {
              id,
              date: d,
              type: p.type as any,
              plan: p.plan || '',
              isBusy: Boolean(p.is_busy), // Explicit Boolean cast
              isSupport: Boolean(p.is_support),
              recurring: 'none' 
            };
          });
        }

        const cloudSettings = settingsRes.data?.recurring_support;

        setState(prev => {
          const mergedDays = { ...prev.weekendDays };
          
          Object.keys(cloudPlans).forEach(id => {
            const cloudDay = cloudPlans[id];
            const localDay = mergedDays[id];
            
            // Protect local unsynced content
            const localHasContent = localDay && (localDay.isBusy || (localDay.plan && localDay.plan.trim() !== ''));
            const cloudIsEmpty = !cloudDay.isBusy && (!cloudDay.plan || cloudDay.plan.trim() === '');

            if (!localDay || !localHasContent || (localHasContent && !cloudIsEmpty)) {
               mergedDays[id] = cloudDay;
            }
          });

          return {
            weekendDays: mergedDays,
            recurringSupport: cloudSettings ? { ...prev.recurringSupport, ...cloudSettings } : prev.recurringSupport
          };
        });
      } catch (err) {
        console.warn("Offline Mode Active");
      } finally {
        setLoading(false);
      }
    };
    syncWithCloud();
  }, []);

  // 3. Local Persistence
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, loading]);

  const groupedWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay() - 7);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - today.getDay()) + (7 * 6));

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
    setLastError(null);
    
    const cleanId = formatDateId(updatedDay.date);
    const dayWithCleanId = { ...updatedDay, id: cleanId };

    const newState = {
      ...state,
      weekendDays: { ...state.weekendDays, [cleanId]: dayWithCleanId }
    };
    setState(newState);
    setEditingDay(null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));

    try {
      const { error } = await supabase.from('weekend_plans').upsert({
        id: cleanId,
        date: cleanId,
        type: dayWithCleanId.type,
        plan: dayWithCleanId.plan,
        is_busy: dayWithCleanId.isBusy,
        is_support: dayWithCleanId.isSupport
      }, { onConflict: 'id' });
      
      if (error) throw error;
    } catch (e: any) {
      console.error("Sync Error:", e.message);
      setLastError(e.message || "Unknown Cloud Error");
    } finally {
      setSyncing(false);
    }
  };

  const updateSupportSettings = async (updates: Partial<RecurringSupportSettings>) => {
    setSyncing(true);
    const newSettings = { ...state.recurringSupport, ...updates };
    setState(prev => ({ ...prev, recurringSupport: newSettings }));
    try {
      await supabase.from('weekend_settings').upsert({ id: 1, recurring_support: newSettings }, { onConflict: 'id' });
    } catch (e) {} finally { setSyncing(false); }
  };

  const isDateSupport = (targetDate: Date) => {
    const { interval, baseDate } = state.recurringSupport;
    const d = new Date(targetDate);
    const start = new Date(baseDate);
    const diff = Math.round((d.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.abs(diff) % (interval || 1) === 0;
  };

  const getWeekLabel = (dates: Date[]) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const weekSun = new Date(dates[dates.length - 1]); weekSun.setHours(0,0,0,0);
    const diff = Math.ceil((weekSun.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= 6) return "This Weekend";
    if (diff < 0 && diff >= -7) return "Last Weekend";
    return diff > 6 ? `${Math.floor(diff/7)}w Ahead` : `Past`;
  };

  const bgImage = state.recurringSupport.customBg || APP_CONFIG.BG_IMAGE;

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center p-4 md:p-6 overflow-y-auto no-scrollbar"
      style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.9)), url(${bgImage})` }}
    >
      <header className="w-full max-w-7xl mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 z-10 pt-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 mb-1 drop-shadow-sm">ZenWeekend</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${lastError ? 'bg-red-500' : (syncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500')}`} />
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
              {lastError ? `Sync Failed: ${lastError}` : (syncing ? 'Syncing...' : 'Cloud Active')}
            </p>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-2xl p-4 rounded-3xl flex flex-wrap gap-4 items-center border border-white shadow-xl">
          <div className="flex flex-col gap-0.5">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Cycle</span>
             <select 
                className="bg-white/80 border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-800 outline-none hover:border-slate-400 transition-all cursor-pointer min-w-[110px]"
                value={state.recurringSupport.interval}
                onChange={(e) => updateSupportSettings({ interval: parseInt(e.target.value) })}
              >
                 <option value="1">Every Week</option>
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
              value={state.recurringSupport.baseDate}
              onChange={(e) => updateSupportSettings({ baseDate: e.target.value })}
             />
          </div>

          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-md font-black text-[9px] uppercase tracking-widest">
            <Icons.Image /> Theme
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

      <main className="w-full max-w-7xl pb-24 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 px-2">
          {groupedWeeks.map((weekDates, wIdx) => {
            const weekLabel = getWeekLabel(weekDates);
            const isTodayWeek = weekLabel === "This Weekend";
            return (
              <React.Fragment key={`week-block-${wIdx}`}>
                <div className="col-span-full mt-4 flex items-center gap-4">
                  <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] shadow-sm backdrop-blur-md transition-all ${isTodayWeek ? 'bg-slate-900 text-white border-slate-900' : 'bg-white/80 text-slate-400 border-white'}`}>{weekLabel}</div>
                  <div className={`h-[1px] flex-1 ${isTodayWeek ? 'bg-slate-900/20' : 'bg-slate-200/50'}`} />
                </div>
                {weekDates.map((date, dIdx) => {
                  const id = formatDateId(date);
                  const dayData = state.weekendDays[id] || { id, date, type: date.getDay() === 6 ? 'Saturday' : 'Sunday', plan: '', isBusy: false, isSupport: false, recurring: 'none' };
                  return (
                    <div key={id} className="animate-in fade-in zoom-in duration-300">
                      <WeekendCard day={dayData} activeSupport={dayData.isSupport || isDateSupport(date)} onEdit={() => setEditingDay(dayData)} />
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </main>

      {editingDay && <EditModal day={editingDay} onClose={() => setEditingDay(null)} onSave={handleUpdateDay} />}
      
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
