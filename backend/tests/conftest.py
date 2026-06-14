"""LeadFlow AI OS - Test Fixtures for Celery Workers"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
from app.workers import celery_app
from app.core.config import settings


@pytest.fixture(autouse=True)
def celery_eager_mode():
    """Run Celery tasks synchronously during tests."""
    old_value = celery_app.conf.task_always_eager
    celery_app.conf.task_always_eager = True
    yield
    celery_app.conf.task_always_eager = old_value


@pytest.fixture
def mock_db_session():
    """Create a mock DB session that mimics SQLAlchemy Session."""
    session = MagicMock()

    # Make query chain work: session.query(Model).filter(...).first()
    query_mock = MagicMock()
    session.query.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.options.return_value = query_mock
    query_mock.first.return_value = None
    query_mock.all.return_value = []
    query_mock.limit.return_value = query_mock
    query_mock.scalar.return_value = 0
    query_mock.count.return_value = 0

    return session


@pytest.fixture
def mock_http_post():
    """Mock httpx.Client.post to return a controlled response."""
    with patch("httpx.Client") as mock_client:
        client_instance = MagicMock()
        response = MagicMock()
        response.status_code = 200
        response.text = '{"messages": [{"id": "wa_test_id"}]}'
        response.json.return_value = {"choices": [{"message": {"content": "{}"}}]}
        client_instance.post.return_value = response
        client_instance.get.return_value = response
        mock_client.return_value.__enter__.return_value = client_instance
        yield client_instance


@pytest.fixture
def sample_lead():
    """Create a sample Lead mock object."""
    from unittest.mock import MagicMock
    from datetime import datetime, timezone

    lead = MagicMock()
    lead.id = "lead-001"
    lead.tenant_id = "tenant-001"
    lead.first_name = "Rahul"
    lead.last_name = "Sharma"
    lead.phone = "+919876543210"
    lead.email = "rahul@example.com"
    lead.status = "pending"
    lead.lead_score = 0
    lead.source = "manual"
    lead.tags = []
    lead.created_by = "user-001"
    lead.requirement = "Looking for 2BHK in Andheri"
    lead.city = "Mumbai"
    lead.location = "Andheri West"
    return lead


@pytest.fixture
def sample_tenant():
    """Create a sample Tenant mock object."""
    from unittest.mock import MagicMock

    tenant = MagicMock()
    tenant.id = "tenant-001"
    tenant.name = "Sharma Realty"
    tenant.slug = "sharma-realty"
    tenant.email = "owner@sharmarealty.com"
    tenant.phone = "+919876543210"
    tenant.status = "active"
    tenant.plan = "starter"
    tenant.is_active = True
    return tenant


@pytest.fixture
def sample_ai_config():
    """Create a sample AIConfiguration mock object."""
    from unittest.mock import MagicMock

    config = MagicMock()
    config.id = "ai-config-001"
    config.tenant_id = "tenant-001"
    config.call_from_number = "+918888888888"
    config.is_active = True
    return config


@pytest.fixture
def sample_call():
    """Create a sample Call mock object."""
    from unittest.mock import MagicMock

    call = MagicMock()
    call.id = "call-001"
    call.tenant_id = "tenant-001"
    call.lead_id = "lead-001"
    call.call_type = "ai"
    call.direction = "outbound"
    call.status = "queued"
    call.to_number = "+919876543210"
    call.from_number = "+918888888888"
    call.ai_summary = ""
    call.ai_sentiment = ""
    call.ai_keywords = []
    return call


@pytest.fixture
def sample_appointment():
    """Create a sample Appointment mock object."""
    from unittest.mock import MagicMock
    from datetime import datetime, timezone, timedelta

    apt = MagicMock()
    apt.id = "apt-001"
    apt.tenant_id = "tenant-001"
    apt.lead_id = "lead-001"
    apt.title = "Site Visit - Andheri West"
    apt.status = "scheduled"
    apt.scheduled_date = datetime.now(timezone.utc) + timedelta(days=1)
    apt.scheduled_start_time = datetime.now(timezone.utc) + timedelta(days=1, hours=10)
    apt.scheduled_end_time = datetime.now(timezone.utc) + timedelta(days=1, hours=11)
    apt.location = "Andheri West, Mumbai"
    apt.reminder_sent_24h = False
    apt.reminder_sent_2h = False
    apt.is_active = True
    return apt


@pytest.fixture
def sample_campaign():
    """Create a sample Campaign mock object."""
    from unittest.mock import MagicMock

    campaign = MagicMock()
    campaign.id = "camp-001"
    campaign.tenant_id = "tenant-001"
    campaign.name = "Follow Up Campaign"
    campaign.status = "active"
    campaign.is_active = True
    campaign.target_lead_statuses = ["pending", "contacted"]
    campaign.target_lead_sources = []
    campaign.target_min_score = 0
    campaign.target_max_score = 100
    campaign.leads_processed = 0
    campaign.leads_targeted = 0
    campaign.tasks = []
    return campaign


@pytest.fixture
def sample_subscription():
    """Create a sample Subscription mock object."""
    from unittest.mock import MagicMock
    from datetime import datetime, timezone, timedelta

    sub = MagicMock()
    sub.id = "sub-001"
    sub.tenant_id = "tenant-001"
    sub.status = "trial"
    sub.start_date = datetime.now(timezone.utc) - timedelta(days=10)
    sub.end_date = datetime.now(timezone.utc) - timedelta(days=1)
    sub.auto_renew = False
    sub.plan = "starter"
    return sub
