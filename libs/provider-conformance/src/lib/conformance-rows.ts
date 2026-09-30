import { ConformanceRow } from './conformance-row';

export const CONFORMANCE_ROWS: readonly ConformanceRow[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Keyboard',
    price: 50,
    in_stock: true,
    note: 'mechanical',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Mouse',
    price: 20,
    in_stock: true,
    note: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'USB mouse pad',
    price: 10,
    in_stock: false,
    note: 'MOUSE accessory',
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    name: '100% cotton cover',
    price: 10,
    in_stock: true,
    note: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    name: 'snake_case sticker',
    price: 2,
    in_stock: false,
    note: 'sticker',
  },
  {
    id: '00000000-0000-4000-8000-000000000006',
    name: 'Monitor',
    price: 200,
    in_stock: true,
    note: 'display',
  },
  {
    id: '00000000-0000-4000-8000-000000000007',
    name: 'Cable, "USB-C"',
    price: 5,
    in_stock: true,
    note: 'cable',
  },
];
