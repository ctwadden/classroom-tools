import React, { useState } from 'react';
import { Student, AssessmentRecord } from '../types';
import { Users, Plus, Trash2, Edit3, Check, Search, ClipboardCheck, ArrowRight, UserPlus } from 'lucide-react';

interface StudentManagerProps {
  students: Student[];
  records: AssessmentRecord[];
  onSaveStudents: (students: Student[]) => void;
  onAssessStudent: (studentId: string) => void;
}

const AVATAR_COLORS = [
  'bg-emerald-500',
  'bg-indigo-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-blue-500',
];

export const StudentManager: React.FC<StudentManagerProps> = ({
  students,
  records,
  onSaveStudents,
  onAssessStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('Grade 6');
  const [notes, setNotes] = useState('');
  const [batchNames, setBatchNames] = useState('');

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingStudentId) {
      const updated = students.map((s) =>
        s.id === editingStudentId ? { ...s, name: name.trim(), grade, notes } : s
      );
      onSaveStudents(updated);
      setEditingStudentId(null);
    } else {
      const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const newStudent: Student = {
        id: `s-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        name: name.trim(),
        grade: grade.trim() || undefined,
        notes: notes.trim() || undefined,
        avatarColor: randomColor,
      };
      onSaveStudents([...students, newStudent]);
    }

    setName('');
    setNotes('');
    setIsAdding(false);
  };

  const handleBatchAdd = () => {
    const lines = batchNames
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const newStudents: Student[] = lines.map((studentName, i) => ({
      id: `s-${Date.now()}-${i}`,
      name: studentName,
      grade: grade || 'Grade 6',
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    }));

    onSaveStudents([...students, ...newStudents]);
    setBatchNames('');
    setIsBatchAdding(false);
  };

  const handleDelete = (id: string, studentName: string) => {
    if (confirm(`Remove ${studentName} from roster? Their existing historical records will remain safe.`)) {
      onSaveStudents(students.filter((s) => s.id !== id));
    }
  };

  const startEdit = (student: Student) => {
    setEditingStudentId(student.id);
    setName(student.name);
    setGrade(student.grade || 'Grade 6');
    setNotes(student.notes || '');
    setIsAdding(true);
    setIsBatchAdding(false);
  };

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.grade && s.grade.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Class Roster & Student Profiles</h2>
          <p className="text-xs text-slate-500">
            {students.length} students enrolled. Tap "Assess" on any student to begin an observation or conversation session.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setIsBatchAdding(!isBatchAdding);
              setIsAdding(false);
              setEditingStudentId(null);
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all"
          >
            + Batch Paste Roster
          </button>
          <button
            onClick={() => {
              setIsAdding(!isAdding);
              setIsBatchAdding(false);
              setEditingStudentId(null);
              setName('');
              setNotes('');
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-100 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Batch Add Area */}
      {isBatchAdding && (
        <div className="bg-white border border-indigo-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Batch Add Students (Paste One Name Per Line)</h3>
          <textarea
            rows={5}
            value={batchNames}
            onChange={(e) => setBatchNames(e.target.value)}
            placeholder={`Alex Johnson\nSamira Patel\nJordan Lee\nMarcus Bell`}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono"
          />
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={() => setIsBatchAdding(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleBatchAdd}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              Import Students
            </button>
          </div>
        </div>
      )}

      {/* Single Add / Edit Form */}
      {isAdding && (
        <form onSubmit={handleAddSingle} className="bg-white border border-indigo-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            {editingStudentId ? 'Edit Student Details' : 'Add New Student'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Student Full Name: *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jordan Miller"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Grade Level:</label>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="e.g. Grade 6 or Period 3"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Pedagogical / Accommodation Notes:</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Benefits from visual manipulatives, verbal conversation prompts, extra thinking time..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setEditingStudentId(null);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              {editingStudentId ? 'Save Changes' : 'Add to Roster'}
            </button>
          </div>
        </form>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search students by name or grade..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
        />
      </div>

      {/* Student Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map((student) => {
          const studentRecords = records.filter((r) => r.studentId === student.id);
          const lastRecord = studentRecords[studentRecords.length - 1];

          return (
            <div
              key={student.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-11 h-11 rounded-xl ${student.avatarColor || 'bg-indigo-500'} text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0`}
                    >
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {student.name}
                      </h4>
                      <p className="text-xs text-slate-500">{student.grade || 'Grade 6'}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => startEdit(student)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                      title="Edit Student"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(student.id, student.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      title="Delete Student"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {student.notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg mt-3 border border-slate-100 italic">
                    "{student.notes}"
                  </p>
                )}

                {/* Evidence Metrics */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Evidence Logs: <strong className="text-slate-800">{studentRecords.length}</strong>
                  </span>
                  {lastRecord ? (
                    <span className="text-emerald-700 font-medium">
                      Latest: {lastRecord.selectedBandName}
                    </span>
                  ) : (
                    <span className="text-slate-400">Not yet assessed</span>
                  )}
                </div>
              </div>

              {/* Assess Now Button */}
              <button
                onClick={() => onAssessStudent(student.id)}
                className="mt-4 w-full inline-flex items-center justify-center space-x-1.5 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Assess This Student</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
