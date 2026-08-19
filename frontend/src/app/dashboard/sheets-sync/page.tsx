"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Sheet, Loader2, CheckCircle2, ExternalLink, Link as LinkIcon,
  RefreshCw, AlertTriangle, FileSpreadsheet,
} from "lucide-react";

export default function SheetsSyncPage() {
  const [integrationId, setIntegrationId] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    leadsSynced?: number;
    leadsUpdated?: number;
    errors?: string[];
  } | null>(null);

  async function handleSync() {
    if (!sheetUrl.trim()) return toast.error("Google Sheet URL is required");
    if (!integrationId.trim()) return toast.error("Integration ID is required");

    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post<{
        leadsSynced: number;
        leadsUpdated: number;
        errors?: string[];
      }>("/integrations/sheets/sync", {
        integrationId: integrationId.trim(),
        sheetUrl: sheetUrl.trim(),
      });
      setSyncResult(res);
      toast.success(`Sync complete! ${res.leadsSynced} leads synced`);
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F0F7F3]">Google Sheets Sync</h1>
        <p className="text-[#9FB0A6] mt-1">Bidirectional sync between LeadBridge and Google Sheets</p>
      </div>

      {/* Instructions */}
      <div className="p-6 rounded-xl app-card">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#34D399]/15 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-[#34D399]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F0F7F3]">Sync your lead data with Google Sheets</h3>
            <p className="text-xs text-[#9FB0A6] mt-1">
              Keep your Google Sheets up to date with your lead data from LeadBridge.
              New leads will be added to your sheet, and updates (like booking status) will be synced back.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {[
            "Leads are synced from LeadBridge to your Google Sheet",
            "Status updates are pushed back to LeadBridge from the sheet",
            "Works best with the LeadBridge Google Sheets template",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[#9FB0A6]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399] mt-0.5 shrink-0" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sync Form */}
      <div className="p-6 rounded-xl app-card">
        <h3 className="text-sm font-semibold text-[#F0F7F3] mb-4">Configure Sync</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#9FB0A6] mb-1.5 block">Integration ID</label>
            <input value={integrationId} onChange={(e) => setIntegrationId(e.target.value)}
              placeholder="Enter your integration ID from Integrations page"
              className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/50/50"
            />
          </div>
          <div>
            <label className="text-xs text-[#9FB0A6] mb-1.5 block">Google Sheet URL *</label>
            <input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/50/50"
            />
          </div>

          <button onClick={handleSync} disabled={syncing || !sheetUrl.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#34D399] text-white text-sm font-medium hover:bg-[#065F46] disabled:opacity-50 transition-all"
          >
            {syncing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Syncing...</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Start Sync</>
            )}
          </button>
        </div>
      </div>

      {/* Result */}
      {syncResult && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl app-card"
        >
          <h3 className="text-sm font-semibold text-[#F0F7F3] mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
            Sync Results
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-[#34D399]/10">
              <div className="text-2xl font-bold text-[#34D399]">{syncResult.leadsSynced || 0}</div>
              <div className="text-xs text-[#9FB0A6]">Leads Synced</div>
            </div>
            <div className="p-3 rounded-lg bg-[#34D399]/10">
              <div className="text-2xl font-bold text-[#6FE3B0]">{syncResult.leadsUpdated || 0}</div>
              <div className="text-xs text-[#9FB0A6]">Leads Updated</div>
            </div>
          </div>
          {syncResult.errors && syncResult.errors.length > 0 && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <p className="text-xs font-medium text-red-400 mb-1">Errors</p>
              {syncResult.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-300/70">{err}</p>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Setup Guide */}
      <div className="p-6 rounded-xl app-card">
        <h3 className="text-sm font-semibold text-[#F0F7F3] mb-3">Setup Guide</h3>
        <ol className="space-y-2 text-xs text-[#9FB0A6] list-decimal list-inside">
          <li>Go to the <a href="/dashboard/integrations" className="text-[#6FE3B0] hover:underline">Integrations</a> page and configure Google Sheets</li>
          <li>Copy your Integration ID from the integrations list</li>
          <li>Create or open a Google Sheet (use the LeadBridge template for best results)</li>
          <li>Share the sheet with the service account email from integrations</li>
          <li>Paste the sheet URL and Integration ID above</li>
          <li>Click &ldquo;Start Sync&rdquo; to sync your data</li>
        </ol>
      </div>
    </div>
  );
}
