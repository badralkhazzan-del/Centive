// Chart colors, validated with the dataviz palette checker (light surface):
// lightness band, chroma floor, adjacent CVD separation and normal-vision floor all
// pass. Light hues sit below 3:1 contrast, so every chart ships a legend, a tooltip
// and a table view (relief rule). Text never uses these colors.

export const STRATEGY_COLORS = { baseline: "#4a3aa7", piringtani: "#13804c" } as const;

/** Fixed categorical order, never cycled. A series past slot 7 folds into "Other". */
export const CATEGORICAL = ["#13804c", "#eda100", "#2a78d6", "#e87ba4", "#4a3aa7", "#eb6834", "#1baf7a"] as const;
export const OTHER_COLOR = "#a9a59b";

export const CHART_GRID = "#e4dfd3";
export const CHART_AXIS_TEXT = "#5b6b63";
export const CHART_SURFACE = "#ffffff";

/** Legend text uses text tokens (never the series color); series keep their given order. */
export const legendText = (value: string) => <span style={{ color: CHART_AXIS_TEXT, fontSize: 13 }}>{value}</span>;
