# Webhook Integration Guide

## Overview

The Veeam Insight Dashboard supports webhook notifications for real-time alert events. When alerts are created, acknowledged, or resolved, the system can send HTTP POST requests to configured webhook URLs with detailed alert information.

## Webhook Configuration

Webhooks are configured per alert rule in the alert rule settings. Each alert rule can have:
- Email notifications
- WhatsApp notifications  
- Webhook URL for HTTP notifications

## Webhook Events

The system sends webhook notifications for three types of events:

1. **`alert.created`** - When a new alert is generated
2. **`alert.acknowledged`** - When an alert is acknowledged by a user
3. **`alert.resolved`** - When an alert is resolved

## Webhook Payload Format

All webhook requests are sent as HTTP POST with `Content-Type: application/json`. The payload structure is:

```json
{
  "event": "alert.created",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "alert": {
    "id": "alert_12345",
    "ruleId": "rule_67890",
    "type": "job_failure",
    "severity": "critical",
    "title": "Backup Job Failed",
    "message": "Backup job 'Daily VM Backup' failed with error: Connection timeout",
    "timestamp": "2024-01-15T10:29:45.000Z",
    "acknowledged": false,
    "acknowledgedBy": null,
    "acknowledgedAt": null,
    "resolved": false,
    "resolvedAt": null,
    "metadata": {
      "jobId": "job_abc123",
      "jobName": "Daily VM Backup",
      "errorCode": "TIMEOUT_ERROR"
    }
  },
  "source": {
    "system": "veeam-insight-dash",
    "version": "1.0.0",
    "environment": "production"
  }
}
```

## Field Descriptions

### Root Level Fields

- **`event`** (string): The type of event (`alert.created`, `alert.acknowledged`, `alert.resolved`)
- **`timestamp`** (string): ISO 8601 timestamp when the webhook was sent
- **`alert`** (object): Complete alert information
- **`source`** (object): Information about the system sending the webhook

### Alert Object Fields

- **`id`** (string): Unique alert identifier
- **`ruleId`** (string): ID of the alert rule that triggered this alert
- **`type`** (string): Alert type - one of:
  - `job_failure` - Backup job failed
  - `storage_threshold` - Repository storage threshold exceeded
  - `infrastructure_down` - Infrastructure component is down
  - `long_running_job` - Job running longer than expected
  - `error` - General error condition
  - `warning` - Warning condition
- **`severity`** (string): Alert severity level (`low`, `medium`, `high`, `critical`)
- **`title`** (string): Human-readable alert title
- **`message`** (string): Detailed alert description
- **`timestamp`** (string): ISO 8601 timestamp when the alert was created
- **`acknowledged`** (boolean): Whether the alert has been acknowledged
- **`acknowledgedBy`** (string|null): Username who acknowledged the alert
- **`acknowledgedAt`** (string|null): ISO 8601 timestamp when acknowledged
- **`resolved`** (boolean): Whether the alert has been resolved
- **`resolvedAt`** (string|null): ISO 8601 timestamp when resolved
- **`metadata`** (object|null): Additional context-specific information

### Source Object Fields

- **`system`** (string): System identifier (`veeam-insight-dash`)
- **`version`** (string): Application version
- **`environment`** (string): Deployment environment (`development`, `staging`, `production`)

## Example Webhook Payloads

### Alert Created Event

```json
{
  "event": "alert.created",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "alert": {
    "id": "alert_storage_001",
    "ruleId": "rule_storage_threshold",
    "type": "storage_threshold",
    "severity": "high",
    "title": "Repository Storage Warning",
    "message": "Repository 'Main Backup Storage' is 85% full (850GB used of 1TB)",
    "timestamp": "2024-01-15T10:29:45.000Z",
    "acknowledged": false,
    "acknowledgedBy": null,
    "acknowledgedAt": null,
    "resolved": false,
    "resolvedAt": null,
    "metadata": {
      "repositoryId": "repo_main_001",
      "repositoryName": "Main Backup Storage",
      "usagePercent": 85,
      "usedGB": 850,
      "totalGB": 1000
    }
  },
  "source": {
    "system": "veeam-insight-dash",
    "version": "1.0.0",
    "environment": "production"
  }
}
```

### Alert Acknowledged Event

```json
{
  "event": "alert.acknowledged",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "alert": {
    "id": "alert_storage_001",
    "ruleId": "rule_storage_threshold",
    "type": "storage_threshold",
    "severity": "high",
    "title": "Repository Storage Warning",
    "message": "Repository 'Main Backup Storage' is 85% full (850GB used of 1TB)",
    "timestamp": "2024-01-15T10:29:45.000Z",
    "acknowledged": true,
    "acknowledgedBy": "admin@company.com",
    "acknowledgedAt": "2024-01-15T10:35:00.000Z",
    "resolved": false,
    "resolvedAt": null,
    "metadata": {
      "repositoryId": "repo_main_001",
      "repositoryName": "Main Backup Storage",
      "usagePercent": 85,
      "usedGB": 850,
      "totalGB": 1000
    }
  },
  "source": {
    "system": "veeam-insight-dash",
    "version": "1.0.0",
    "environment": "production"
  }
}
```

### Alert Resolved Event

```json
{
  "event": "alert.resolved",
  "timestamp": "2024-01-15T11:00:00.000Z",
  "alert": {
    "id": "alert_storage_001",
    "ruleId": "rule_storage_threshold",
    "type": "storage_threshold",
    "severity": "high",
    "title": "Repository Storage Warning",
    "message": "Repository 'Main Backup Storage' is 85% full (850GB used of 1TB)",
    "timestamp": "2024-01-15T10:29:45.000Z",
    "acknowledged": true,
    "acknowledgedBy": "admin@company.com",
    "acknowledgedAt": "2024-01-15T10:35:00.000Z",
    "resolved": true,
    "resolvedAt": "2024-01-15T11:00:00.000Z",
    "metadata": {
      "repositoryId": "repo_main_001",
      "repositoryName": "Main Backup Storage",
      "usagePercent": 85,
      "usedGB": 850,
      "totalGB": 1000,
      "resolvedBy": "system"
    }
  },
  "source": {
    "system": "veeam-insight-dash",
    "version": "1.0.0",
    "environment": "production"
  }
}
```

## Webhook Delivery

### Request Headers

```
Content-Type: application/json
User-Agent: Veeam-Insight-Dashboard/1.0.0
```

### Timeout and Retry

- **Timeout**: 10 seconds
- **Retry Policy**: No automatic retries (to prevent duplicate notifications)
- **Error Handling**: Webhook failures are logged but do not prevent alert processing

### Security Considerations

1. **HTTPS**: Always use HTTPS URLs for webhook endpoints
2. **Authentication**: Implement webhook signature verification on your endpoint
3. **Rate Limiting**: Consider rate limiting on your webhook endpoint
4. **Validation**: Validate the webhook payload structure and content

## Testing Webhooks

You can test webhook delivery using the "Generate Test Alerts" feature in the Settings page. This will create sample alerts that trigger webhook notifications if configured.

## Integration Examples

### Slack Integration

```javascript
// Express.js webhook handler for Slack
app.post('/webhook/veeam-alerts', (req, res) => {
  const { event, alert } = req.body;
  
  const color = {
    'critical': 'danger',
    'high': 'warning', 
    'medium': 'warning',
    'low': 'good'
  }[alert.severity] || 'warning';
  
  const slackMessage = {
    text: `Veeam Alert: ${alert.title}`,
    attachments: [{
      color: color,
      fields: [
        { title: 'Event', value: event, short: true },
        { title: 'Severity', value: alert.severity, short: true },
        { title: 'Type', value: alert.type, short: true },
        { title: 'Message', value: alert.message, short: false }
      ],
      ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
    }]
  };
  
  // Send to Slack...
  res.status(200).send('OK');
});
```

### Microsoft Teams Integration

```javascript
// Teams webhook handler
app.post('/webhook/veeam-alerts', (req, res) => {
  const { event, alert } = req.body;
  
  const teamsMessage = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "summary": `Veeam Alert: ${alert.title}`,
    "themeColor": alert.severity === 'critical' ? 'FF0000' : 'FFA500',
    "sections": [{
      "activityTitle": `${event.replace('.', ' ').toUpperCase()}`,
      "activitySubtitle": alert.title,
      "facts": [
        { "name": "Severity", "value": alert.severity },
        { "name": "Type", "value": alert.type },
        { "name": "Time", "value": alert.timestamp }
      ],
      "text": alert.message
    }]
  };
  
  // Send to Teams...
  res.status(200).send('OK');
});
```

## Troubleshooting

### Common Issues

1. **Webhook not receiving requests**
   - Verify the webhook URL is correct and accessible
   - Check firewall settings
   - Ensure the endpoint accepts POST requests

2. **Webhook timeouts**
   - Optimize your webhook handler for fast response
   - Return HTTP 200 status quickly
   - Process webhook data asynchronously if needed

3. **Missing webhook notifications**
   - Verify alert rules have webhook URLs configured
   - Check application logs for webhook delivery errors
   - Ensure your endpoint is responding with HTTP 2xx status codes

### Debugging

Webhook delivery attempts and results are logged in the application logs:

```
[INFO] Webhook notification sent successfully to https://your-webhook.com for alert: alert_12345 (alert.created)
[ERROR] Failed to send webhook notification to https://your-webhook.com: Error: Request timeout
```