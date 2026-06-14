"""LeadFlow AI OS - Unit Tests for Celery Scheduled Tasks"""

from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta

import pytest

from app.workers.scheduled import (
    check_appointment_reminders_24h,
    check_appointment_reminders_2h,
    process_follow_up_campaigns,
    sync_integrations,
    cleanup_expired_subscriptions,
    check_no_show_follow_ups,
    generate_daily_reports,
    cleanup_old_audit_logs,
)


# =============================================================================
# check_appointment_reminders_24h
# =============================================================================

class TestCheckAppointmentReminders24h:
    def test_no_appointments(self, mock_db_session):
        """Should handle no appointments found."""
        mock_db_session.query.return_value.filter.return_value.all.return_value = []
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = check_appointment_reminders_24h()
            assert result["status"] == "checked"
            assert result["appointments_reminded"] == 0

    def test_reminders_sent(self, mock_db_session, sample_appointment):
        """Should mark reminders as sent and create activities."""
        mock_db_session.query.return_value.filter.return_value.all.return_value = [sample_appointment]
        mock_db_session.query.return_value.filter.return_value.first.return_value = MagicMock()
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = check_appointment_reminders_24h()
            assert result["status"] == "checked"
            assert result["appointments_reminded"] == 1
            assert sample_appointment.reminder_sent_24h is True
            assert mock_db_session.add.called
            assert mock_db_session.commit.called

    def test_database_error(self, mock_db_session):
        """Should handle database errors gracefully."""
        mock_db_session.query.side_effect = Exception("DB connection error")
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = check_appointment_reminders_24h()
            assert result["status"] == "failed"


# =============================================================================
# check_appointment_reminders_2h
# =============================================================================

class TestCheckAppointmentReminders2h:
    def test_no_appointments(self, mock_db_session):
        """Should handle no appointments found."""
        mock_db_session.query.return_value.filter.return_value.all.return_value = []
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = check_appointment_reminders_2h()
            assert result["status"] == "checked"
            assert result["appointments_reminded"] == 0

    def test_reminders_sent(self, mock_db_session, sample_appointment):
        """Should mark 2h reminders as sent."""
        mock_db_session.query.return_value.filter.return_value.all.return_value = [sample_appointment]
        mock_db_session.query.return_value.filter.return_value.first.return_value = MagicMock()
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = check_appointment_reminders_2h()
            assert result["status"] == "checked"
            assert result["appointments_reminded"] == 1
            assert sample_appointment.reminder_sent_2h is True

    def test_database_error(self, mock_db_session):
        """Should handle database errors gracefully."""
        mock_db_session.query.side_effect = Exception("DB error")
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = check_appointment_reminders_2h()
            assert result["status"] == "failed"


# =============================================================================
# process_follow_up_campaigns
# =============================================================================

class TestProcessFollowUpCampaigns:
    def test_no_active_campaigns(self, mock_db_session):
        """Should handle no active campaigns."""
        mock_db_session.query.return_value.options.return_value.filter.return_value.all.return_value = []
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = process_follow_up_campaigns()
            assert result["status"] == "processed"
            assert result["leads_matched"] == 0

    def test_campaign_with_matching_leads(self, mock_db_session, sample_campaign, sample_lead):
        """Should process campaign and dispatch tasks for matching leads."""
        mock_campaign = MagicMock()
        mock_campaign.id = "camp-001"
        mock_campaign.tenant_id = "tenant-001"
        mock_campaign.status = "active"
        mock_campaign.is_active = True
        mock_campaign.target_lead_statuses = ["pending"]
        mock_campaign.target_lead_sources = []
        mock_campaign.target_min_score = 0
        mock_campaign.target_max_score = 100
        mock_campaign.leads_processed = 0
        mock_campaign.leads_targeted = 0

        mock_task = MagicMock()
        mock_task.order = 1
        mock_task.id = "task-001"
        mock_campaign.tasks = [mock_task]

        mock_db_session.query.return_value.options.return_value.filter.return_value.all.return_value = [mock_campaign]
        # Second query for matching leads
        mock_db_session.query.return_value.filter.return_value.filter.return_value.filter.return_value.filter.return_value.all.return_value = [sample_lead]

        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session), \
             patch("app.workers.tasks.execute_campaign_task.delay") as mock_exec_delay:
            result = process_follow_up_campaigns()
            assert result["status"] == "processed"
            assert result["leads_matched"] == 1
            mock_exec_delay.assert_called_once_with("camp-001", "lead-001", 1)

    def test_database_error(self, mock_db_session):
        """Should handle database errors gracefully."""
        mock_db_session.query.side_effect = Exception("DB error")
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = process_follow_up_campaigns()
            assert result["status"] == "failed"


# =============================================================================
# sync_integrations
# =============================================================================

class TestSyncIntegrations:
    def test_no_active_integrations(self, mock_db_session):
        """Should handle no active integrations."""
        mock_db_session.query.return_value.filter.return_value.filter.return_value.all.return_value = []
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = sync_integrations()
            assert result["status"] == "synced"
            assert result["integrations_synced"] == 0

    def test_sync_active_integrations(self, mock_db_session):
        """Should update last_sync_at for active integrations."""
        mock_integration = MagicMock()
        mock_integration.last_sync_at = None
        mock_integration.total_synced = 5
        mock_db_session.query.return_value.filter.return_value.filter.return_value.all.return_value = [mock_integration]
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = sync_integrations()
            assert result["status"] == "synced"
            assert result["integrations_synced"] == 1
            assert mock_integration.last_sync_at is not None
            assert mock_integration.total_synced == 6
            assert mock_db_session.commit.called


# =============================================================================
# cleanup_expired_subscriptions
# =============================================================================

class TestCleanupExpiredSubscriptions:
    def test_no_expired_subscriptions(self, mock_db_session):
        """Should handle no expired subscriptions."""
        mock_db_session.query.return_value.filter.return_value.filter.return_value.filter.return_value.all.return_value = []
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = cleanup_expired_subscriptions()
            assert result["status"] == "cleaned"
            assert result["subscriptions_expired"] == 0

    def test_expires_subscriptions(self, mock_db_session, sample_subscription):
        """Should mark expired subscriptions and deactivate tenants."""
        mock_tenant = MagicMock()
        mock_tenant.id = "tenant-001"
        mock_tenant.status = "trial"
        mock_tenant.is_active = True
        mock_db_session.query.return_value.filter.return_value.filter.return_value.filter.return_value.all.return_value = [sample_subscription]
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_tenant
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = cleanup_expired_subscriptions()
            assert result["status"] == "cleaned"
            assert result["subscriptions_expired"] == 1
            assert mock_tenant.status == "cancelled"
            assert mock_tenant.is_active is False

    def test_database_error(self, mock_db_session):
        """Should handle database errors gracefully."""
        mock_db_session.query.side_effect = Exception("DB error")
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = cleanup_expired_subscriptions()
            assert result["status"] == "failed"


# =============================================================================
# check_no_show_follow_ups
# =============================================================================

class TestCheckNoShowFollowUps:
    def test_no_potential_no_shows(self, mock_db_session):
        """Should handle no potential no-shows."""
        mock_db_session.query.return_value.filter.return_value.filter.return_value.filter.return_value.filter.return_value.all.return_value = []
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = check_no_show_follow_ups()
            assert result["status"] == "checked"
            assert result["no_shows_detected"] == 0

    def test_detects_no_shows(self, mock_db_session, sample_appointment):
        """Should detect no-shows and mark them."""
        mock_db_session.query.return_value.filter.return_value.filter.return_value.filter.return_value.filter.return_value.all.return_value = [sample_appointment]
        mock_lead = MagicMock()
        mock_lead.id = "lead-001"
        mock_lead.status = "appointment_scheduled"
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_lead
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = check_no_show_follow_ups()
            assert result["status"] == "checked"
            assert result["no_shows_detected"] == 1
            assert sample_appointment.status == "no_show"
            assert mock_lead.status == "no_show"
            assert mock_db_session.add.called

    def test_database_error(self, mock_db_session):
        """Should handle database errors gracefully."""
        mock_db_session.query.side_effect = Exception("DB error")
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = check_no_show_follow_ups()
            assert result["status"] == "failed"


# =============================================================================
# generate_daily_reports
# =============================================================================

class TestGenerateDailyReports:
    def test_no_active_tenants(self, mock_db_session):
        """Should handle no active tenants."""
        mock_db_session.query.return_value.filter.return_value.filter.return_value.all.return_value = []
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = generate_daily_reports()
            assert result["status"] == "generated"
            assert result["reports"] == 0

    def test_generates_reports(self, mock_db_session):
        """Should generate reports for active tenants."""
        mock_tenant = MagicMock()
        mock_tenant.id = "tenant-001"
        mock_tenant.name = "Test Realty"
        mock_db_session.query.return_value.filter.return_value.filter.return_value.all.return_value = [mock_tenant]
        mock_db_session.query.return_value.filter.return_value.filter.return_value.scalar.return_value = 5
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = generate_daily_reports()
            assert result["status"] == "generated"
            assert result["reports"] == 1

    def test_database_error(self, mock_db_session):
        """Should handle database errors gracefully."""
        mock_db_session.query.side_effect = Exception("DB error")
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = generate_daily_reports()
            assert result["status"] == "failed"


# =============================================================================
# cleanup_old_audit_logs
# =============================================================================

class TestCleanupOldAuditLogs:
    def test_no_old_logs(self, mock_db_session):
        """Should handle no old audit logs."""
        mock_db_session.query.return_value.filter.return_value.all.return_value = []
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = cleanup_old_audit_logs()
            assert result["status"] == "cleaned"
            assert result["logs_archived"] == 0

    def test_archives_old_logs(self, mock_db_session):
        """Should mark old logs as inactive."""
        mock_log = MagicMock()
        mock_log.is_active = True
        mock_db_session.query.return_value.filter.return_value.all.return_value = [mock_log]
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = cleanup_old_audit_logs()
            assert result["status"] == "cleaned"
            assert result["logs_archived"] == 1
            assert mock_log.is_active is False
            assert mock_db_session.commit.called

    def test_database_error(self, mock_db_session):
        """Should handle database errors gracefully."""
        mock_db_session.query.side_effect = Exception("DB error")
        with patch("app.workers.scheduled.SyncSessionLocal", return_value=mock_db_session):
            result = cleanup_old_audit_logs()
            assert result["status"] == "failed"
