import { WeatherFieldOption, WeatherDataset } from '../../../entities/weather';

type WeatherControlsProps = {
  availableFields: WeatherFieldOption[];
  selectedDataset: WeatherDataset;
  selectedFields: string[];
  selectedPreset: '24h' | '72h' | '7d';
  onDatasetChange: (dataset: WeatherDataset) => void;
  onFieldsChange: (fields: string[]) => void;
  onPresetChange: (preset: '24h' | '72h' | '7d') => void;
};

export const WeatherControls = ({
  availableFields,
  selectedDataset,
  selectedFields,
  selectedPreset,
  onDatasetChange,
  onFieldsChange,
  onPresetChange,
}: WeatherControlsProps) => (
  <div className="dashboard-controls">
    <div className="control-row">
      <span>Dataset</span>
      <select value={selectedDataset} onChange={(event) => onDatasetChange(event.target.value as WeatherDataset)}>
        <option value="refined">Refined 15 minute</option>
        <option value="raw">Raw observations</option>
      </select>
    </div>

    <div className="control-row">
      <span>Range</span>
      <select value={selectedPreset} onChange={(event) => onPresetChange(event.target.value as '24h' | '72h' | '7d')}>
        <option value="24h">Last 24 hours</option>
        <option value="72h">Last 72 hours</option>
        <option value="7d">Last 7 days</option>
      </select>
    </div>

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
