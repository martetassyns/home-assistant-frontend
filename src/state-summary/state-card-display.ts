import type { HassEntity } from "home-assistant-js-websocket";
import type { CSSResultGroup, TemplateResult } from "lit";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import { computeDomain } from "../common/entity/compute_domain";
import "../components/entity/state-info";
import { isUnavailableState } from "../data/entity";
import { SENSOR_DEVICE_CLASS_TIMESTAMP } from "../data/sensor";
import "../panels/lovelace/components/hui-timestamp-display";
import { haStyle } from "../resources/styles";
import type { HomeAssistant } from "../types";

@customElement("state-card-display")
class StateCardDisplay extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public stateObj!: HassEntity;

  @property({ attribute: false, type: Boolean }) public inDialog = false;

  // property used only in CSS
  @property({ type: Boolean, reflect: true }) public rtl = false;

  protected render(): TemplateResult {
    return html`
      <div class="horizontal justified layout">
        <state-info
          .hass=${this.hass}
          .stateObj=${this.stateObj}
          .inDialog=${this.inDialog}
        >
        </state-info>
        <div
          class="state ${classMap({
            "has-unit_of_measurement":
              "unit_of_measurement" in this.stateObj.attributes,
          })}"
        >
          ${computeDomain(this.stateObj.entity_id) === "sensor" &&
          this.stateObj.attributes.device_class ===
            SENSOR_DEVICE_CLASS_TIMESTAMP &&
          !isUnavailableState(this.stateObj.state)
            ? html`<hui-timestamp-display
                .hass=${this.hass}
                .ts=${new Date(this.stateObj.state)}
                format="datetime"
                capitalize
              ></hui-timestamp-display>`
            : this.hass.formatEntityState(this.stateObj)}
        </div>
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return [
      haStyle,
      css`
        state-info {
          flex: 0 1 fit-content;
          min-width: 120px;
        }
        .state {
          color: var(--primary-text-color);
          margin-inline-start: 16px;
          margin-inline-end: initial;
          text-align: var(--float-end, right);
          min-width: 50px;
          flex: 0 1 fit-content;
          word-break: break-word;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .state.has-unit_of_measurement {
          white-space: nowrap;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "state-card-display": StateCardDisplay;
  }
}
