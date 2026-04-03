export type QueryTarget = {
  routeName: 'observations' | 'refined' | 'series';
  tableName: string;
  timestampColumn: string;
  defaultFields: string[];
  allowedFields: Set<string>;
  maxRangeMs?: number;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const OBSERVATION_FIELDS = [
  'deviceid',
  'datetime',
  'windlull',
  'windavg',
  'windgust',
  'winddirection',
  'windsampleinterval',
  'pressure',
  'airtemperature',
  'relativehumidity',
  'illuminance',
  'uv',
  'solarradiation',
  'rainaccumulation',
  'precipitationtype',
  'avgstrikedistance',
  'strikecount',
  'battery',
  'reportinterval',
  'localdayrainaccumulation',
  'ncrainaccumulation',
  'localdayncrainaccumulation',
  'precipitationanalysis',
  'year',
  'month',
  'day',
  'hour',
];

const OBSERVATIONS_DEFAULT_FIELDS = ['datetime', 'winddirection', 'windavg', 'windgust', 'airtemperature', 'relativehumidity', 'rainaccumulation'];

const REFINED_FIELDS = [
  'period_start',
  'winddirection_avg',
  'windavg_avg',
  'windgust_max',
  'pressure_avg',
  'airtemperature_avg',
  'relativehumidity_avg',
  'rainaccumulation_sum',
  'uv_avg',
  'solarradiation_avg',
  'sample_count',
  'year',
  'month',
  'day',
  'hour',
];

const REFINED_DEFAULT_FIELDS = [
  'period_start',
  'winddirection_avg',
  'windavg_avg',
  'windgust_max',
  'airtemperature_avg',
  'relativehumidity_avg',
  'rainaccumulation_sum',
];

export const OBSERVATIONS_QUERY_TARGET: QueryTarget = {
  routeName: 'observations',
  tableName: 'observations',
  timestampColumn: 'datetime',
  defaultFields: OBSERVATIONS_DEFAULT_FIELDS,
  allowedFields: new Set(OBSERVATION_FIELDS),
  maxRangeMs: SEVEN_DAYS_MS,
};

export const REFINED_QUERY_TARGET: QueryTarget = {
  routeName: 'refined',
  tableName: 'observations_refined_15m',
  timestampColumn: 'period_start',
  defaultFields: REFINED_DEFAULT_FIELDS,
  allowedFields: new Set(REFINED_FIELDS),
  maxRangeMs: SEVEN_DAYS_MS,
};

export const SERIES_QUERY_TARGET: QueryTarget = {
  routeName: 'series',
  tableName: 'observations_refined_15m',
  timestampColumn: 'period_start',
  defaultFields: REFINED_DEFAULT_FIELDS,
  allowedFields: new Set(REFINED_FIELDS),
};

export const getQueryTargetFromPath = (path?: string): QueryTarget | undefined => {
  const normalizedPath = !path || path === '/' ? '/' : path.replace(/\/+$/, '');

  if (normalizedPath === '/' || normalizedPath === '/observations') {
    return OBSERVATIONS_QUERY_TARGET;
  }

  if (normalizedPath === '/refined') {
    return REFINED_QUERY_TARGET;
  }

  if (normalizedPath === '/series') {
    return SERIES_QUERY_TARGET;
  }

  return undefined;
};
