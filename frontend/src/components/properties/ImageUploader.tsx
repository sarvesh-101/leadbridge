"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Upload,
  X,
  ImageIcon,
  Loader2,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function ImageUploader({
  images,
  onChange,
  maxImages = 10,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = maxImages - images.length;

  const handleFile = useCallback(async (file: File) => {
    if (images.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    // Validate type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPEG, PNG, WebP, GIF, and AVIF images are supported");
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    setUploadProgress(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // api.post handles FormData correctly (no JSON.stringify, no Content-Type)
      const data = await api.post<{ url: string; filename: string }>("/properties/upload", formData);

      onChange([...images, data.url]);
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [images, onChange, maxImages]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((f) => f.type.startsWith("image/"));
    if (imageFile) handleFile(imageFile);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  return (
    <div className="space-y-3">
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500 flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3" />
          Property Images ({images.length}/{maxImages})
        </label>
        {images.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Drop zone */}
      {remaining > 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
            isDragging
              ? "border-leadflow-500 bg-leadflow-500/10 scale-[1.02]"
              : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5",
            uploading && "pointer-events-none opacity-60"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-leadflow-accent animate-spin" />
              <div className="text-center">
                <p className="text-sm text-gray-400">Uploading...</p>
                <p className="text-xs text-gray-600 mt-0.5">{uploadProgress}</p>
              </div>
              {/* Progress bar */}
              <div className="w-full max-w-[200px] h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-leadflow-accent rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-leadflow-500/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-leadflow-accent" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-300 font-medium">
                  Drop images here or click to browse
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  JPEG, PNG, WebP, GIF, AVIF — max 5MB each
                </p>
              </div>
              <span className="text-[11px] text-gray-600 mt-1">
                {remaining} slot{remaining !== 1 ? "s" : ""} remaining
              </span>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          <AnimatePresence>
            {images.map((url, index) => (
              <motion.div
                key={url}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5"
              >
                {/* Image */}
                <img
                  src={`${API_BASE}${url}`}
                  alt={`Property image ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                    (e.target as HTMLImageElement).classList.add("hidden");
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      parent.classList.add("flex", "items-center", "justify-center");
                      const fallback = document.createElement("div");
                      fallback.className = "text-center";
                      fallback.innerHTML = `<svg class="w-6 h-6 text-gray-600 mx-auto" ...></svg><p class="text-xs text-gray-600 mt-1">Failed to load</p>`;
                      parent.appendChild(fallback);
                    }
                  }}
                />

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => removeImage(index)}
                    className="p-2 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Index badge */}
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-medium">
                  {index + 1}
                </div>

                {/* Status icons */}
                {url.startsWith("blob:") ? (
                  <div className="absolute bottom-1 right-1">
                    <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                  </div>
                ) : (
                  <div className="absolute bottom-1 right-1">
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && !uploading && (
        <div className="text-center py-4 text-gray-600">
          <p className="text-xs">No images yet. Photos help leads visualize the property.</p>
        </div>
      )}
    </div>
  );
}
