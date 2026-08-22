"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Upload, FileText, CheckCircle2, XCircle, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { customerApi } from "@/lib/customer-api";

const DOC_TYPES = [
  { value: "aadhar", label: "Aadhaar Card" },
  { value: "pan", label: "PAN Card" },
  { value: "passport", label: "Passport" },
  { value: "voter_id", label: "Voter ID" },
  { value: "driving_license", label: "Driving License" },
  { value: "income_proof", label: "Income Proof" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "property_document", label: "Property Document" },
  { value: "other", label: "Other" },
];

interface UploadedDoc {
  id: string;
  type: string;
  fileName: string;
  fileSize: number;
  status: string;
  uploadedAt: string;
  verifiedAt?: string;
}

export default function CustomerDocumentsPage() {
  const router = useRouter();
  const [docType, setDocType] = useState("aadhar");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = sessionStorage.getItem("customer_token");
    if (!t) {
      router.push("/customer/login");
      return;
    }
    setToken(t);
    loadDocuments(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDocuments(t: string) {
    setLoading(true);
    try {
      const data = await customerApi.get("/customer/profile");
      setDocuments(data.documents || []);
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!file || !token) return toast.error("Select a file first");
    if (file.size > 10 * 1024 * 1024) return toast.error("File too large. Maximum 10MB.");

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", docType);

      const data = await customerApi.post("/customer/documents/upload", formData);
      setDocuments((prev) => [data.document, ...prev]);
      toast.success("Document uploaded successfully!");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="min-h-screen bg-[#0A0F0C] aurora-backdrop">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0A0F0C]/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.push("/customer/dashboard")} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-[#F0F7F3]">Upload Documents</h1>
            <p className="text-[10px] text-[#9FB0A6]">Share KYC documents with your broker</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Upload Form */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl app-card"
        >
          <h2 className="text-sm font-semibold text-[#F0F7F3] mb-4">Upload a Document</h2>

          {/* Doc Type */}
          <div className="mb-4">
            <label className="text-xs text-[#9FB0A6] mb-1.5 block">Document Type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl app-card text-[#F0F7F3] text-xs focus:outline-none focus:border-[#34D399]/50/50"
            >
              {DOC_TYPES.map((dt) => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>

          {/* File Picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative p-6 rounded-xl border-2 border-dashed border-white/10 text-center cursor-pointer hover:border-[#34D399]/40 hover:bg-white/[0.06] transition-all mb-4"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <FileText className="w-6 h-6 text-[#6FE3B0]" />
                <div className="text-left">
                  <p className="text-sm text-[#F0F7F3]">{file.name}</p>
                  <p className="text-[11px] text-[#9FB0A6]">{formatSize(file.size)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="p-1 rounded hover:bg-white/[0.06]"
                >
                  <XCircle className="w-4 h-4 text-[#9FB0A6]" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-[#9FB0A6]">Tap to select a file</p>
                <p className="text-[11px] text-gray-600 mt-1">PDF, JPG, PNG up to 10MB</p>
              </>
            )}
          </div>

          <button onClick={handleUpload} disabled={!file || uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-xs font-medium hover:opacity-90 transition-all disabled:opacity-40"
          >
            {uploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="w-3.5 h-3.5" /> Upload Document</>
            )}
          </button>
        </motion.div>

        {/* Uploaded Documents */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="p-5 rounded-2xl app-card"
        >
          <h2 className="text-sm font-semibold text-[#F0F7F3] mb-4">Uploaded Documents</h2>

          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl app-card">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    doc.status === "VERIFIED" ? "bg-green-500/10" : "bg-amber-500/10"
                  )}>
                    {doc.status === "VERIFIED" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#F0F7F3] truncate">{doc.fileName}</p>
                    <p className="text-[11px] text-[#9FB0A6]">
                      {DOC_TYPES.find(dt => dt.value === doc.type)?.label || doc.type}
                      {" · "}{formatSize(doc.fileSize)}
                    </p>
                  </div>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full",
                    doc.status === "VERIFIED" ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"
                  )}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-[#9FB0A6]">No documents uploaded yet</p>
              <p className="text-[11px] text-gray-600 mt-1">Upload documents above for your broker to review</p>
            </div>
          )}
        </motion.div>

        {/* Info */}
        <div className="p-4 rounded-xl bg-[#34D399]/10 border border-[#34D399]/50/10">
          <p className="text-xs text-[#9FB0A6]">
            <strong className="text-[#9FB0A6]">Note:</strong> Your documents are securely stored and only
            visible to you and your broker. Uploaded documents help speed up the booking process.
          </p>
        </div>
      </main>
    </div>
  );
}
