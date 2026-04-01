export const getPresetRange = (preset: '24h' | '72h' | '7d') => {
  const to = new Date();
  const hours = preset === '24h' ? 24 : preset === '72h' ? 72 : 168;
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

  return { from, to };
};
