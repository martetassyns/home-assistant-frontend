import "@lrnwebcomponents/simple-tooltip/simple-tooltip";
import type { HassEntity } from "home-assistant-js-websocket";
import type { CSSResultGroup } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators";
import { computeStateName } from "../../common/entity/compute_state_name";
import type { HomeAssistant } from "../../types";
import "../ha-relative-time";
import "./state-badge";

@customElement("state-info")
class StateInfo extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public stateObj?: HassEntity;

  @property({ attribute: false, type: Boolean }) public inDialog = false;

  @property() public color?: string;

  protected render() {
    if (!this.hass || !this.stateObj) {
      return nothing;
    }

    const name = computeStateName(this.stateObj);

    return html`<state-badge
        .hass=${this.hass}
        .stateObj=${this.stateObj}
        .stateColor=${true}
        .color=${this.color}
      ></state-badge>
      <div class="info">
        <div class="name" .title=${name} .inDialog=${this.inDialog}>
          ${name}
        </div>
        ${this.inDialog
          ? html`<div class="time-ago">
              <ha-relative-time
                id="last_changed"
                .hass=${this.hass}
                .datetime=${this.stateObj.last_changed}
                capitalize
              ></ha-relative-time>
              <simple-tooltip animation-delay="0" for="last_changed">
                <div>
                  <div class="row">
                    <span class="column-name">
                      ${this.hass.localize(
                        "ui.dialogs.more_info_control.last_changed"
                      )}:
                    </span>
                    <ha-relative-time
                      .hass=${this.hass}
                      .datetime=${this.stateObj.last_changed}
                      capitalize
                    ></ha-relative-time>
                  </div>
                  <div class="row">
                    <span>
                      ${this.hass.localize(
                        "ui.dialogs.more_info_control.last_updated"
                      )}:
                    </span>
                    <ha-relative-time
                      .hass=${this.hass}
                      .datetime=${this.stateObj.last_updated}
                      capitalize
                    ></ha-relative-time>
                  </div>
                </div>
              </simple-tooltip>
            </div>`
          : html`<div class="extra-info"><slot></slot></div>`}
      </div>`;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        min-width: 120px;
        white-space: nowrap;
        display: flex;
        align-items: center;
      }

      state-badge {
        flex: none;
      }

      .info {
        margin-left: 8px;
        margin-inline-start: 8px;
        margin-inline-end: initial;
        display: flex;
        flex-direction: column;
        justify-content: center;
        height: 100%;
        min-width: 0;
        text-align: var(--float-start);
      }

      .name {
        color: var(--primary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .name[inDialog],
      :host([secondary-line]) .name {
        line-height: 20px;
      }

      .time-ago,
      .extra-info,
      .extra-info > * {
        color: var(--secondary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .row {
        display: flex;
        flex-direction: row;
        flex-wrap: no-wrap;
        width: 100%;
        justify-content: space-between;
        margin: 0 2px 4px 0;
      }

      .row:last-child {
        margin-bottom: 0px;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "state-info": StateInfo;
  }
}
