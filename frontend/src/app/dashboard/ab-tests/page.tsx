"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, FlaskConical, BarChart3, Target, Play, Pause, CheckCircle2,
  X, Loader2, Trophy, AlertTriangle,
} from "lucide-react";

const GOAL_METRICS = [
  { value: "conversion_rate", label: "Conversion Rate" },
  { value: "call_answer_rate", label: "Call Answer Rate" },
  { value: "booking_rate", label: "Booking Rate" },
  { value: "response_rate", label: "Response Rate" },
];

export default function ABTestsPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<any>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCampaignId, setNewCampaignId] = useState("");
  const [newGoalMetric, setNewGoalMetric] = useState("conversion_rate");
  const [newMinSample, setNewMinSample] = useState(50);
  const [variants, setVariants] = useState([{ name: "Control", config: "{}", trafficPercent: 50 }]);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get("/ab-tests");
      setTests(res.tests || []);
    } catch (err: any) {
      toast.error("Failed to load A/B tests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function viewResults(testId: string) {
    setActionLoading(`view-${testId}`);
    try {
      const res = await api.get(`/ab-tests/${testId}`);
      setSelectedTest(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load results");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return toast.error("Test name is required");
    const totalTraffic = variants.reduce((s, v) => s + v.trafficPercent, 0);
    if (Math.round(totalTraffic) !== 100) return toast.error("Traffic percentages must sum to 100");

    setActionLoading("create");
    try {
      await api.post("/ab-tests", {
        name: newName,
        description: newDescription || undefined,
        campaignId: newCampaignId || "default",
        goalMetric: newGoalMetric,
        minSampleSize: newMinSample,
        variants: variants.map((v) => ({
          name: v.name,
          config: JSON.parse(v.config || "{}"),
          trafficPercent: v.trafficPercent,
        })),
      });
      toast.success("A/B test created!");
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setVariants([{ name: "Control", config: "{}", trafficPercent: 50 }]);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create test");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdateStatus(testId: string, status: string) {
    setActionLoading(`status-${testId}`);
    try {
      await api.patch(`/ab-tests/${testId}/status`, { status });
      toast.success(`Test ${status.toLowerCase()}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setActionLoading(null);
    }
  }

  const addVariant = () => setVariants([...variants, { name: "", config: "{}", trafficPercent: 0 }]);
  const updateVariant = (i: number, updates: Partial<(typeof variants)[0]>) => {
    setVariants(variants.map((v, idx) => idx === i ? { ...v, ...updates } : v));
  };
  const removeVariant = (i: number) => {
    if (variants.length <= 2) return toast.error("Need at least 2 variants");
    setVariants(variants.filter((_, idx) => idx !== i));
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "RUNNING": return "bg-green-500/10 text-green-400";
      case "PAUSED": return "bg-yellow-500/10 text-yellow-400";
      case "COMPLETED": return "bg-blue-500/10 text-blue-400";
      default: return "bg-gray-500/10 text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">A/B Testing</h1>
          <p className="text-gray-400 mt-1">Test campaign variants and measure what works</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> New Test
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: FlaskConical, label: "Total Tests", value: loading ? "—" : tests.length, color: "text-blue-400" },
          { icon: Play, label: "Running", value: loading ? "—" : tests.filter((t:any) => t.status === "RUNNING").length, color: "text-green-400" },
          { icon: Trophy, label: "Completed", value: loading ? "—" : tests.filter((t:any) => t.status === "COMPLETED").length, color: "text-emerald-400" },
          { icon: BarChart3, label: "Total Results", value: loading ? "—" : tests.reduce((s:number, t:any) => s + t.totalResults, 0), color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
            {loading ? (
              <div className="animate-pulse"><div className="h-7 w-12 bg-white/10 rounded" /></div>
            ) : (
              <>
                <s.icon className={cn("w-5 h-5 mb-2", s.color)} />
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Test List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 border border-white/10 animate-pulse" />)}</div>
      ) : tests.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <FlaskConical className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No A/B tests yet</h3>
          <p className="text-sm text-gray-500">Create your first test to start optimizing campaigns</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((test: any, i: number) => (
            <motion.div key={test.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
              onClick={() => viewResults(test.id)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5 text-purple-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{test.name}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", statusColor(test.status))}>{test.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {test.totalResults} results · {GOAL_METRICS.find(g => g.value === test.goalMetric)?.label || test.goalMetric}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                {test.status === "RUNNING" ? (
                  <button onClick={() => handleUpdateStatus(test.id, "PAUSED")} disabled={actionLoading === `status-${test.id}`}
                    className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50"
                  >
                    {actionLoading === `status-${test.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                  </button>
                ) : test.status !== "COMPLETED" ? (
                  <button onClick={() => handleUpdateStatus(test.id, "RUNNING")} disabled={actionLoading === `status-${test.id}`}
                    className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                  >
                    {actionLoading === `status-${test.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </button>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Results Modal */}
      <AnimatePresence>
        {selectedTest && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedTest(null)}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedTest.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{GOAL_METRICS.find(g => g.value === selectedTest.goalMetric)?.label}</p>
                </div>
                <button onClick={() => setSelectedTest(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Winner Banner */}
              {selectedTest.winner && selectedTest.isSignificant && (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 mb-6">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                  <div>
                    <p className="text-sm font-medium text-white">Winner: {selectedTest.winner}</p>
                    <p className="text-xs text-green-400">Statistically significant result</p>
                  </div>
                </div>
              )}

              {!selectedTest.isSignificant && (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3 mb-6">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <div>
                    <p className="text-xs text-gray-300">Not enough data yet — need at least {selectedTest.minSampleSize || 50} conversions</p>
                    <p className="text-xs text-gray-500">{selectedTest.totalResults} results collected</p>
                  </div>
                </div>
              )}

              {/* Variants Comparison */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white">Variants</h3>
                {selectedTest.variants?.map((v: any) => {
                  const maxRate = Math.max(...(selectedTest.variants?.map((x: any) => x.conversionRate) || [1]), 1);
                  return (
                    <div key={v.variantName} className={cn(
                      "p-4 rounded-xl border",
                      v.variantName === selectedTest.winner
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-white/5 border-white/10"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white flex items-center gap-2">
                          {v.variantName}
                          {v.variantName === selectedTest.winner && <Trophy className="w-4 h-4 text-yellow-400" />}
                        </span>
                        <span className="text-xs text-gray-500">{v.trafficPercent}% traffic</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Conversion: </span>
                          <span className="text-white font-medium">{v.conversionRate}%</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Exposed: </span>
                          <span className="text-white">{v.totalExposed}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Converted: </span>
                          <span className="text-white">{v.conversions}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 mt-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                          style={{ width: `${(v.conversionRate / maxRate) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Create A/B Test</h2>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Test name (e.g., Call Script A vs B)"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                />
                <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                />
                <div className="grid grid-cols-2 gap-4">
                  <select value={newGoalMetric} onChange={(e) => setNewGoalMetric(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                  >
                    {GOAL_METRICS.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Min Sample Size</label>
                    <input type="number" min={10} value={newMinSample} onChange={(e) => setNewMinSample(parseInt(e.target.value) || 50)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                    />
                  </div>
                </div>

                {/* Variants */}
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">Variants</h3>
                    <button onClick={addVariant}
                      className="px-3 py-1.5 rounded-lg bg-leadflow-500/10 border border-leadflow-500/30 text-leadflow-accent text-xs font-medium"
                    >
                      <Plus className="w-3 h-3 inline-block mr-1" /> Add Variant
                    </button>
                  </div>
                  {variants.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 mb-2">
                      <input value={v.name} onChange={(e) => updateVariant(i, { name: e.target.value })}
                        placeholder={`Variant ${i + 1}`}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500"
                      />
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span>Traffic:</span>
                        <input type="number" min={0} max={100} value={v.trafficPercent}
                          onChange={(e) => updateVariant(i, { trafficPercent: parseInt(e.target.value) || 0 })}
                          className="w-14 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white text-center"
                        />
                        <span>%</span>
                      </div>
                      {variants.length > 2 && (
                        <button onClick={() => removeVariant(i)} className="p-1 rounded hover:bg-red-500/10 text-red-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-gray-600 mt-1">Total: {variants.reduce((s, v) => s + v.trafficPercent, 0)}% (must be 100%)</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
                >Cancel</button>
                <button onClick={handleCreate} disabled={!newName.trim() || actionLoading === "create"}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading === "create" ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Test"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
