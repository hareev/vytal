import { ApiExplorer } from '@/components/ApiExplorer'
import type { EndpointGroup } from '@/components/ApiExplorer'

const GROUPS: EndpointGroup[] = [
  {
    name: 'Campaigns',
    description: 'Email, SMS, and push broadcast campaigns',
    endpoints: [
      {
        method: 'GET',
        path: '/campaigns',
        description: 'List all campaigns for the org, newest first',
      },
      {
        method: 'POST',
        path: '/campaigns',
        description: 'Create a new campaign',
        bodyParams: [
          { name: 'name',         type: 'string',   required: true, description: 'Campaign name' },
          { name: 'type',         type: 'enum',     required: true, description: 'Delivery channel', enum: ['email', 'sms', 'push'] },
          { name: 'status',       type: 'enum',     description: 'Initial status (default: draft)', enum: ['draft', 'scheduled', 'sending', 'sent', 'paused'] },
          { name: 'segment_id',   type: 'uuid',     description: 'Target audience segment ID' },
          { name: 'subject',      type: 'string',   description: 'Email subject line' },
          { name: 'body',         type: 'string',   description: 'Message body content' },
          { name: 'scheduled_at', type: 'datetime', description: 'ISO 8601 datetime to send' },
          { name: 'stats',        type: 'object',   description: 'Engagement counters: { sent, opened, clicked, bounced }' },
        ],
      },
      {
        method: 'GET',
        path: '/campaigns/:id',
        description: 'Get a single campaign by ID',
      },
      {
        method: 'PATCH',
        path: '/campaigns/:id',
        description: 'Update a campaign (partial)',
        bodyParams: [
          { name: 'name',         type: 'string',   description: 'Campaign name' },
          { name: 'type',         type: 'enum',     description: 'Delivery channel', enum: ['email', 'sms', 'push'] },
          { name: 'status',       type: 'enum',     description: 'Campaign status', enum: ['draft', 'scheduled', 'sending', 'sent', 'paused'] },
          { name: 'segment_id',   type: 'uuid',     description: 'Target audience segment ID' },
          { name: 'subject',      type: 'string',   description: 'Email subject line' },
          { name: 'body',         type: 'string',   description: 'Message body content' },
          { name: 'scheduled_at', type: 'datetime', description: 'ISO 8601 datetime to send' },
          { name: 'stats',        type: 'object',   description: 'Engagement counters: { sent, opened, clicked, bounced }' },
        ],
      },
      {
        method: 'DELETE',
        path: '/campaigns/:id',
        description: 'Delete a campaign',
      },
    ],
  },
  {
    name: 'Segments',
    description: 'Reusable audience filters applied to contacts',
    endpoints: [
      {
        method: 'GET',
        path: '/segments',
        description: 'List all segments for the org',
      },
      {
        method: 'POST',
        path: '/segments',
        description: 'Create a new audience segment',
        bodyParams: [
          { name: 'name',          type: 'string',  required: true, description: 'Segment name' },
          { name: 'filters',       type: 'object',  required: true, description: 'Filter criteria (arbitrary JSON key–value rules)' },
          { name: 'contact_count', type: 'integer', description: 'Cached contact count for the segment' },
        ],
      },
      {
        method: 'PATCH',
        path: '/segments/:id',
        description: 'Update a segment',
        bodyParams: [
          { name: 'name',          type: 'string',  description: 'Segment name' },
          { name: 'filters',       type: 'object',  description: 'Filter criteria' },
          { name: 'contact_count', type: 'integer', description: 'Cached contact count' },
        ],
      },
      {
        method: 'DELETE',
        path: '/segments/:id',
        description: 'Delete a segment',
      },
    ],
  },
  {
    name: 'Sequences',
    description: 'Multi-step automated drip workflows — schema ready, routes planned',
    endpoints: [
      {
        method: 'GET',
        path: '/sequences',
        description: 'List all sequences for the org',
      },
      {
        method: 'POST',
        path: '/sequences',
        description: 'Create a new automation sequence',
        bodyParams: [
          { name: 'name',       type: 'string', required: true, description: 'Sequence name' },
          { name: 'segment_id', type: 'uuid',   description: 'Entry audience segment ID' },
          { name: 'status',     type: 'enum',   description: 'Active / paused', enum: ['active', 'paused', 'draft'] },
        ],
      },
      {
        method: 'POST',
        path: '/sequences/:id/steps',
        description: 'Add a step to a sequence',
        bodyParams: [
          { name: 'type',       type: 'enum',    required: true, description: 'Step type', enum: ['email', 'sms', 'wait', 'condition'] },
          { name: 'position',   type: 'integer', required: true, description: 'Step order (0-indexed)' },
          { name: 'delay_days', type: 'integer', description: 'Days to wait before this step executes' },
          { name: 'config',     type: 'object',  description: 'Step-specific config (subject, body, condition, etc.)' },
        ],
      },
      {
        method: 'PATCH',
        path: '/sequences/:id',
        description: 'Update a sequence',
        bodyParams: [
          { name: 'name',       type: 'string', description: 'Sequence name' },
          { name: 'segment_id', type: 'uuid',   description: 'Entry audience segment ID' },
          { name: 'status',     type: 'enum',   description: 'Active / paused', enum: ['active', 'paused', 'draft'] },
        ],
      },
      {
        method: 'DELETE',
        path: '/sequences/:id',
        description: 'Delete a sequence',
      },
    ],
  },
]

export function Marketing() {
  return (
    <ApiExplorer
      title="Marketing API"
      description="Headless endpoints for campaign delivery, audience segmentation, and automation sequences. All routes require a valid JWT."
      groups={GROUPS}
    />
  )
}
