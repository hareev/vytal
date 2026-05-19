import { ApiExplorer } from '@/components/ApiExplorer'
import type { EndpointGroup } from '@/components/ApiExplorer'

const GROUPS: EndpointGroup[] = [
  {
    name: 'Tickets',
    description: 'Support tickets with automatic SLA deadlines based on priority',
    endpoints: [
      {
        method: 'GET',
        path: '/tickets',
        description: 'List tickets with optional filters, newest first',
        queryParams: [
          { name: 'status',      type: 'enum', description: 'Filter by ticket status', enum: ['open', 'pending', 'resolved', 'closed'] },
          { name: 'priority',    type: 'enum', description: 'Filter by priority', enum: ['urgent', 'high', 'medium', 'low'] },
          { name: 'assignee_id', type: 'uuid', description: 'Filter by assigned user ID' },
        ],
      },
      {
        method: 'POST',
        path: '/tickets',
        description: 'Create a ticket — SLA deadline auto-computed from priority',
        bodyParams: [
          { name: 'subject',     type: 'string',   required: true, description: 'Short ticket subject' },
          { name: 'description', type: 'string',   required: true, description: 'Full issue description' },
          { name: 'priority',    type: 'enum',     description: 'Priority (default: medium) — sets SLA: urgent=8h, high=24h, medium/low=72h', enum: ['urgent', 'high', 'medium', 'low'] },
          { name: 'status',      type: 'enum',     description: 'Initial status (default: open)', enum: ['open', 'pending', 'resolved', 'closed'] },
          { name: 'contact_id',  type: 'uuid',     description: 'Associated contact ID' },
          { name: 'assignee_id', type: 'uuid',     description: 'Assigned agent user ID' },
          { name: 'tags',        type: 'string[]', description: 'Array of tag strings' },
        ],
      },
      {
        method: 'GET',
        path: '/tickets/:id',
        description: 'Get a ticket by ID — response includes messages array',
      },
      {
        method: 'PATCH',
        path: '/tickets/:id',
        description: 'Update a ticket — transitioning to resolved auto-sets resolved_at',
        bodyParams: [
          { name: 'subject',     type: 'string',   description: 'Short ticket subject' },
          { name: 'description', type: 'string',   description: 'Full issue description' },
          { name: 'status',      type: 'enum',     description: 'Ticket status', enum: ['open', 'pending', 'resolved', 'closed'] },
          { name: 'priority',    type: 'enum',     description: 'Priority level', enum: ['urgent', 'high', 'medium', 'low'] },
          { name: 'contact_id',  type: 'uuid',     description: 'Associated contact ID' },
          { name: 'assignee_id', type: 'uuid',     description: 'Assigned agent user ID' },
          { name: 'tags',        type: 'string[]', description: 'Array of tag strings' },
          { name: 'resolved_at', type: 'datetime', description: 'Override resolved timestamp (ISO 8601)' },
        ],
      },
      {
        method: 'DELETE',
        path: '/tickets/:id',
        description: 'Delete a ticket and its messages',
      },
    ],
  },
  {
    name: 'Messages',
    description: 'Conversation thread attached to a ticket',
    endpoints: [
      {
        method: 'POST',
        path: '/tickets/:id/messages',
        description: 'Post a message to a ticket thread',
        bodyParams: [
          { name: 'body',        type: 'string',  required: true, description: 'Message body text' },
          { name: 'is_internal', type: 'boolean', description: 'Internal note (not visible to contact) — default: false' },
        ],
      },
    ],
  },
]

export function Service() {
  return (
    <ApiExplorer
      title="Service API"
      description="Headless endpoints for support ticket management, SLA tracking, and threaded conversations. All routes require a valid JWT."
      groups={GROUPS}
    />
  )
}
