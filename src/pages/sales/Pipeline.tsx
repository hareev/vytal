import { ApiExplorer } from '@/components/ApiExplorer'
import type { EndpointGroup } from '@/components/ApiExplorer'

const GROUPS: EndpointGroup[] = [
  {
    name: 'Contacts',
    description: 'People and companies in your CRM',
    endpoints: [
      {
        method: 'GET',
        path: '/contacts',
        description: 'List contacts with filters and pagination',
        queryParams: [
          { name: 'search', type: 'string', description: 'Search by first name, last name, or email (ILIKE)' },
          { name: 'status', type: 'enum', description: 'Filter by lifecycle status', enum: ['lead', 'prospect', 'customer', 'churned'] },
          { name: 'page', type: 'integer', description: 'Page number (default: 1)' },
          { name: 'limit', type: 'integer', description: 'Results per page (default: 50, max: 200)' },
        ],
      },
      {
        method: 'POST',
        path: '/contacts',
        description: 'Create a new contact',
        bodyParams: [
          { name: 'first_name', type: 'string', required: true, description: 'First name' },
          { name: 'last_name',  type: 'string', required: true, description: 'Last name' },
          { name: 'email',    type: 'string',  description: 'Email address' },
          { name: 'phone',    type: 'string',  description: 'Phone number' },
          { name: 'company',  type: 'string',  description: 'Company name' },
          { name: 'status',   type: 'enum',    description: 'Lifecycle status', enum: ['lead', 'prospect', 'customer', 'churned'] },
          { name: 'tags',     type: 'string[]', description: 'Array of tag strings' },
          { name: 'notes',    type: 'string',  description: 'Free-text notes' },
          { name: 'owner_id', type: 'uuid',    description: 'Assigned user ID' },
        ],
      },
      {
        method: 'GET',
        path: '/contacts/:id',
        description: 'Get a single contact by ID',
      },
      {
        method: 'PATCH',
        path: '/contacts/:id',
        description: 'Partially update a contact',
        bodyParams: [
          { name: 'first_name', type: 'string',  description: 'First name' },
          { name: 'last_name',  type: 'string',  description: 'Last name' },
          { name: 'email',      type: 'string',  description: 'Email address' },
          { name: 'phone',      type: 'string',  description: 'Phone number' },
          { name: 'company',    type: 'string',  description: 'Company name' },
          { name: 'status',     type: 'enum',    description: 'Lifecycle status', enum: ['lead', 'prospect', 'customer', 'churned'] },
          { name: 'tags',       type: 'string[]', description: 'Array of tag strings' },
          { name: 'notes',      type: 'string',  description: 'Free-text notes' },
          { name: 'owner_id',   type: 'uuid',    description: 'Assigned user ID' },
        ],
      },
      {
        method: 'DELETE',
        path: '/contacts/:id',
        description: 'Delete a contact',
      },
    ],
  },
  {
    name: 'Deals',
    description: 'Opportunities moving through pipeline stages',
    endpoints: [
      {
        method: 'GET',
        path: '/deals',
        description: 'List deals with optional filters',
        queryParams: [
          { name: 'pipeline_id', type: 'uuid', description: 'Filter by pipeline' },
          { name: 'stage_id',    type: 'uuid', description: 'Filter by stage' },
          { name: 'status',      type: 'enum', description: 'Filter by deal outcome', enum: ['open', 'won', 'lost'] },
        ],
      },
      {
        method: 'POST',
        path: '/deals',
        description: 'Create a new deal',
        bodyParams: [
          { name: 'title',       type: 'string', required: true, description: 'Deal title' },
          { name: 'stage_id',    type: 'uuid',   required: true, description: 'Pipeline stage ID' },
          { name: 'pipeline_id', type: 'uuid',   required: true, description: 'Pipeline ID' },
          { name: 'value',       type: 'string',  description: 'Monetary value' },
          { name: 'currency',    type: 'string',  description: 'ISO 4217 currency code (default: USD)' },
          { name: 'contact_id',  type: 'uuid',    description: 'Associated contact ID' },
          { name: 'owner_id',    type: 'uuid',    description: 'Assigned user ID' },
          { name: 'close_date',  type: 'string',  description: 'Expected close date (ISO 8601)' },
          { name: 'status',      type: 'enum',    description: 'Deal outcome', enum: ['open', 'won', 'lost'] },
          { name: 'notes',       type: 'string',  description: 'Free-text notes' },
        ],
      },
      {
        method: 'GET',
        path: '/deals/:id',
        description: 'Get a single deal by ID',
      },
      {
        method: 'PATCH',
        path: '/deals/:id',
        description: 'Update a deal — use stage_id to move between stages',
        bodyParams: [
          { name: 'title',      type: 'string', description: 'Deal title' },
          { name: 'stage_id',   type: 'uuid',   description: 'Move to a different stage' },
          { name: 'value',      type: 'string', description: 'Monetary value' },
          { name: 'currency',   type: 'string', description: 'ISO 4217 currency code' },
          { name: 'status',     type: 'enum',   description: 'Deal outcome', enum: ['open', 'won', 'lost'] },
          { name: 'close_date', type: 'string', description: 'Expected close date (ISO 8601)' },
          { name: 'notes',      type: 'string', description: 'Free-text notes' },
        ],
      },
      {
        method: 'DELETE',
        path: '/deals/:id',
        description: 'Delete a deal',
      },
    ],
  },
  {
    name: 'Pipelines',
    description: 'Named sequences of stages; returned with stages embedded',
    endpoints: [
      {
        method: 'GET',
        path: '/pipelines',
        description: 'List all pipelines with their stages embedded',
      },
      {
        method: 'POST',
        path: '/pipelines',
        description: 'Create a new pipeline',
        bodyParams: [
          { name: 'name',       type: 'string',  required: true, description: 'Pipeline name' },
          { name: 'is_default', type: 'boolean', description: 'Set as the org default pipeline' },
        ],
      },
      {
        method: 'POST',
        path: '/pipelines/:id/stages',
        description: 'Add a stage to a pipeline',
        bodyParams: [
          { name: 'name',        type: 'string',  required: true, description: 'Stage name' },
          { name: 'position',    type: 'integer', required: true, description: 'Display order (0-indexed)' },
          { name: 'probability', type: 'integer', description: 'Win probability percentage 0–100' },
        ],
      },
      {
        method: 'PATCH',
        path: '/pipelines/:id/stages/:stageId',
        description: 'Update a stage name, position, or probability',
        bodyParams: [
          { name: 'name',        type: 'string',  description: 'Stage name' },
          { name: 'position',    type: 'integer', description: 'Display order (0-indexed)' },
          { name: 'probability', type: 'integer', description: 'Win probability percentage 0–100' },
        ],
      },
    ],
  },
]


export function Pipeline() {
  return (
    <ApiExplorer
      title="Sales API"
      description="Headless endpoints for contacts, deals, and pipeline management. All routes require a valid JWT."
      groups={GROUPS}
    />
  )
}
