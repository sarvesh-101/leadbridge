# LeadBridge — Railway Procfile
# Defines process types for the API server and BullMQ workers.
# Railway reads this from the project root.
# Use `railway run <process_type>` to start each service.

web: cd server && node dist/index.js
worker-call: cd server && node dist/workers/call.worker.js
worker-notification: cd server && node dist/workers/notification.worker.js
worker-extraction: cd server && node dist/workers/extraction.worker.js
worker-followup: cd server && node dist/workers/followup.worker.js
worker-reminder: cd server && node dist/workers/reminder.worker.js
worker-webhook-retry: cd server && node dist/workers/webhook-retry.worker.js
