import { conformanceId } from './conformance-id';
import { ConformanceRow } from './conformance-row';

export const CONFORMANCE_ROWS: readonly ConformanceRow[] = [
  {
    id: conformanceId(1),
    name: 'Keyboard',
    price: 50,
    in_stock: true,
    note: 'mechanical',
  },
  {
    id: conformanceId(2),
    name: 'Mouse',
    price: 20,
    in_stock: true,
    note: null,
  },
  {
    id: conformanceId(4),
    name: '100% cotton cover',
    price: 10,
    in_stock: true,
    note: null,
  },
  {
    id: conformanceId(3),
    name: 'USB mouse pad',
    price: 10,
    in_stock: false,
    note: 'MOUSE accessory',
  },
  {
    id: conformanceId(5),
    name: 'snake_case sticker',
    price: 2,
    in_stock: false,
    note: 'sticker',
  },
  {
    id: conformanceId(6),
    name: 'Monitor',
    price: 200,
    in_stock: true,
    note: 'display',
  },
  {
    id: conformanceId(7),
    name: 'Cable, "USB-C"',
    price: 5,
    in_stock: true,
    note: 'cable',
  },
];
