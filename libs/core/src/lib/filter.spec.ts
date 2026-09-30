import { Filter } from './filter';
import { ListParams } from './list-params';
import { rejectUnsupportedFilters } from './reject-unsupported-filters';

type Filters = NonNullable<ListParams['filters']>;

describe('Filter', () => {
  it('accepts one well-typed value per operator', () => {
    expectTypeOf<{
      field: string;
      operator: 'eq';
      value: string;
    }>().toExtend<Filter>();
    expectTypeOf<{
      field: string;
      operator: 'gte';
      value: number;
    }>().toExtend<Filter>();
    expectTypeOf<{
      field: string;
      operator: 'in';
      value: boolean[];
    }>().toExtend<Filter>();
    expectTypeOf<{
      field: string;
      operator: 'contains';
      value: string;
    }>().toExtend<Filter>();
    expectTypeOf<{
      field: string;
      operator: 'null';
      value: boolean;
    }>().toExtend<Filter>();
  });

  it('rejects a value that does not fit its operator', () => {
    expectTypeOf<{
      field: string;
      operator: 'in';
      value: string;
    }>().not.toExtend<Filter>();
    expectTypeOf<{
      field: string;
      operator: 'contains';
      value: number;
    }>().not.toExtend<Filter>();
    expectTypeOf<{
      field: string;
      operator: 'null';
      value: string;
    }>().not.toExtend<Filter>();
    expectTypeOf<{
      field: string;
      operator: 'eq';
      value: null;
    }>().not.toExtend<Filter>();
    expectTypeOf<{
      field: string;
      operator: 'lt';
      value: object;
    }>().not.toExtend<Filter>();
  });

  it('rejects a list of filters holding an ill-typed one', () => {
    expectTypeOf<
      { field: string; operator: 'in'; value: string }[]
    >().not.toExtend<Filters>();
  });

  it('rejects a legacy record value that is not a filter value', () => {
    expectTypeOf<Record<string, Date>>().not.toExtend<Filters>();
    expectTypeOf<Record<string, string[]>>().not.toExtend<Filters>();
    expectTypeOf<
      Record<string, string | number | boolean | null | undefined>
    >().toExtend<Filters>();
  });

  it('rejects a single filter passed without brackets', () => {
    expectTypeOf<{
      field: string;
      operator: 'contains';
      value: string;
    }>().not.toExtend<Filters>();
  });

  it('accepts a readonly list of filters', () => {
    expectTypeOf<readonly Filter[]>().toExtend<Filters>();
  });

  it('lets rejectUnsupportedFilters take the readonly list form', () => {
    expectTypeOf<readonly Filter[]>().toExtend<
      Parameters<typeof rejectUnsupportedFilters>[0]
    >();
  });
});
