import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Play,
  XCircle,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Tag,
  DollarSign,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function ScheduledTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [taskName, setTaskName] = useState('');
  const [itemKeywords, setItemKeywords] = useState('');
  const [category, setCategory] = useState('Footwear');
  const [budgetCap, setBudgetCap] = useState('2000');
  const [scheduleTime, setScheduleTime] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.get('/scheduled-tasks', { params: { userId } });
      if (res.data?.success) {
        setTasks(res.data.tasks || []);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to load scheduled tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage('');
    setError('');

    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.post('/scheduled-tasks', {
        userId,
        taskName: taskName || `Buy ${itemKeywords}`,
        itemKeywords,
        category,
        budgetCap: Number(budgetCap),
        scheduleTime: new Date(scheduleTime).toISOString(),
      });

      if (res.data?.success) {
        setMessage(`Task "${res.data.task.taskName}" scheduled successfully!`);
        setShowCreateModal(false);
        setTaskName('');
        setItemKeywords('');
        fetchTasks();
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to create task');
    } finally {
      setFormLoading(false);
    }
  };

  const handleExecuteNow = async (taskId, name) => {
    setMessage(`Executing task "${name}" immediately...`);
    try {
      const res = await apiClient.post(`/scheduled-tasks/${taskId}/execute-now`);
      if (res.data?.success) {
        setMessage(`Task "${name}" executed successfully! Order ID: ${res.data.order?.orderId}`);
        fetchTasks();
      }
    } catch (err) {
      setError(err.error || err.message || 'Immediate execution failed');
    }
  };

  const handleCancelTask = async (taskId, name) => {
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.delete(`/scheduled-tasks/${taskId}`, {
        data: { userId },
      });

      if (res.data?.success) {
        setMessage(`Cancelled task "${name}".`);
        fetchTasks();
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to cancel task');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-600/10 border border-amber-500/30 text-amber-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Scheduled Tasks Engine
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-400">
                Automated future orders ("Buy at 6 PM") with fresh price & stock re-verification
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-600/20 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule New Task</span>
          </button>
        </div>

        {/* Notifications */}
        {message && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Create Task Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-base">Schedule Automated Task</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    placeholder="e.g. Buy running shoes under 2000"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Item Keywords</label>
                  <input
                    type="text"
                    required
                    value={itemKeywords}
                    onChange={(e) => setItemKeywords(e.target.value)}
                    placeholder="e.g. running shoes"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                    >
                      <option value="Footwear">Footwear</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Fashion">Fashion</option>
                      <option value="Home">Home</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Budget Cap (₹)</label>
                    <input
                      type="number"
                      required
                      min="100"
                      value={budgetCap}
                      onChange={(e) => setBudgetCap(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Schedule Execution Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold transition shadow-md shadow-amber-600/20 disabled:opacity-50"
                  >
                    {formLoading ? 'Scheduling...' : 'Save Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tasks List */}
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            Loading scheduled tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
            No active or historical scheduled tasks found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((t) => {
              const status = t.status || 'scheduled';
              const isScheduled = status === 'scheduled';
              const isExecuted = status === 'executed';
              const isFailed = status === 'failed';

              return (
                <div
                  key={t._id}
                  className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          isExecuted
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : isFailed
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : isScheduled
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {status}
                      </span>
                      <span className="text-slate-500 text-xs flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {t.intent?.category || 'General'}
                      </span>
                    </div>

                    <h3 className="font-semibold text-white text-sm">{t.taskName}</h3>

                    <div className="space-y-1 text-xs text-slate-400">
                      <div><span className="text-slate-500">Keywords:</span> {t.intent?.itemKeywords}</div>
                      <div><span className="text-slate-500">Budget Cap:</span> ₹{t.intent?.budgetCap}</div>
                      <div className="flex items-center gap-1 text-amber-400 pt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Target: {new Date(t.scheduleTime).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Execution details log if executed/failed */}
                    {t.executionLog?.errorMessage && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{t.executionLog.errorMessage}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {isScheduled && (
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                      <button
                        onClick={() => handleExecuteNow(t._id, t.taskName)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl py-2 flex items-center justify-center gap-1 transition shadow-md shadow-emerald-600/20"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Run Now</span>
                      </button>

                      <button
                        onClick={() => handleCancelTask(t._id, t.taskName)}
                        className="p-2 rounded-xl bg-slate-955 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition"
                        title="Cancel Task"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
