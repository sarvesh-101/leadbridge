// Converza — Shared TypeScript Types

export type LeadStatus =
  | "PENDING" | "CALLING" | "CALL_FAILED" | "NO_ANSWER" | "FAQ_ONLY"
  | "BOOKED" | "REMINDED" | "VISITED" | "NO_SHOW"
  | "FOLLOWUP_D1" | "FOLLOWUP_D2" | "FOLLOWUP_D3"
  | "REBOOKED" | "COLD" | "CONVERTED";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  PENDING: "Waiting",
  CALLING: "Calling...",
  CALL_FAILED: "Call failed",
  NO_ANSWER: "No answer",
  FAQ_ONLY: "FAQ only",
  BOOKED: "Visit booked",
  REMINDED: "Reminded",
  VISITED: "Visited",
  NO_SHOW: "No show",
  FOLLOWUP_D1: "Follow-up D1",
  FOLLOWUP_D2: "Follow-up D2",
  FOLLOWUP_D3: "Follow-up D3",
  REBOOKED: "Rebooked",
  COLD: "Cold",
  CONVERTED: "Converted",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  PENDING: "bg-white/[0.06] text-ink-soft border border-line",
  CALLING: "bg-brand/15 text-brand border border-brand/30 animate-pulse",
  CALL_FAILED: "bg-danger/15 text-danger border border-danger/30",
  NO_ANSWER: "bg-warning/15 text-warning border border-warning/30",
  FAQ_ONLY: "bg-neutral-soft/15 text-neutral-soft border border-neutral-soft/30",
  BOOKED: "bg-brand/15 text-brand border border-brand/30",
  REMINDED: "bg-brand-soft/15 text-brand-soft border border-brand-soft/30",
  VISITED: "bg-success/15 text-success border border-success/30",
  NO_SHOW: "bg-danger/15 text-danger border border-danger/30",
  FOLLOWUP_D1: "bg-warning/15 text-warning border border-warning/30",
  FOLLOWUP_D2: "bg-warning/15 text-warning border border-warning/30",
  FOLLOWUP_D3: "bg-warning/15 text-warning border border-warning/30",
  REBOOKED: "bg-success/15 text-success border border-success/30",
  COLD: "bg-white/[0.06] text-ink-muted border border-line",
  CONVERTED: "bg-success/15 text-success border border-success/30",
};

/** Single-source semantic status tokens for dashboard badges and Kanban pills. 
 * Kept in the same file so every consumer uses the same muted greens/ambers/reds 
 * instead of re-deriving their own. 
 */
export const SEMANTIC_STATUS_CLASSES: Record<string, string> = {
  success: "bg-success/15 text-success border border-success/30",
  warning: "bg-warning/15 text-warning border border-warning/30",
  error: "bg-danger/15 text-danger border border-danger/30",
  neutral: "bg-white/[0.06] text-ink-soft border border-line",
};

export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type CampaignType = "FOLLOW_UP" | "RE_ENGAGEMENT" | "NO_SHOW_RECOVERY" | "WELCOME" | "PROMOTIONAL" | "CUSTOM";
export type TaskAction =
  | "CALL" | "WHATSAPP" | "SMS" | "EMAIL" | "DELAY" | "CONDITION"
  | "WEBHOOK" | "UPDATE_LEAD_STATUS" | "ASSIGN_LEAD" | "UPDATE_SCORE" | "TAG_LEAD" | "CUSTOM";

export interface CampaignTask {
  id: string;
  campaignId: string;
  name: string;
  action: TaskAction;
  order: number;
  config?: Record<string, unknown>;
  delayAfterPreviousHours?: number;
  delayAfterPreviousMinutes?: number;
  isCondition?: boolean;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  targetLeadSources?: string[];
  targetLeadStatuses?: string[];
  targetLocations?: string[];
  targetTags?: string[];
  targetMinScore?: number;
  targetMaxScore?: number;
  leadsTargeted: number;
  leadsProcessed: number;
  callsMade: number;
  messagesSent: number;
  appointmentsBooked: number;
  conversions: number;
  startDate?: string;
  endDate?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  workingDays?: number[];
  activatedAt?: string;
  completedAt?: string;
  tasks: CampaignTask[];
  createdAt: string;
  updatedAt: string;
}

export type Plan = "LAUNCH" | "STARTER" | "GROWTH" | "PRO";
export type PlanStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
export type CallType = "QUALIFICATION" | "BOOKING_REMINDER" | "FOLLOWUP_D1" | "FOLLOWUP_D3";
export type CallStatus = "INITIATED" | "RINGING" | "ANSWERED" | "COMPLETED" | "NO_ANSWER" | "FAILED" | "BUSY";
export type BookingStatus = "CONFIRMED" | "REMINDED" | "VISITED" | "NO_SHOW" | "RESCHEDULED" | "CANCELLED";

export interface Lead {
  id: string;
  clientId: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  budget?: string;
  location?: string;
  timeline?: string;
  propertyType?: string;
  bedrooms?: string;
  callLanguage?: string;
  sentiment?: string;
  score: number;
  status: LeadStatus;
  callAttempts: number;
  maxAttempts: number;
  nextRetryAt?: string;
  bookingId?: string;
  followupD1At?: string;
  followupD2At?: string;
  followupD3At?: string;
  receivedAt: string;
  firstCalledAt?: string;
  bookedAt?: string;
  visitedAt?: string;
  coldAt?: string;
  convertedAt?: string;
  createdAt: string;
  booking?: Booking;
  calls?: Call[];
  customerNotifications?: CustomerNotification[];
}

export interface Call {
  id: string;
  clientId: string;
  leadId: string;
  lead?: { name: string; phone: string };
  type: CallType;
  direction: string;
  duration?: number;
  status: CallStatus;
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
  extractedData?: any;
  createdAt: string;
}

export interface Booking {
  id: string;
  clientId: string;
  visitDate: string;
  visitTime: string;
  propertyAddress: string;
  propertyName?: string;
  notes?: string;
  status: BookingStatus;
  confirmedAt: string;
  reminderSentAt?: string;
  visitedAt?: string;
  noShowAt?: string;
  lead?: { name: string; phone: string; source: string; score?: number };
}

export interface CustomerNotification {
  id: string;
  leadId: string;
  type: string;
  channel: string;
  message: string;
  status: string;
  waMessageId?: string;
  sentAt: string;
}

export interface Client {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  zone?: string;
  language: string;
  ownerWhatsapp: string;
  plan: Plan;
  planStatus: PlanStatus;
  callsThisMonth: number;
  callsLimit: number;
  trialEndsAt?: string;
  territory?: Territory;
  _count?: { leads: number; calls: number; bookings: number };
}

export interface Territory {
  id: string;
  city: string;
  zone?: string;
  tier: number;
  clientId?: string;
  locked: boolean;
  client?: { businessName: string; ownerName: string };
}

export interface DashboardStats {
  todayLeads: number;
  todayCalls: number;
  todayBookings: number;
  monthLeads: number;
  monthCalls: number;
  monthBookings: number;
  qualifiedRate: number;
  bookingRate: number;
  showRate: number;
  conversionRate: number;
  activeFollowups: number;
  totalLeads: number;
  leadsByStatus?: Record<string, unknown>[];
  leadsBySource?: Record<string, unknown>[];
  recentActivity?: Record<string, unknown>[];
}

export interface LeadFilterState {
  search: string;
  status: string[];
  source: string[];
  dateFrom: string;
  dateTo: string;
}

export type PropertyStatus = "AVAILABLE" | "BOOKED" | "SOLD" | "OFF_MARKET";

export interface Property {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  price?: number;
  currency: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  areaUnit: string;
  location?: string;
  city?: string;
  zone?: string;
  status: PropertyStatus;
  featured: boolean;
  images: string[];
  amenities: string[];
  tags: string[];
  lastSyncedToAgentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebSocketEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}
