import { WeatherFieldOption, WeatherRangePreset } from '../../../entities/weather';

type WeatherControlsProps = {
  availableFields: WeatherFieldOption[];
  selectedFields: string[];
  selectedPreset: WeatherRangePreset;
  customFrom: string;
  customTo: string;
  onFieldsChange: (fields: string[]) => void;
  onPresetChange: (preset: WeatherRangePreset) => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
};

export const WeatherControls = ({
  availableFields,
  selectedFields,
  selectedPreset,
  customFrom,
  customTo,
  onFieldsChange,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
}: WeatherControlsProps) => (
  <div className="dashboard-controls">
    <div className="control-row">
      <span>Range</span>
      <select value={selectedPreset} onChange={(event) => onPresetChange(event.target.value as WeatherRangePreset)}>
        <option value="24h">Last 24 hours</option>
        <option value="72h">Last 72 hours</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
        <option value="1y">Last 1 year</option>
        <option value="3y">Last 3 years</option>
        <option value="5y">Last 5 years</option>
        <option value="custom">Custom range</option>
      </select>
    </div>

    {selectedPreset === 'custom' ? (
      <div className="field-grid">
        <label className="control-row">
          <span>From</span>
          <input type="datetime-local" value={customFrom} onChange={(event) => onCustomFromChange(event.target.value)} />
        </label>
        <label className="control-row">
          <span>To</span>
          <input type="datetime-local" value={customTo} onChange={(event) => onCustomToChange(event.target.value)} />
        </label>
      </div>
    ) : null}

    <div className="control-row">
      <span>Fields</span>
      <div className="field-grid">
        {availableFields.map((field) => (
          <label className="field-pill" key={field.key}>
            <input
              type="checkbox"
              checked={selectedFields.includes(field.key)}
              onChange={(event) => {
                if (event.target.checked) {
                  onFieldsChange([...selectedFields, field.key]);
                  return;
                }

                onFieldsChange(selectedFields.filter((selectedField) => selectedField !== field.key));
              }}
            />
            <span>{field.label}</span>
          </label>
        ))}
      </div>
    </div>
  </div>
);
