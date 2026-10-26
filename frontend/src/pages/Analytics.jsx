import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [competition, setCompetition] = useState('All Leagues');
  const [sector, setSector] = useState('All Sectors');
  const [dayType, setDayType] = useState('All Days');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get('http://localhost:8000/api/analytics', {
          params: {
            competition: competition,
            sector: sector,
            day_type: dayType
          }
        });
        setData(response.data);
      } catch (error) {
        console.error("Error fetching analytics data", error);
      }
      setLoading(false);
    };
    
    fetchData();
  }, [competition, sector, dayType]);

  const formatCurrency = (value) => {
    if (!value) return "€0.00";
    if (value >= 1000000) {
      return `€${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `€${(value / 1000).toFixed(1)}K`;
    }
    return `€${value.toFixed(2)}`;
  };

  const getCompColor = (index) => {
    const colors = ['bg-primary-container shadow-[0_0_10px_rgba(255,215,0,0.4)]', 'bg-secondary shadow-[0_0_10px_rgba(201,4,86,0.4)]', 'bg-tertiary-fixed-dim shadow-[0_0_10px_rgba(0,218,243,0.4)]'];
    return colors[index % colors.length];
  };

  const getCompTextColor = (index) => {
    const colors = ['text-primary', 'text-secondary', 'text-tertiary-fixed-dim'];
    return colors[index % colors.length];
  };

  return (
    <main className="ml-[260px] flex-1 flex flex-col min-h-screen overflow-y-auto bg-transparent custom-scrollbar p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-10">
        <div>
          <h2 className="font-headline-md text-primary text-3xl font-bold">Estadísticas de Temporada y Rendimiento del Estadio</h2>
        </div>
        <div className="flex items-center gap-4">
          <button className="px-4 py-2 rounded-lg border border-secondary text-secondary font-label-md flex items-center gap-2 hover:bg-secondary/10 transition-colors active:scale-95 duration-150">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download CSV
          </button>
          <button className="px-4 py-2 rounded-lg bg-secondary-container text-on-secondary-container font-label-md flex items-center gap-2 hover:opacity-90 transition-opacity active:scale-95 duration-150 shadow-[0_4px_20px_rgba(201,4,86,0.3)]">
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Export PDF
          </button>
        </div>
      </header>

      {/* Main Dashboard View */}
      <div className="space-y-6 max-w-[1600px] w-full animate-fade-in-up opacity-0">
        {/* Filters Bar */}
        <div className="glass-card p-4 rounded-xl flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] text-on-surface-variant uppercase font-bold mb-1 ml-1">Season</label>
            <div className="relative">
              <select className="w-full bg-surface-container-high border-none text-on-surface font-label-md rounded-lg py-2 pl-3 pr-8 appearance-none focus:ring-1 focus:ring-primary/50">
                <option>2023/2024</option>
              </select>
            </div>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] text-on-surface-variant uppercase font-bold mb-1 ml-1">Competition</label>
            <div className="relative">
              <select 
                className="w-full bg-surface-container-high border-none text-on-surface font-label-md rounded-lg py-2 pl-3 pr-8 appearance-none focus:ring-1 focus:ring-primary/50"
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
              >
                <option>All Leagues</option>
                <option>LaLiga</option>
                <option>Champions League</option>
                <option>Copa del Rey</option>
                <option>Supercopa</option>
                <option>Friendly</option>
              </select>
            </div>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] text-on-surface-variant uppercase font-bold mb-1 ml-1">Sector</label>
            <div className="relative">
              <select 
                className="w-full bg-surface-container-high border-none text-on-surface font-label-md rounded-lg py-2 pl-3 pr-8 appearance-none focus:ring-1 focus:ring-primary/50"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              >
                <option>All Sectors</option>
                <option>Gol</option>
                <option>Lateral</option>
                <option>Tribuna</option>
                <option>Corner</option>
                <option>VIP</option>
              </select>
            </div>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] text-on-surface-variant uppercase font-bold mb-1 ml-1">Day of Week</label>
            <div className="relative">
              <select 
                className="w-full bg-surface-container-high border-none text-on-surface font-label-md rounded-lg py-2 pl-3 pr-8 appearance-none focus:ring-1 focus:ring-primary/50"
                value={dayType}
                onChange={(e) => setDayType(e.target.value)}
              >
                <option>All Days</option>
                <option>Weekend Only</option>
                <option>Weekdays</option>
              </select>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 animate-fade-in-up opacity-0 stagger-1">
          <div className="glass-card p-6 rounded-xl border-l-4 border-l-primary-container relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
              <p className="font-label-sm text-on-surface-variant uppercase">Total Revenue</p>
              <span className="material-symbols-outlined text-primary-fixed-dim">payments</span>
            </div>
            <p className="font-numeric-xl text-primary">
              {loading ? "..." : formatCurrency(data?.total_revenue)}
            </p>
          </div>

          <div className="glass-card p-6 rounded-xl border-l-4 border-l-tertiary relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <p className="font-label-sm text-on-surface-variant uppercase">Avg Occupancy</p>
              <span className="material-symbols-outlined text-tertiary-fixed-dim">group</span>
            </div>
            <p className="font-numeric-xl text-tertiary">
              {loading ? "..." : `${data?.avg_occupancy.toFixed(1)}%`}
            </p>
          </div>

          <div className="glass-card p-6 rounded-xl border-l-4 border-l-secondary relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <p className="font-label-sm text-on-surface-variant uppercase">Avg Ticket Price</p>
              <span className="material-symbols-outlined text-secondary">local_activity</span>
            </div>
            <p className="font-numeric-xl text-secondary">
              {loading ? "..." : `€${data?.avg_ticket_price.toFixed(2)}`}
            </p>
          </div>

          <div className="glass-card p-6 rounded-xl border-l-4 border-l-on-tertiary-container relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <p className="font-label-sm text-on-surface-variant uppercase">Retention Rate</p>
              <span className="material-symbols-outlined text-on-tertiary-container">cached</span>
            </div>
            <p className="font-numeric-xl text-on-tertiary-container"></p>
          </div>
        </div>

        {/* Bottom Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up opacity-0 stagger-2">
          {/* Performance by Competition */}
          <div className="lg:col-span-1 glass-card p-6 rounded-xl">
            <h3 className="font-label-md text-on-surface uppercase tracking-wider mb-4">Performance by Competition</h3>
            <div className="space-y-4">
              {loading ? <p className="text-on-surface-variant">Loading...</p> : 
                data?.performance_by_competition?.map((comp, index) => {
                  const maxRev = data.performance_by_competition[0]?.revenue || 1;
                  const pct = Math.max(5, (comp.revenue / maxRev) * 100);
                  return (
                    <div key={comp.name} className="p-3 bg-surface-container-low rounded-lg">
                      <div className="flex justify-between mb-2">
                        <span className="font-label-md">{comp.name}</span>
                        <span className={`font-label-md ${getCompTextColor(index)}`}>{formatCurrency(comp.revenue)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
                        <div className={`h-full ${getCompColor(index)} rounded-full`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>

          {/* Recent Matches Table */}
          <div className="lg:col-span-2 glass-card rounded-xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-label-md text-on-surface uppercase tracking-wider">Matches Performance</h3>
            </div>
            <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low/50 font-label-sm text-on-surface-variant uppercase tracking-tighter sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Match Details</th>
                    <th className="px-6 py-4">Competition</th>
                    <th className="px-6 py-4 text-right">Attendance</th>
                    <th className="px-6 py-4 text-right">Revenue</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-label-md">
                  {loading ? (
                    <tr><td colSpan="5" className="px-6 py-4 text-center text-on-surface-variant">Loading matches...</td></tr>
                  ) : (
                    data?.recent_matches?.map((match) => (
                      <tr key={match.match_id} className="hover:bg-white/5 transition-colors cursor-pointer group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center font-bold">VS</div>
                            <div>
                              <p className="text-on-surface">Home vs {match.opponent}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-secondary-container/20 text-secondary rounded text-[11px] font-bold">
                            {match.competition.substring(0, 3).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">{match.attendance.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-primary">{formatCurrency(match.revenue)}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            {match.status === 'OPTIMAL' ? (
                              <span className="flex items-center gap-1 text-[11px] text-tertiary-fixed-dim bg-on-tertiary/20 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse"></span>
                                OPTIMAL
                              </span>
                            ) : match.status === 'GOOD' ? (
                              <span className="flex items-center gap-1 text-[11px] text-primary-fixed-dim bg-primary/20 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-fixed-dim"></span>
                                GOOD
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded-full">
                                UNDER
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Analytics;
