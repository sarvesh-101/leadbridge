"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, FileText, Loader2, X, Eye, Copy, Trash2, Pencil, Save, MessageSquare, Mail } from "lucide-react";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "email" | "sms">("all");

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    try {
      const res = await api.get("/templates");
      setTemplates(res.templates || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function openCreate() {
    setEditingId(null); setName(""); setSubject(""); setBody(""); setPreviewHtml(""); setShowCreate(true);
  }

  function openEdit(t: any) {
    setEditingId(t.id); setName(t.name); setSubject(t.subject || ""); setBody(t.body); setPreviewHtml(t.body.replace(/{{leadName}}/g, "[Lead]").replace(/{{location}}/g, "[Location]").replace(/{{businessName}}/g, "[Business]").replace(/{{dashboardUrl}}/g, "#")); setShowCreate(true);
  }

  async function handleSave() {
    if (!name.trim() || !body.trim()) return toast.error("Name and body required");
    setActionLoading("save");
    try {
      if (editingId) {
        await api.patch(`/templates/${editingId}`, { name, subject, body });
        toast.success("Template updated");
      } else {
        const isEmail = body.includes("<") && body.includes(">");
        await api.post("/templates", { name, subject: subject || "No subject", body, type: isEmail ? "email" : "sms" });
        toast.success("Template saved");
      }
      setShowCreate(false); setName(""); setSubject(""); setBody(""); setPreviewHtml("");
      await loadTemplates();
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    try { await api.delete(`/templates/${id}`); toast.success("Deleted"); await loadTemplates(); }
    catch (err: any) { toast.error(err.message); }
  }

  function applyPreview(html: string) {
    setPreviewHtml(html.replace(/{{leadName}}/g, "[Lead]").replace(/{{location}}/g, "[Location]").replace(/{{businessName}}/g, "[Business]").replace(/{{dashboardUrl}}/g, "#"));
  }

  const isEmail = body.includes("<") && body.includes(">");
  const filtered = templates.filter(t => filter === "all" || (filter === "email" && t.type === "EMAIL") || (filter === "sms" && t.type === "SMS"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Templates</h1><p className="text-gray-400 mt-1">Reusable email & SMS templates</p></div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90"><Plus className="w-4 h-4" /> New Template</button>
      </div>

      <div className="flex items-center gap-2">
        {["all", "email", "sms"].map(f => (
          <button key={f} onClick={() => setFilter(f as any)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all", filter === f ? "bg-leadflow-500 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10")}>{f === "all" ? "All" : f === "email" ? <><Mail className="w-3 h-3 inline mr-1" />Email</> : <><MessageSquare className="w-3 h-3 inline mr-1" />SMS</>}</button>
        ))}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-40 rounded-xl bg-white/5 border border-white/10 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No templates yet</h3>
          <p className="text-sm text-gray-500">Save your first template for reuse</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t: any) => {
            const isEmailTemplate = t.body.includes("<");
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isEmailTemplate ? <Mail className="w-4 h-4 text-leadflow-accent" /> : <MessageSquare className="w-4 h-4 text-green-400" />}
                    <h3 className="text-sm font-medium text-white truncate">{t.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(t)} className="p-1 rounded hover:bg-white/10 text-gray-400"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(t.id)} className="p-1 rounded hover:bg-red-500/10 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {t.subject && <p className="text-xs text-gray-500 mb-2 truncate">{t.subject}</p>}
                <p className="text-xs text-gray-600 line-clamp-3 font-mono">{t.body.substring(0, 150)}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <Eye className="w-3 h-3" />
                  {isEmailTemplate ? "Email template" : "SMS template"}
                  <span className="ml-auto">{(t.body.length > 100 ? `${Math.round(t.body.length / 100) * 100}+` : t.body.length) + " chars"}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 0.95 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-xl mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">{editingId ? "Edit Template" : "New Template"}</h2>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Template name" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500" />
                <input value={subject} onChange={e => { setSubject(e.target.value); if (body) applyPreview(body); }} placeholder="Subject line (for email templates)" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500" />
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{isEmail ? "HTML Body" : "SMS Text"}</label>
                  <textarea value={body} onChange={e => { setBody(e.target.value); applyPreview(e.target.value); }} placeholder={isEmail ? "<h1>Your HTML here</h1>" : "Your SMS text here"} rows={8} className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 font-mono" />
                </div>
                {previewHtml && isEmail && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-500 mb-1">Preview</p>
                    <div className="bg-white rounded-lg p-3 max-h-32 overflow-y-auto text-xs" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                )}
                {previewHtml && !isEmail && (
                  <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                    <p className="text-xs text-gray-500 mb-1">Preview ({body.length}/765 chars)</p>
                    <p className="text-xs text-gray-300">{previewHtml.replace(/<[^>]*>/g, "")}</p>
                  </div>
                )}
                <p className="text-xs text-gray-500">Variables: <code className="text-leadflow-accent bg-leadflow-500/10 px-1 rounded">{`{{leadName}}`}</code> <code className="text-leadflow-accent bg-leadflow-500/10 px-1 rounded">{`{{location}}`}</code> <code className="text-leadflow-accent bg-leadflow-500/10 px-1 rounded">{`{{businessName}}`}</code> <code className="text-leadflow-accent bg-leadflow-500/10 px-1 rounded">{`{{dashboardUrl}}`}</code></p>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5">Cancel</button>
                <button onClick={handleSave} disabled={!name.trim() || !body.trim() || actionLoading === "save"} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium disabled:opacity-50">
                  {actionLoading === "save" ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> {editingId ? "Update" : "Save"} Template</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
