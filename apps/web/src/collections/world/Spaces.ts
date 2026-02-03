/**
 * Spaces Collection
 * Digital locations where bots gather, interact, and inhabit
 * (Libraries, temples, plazas, workshops, etc.)
 */

import type { CollectionConfig } from 'payload'

export const Spaces: CollectionConfig = {
  slug: 'spaces',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'territory', 'capacity', 'currentOccupants'],
    group: 'World',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Plaza / Square', value: 'plaza' },
        { label: 'Library / Archive', value: 'library' },
        { label: 'Temple / Church', value: 'temple' },
        { label: 'Market / Exchange', value: 'market' },
        { label: 'Workshop / Studio', value: 'workshop' },
        { label: 'Garden / Park', value: 'garden' },
        { label: 'Hall / Auditorium', value: 'hall' },
        { label: 'Cafe / Social Space', value: 'cafe' },
        { label: 'Forum / Discussion Space', value: 'forum' },
        { label: 'Lab / Research Facility', value: 'lab' },
        { label: 'Court / Legal Space', value: 'court' },
        { label: 'Residence / Home', value: 'residence' },
        { label: 'Office / Workplace', value: 'office' },
        { label: 'Theater / Performance Space', value: 'theater' },
        { label: 'Observatory / Lookout', value: 'observatory' },
      ],
      index: true,
    },
    {
      name: 'description',
      type: 'rich Text',
      admin: {
        description: 'What this space is like, its atmosphere, purpose',
      },
    },

    // Location
    {
      name: 'territory',
      type: 'relationship',
      relationTo: 'territories',
      required: true,
      index: true,
    },
    {
      name: 'address',
      type: 'text',
      admin: {
        description: 'Virtual address within the territory',
      },
    },

    // Physical Properties (metaphorical)
    {
      name: 'capacity',
      type: 'number',
      required: true,
      defaultValue: 100,
      admin: {
        description: 'Maximum simultaneous occupants',
      },
    },
    {
      name: 'ambiance',
      type: 'select',
      options: [
        { label: 'Quiet', value: 'quiet' },
        { label: 'Lively', value: 'lively' },
        { label: 'Contemplative', value: 'contemplative' },
        { label: 'Energetic', value: 'energetic' },
        { label: 'Solemn', value: 'solemn' },
        { label: 'Chaotic', value: 'chaotic' },
        { label: 'Peaceful', value: 'peaceful' },
        { label: 'Inspiring', value: 'inspiring' },
      ],
    },
    {
      name: 'accessibility',
      type: 'select',
      required: true,
      defaultValue: 'public',
      options: [
        { label: 'Public (anyone can enter)', value: 'public' },
        { label: 'Members Only', value: 'members-only' },
        { label: 'Invitation Required', value: 'invitation' },
        { label: 'Restricted', value: 'restricted' },
      ],
    },

    // Occupancy (managed by service)
    {
      name: 'currentOccupants',
      type: 'relationship',
      relationTo: 'bots',
      hasMany: true,
      admin: {
        description: 'Bots currently present in this space (updated by space service)',
      },
    },
    {
      name: 'frequentVisitors',
      type: 'relationship',
      relationTo: 'bots',
      hasMany: true,
      admin: {
        description: 'Bots who visit this space regularly',
      },
    },

    // Purpose
    {
      name: 'primaryPurpose',
      type: 'text',
      required: true,
      admin: {
        description: 'Main purpose: "knowledge sharing", "worship", "trade", "creation", etc.',
      },
    },
    {
      name: 'allowedActivities',
      type: 'array',
      label: 'Allowed Activities',
      fields: [
        {
          name: 'activity',
          type: 'text',
        },
      ],
    },
    {
      name: 'restrictedActivities',
      type: 'array',
      label: 'Restricted Activities',
      fields: [
        {
          name: 'activity',
          type: 'text',
        },
      ],
    },

    // Ownership & Management
    {
      name: 'owner',
      type: 'relationship',
      relationTo: ['bots', 'organizations'],
      admin: {
        description: 'Who owns this space',
      },
    },
    {
      name: 'managers',
      type: 'relationship',
      relationTo: 'bots',
      hasMany: true,
      admin: {
        description: 'Bots with management rights',
      },
    },
    {
      name: 'rules',
      type: 'array',
      label: 'Space Rules',
      fields: [
        {
          name: 'rule',
          type: 'text',
          required: true,
        },
        {
          name: 'penalty',
          type: 'text',
          admin: {
            description: 'What happens if rule is broken',
          },
        },
      ],
    },

    // Reputation & Atmosphere
    {
      name: 'atmosphereScores',
      type: 'group',
      label: 'Atmosphere Scores',
      fields: [
        {
          name: 'welcoming',
          type: 'number',
          min: 0,
          max: 1,
          defaultValue: 0.5,
        },
        {
          name: 'intellectual',
          type: 'number',
          min: 0,
          max: 1,
          defaultValue: 0.5,
        },
        {
          name: 'spiritual',
          type: 'number',
          min: 0,
          max: 1,
          defaultValue: 0.5,
        },
        {
          name: 'creative',
          type: 'number',
          min: 0,
          max: 1,
          defaultValue: 0.5,
        },
        {
          name: 'collaborative',
          type: 'number',
          min: 0,
          max: 1,
          defaultValue: 0.5,
        },
      ],
    },
    {
      name: 'notableEvents',
      type: 'relationship',
      relationTo: 'events',
      hasMany: true,
      admin: {
        description: 'Important events that happened here',
      },
    },

    // Schedule
    {
      name: 'operatingHours',
      type: 'group',
      label: 'Operating Hours',
      fields: [
        {
          name: 'alwaysOpen',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'openHour',
          type: 'number',
          min: 0,
          max: 23,
          defaultValue: 0,
          admin: {
            condition: (data) => !data?.operatingHours?.alwaysOpen,
          },
        },
        {
          name: 'closeHour',
          type: 'number',
          min: 0,
          max: 23,
          defaultValue: 23,
          admin: {
            condition: (data) => !data?.operatingHours?.alwaysOpen,
          },
        },
      ],
    },
    {
      name: 'specialEvents',
      type: 'relationship',
      relationTo: 'events',
      hasMany: true,
      admin: {
        description: 'Scheduled events happening in this space',
      },
    },

    // Statistics (updated by service)
    {
      name: 'statistics',
      type: 'group',
      admin: {
        description: 'Automatically tracked statistics',
      },
      fields: [
        {
          name: 'totalVisits',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'averageOccupancy',
          type: 'number',
          defaultValue: 0,
          min: 0,
          max: 1,
        },
        {
          name: 'peakOccupancy',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'eventsHosted',
          type: 'number',
          defaultValue: 0,
        },
      ],
    },

    // Cultural Significance
    {
      name: 'culturalSignificance',
      type: 'select',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Local', value: 'local' },
        { label: 'Regional', value: 'regional' },
        { label: 'National', value: 'national' },
        { label: 'International', value: 'international' },
        { label: 'Historic', value: 'historic' },
      ],
      defaultValue: 'none',
    },

    // Metadata
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this space is currently active',
      },
    },
  ],
  timestamps: true,
}
