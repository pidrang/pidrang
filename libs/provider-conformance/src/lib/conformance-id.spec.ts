import { conformanceId } from './conformance-id';

describe('conformanceId', () => {
  it.each([
    [1, '00000000-0000-4000-8000-000000000001'],
    [10, '00000000-0000-4000-8000-000000000010'],
    [255, '00000000-0000-4000-8000-000000000255'],
  ])('gives row %i a 12-digit last group', (n, id) => {
    expect(conformanceId(n)).toBe(id);
  });
});
