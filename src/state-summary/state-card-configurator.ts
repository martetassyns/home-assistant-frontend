import "@material/mwc-button";
import type { HassEntity } from "home-assistant-js-websocket";
import "../components/entity/state-info";
import { customElement, property } from "lit/decorators";
import type { CSSResultGroup, TemplateResult } from "lit";
import { LitElement, css, html, nothing } from "lit";
import type { HomeAssistant } from "../types";
import { haStyle } from "../resources/styles";

@customElement("state-card-configurator")
class StateCardConfigurator extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public stateObj!: HassEntity;

  @property({ attribute: false, type: Boolean }) public inDialog = false;

  protected render(): TemplateResult {
    return html`
      <div class="horizontal justified layout">
        <state-info
          .hass=${this.hass}
          .stateObj=${this.stateObj}
          .inDialog=${this.inDialog}
        ></state-info>
        ${this.inDialog
          ? html`<mwc-button
              >${this.hass.formatEntityState(this.stateObj)}</mwc-button
            >`
          : nothing}
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return [
      haStyle,
      css`
        mwc-button {
          top: 3px;
          height: 37px;
          margin-right: -0.57em;
          margin-inline-end: -0.57em;
          margin-inline-start: initial;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "state-card-configurator": StateCardConfigurator;
  }
}
