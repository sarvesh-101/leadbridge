"use client";

interface PhoneDisplayProps {
  phone: string;
  masked?: boolean;
  clickable?: boolean;
}

export function PhoneDisplay({ phone, masked = false, clickable = false }: PhoneDisplayProps) {
  const displayPhone = masked
    ? `+91 ••••• ${phone.slice(-4)}`
    : phone;

  const content = (
    <span className="font-mono text-sm tracking-wide">
      {displayPhone}
    </span>
  );

  if (clickable) {
    return (
      <a
        href={`tel:${phone}`}
        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
      >
        {content}
      </a>
    );
  }

  return content;
}
