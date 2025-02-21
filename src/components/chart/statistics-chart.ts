import type {
  ChartData,
  ChartDataset,
  ChartOptions,
  ChartType,
} from "chart.js";
import type { CSSResultGroup, PropertyValues, TemplateResult } from "lit";
import { css, html, LitElement } from "lit";
import { customElement, property, state, query } from "lit/decorators";
import memoizeOne from "memoize-one";
import { getGraphColorByIndex } from "../../common/color/colors";
import { isComponentLoaded } from "../../common/config/is_component_loaded";
import { fireEvent } from "../../common/dom/fire_event";
import {
  formatNumber,
  numberFormatToLocale,
  getNumberFormatOptions,
} from "../../common/number/format_number";
import type {
  Statistics,
  StatisticsMetaData,
  StatisticType,
} from "../../data/recorder";
import {
  getDisplayUnit,
  getStatisticLabel,
  getStatisticMetadata,
  isExternalStatistic,
  statisticsHaveType,
} from "../../data/recorder";
import type { HomeAssistant } from "../../types";
import "./ha-chart-base";
import type {
  ChartResizeOptions,
  ChartDatasetExtra,
  HaChartBase,
} from "./ha-chart-base";
import { clickIsTouch } from "./click_is_touch";

export const supportedStatTypeMap: Record<StatisticType, StatisticType> = {
  mean: "mean",
  min: "min",
  max: "max",
  sum: "sum",
  state: "sum",
  change: "sum",
};

@customElement("statistics-chart")
export class StatisticsChart extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public statisticsData?: Statistics;

  @property({ attribute: false }) public metadata?: Record<
    string,
    StatisticsMetaData
  >;

  @property({ attribute: false }) public names?: Record<string, string>;

  @property() public unit?: string;

  @property({ attribute: false }) public endTime?: Date;

  @property({ attribute: false, type: Array })
  public statTypes: Array<StatisticType> = ["sum", "min", "mean", "max"];

  @property({ attribute: false }) public chartType: ChartType = "line";

  @property({ attribute: false, type: Number }) public minYAxis?: number;

  @property({ attribute: false, type: Number }) public maxYAxis?: number;

  @property({ attribute: false, type: Boolean }) public fitYData = false;

  @property({ attribute: false, type: Boolean }) public hideLegend = false;

  @property({ attribute: false, type: Boolean }) public logarithmicScale =
    false;

  @property({ attribute: false, type: Boolean }) public isLoadingData = false;

  @property({ attribute: false, type: Boolean }) public clickForMoreInfo = true;

  @property() public period?: string;

  @state() private _chartData: ChartData = { datasets: [] };

  @state() private _chartDatasetExtra: ChartDatasetExtra[] = [];

  @state() private _statisticIds: string[] = [];

  @state() private _chartOptions?: ChartOptions;

  @state() private _hiddenStats = new Set<string>();

  @query("ha-chart-base") private _chart?: HaChartBase;

  private _computedStyle?: CSSStyleDeclaration;

  public resize = (options?: ChartResizeOptions): void => {
    this._chart?.resize(options);
  };

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    return changedProps.size > 1 || !changedProps.has("hass");
  }

  public willUpdate(changedProps: PropertyValues) {
    if (changedProps.has("legendMode")) {
      this._hiddenStats.clear();
    }
    if (
      !this.hasUpdated ||
      changedProps.has("unit") ||
      changedProps.has("period") ||
      changedProps.has("chartType") ||
      changedProps.has("minYAxis") ||
      changedProps.has("maxYAxis") ||
      changedProps.has("fitYData") ||
      changedProps.has("logarithmicScale") ||
      changedProps.has("hideLegend")
    ) {
      this._createOptions();
    }
    if (
      changedProps.has("statisticsData") ||
      changedProps.has("statTypes") ||
      changedProps.has("chartType") ||
      changedProps.has("hideLegend") ||
      changedProps.has("_hiddenStats")
    ) {
      this._generateData();
    }
  }

  public firstUpdated() {
    this._computedStyle = getComputedStyle(this);
  }

  protected render(): TemplateResult {
    if (!isComponentLoaded(this.hass, "history")) {
      return html`<div class="info">
        ${this.hass.localize("ui.components.history_charts.history_disabled")}
      </div>`;
    }

    if (this.isLoadingData && !this.statisticsData) {
      return html`<div class="info">
        ${this.hass.localize(
          "ui.components.statistics_charts.loading_statistics"
        )}
      </div>`;
    }

    if (!this.statisticsData || !Object.keys(this.statisticsData).length) {
      return html`<div class="info">
        ${this.hass.localize(
          "ui.components.statistics_charts.no_statistics_found"
        )}
      </div>`;
    }

    return html`
      <ha-chart-base
        externalHidden
        .hass=${this.hass}
        .data=${this._chartData}
        .extraData=${this._chartDatasetExtra}
        .options=${this._chartOptions}
        .chartType=${this.chartType}
        @dataset-hidden=${this._datasetHidden}
        @dataset-unhidden=${this._datasetUnhidden}
      ></ha-chart-base>
    `;
  }

  private _datasetHidden(ev) {
    ev.stopPropagation();
    this._hiddenStats.add(this._statisticIds[ev.detail.index]);
    this.requestUpdate("_hiddenStats");
  }

  private _datasetUnhidden(ev) {
    ev.stopPropagation();
    this._hiddenStats.delete(this._statisticIds[ev.detail.index]);
    this.requestUpdate("_hiddenStats");
  }

  private _createOptions(unit?: string) {
    this._chartOptions = {
      parsing: false,
      animation: false,
      interaction: {
        mode: "nearest",
        axis: "x",
      },
      scales: {
        x: {
          type: "time",
          adapters: {
            date: {
              locale: this.hass.locale,
              config: this.hass.config,
            },
          },
          ticks: {
            source: this.chartType === "bar" ? "data" : undefined,
            maxRotation: 0,
            sampleSize: 5,
            autoSkipPadding: 20,
            major: {
              enabled: true,
            },
            font: (context) =>
              context.tick && context.tick.major
                ? ({ weight: "bold" } as any)
                : {},
          },
          time: {
            tooltipFormat: "datetime",
            unit:
              this.chartType === "bar" &&
              this.period &&
              ["hour", "day", "week", "month"].includes(this.period)
                ? this.period
                : undefined,
          },
        },
        y: {
          beginAtZero: this.chartType === "bar",
          ticks: {
            maxTicksLimit: 7,
          },
          title: {
            display: unit || this.unit,
            text: unit || this.unit,
          },
          type: this.logarithmicScale ? "logarithmic" : "linear",
          min: this.fitYData ? null : this.minYAxis,
          max: this.fitYData ? null : this.maxYAxis,
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.dataset.label}: ${formatNumber(
                context.parsed.y,
                this.hass.locale,
                getNumberFormatOptions(
                  undefined,
                  this.hass.entities[this._statisticIds[context.datasetIndex]]
                )
              )} ${
                // @ts-ignore
                context.dataset.unit || ""
              }`,
          },
        },
        filler: {
          propagate: true,
        },
        legend: {
          display: !this.hideLegend,
          labels: {
            usePointStyle: true,
          },
        },
      },
      elements: {
        line: {
          tension: 0.4,
          cubicInterpolationMode: "monotone",
          borderWidth: 1.5,
        },
        bar: { borderWidth: 1.5, borderRadius: 4 },
        point: {
          hitRadius: 50,
        },
      },
      // @ts-expect-error
      locale: numberFormatToLocale(this.hass.locale),
      onClick: (e: any) => {
        if (!this.clickForMoreInfo || clickIsTouch(e)) {
          return;
        }

        const chart = e.chart;

        const points = chart.getElementsAtEventForMode(
          e,
          "nearest",
          { intersect: true },
          true
        );

        if (points.length) {
          const firstPoint = points[0];
          const statisticId = this._statisticIds[firstPoint.datasetIndex];
          if (!isExternalStatistic(statisticId)) {
            fireEvent(this, "hass-more-info", { entityId: statisticId });
            chart.canvas.dispatchEvent(new Event("mouseout")); // to hide tooltip
          }
        }
      },
    };
  }

  private _getStatisticsMetaData = memoizeOne(
    async (statisticIds: string[] | undefined) => {
      const statsMetadataArray = await getStatisticMetadata(
        this.hass,
        statisticIds
      );
      const statisticsMetaData = {};
      statsMetadataArray.forEach((x) => {
        statisticsMetaData[x.statistic_id] = x;
      });
      return statisticsMetaData;
    }
  );

  private async _generateData() {
    if (!this.statisticsData) {
      return;
    }

    const statisticsMetaData =
      this.metadata ||
      (await this._getStatisticsMetaData(Object.keys(this.statisticsData)));

    let colorIndex = 0;
    const statisticsData = Object.entries(this.statisticsData);
    const totalDataSets: ChartDataset<"line">[] = [];
    const totalDatasetExtras: ChartDatasetExtra[] = [];
    const statisticIds: string[] = [];
    let endTime: Date;

    if (statisticsData.length === 0) {
      return;
    }

    endTime =
      this.endTime ||
      // Get the highest date from the last date of each statistic
      new Date(
        Math.max(
          ...statisticsData.map(([_, stats]) =>
            new Date(stats[stats.length - 1].start).getTime()
          )
        )
      );

    if (endTime > new Date()) {
      endTime = new Date();
    }

    let unit: string | undefined | null;

    const names = this.names || {};
    statisticsData.forEach(([statistic_id, stats]) => {
      const meta = statisticsMetaData?.[statistic_id];
      let name = names[statistic_id];
      if (name === undefined) {
        name = getStatisticLabel(this.hass, statistic_id, meta);
      }

      if (!this.unit) {
        if (unit === undefined) {
          unit = getDisplayUnit(this.hass, statistic_id, meta);
        } else if (
          unit !== null &&
          unit !== getDisplayUnit(this.hass, statistic_id, meta)
        ) {
          // Clear unit if not all statistics have same unit
          unit = null;
        }
      }

      // array containing [value1, value2, etc]
      let prevValues: Array<number | null> | null = null;
      let prevEndTime: Date | undefined;

      // The datasets for the current statistic
      const statDataSets: ChartDataset<"line">[] = [];
      const statDatasetExtras: ChartDatasetExtra[] = [];

      const pushData = (
        start: Date,
        end: Date,
        dataValues: Array<number | null> | null
      ) => {
        if (!dataValues) return;
        if (start > end) {
          // Drop data points that are after the requested endTime. This could happen if
          // endTime is "now" and client time is not in sync with server time.
          return;
        }
        statDataSets.forEach((d, i) => {
          if (
            this.chartType === "line" &&
            prevEndTime &&
            prevValues &&
            prevEndTime.getTime() !== start.getTime()
          ) {
            // if the end of the previous data doesn't match the start of the current data,
            // we have to draw a gap so add a value at the end time, and then an empty value.
            d.data.push({ x: prevEndTime.getTime(), y: prevValues[i]! });
            // @ts-expect-error
            d.data.push({ x: prevEndTime.getTime(), y: null });
          }
          d.data.push({ x: start.getTime(), y: dataValues[i]! });
        });
        prevValues = dataValues;
        prevEndTime = end;
      };

      const color = getGraphColorByIndex(
        colorIndex,
        this._computedStyle || getComputedStyle(this)
      );
      colorIndex++;

      const statTypes: this["statTypes"] = [];

      const hasMean =
        this.statTypes.includes("mean") && statisticsHaveType(stats, "mean");
      const drawBands =
        hasMean ||
        (this.statTypes.includes("min") &&
          statisticsHaveType(stats, "min") &&
          this.statTypes.includes("max") &&
          statisticsHaveType(stats, "max"));

      const sortedTypes = drawBands
        ? [...this.statTypes].sort((a, b) => {
            if (a === "min" || b === "max") {
              return -1;
            }
            if (a === "max" || b === "min") {
              return +1;
            }
            return 0;
          })
        : this.statTypes;

      let displayed_legend = false;
      sortedTypes.forEach((type) => {
        if (statisticsHaveType(stats, type)) {
          const band = drawBands && (type === "min" || type === "max");
          if (!this.hideLegend) {
            const show_legend = hasMean
              ? type === "mean"
              : displayed_legend === false;
            statDatasetExtras.push({
              legend_label: name,
              show_legend,
            });
            displayed_legend = displayed_legend || show_legend;
          }
          statTypes.push(type);
          statDataSets.push({
            label: name
              ? `${name} (${this.hass.localize(
                  `ui.components.statistics_charts.statistic_types.${type}`
                )})
            `
              : this.hass.localize(
                  `ui.components.statistics_charts.statistic_types.${type}`
                ),
            fill: drawBands
              ? type === "min" && hasMean
                ? "+1"
                : type === "max"
                  ? "-1"
                  : false
              : false,
            borderColor:
              band && hasMean ? color + (this.hideLegend ? "00" : "7F") : color,
            backgroundColor: band ? color + "3F" : color + "7F",
            pointRadius: 0,
            hidden: !this.hideLegend
              ? this._hiddenStats.has(statistic_id)
              : false,
            data: [],
            // @ts-ignore
            unit: meta?.unit_of_measurement,
            band,
          });
          statisticIds.push(statistic_id);
        }
      });

      let prevDate: Date | null = null;
      // Process chart data.
      let firstSum: number | null | undefined = null;
      stats.forEach((stat) => {
        const startDate = new Date(stat.start);
        if (prevDate === startDate) {
          return;
        }
        prevDate = startDate;
        const dataValues: Array<number | null> = [];
        statTypes.forEach((type) => {
          let val: number | null | undefined;
          if (type === "sum") {
            if (firstSum === null || firstSum === undefined) {
              val = 0;
              firstSum = stat.sum;
            } else {
              val = (stat.sum || 0) - firstSum;
            }
          } else {
            val = stat[type];
          }
          dataValues.push(val ?? null);
        });
        pushData(startDate, new Date(stat.end), dataValues);
      });

      // Concat two arrays
      Array.prototype.push.apply(totalDataSets, statDataSets);
      Array.prototype.push.apply(totalDatasetExtras, statDatasetExtras);
    });

    if (unit) {
      this._createOptions(unit);
    }

    this._chartData = {
      datasets: totalDataSets,
    };
    this._chartDatasetExtra = totalDatasetExtras;
    this._statisticIds = statisticIds;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
        min-height: 60px;
      }
      .info {
        text-align: center;
        line-height: 60px;
        color: var(--secondary-text-color);
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "statistics-chart": StatisticsChart;
  }
}
