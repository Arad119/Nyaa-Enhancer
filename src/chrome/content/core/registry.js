let features = [];

export function setFeatures(list) {
  features = list;
}

export function getFeatures() {
  return features;
}

export async function handleSettingChange(setting, value) {
  for (const feature of features) {
    await feature.onSettingChanged?.(setting, value);
  }
}

export async function dispatchTableMutated(mutations) {
  for (const feature of features) {
    await feature.onTableMutated?.(mutations);
  }
}
