import { Resource } from '@pidrang/core';

export const DEMO_RESOURCES: Resource[] = [
  {
    name: 'users',
    fields: [
      { name: 'id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'created_at', label: 'Created at', type: 'date' },
    ],
  },
  {
    name: 'products',
    fields: [
      { name: 'id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'price', type: 'number' },
      { name: 'created_at', label: 'Created at', type: 'date' },
    ],
  },
  {
    name: 'orders',
    fields: [
      { name: 'id', type: 'text' },
      { name: 'user_id', label: 'User', type: 'text' },
      { name: 'total', type: 'number' },
      { name: 'created_at', label: 'Created at', type: 'date' },
    ],
  },
];
