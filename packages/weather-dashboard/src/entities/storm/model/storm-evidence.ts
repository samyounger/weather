const MET = 'https://www.metoffice.gov.uk';
const NEWS = MET + '/about-us/news-and-media/media-centre/weather-and-climate-news/2025/';
export const stormSources = [
  {
    id: 'report', title: 'Storm Éowyn — official event report', publisher: 'Met Office',
    published: 'January 2025 report (retrospective; exact publication date not stated)',
    url: MET + '/binaries/content/assets/metofficegovuk/pdf/weather/learn-about/uk-past-events/interesting/2025/2025_02_storm_eowyn.pdf',
  },
  {
    id: 'naming', title: 'Storm Éowyn named', publisher: 'Met Office',
    published: '21 January 2025, 12:16 UTC',
    url: NEWS + 'storm-eowyn-named-as-strong-winds-heavy-rain-and-snow-forecast',
  },
  {
    id: 'forecast', title: 'Red warnings and regional forecast', publisher: 'Met Office',
    published: '23 January 2025, 10:12 UTC',
    url: NEWS + 'red-weather-warnings-issued-with-damaging-winds-forecast-for-storm-eowyn',
  },
  {
    id: 'alert', title: 'Historical emergency alert — Scottish Borders included', publisher: 'UK and Scottish Governments',
    published: '23 January 2025, 17:50 UTC',
    url: 'https://www.gov.uk/alerts/23-jan-2025-2',
  },
  {
    id: 'review', title: 'A look back on Storm Éowyn', publisher: 'Met Office',
    published: '31 January 2025 (retrospective)',
    url: MET + '/blog/2025/a-look-back-on-storm-eowyn',
  },
] as const;

export const stormMilestones = [
  {
    date: '20 January 2025', title: 'Warnings before formation',
    text: 'The later Met Office review dates the first warnings to 20 January, before the storm existed as a distinct Atlantic system.',
    source: 'review',
  },
  {
    date: '21 January, 12:16 UTC', title: 'Named before it formed',
    text: 'The published forecast named Éowyn and anticipated gusts above 80 mph at exposed sites. Naming is not the time of physical formation.',
    source: 'naming',
  },
  {
    date: '23 January → 24 January, 00:00 UTC', title: 'Rapid Atlantic development',
    text: 'The official report describes central pressure falling from 991 to 941 hPa in 24 hours, under a powerful jet stream. Exact formation coordinates and time are not established here.',
    source: 'report',
  },
  {
    date: '24 January, 06:00 UTC', title: 'Off County Donegal',
    text: 'The analysed storm centre was off the coast of County Donegal. The report describes a north-easterly track.',
    source: 'report',
  },
  {
    date: '24 January, 08:00 UTC', title: 'Across Argyll',
    text: 'The report’s radar account places the centre over Argyll. Its regional passage is separate from the local peak at your station.',
    source: 'report',
  },
  {
    date: '24 January', title: 'Northern Scotland and the North Sea',
    text: 'Satellite imagery shows the low over northern Scotland, with fronts clearing into the North Sea. This does not establish when the whole storm dissipated.',
    source: 'report',
  },
  {
    date: 'Beyond the report’s coverage', title: 'Final dissipation unknown',
    text: 'The selected sources do not establish the storm’s final end time or position. Local easing is not proof that the storm had ended everywhere.',
    source: 'report',
  },
] as const;

export const sourceFor = (id: string) => stormSources.find((source) => source.id === id)!;
