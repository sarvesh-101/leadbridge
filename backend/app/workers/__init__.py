"""LeadFlow AI OS - Celery Workers & Tasks"""

from celery import Celery
from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "leadflow_ai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks",
        "app.workers.scheduled",
    ],
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_max_tasks_per_child=200,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "check-appointment-reminders-24h": {
            "task": "app.workers.scheduled.check_appointment_reminders_24h",
            "schedule": 3600.0,  # Every hour
        },
        "check-appointment-reminders-2h": {
            "task": "app.workers.scheduled.check_appointment_reminders_2h",
            "schedule": 1800.0,  # Every 30 minutes
        },
        "process-follow-up-campaigns": {
            "task": "app.workers.scheduled.process_follow_up_campaigns",
            "schedule": 900.0,  # Every 15 minutes
        },
        "sync-integrations": {
            "task": "app.workers.scheduled.sync_integrations",
            "schedule": 3600.0,  # Every hour
        },
        "cleanup-expired-subscriptions": {
            "task": "app.workers.scheduled.cleanup_expired_subscriptions",
            "schedule": 86400.0,  # Daily
        },
    },
)
