import React, { useState, useMemo } from 'react';
import { 
  AssessmentRecord, 
  Student, 
  OutcomeRubric, 
  ActiveTab 
} from '../types';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  Calendar, 
  Users, 
  ClipboardCheck, 
  MessageSquare, 
  Eye, 
  Sparkles, 
  Filter, 
  ArrowUpRight, 
  Award, 
  CheckCircle2, 
  Clock, 
  Layers 
} from 'lucide-react';

interface DashboardProps {
  records: AssessmentRecord[];
  students: Student[];
  rubrics: OutcomeRubric[];
  onNavigateToAssess: (studentId?: string, rubricId?: string) => void;
  onNavigateToHistory: () => void;
}

// Color palettes for bands and evidence types
const BAND_COLORS: Record<string, string> = {
  Emerging: '#f43f5e',   // rose-500
  Developing: '#f59e0b', // amber-500
  Proficient: '#10b981', // emerald-500
  Extending: '#6366f1',  // indigo-500
};

const EVIDENCE_COLORS = {
  observation: '#0ea5e9',  // sky-500
  conversation: '#8b5cf6', // violet-500
  both: '#10b981',         // emerald-500
};

export const Dashboard: React.FC<DashboardProps> = ({
  records,
  students,
  rubrics,
  onNavigateToAssess,
  onNavigateToHistory,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [selectedRubricId, setSelectedRubricId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'all' | '14d' | '30d'>('all');

  // Filter records based on selected filters
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (selectedStudentId !== 'all') {
      result = result.filter((r) => r.studentId === selectedStudentId);
    }

    if (selectedRubricId !== 'all') {
      result = result.filter((r) => r.rubricId === selectedRubricId);
    }

    if (timeRange !== 'all') {
      const now = new Date().getTime();
      const days = timeRange === '14d' ? 14 : 30;
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      result = result.filter((r) => new Date(r.date).getTime() >= cutoff);
    }

    // Chronological order for time series
    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [records, selectedStudentId, selectedRubricId, timeRange]);

  // Aggregate Key Statistics
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    if (total === 0) {
      return {
        total: 0,
        avgScore: 0,
        avgScoreFormatted: '0.0',
        observationCount: 0,
        conversationCount: 0,
        bothCount: 0,
        studentCoveragePct: 0,
        activeStudentCount: 0,
      };
    }

    const totalScore = filteredRecords.reduce((acc, r) => acc + (r.selectedScore || 0), 0);
    const avgScore = totalScore / total;
    const observationCount = filteredRecords.filter((r) => r.type === 'observation').length;
    const conversationCount = filteredRecords.filter((r) => r.type === 'conversation').length;
    const bothCount = filteredRecords.filter((r) => r.type === 'both').length;

    const uniqueStudentsAssessed = new Set(filteredRecords.map((r) => r.studentId)).size;
    const studentCoveragePct = students.length > 0 
      ? Math.round((uniqueStudentsAssessed / students.length) * 100) 
      : 0;

    return {
      total,
      avgScore,
      avgScoreFormatted: avgScore.toFixed(1),
      observationCount,
      conversationCount,
      bothCount,
      studentCoveragePct,
      activeStudentCount: uniqueStudentsAssessed,
    };
  }, [filteredRecords, students]);

  // 1. Performance Trends Over Time Data (for Recharts AreaChart/LineChart)
  const performanceTrendData = useMemo(() => {
    if (filteredRecords.length === 0) return [];

    // Group records by calendar day (YYYY-MM-DD)
    const dayGroups: Record<string, { dateStr: string; displayDate: string; scores: number[]; count: number; studentNames: Set<string> }> = {};

    filteredRecords.forEach((r) => {
      const d = new Date(r.date);
      const key = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      if (!dayGroups[key]) {
        dayGroups[key] = {
          dateStr: key,
          displayDate,
          scores: [],
          count: 0,
          studentNames: new Set(),
        };
      }
      dayGroups[key].scores.push(r.selectedScore || 0);
      dayGroups[key].count += 1;
      dayGroups[key].studentNames.add(r.studentName);
    });

    // Build timeline points
    return Object.keys(dayGroups)
      .sort()
      .map((key) => {
        const item = dayGroups[key];
        const sum = item.scores.reduce((a, b) => a + b, 0);
        const avg = Number((sum / item.scores.length).toFixed(2));
        return {
          date: item.displayDate,
          fullDate: item.dateStr,
          averageScore: avg,
          score: avg,
          assessments: item.count,
          students: Array.from(item.studentNames).join(', '),
        };
      });
  }, [filteredRecords]);

  // 2. Frequency of Assessments Over Time Data (for Recharts BarChart)
  const assessmentFrequencyData = useMemo(() => {
    if (filteredRecords.length === 0) return [];

    const frequencyMap: Record<string, { date: string; observation: number; conversation: number; both: number; total: number }> = {};

    filteredRecords.forEach((r) => {
      const d = new Date(r.date);
      const displayDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      if (!frequencyMap[displayDate]) {
        frequencyMap[displayDate] = {
          date: displayDate,
          observation: 0,
          conversation: 0,
          both: 0,
          total: 0,
        };
      }

      if (r.type === 'observation') frequencyMap[displayDate].observation += 1;
      else if (r.type === 'conversation') frequencyMap[displayDate].conversation += 1;
      else frequencyMap[displayDate].both += 1;

      frequencyMap[displayDate].total += 1;
    });

    return Object.values(frequencyMap);
  }, [filteredRecords]);

  // 3. Rubric Band Mastery Breakdown (for Recharts PieChart)
  const bandDistributionData = useMemo(() => {
    const counts: Record<string, number> = {
      Emerging: 0,
      Developing: 0,
      Proficient: 0,
      Extending: 0,
    };

    filteredRecords.forEach((r) => {
      const name = r.selectedBandName || '';
      if (name.toLowerCase().includes('emerging') || name.toLowerCase().includes('beginning') || name.toLowerCase().includes('not yet') || r.selectedScore === 1) {
        counts.Emerging += 1;
      } else if (name.toLowerCase().includes('developing') || name.toLowerCase().includes('approaching') || name.toLowerCase().includes('in progress') || r.selectedScore === 2) {
        counts.Developing += 1;
      } else if (name.toLowerCase().includes('proficient') || name.toLowerCase().includes('standard') || name.toLowerCase().includes('mastered') || r.selectedScore === 3) {
        counts.Proficient += 1;
      } else if (name.toLowerCase().includes('extending') || name.toLowerCase().includes('exceeding') || r.selectedScore >= 4) {
        counts.Extending += 1;
      } else {
        counts.Proficient += 1;
      }
    });

    return [
      { name: 'Emerging (1)', count: counts.Emerging, color: BAND_COLORS.Emerging },
      { name: 'Developing (2)', count: counts.Developing, color: BAND_COLORS.Developing },
      { name: 'Proficient (3)', count: counts.Proficient, color: BAND_COLORS.Proficient },
      { name: 'Extending (4)', count: counts.Extending, color: BAND_COLORS.Extending },
    ].filter((item) => item.count > 0);
  }, [filteredRecords]);

  // 4. Per-Student Assessment Coverage & Progress (Horizontal BarChart)
  const studentCoverageData = useMemo(() => {
    return students.map((s) => {
      const sRecords = records.filter((r) => r.studentId === s.id);
      const obsCount = sRecords.filter((r) => r.type === 'observation').length;
      const convCount = sRecords.filter((r) => r.type === 'conversation').length;
      const bothCount = sRecords.filter((r) => r.type === 'both').length;
      const avgScore = sRecords.length > 0 
        ? Number((sRecords.reduce((acc, r) => acc + (r.selectedScore || 0), 0) / sRecords.length).toFixed(1))
        : 0;

      return {
        name: s.name,
        studentId: s.id,
        observation: obsCount,
        conversation: convCount,
        both: bothCount,
        total: sRecords.length,
        avgScore: avgScore,
      };
    }).sort((a, b) => b.total - a.total);
  }, [students, records]);

  // Recent 4 records for quick review cards
  const recentRecords = useMemo(() => {
    return [...filteredRecords].reverse().slice(0, 4);
  }, [filteredRecords]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner & Control Filters */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <TrendingUp className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Assessment Analytics & Growth Dashboard
              </h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Visualizing longitudinal student performance trends, observation frequency, and conversation evidence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigateToAssess(selectedStudentId !== 'all' ? selectedStudentId : undefined)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all active:scale-95 min-h-[44px]"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>+ Quick Assess</span>
            </button>
            <button
              onClick={onNavigateToHistory}
              className="inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all min-h-[44px]"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>View Evidence Feed</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Student Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Student Filter
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all min-h-[42px]"
            >
              <option value="all">All Students (Class Cohort)</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({records.filter((r) => r.studentId === s.id).length} assessments)
                </option>
              ))}
            </select>
          </div>

          {/* Outcome / Rubric Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Outcome / Rubric Filter
            </label>
            <select
              value={selectedRubricId}
              onChange={(e) => setSelectedRubricId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all min-h-[42px]"
            >
              <option value="all">All Learning Outcomes</option>
              {rubrics.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.outcomeCode ? `[${r.outcomeCode}] ` : ''}{r.title}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Time Window
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTimeRange('all')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  timeRange === 'all'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('30d')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  timeRange === '30d'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 30d
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('14d')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  timeRange === '14d'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 14d
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Records */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Evidence Logged
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ClipboardCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.total}</span>
            <span className="text-xs text-slate-500">records</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>{stats.observationCount} obs • {stats.conversationCount} conv • {stats.bothCount} triangulated</span>
          </div>
        </div>

        {/* Average Proficiency */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cohort Avg Score
            </span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.avgScoreFormatted}</span>
            <span className="text-xs text-slate-500">/ 4.0 scale</span>
          </div>
          <div className="mt-2 text-xs font-medium text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {stats.avgScore >= 3.5 ? 'Extending Mastery' : stats.avgScore >= 2.5 ? 'Proficient Target' : stats.avgScore >= 1.5 ? 'Developing Level' : 'Emerging Foundation'}
            </span>
          </div>
        </div>

        {/* Student Coverage */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Student Coverage
            </span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.studentCoveragePct}%</span>
            <span className="text-xs text-slate-500">
              ({stats.activeStudentCount}/{students.length} students)
            </span>
          </div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-sky-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(stats.studentCoveragePct, 100)}%` }} 
            />
          </div>
        </div>

        {/* Triangulation Balance */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Conversational Evidence
            </span>
            <span className="p-2 rounded-xl bg-violet-50 text-violet-600">
              <MessageSquare className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {stats.total > 0 ? Math.round(((stats.conversationCount + stats.bothCount) / stats.total) * 100) : 0}%
            </span>
            <span className="text-xs text-slate-500">of total logs</span>
          </div>
          <div className="mt-2 text-xs text-violet-700 font-medium">
            Voice dialogue & 1-on-1 conferences
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CHART 1: Student Performance Trends Over Time */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Performance Trends Over Time
              </h3>
              <p className="text-xs text-slate-500">
                {selectedStudentId !== 'all' 
                  ? `Chronological score trajectory for ${students.find((s) => s.id === selectedStudentId)?.name || 'selected student'}`
                  : 'Average student rubric mastery score tracked across assessment dates'}
              </p>
            </div>
            <span className="hidden sm:inline-block px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700">
              Scale 1.0 (Emerging) – 4.0 (Extending)
            </span>
          </div>

          <div className="h-[280px] sm:h-[320px] w-full pt-2">
            {performanceTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={performanceTrendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    domain={[1, 4]} 
                    ticks={[1, 2, 3, 4]} 
                    tickFormatter={(val) => {
                      if (val === 1) return '1: Em';
                      if (val === 2) return '2: Dev';
                      if (val === 3) return '3: Pro';
                      if (val === 4) return '4: Ext';
                      return `${val}`;
                    }}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 max-w-xs border border-slate-700">
                            <div className="font-semibold text-indigo-300">{data.date}</div>
                            <div className="text-sm font-bold">
                              Average Score: {data.score} / 4.0
                            </div>
                            <div className="text-slate-400">
                              Assessments: {data.assessments}
                            </div>
                            {data.students && (
                              <div className="text-slate-300 text-[11px] truncate">
                                Students: {data.students}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#6366f1"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#scoreGradient)"
                    dot={{ fill: '#4f46e5', r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                    name="Score"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Clock className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No trend data available for current filters.</p>
              </div>
            )}
          </div>
        </div>

        {/* CHART 2: Frequency of Assessments Over Time */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Assessment Frequency Over Time
              </h3>
              <p className="text-xs text-slate-500">
                Number of evidence recordings per session, grouped by observation & conversation
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="flex items-center gap-1 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> Observation
              </span>
              <span className="flex items-center gap-1 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" /> Conversation
              </span>
              <span className="flex items-center gap-1 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Both
              </span>
            </div>
          </div>

          <div className="h-[280px] sm:h-[320px] w-full pt-2">
            {assessmentFrequencyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={assessmentFrequencyData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    allowDecimals={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 max-w-xs border border-slate-700">
                            <div className="font-semibold text-emerald-300">{data.date}</div>
                            <div className="text-sm font-bold">Total Logs: {data.total}</div>
                            <div className="text-sky-300">Observation: {data.observation}</div>
                            <div className="text-violet-300">Conversation: {data.conversation}</div>
                            <div className="text-emerald-300">Both (Triangulated): {data.both}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="observation" name="Observation" stackId="a" fill={EVIDENCE_COLORS.observation} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="conversation" name="Conversation" stackId="a" fill={EVIDENCE_COLORS.conversation} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="both" name="Both" stackId="a" fill={EVIDENCE_COLORS.both} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Clock className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No frequency data recorded yet.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Secondary Row: Distribution & Student Coverage Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* CHART 3: Mastery Band Distribution (Pie / Donut) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col">
          <div className="mb-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Rubric Band Mastery Distribution
            </h3>
            <p className="text-xs text-slate-500">
              Proportion of assessments across performance bands
            </p>
          </div>

          <div className="h-[230px] w-full flex items-center justify-center">
            {bandDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bandDistributionData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {bandDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const pct = stats.total > 0 ? Math.round((data.count / stats.total) * 100) : 0;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg text-xs space-y-0.5 border border-slate-700">
                            <div className="font-semibold text-slate-200">{data.name}</div>
                            <div className="text-sm font-bold text-emerald-400">{data.count} records ({pct}%)</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 text-sm">No data</div>
            )}
          </div>

          {/* Legend Chips */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            {bandDistributionData.map((item) => (
              <div key={item.name} className="flex items-center space-x-2 text-xs">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 truncate">{item.name}:</span>
                <span className="font-bold text-slate-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CHART 4: Student Evidence Balance (Horizontal Bar Chart) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Student Assessment Coverage & Equity
              </h3>
              <p className="text-xs text-slate-500">
                Total evidence logged per student to ensure balanced conference check-ins
              </p>
            </div>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Sorted by highest evidence count
            </span>
          </div>

          <div className="h-[230px] w-full pt-1">
            {studentCoverageData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={studentCoverageData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 25, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis 
                    type="number" 
                    allowDecimals={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fill: '#1e293b', fontSize: 12, fontWeight: 500 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                            <div className="font-bold text-indigo-300">{data.name}</div>
                            <div className="text-sm font-semibold">Total Records: {data.total}</div>
                            <div className="text-slate-300">Avg Score: {data.avgScore} / 4.0</div>
                            <div className="text-sky-300">Observation: {data.observation}</div>
                            <div className="text-violet-300">Conversation: {data.conversation}</div>
                            <div className="text-emerald-300">Both: {data.both}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="observation" stackId="s" fill={EVIDENCE_COLORS.observation} name="Observation" />
                  <Bar dataKey="conversation" stackId="s" fill={EVIDENCE_COLORS.conversation} name="Conversation" />
                  <Bar dataKey="both" stackId="s" fill={EVIDENCE_COLORS.both} name="Both" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No student data available
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span>Tip: Tap any student in the filter above to inspect individual longitudinal trends.</span>
            <button
              onClick={() => onNavigateToAssess()}
              className="text-indigo-600 font-semibold hover:text-indigo-700"
            >
              Start New Assessment →
            </button>
          </div>
        </div>

      </div>

      {/* Recent Evidence Highlights Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Latest Assessment Feed & Observations
            </h3>
            <p className="text-xs text-slate-500">
              Recent conversational and observational artifacts recorded in the classroom
            </p>
          </div>
          <button
            onClick={onNavigateToHistory}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <span>View All ({records.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentRecords.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentRecords.map((r) => (
              <div 
                key={r.id} 
                className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">{r.studentName}</span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">
                      {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    r.selectedScore >= 4 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    r.selectedScore >= 3 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    r.selectedScore >= 2 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {r.selectedBandName || `Score ${r.selectedScore}`}
                  </span>
                </div>

                <div className="text-xs font-medium text-slate-600 line-clamp-1">
                  {r.rubricTitle}
                </div>

                {r.conversationNotes && (
                  <div className="p-2 rounded-lg bg-white border border-slate-200/70 text-xs text-slate-700">
                    <span className="font-semibold text-violet-700">Conversation: </span>
                    <span className="italic">"{r.conversationNotes.slice(0, 130)}{r.conversationNotes.length > 130 ? '...' : ''}"</span>
                  </div>
                )}

                {r.observationNotes && !r.conversationNotes && (
                  <div className="p-2 rounded-lg bg-white border border-slate-200/70 text-xs text-slate-700">
                    <span className="font-semibold text-sky-700">Observation: </span>
                    <span>{r.observationNotes.slice(0, 130)}{r.observationNotes.length > 130 ? '...' : ''}</span>
                  </div>
                )}

                {r.aiAssessment?.studentFeedback && (
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate">Feedback: {r.aiAssessment.studentFeedback}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No recent records match your current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};
