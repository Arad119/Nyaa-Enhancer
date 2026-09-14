let features = [];

export function setFeatures(list) {
  features = list;
}

export function getFeatures() {
  return features;
}

export async function dispatchFeatureHook(hookName, run) {
  for (const feature of features) {
    try {
      await run(feature);
    } catch (error) {
      console.error(
        `[Nyaa Enhancer] ${hookName} failed for feature "${feature.id || "unknown"}".`,
        error,
      );
    }
  }
}

export async function handleSettingChange(setting, value) {
  await dispatchFeatureHook("onSettingChanged", (feature) =>
    feature.onSettingChanged?.(setting, value),
  );
}

export async function dispatchTableMutated(mutations) {
  await dispatchFeatureHook("onTableMutated", (feature) =>
    feature.onTableMutated?.(mutations),
  );
}
