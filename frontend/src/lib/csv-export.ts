/**
 * CSV Export utility — generates and downloads CSV files from data arrays.
 */

export function exportToCSV(
  data: Record<string, any>[],
  filename: string,
  headers: Record<string, string>
) {
  if (!data.length) return;

  // Map data to rows using headers
  const headerKeys = Object.keys(headers);
  const headerLabels = Object.values(headers);

  const rows = data.map((item) =>
    headerKeys
      .map((key) => {
        const value = getNestedValue(item, key);
        // Format for CSV — escape quotes and wrap in quotes if contains comma
        const str = String(value ?? "");
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(",")
  );

  const csv = [headerLabels.join(","), ...rows].join("\n");

  // Download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => {
    if (current === null || current === undefined) return "";
    if (Array.isArray(current)) {
      // If the key is a number, treat as array index
      const num = parseInt(key);
      if (!isNaN(num)) return current[num];
      return current;
    }
    return current[key];
  }, obj);
}

// Pre-defined export configurations
export const EXPORT_HEADERS = {
  leads: {
    name: "Name",
    phone: "Phone",
    email: "Email",
    source: "Source",
    status: "Status",
    score: "Score",
    budget: "Budget",
    location: "Location",
    propertyType: "Property Type",
    bedrooms: "Bedrooms",
    timeline: "Timeline",
    sentiment: "Sentiment",
    receivedAt: "Received At",
    createdAt: "Created At",
  },
  calls: {
    "lead.name": "Lead Name",
    "lead.phone": "Lead Phone",
    type: "Type",
    direction: "Direction",
    status: "Status",
    duration: "Duration (s)",
    summary: "Summary",
    createdAt: "Created At",
  },
  bookings: {
    "lead.name": "Lead Name",
    "lead.phone": "Lead Phone",
    propertyAddress: "Property Address",
    propertyName: "Property Name",
    visitDate: "Visit Date",
    visitTime: "Visit Time",
    status: "Status",
    createdAt: "Created At",
  },
};
