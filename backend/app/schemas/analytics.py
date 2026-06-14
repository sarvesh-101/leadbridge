"""LeadFlow AI OS - Analytics Schemas"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class DashboardStats(BaseModel):
    total_leads: int
    new_leads_today: int
    new_leads_this_week: int
    new_leads_this_month: int
    
    total_calls: int
    calls_today: int
    calls_answered: int
    calls_missed: int
    avg_call_duration: float
    
    total_appointments: int
    appointments_today: int
    appointments_this_week: int
    visited_today: int
    no_shows_today: int
    
    total_conversions: int
    conversion_rate: float
    
    total_revenue: float
    revenue_this_month: float
    
    active_campaigns: int
    leads_in_follow_up: int
    
    lead_score_avg: float
    high_quality_leads: int


class DailyMetrics(BaseModel):
    date: str
    leads: int
    calls: int
    appointments: int
    conversions: int
    revenue: float


class LeadSourceAnalytics(BaseModel):
    source: str
    count: int
    conversion_rate: float
    avg_score: float


class CallAnalytics(BaseModel):
    total_calls: int
    answered: int
    missed: int
    answer_rate: float
    avg_duration: float
    avg_talk_time: float
    total_cost: float
    calls_by_type: Dict[str, int]
    calls_by_hour: Dict[str, int]


class AppointmentAnalytics(BaseModel):
    total: int
    scheduled: int
    confirmed: int
    visited: int
    no_shows: int
    cancelled: int
    visit_rate: float
    no_show_rate: float
    reschedule_rate: float


class ConversionFunnel(BaseModel):
    leads_received: int
    leads_contacted: int
    leads_qualified: int
    appointments_scheduled: int
    appointments_visited: int
    conversions: int
    conversion_rate: float


class TerritoryAnalytics(BaseModel):
    total_territories: int
    available: int
    occupied: int
    reserved: int
    waitlisted: int
    monthly_revenue: float
    total_revenue: float
    top_territories: List[Dict[str, Any]]


class ROICalculation(BaseModel):
    total_investment: float
    total_revenue: float
    net_profit: float
    roi_percentage: float
    leads_converted: int
    revenue_per_lead: float
    cost_per_lead: float
    break_even_leads: int


class AIPerformanceMetrics(BaseModel):
    total_calls: int
    successful_calls: int
    failed_calls: int
    avg_call_duration: float
    appointment_booking_rate: float
    lead_qualification_rate: float
    avg_lead_score: float
    positive_sentiment_rate: float
    total_ai_cost: float
    cost_per_call: float
