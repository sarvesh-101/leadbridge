"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Loader2, CheckCircle2, ExternalLink,
  RefreshCw, AlertTriangle, FileSpreadsheet, KeyRound, Save,
} from "lucide-react";

export default function SheetsSyncPage() {
  const [integrationId, setIntegrationId] = useState("");
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Service-account credentials
  const [clientEmail, setClientEmail] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync form
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    leadsSynced?: number;
    leadsUpdated?: number;
    errors?: string[];
  } | null>(null);

  // Load an existing Google Sheets integration so the broker never has to
  // hunt for an Integration ID manually.
  useEffect(() => {
    api
      .get<{ items: { id: string; provider: string; name: string }[] }>("/integrations")
      .then((res) => {
        const existing = res.items.find((i) => i.provider === "google");
        if (existing) {
          setIntegrationId(existing.id);
          setCredentialsSaved(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  }, []);

  async function handleSaveCredentials() {
    if (!clientEmail.trim()) return toast.error("Service account email is required");
    if (!privateKey.trim()) return toast.error("Private key is required");

    setSaving(true);
    try {
      const settings: Record<string, string> = {
        clientEmail: clientEmail.trim(),
        privateKey: privateKey.trim(),
      };
      if (spreadsheetId.trim()) settings.spreadsheetId = spreadsheetId.trim();

      if (integrationId) {
        await api.patch(`/integrations/${integrationId}`, { settings });
        toast.success("Credentials updated!");
      } else {
        const res = await api.post<{ id: string }>("/integrations", {
          provider: "google",
          settings,
        });
        setIntegrationId(res.id);
        toast.success("Google Sheets connected!");
      }
      setCredentialsSaved(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    if (!sheetUrl.trim()) return toast.error("Google Sheet URL is required");
    if (!integrationId.trim()) return toast.error("Save your service-account credentials first");

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
      if (res.errors && res.errors.length > 0) {
        toast.error(`Sync finished with errors — see details below`);
      } else {
        toast.success(`Sync complete! ${res.leadsSynced} leads synced`);
      }
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
        <p className="text-[#9FB0A6] mt-1">Bidirectional sync between Converza and Google Sheets</p>
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
              Keep your Google Sheets up to date with your lead data from Converza.
              New leads will be added to your sheet, and updates (like booking status) will be synced back.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {[
            "Leads are synced from Converza to your Google Sheet",
            "Status updates are pushed back to Converza from the sheet",
            "Works best with the Converza Google Sheets template",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[#9FB0A6]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399] mt-0.5 shrink-0" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1 — Service-account credentials */}
      <div className="p-6 rounded-xl app-card">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8C468]/15 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-[#E8C468]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F0F7F3]">1 · Google service-account credentials</h3>
              <p className="text-xs text-[#9FB0A6] mt-1">
                Create a service account in Google Cloud, then paste its email and private key here.
              </p>
            </div>
          </div>
          {credentialsSaved && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/25 text-[10px] font-medium text-green-400 shrink-0">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </span>
          )}
        </div>

        {loadingExisting ? (
          <div className="h-24 rounded-xl app-card animate-pulse" />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#9FB0A6] mb-1.5 block">Service account email *</label>
              <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                placeholder="sheets-sync@your-project.iam.gserviceaccount.com"
                className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/60"
              />
            </div>
            <div>
              <label className="text-xs text-[#9FB0A6] mb-1.5 block">Private key (PEM — from the service account JSON) *</label>
              <textarea value={privateKey} onChange={(e) => setPrivateKey(e.target.value)}
                rows={4} placeholder="-----BEGIN PRIVATE KEY-----\n..."
                className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/60 font-mono resize-y"
              />
            </div>
            <div>
              <label className="text-xs text-[#9FB0A6] mb-1.5 block">
                Spreadsheet ID <span className="text-[#6B7C73]">(optional — auto-detected from the sheet URL)</span>
              </label>
              <input value={spreadsheetId} onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/60"
              />
            </div>

            <button onClick={handleSaveCredentials} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4" /> {credentialsSaved ? "Update credentials" : "Save & Connect"}</>
              )}
            </button>

            <p className="text-[11px] text-[#6B7C73]">
              How to create one: <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-[#6FE3B0] hover:underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-3 h-3" /></a>
              {" "}→ Credentials → Create credentials → Service account → create a key (JSON) → paste the <code className="text-[#6FE3B0]">client_email</code> and <code className="text-[#6FE3B0]">private_key</code> above. Then share your sheet with the service account email (Editor).
            </p>
          </div>
        )}
      </div>

      {/* Step 2 — Sync form */}
      <div className="p-6 rounded-xl app-card">
        <h3 className="text-sm font-semibold text-[#F0F7F3] mb-4">2 · Run a sync</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#9FB0A6] mb-1.5 block">
              Google Sheet URL *
            </label>
            <input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/60"
            />
          </div>

          <button onClick={handleSync} disabled={syncing || !sheetUrl.trim() || !credentialsSaved}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
              credentialsSaved
                ? "bg-[#34D399] text-white hover:bg-[#065F46] disabled:opacity-50"
                : "bg-[#101713] text-[#6B7C73] cursor-not-allowed"
            )}
          >
            {syncing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Syncing...</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Start Sync</>
            )}
          </button>
          {!credentialsSaved && !loadingExisting && (
            <p className="text-[11px] text-[#E8C468] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Save your service-account credentials above to enable syncing.
            </p>
          )}
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
          <li>Create a Google Cloud project and enable the <a href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-[#6FE3B0] hover:underline">Google Sheets API</a></li>
          <li>Create a <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-[#6FE3B0] hover:underline">service account</a> and download its JSON key file</li>
          <li>Paste the service account email + private key in section 1 above</li>
          <li>Create or open a Google Sheet (use the Converza template for best results)</li>
          <li>Share the sheet with the service account email (Editor)</li>
          <li>Paste the sheet URL above and click &ldquo;Start Sync&rdquo;</li>
        </ol>
      </div>
    </div>
  );
}