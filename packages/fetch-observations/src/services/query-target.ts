export type QueryTarget = {
  tableName: string;
  timestampColumn: string;
  defaultFields: string[];
  allowedFields: Set<string>;
};

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
  tableName: 'observations',
  timestampColumn: 'datetime',
  defaultFields: OBSERVATIONS_DEFAULT_FIELDS,
  allowedFields: new Set(OBSERVATION_FIELDS),
};

export const REFINED_QUERY_TARGET: QueryTarget = {
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

  return undefined;
};
