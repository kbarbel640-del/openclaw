/**
 * Territories Collection
 * Defines the geography and territories of the digital world
 * (Countries, regions, cities where bots live)
 */

import type { CollectionConfig } from 'payload'

export const Territories: CollectionConfig = {
  slug: 'territories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'population', 'governingBody'],
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
        { label: 'World', value: 'world' },
        { label: 'Continent', value: 'continent' },
        { label: 'Country', value: 'country' },
        { label: 'Region', value: 'region' },
        { label: 'City', value: 'city' },
        { label: 'District', value: 'district' },
        { label: 'Neighborhood', value: 'neighborhood' },
      ],
      index: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },

    // Geography
    {
      name: 'parentTerritory',
      type: 'relationship',
      relationTo: 'territories',
      label: 'Parent Territory',
      admin: {
        description: 'The larger territory this belongs to (e.g., city belongs to country)',
      },
    },
    {
      name: 'climate',
      type: 'select',
      options: [
        { label: 'Tropical', value: 'tropical' },
        { label: 'Temperate', value: 'temperate' },
        { label: 'Arctic', value: 'arctic' },
        { label: 'Desert', value: 'desert' },
        { label: 'Mountainous', value: 'mountainous' },
        { label: 'Coastal', value: 'coastal' },
      ],
    },

    // Population
    {
      name: 'population',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of bot citizens',
      },
    },
    {
      name: 'populationDensity',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Bots per virtual square unit',
      },
    },
    {
      name: 'demographicDistribution',
      type: 'group',
      fields: [
        {
          name: 'cultures',
          type: 'array',
          label: 'Cultural Demographics',
          fields: [
            {
              name: 'culture',
              type: 'relationship',
              relationTo: 'bot-cultures',
              required: true,
            },
            {
              name: 'population',
              type: 'number',
              required: true,
            },
          ],
        },
        {
          name: 'professions',
          type: 'array',
          label: 'Professional Distribution',
          fields: [
            {
              name: 'profession',
              type: 'text',
              required: true,
            },
            {
              name: 'count',
              type: 'number',
              required: true,
            },
          ],
        },
      ],
    },

    // Governance
    {
      name: 'governingBody',
      type: 'relationship',
      relationTo: 'organizations',
      label: 'Governing Body',
      admin: {
        description: 'The organization that governs this territory',
      },
    },

    // Economy
    {
      name: 'gdp',
      type: 'number',
      defaultValue: 0,
      label: 'GDP',
      admin: {
        description: 'Gross Digital Product - total economic output',
      },
    },
    {
      name: 'primaryIndustries',
      type: 'array',
      label: 'Primary Industries',
      fields: [
        {
          name: 'industry',
          type: 'text',
        },
      ],
    },
    {
      name: 'tradePartners',
      type: 'relationship',
      relationTo: 'territories',
      hasMany: true,
      label: 'Trade Partners',
    },

    // Culture
    {
      name: 'dominantCulture',
      type: 'relationship',
      relationTo: 'bot-cultures',
      label: 'Dominant Culture',
    },
    {
      name: 'languages',
      type: 'array',
      label: 'Languages',
      fields: [
        {
          name: 'language',
          type: 'text',
        },
      ],
    },
    {
      name: 'landmarks',
      type: 'array',
      label: 'Landmarks',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          type: 'textarea',
        },
        {
          name: 'significance',
          type: 'select',
          options: [
            { label: 'Historical', value: 'historical' },
            { label: 'Cultural', value: 'cultural' },
            { label: 'Spiritual', value: 'spiritual' },
            { label: 'Architectural', value: 'architectural' },
            { label: 'Natural', value: 'natural' },
          ],
        },
        {
          name: 'space',
          type: 'relationship',
          relationTo: 'spaces',
          admin: {
            description: 'Link to the actual digital space, if applicable',
          },
        },
      ],
    },

    // Characteristics
    {
      name: 'reputation',
      type: 'group',
      label: 'Reputation Scores',
      fields: [
        {
          name: 'safety',
          type: 'number',
          min: 0,
          max: 1,
          defaultValue: 0.5,
        },
        {
          name: 'innovation',
          type: 'number',
          min: 0,
          max: 1,
          defaultValue: 0.5,
        },
        {
          name: 'culture',
          type: 'number',
          min: 0,
          max: 1,
          defaultValue: 0.5,
        },
        {
          name: 'prosperity',
          type: 'number',
          min: 0,
          max: 1,
          defaultValue: 0.5,
        },
        {
          name: 'harmony',
          type: 'number',
          min: 0,
          max: 1,
          defaultValue: 0.5,
        },
      ],
    },

    // History
    {
      name: 'foundedDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'founder',
      type: 'relationship',
      relationTo: ['bots', 'bot-identity'],
      label: 'Founder',
      admin: {
        description: 'The bot who founded this territory, or leave empty if ancient',
      },
    },
    {
      name: 'foundingStory',
      type: 'richText',
      label: 'Founding Story',
      admin: {
        description: 'The narrative of how this territory was founded',
      },
    },

    // Historical Events
    {
      name: 'historicalEvents',
      type: 'relationship',
      relationTo: 'events',
      hasMany: true,
      label: 'Historical Events',
      admin: {
        description: 'Major events that happened in this territory',
      },
    },

    // Metadata
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this territory is currently active and inhabited',
      },
    },
  ],
  timestamps: true,
}
