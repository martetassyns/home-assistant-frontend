import { LitElement, css, html } from "lit";
import { customElement, property, query, state } from "lit/decorators";
import { fireEvent } from "../../../common/dom/fire_event";
import { navigate } from "../../../common/navigate";
import "../../../components/ha-alert";
import "../../../components/ha-button";
import "../../../components/ha-password-field";
import type { HaPasswordField } from "../../../components/ha-password-field";
import "../../../components/ha-svg-icon";
import "../../../components/ha-textfield";
import type { HaTextField } from "../../../components/ha-textfield";
import { cloudLogin } from "../../../data/cloud";
import type { HomeAssistant } from "../../../types";
import { showAlertDialog } from "../../generic/show-dialog-box";
import { AssistantSetupStyles } from "../styles";

@customElement("cloud-step-signin")
export class CloudStepSignin extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _requestInProgress = false;

  @state() private _error?: string;

  @query("#email", true) private _emailField!: HaTextField;

  @query("#password", true) private _passwordField!: HaPasswordField;

  render() {
    return html`<div class="content">
        <img
          src=${`/static/images/logo_nabu_casa${this.hass.themes?.darkMode ? "_dark" : ""}.png`}
          alt="Nabu Casa logo"
        />
        <h1>Sign in</h1>
        ${this._error
          ? html`<ha-alert alert-type="error">${this._error}</ha-alert>`
          : ""}
        <ha-textfield
          autofocus
          id="email"
          name="email"
          .label=${this.hass.localize(
            "ui.panel.config.cloud.register.email_address"
          )}
          .disabled=${this._requestInProgress}
          type="email"
          autocomplete="email"
          required
          @keydown=${this._keyDown}
          validationMessage=${this.hass.localize(
            "ui.panel.config.cloud.register.email_error_msg"
          )}
        ></ha-textfield>
        <ha-password-field
          id="password"
          name="password"
          .label=${this.hass.localize(
            "ui.panel.config.cloud.register.password"
          )}
          .disabled=${this._requestInProgress}
          autocomplete="new-password"
          minlength="8"
          required
          @keydown=${this._keyDown}
          validationMessage=${this.hass.localize(
            "ui.panel.config.cloud.register.password_error_msg"
          )}
        ></ha-password-field>
      </div>
      <div class="footer">
        <ha-button
          unelevated
          @click=${this._handleLogin}
          .disabled=${this._requestInProgress}
          >Sign in</ha-button
        >
      </div>`;
  }

  private _keyDown(ev: KeyboardEvent) {
    if (ev.key === "Enter") {
      this._handleLogin();
    }
  }

  private async _handleLogin() {
    const emailField = this._emailField;
    const passwordField = this._passwordField;

    const email = emailField.value;
    const password = passwordField.value;

    if (!emailField.reportValidity()) {
      passwordField.reportValidity();
      emailField.focus();
      return;
    }

    if (!passwordField.reportValidity()) {
      passwordField.focus();
      return;
    }

    this._requestInProgress = true;

    const doLogin = async (username: string) => {
      try {
        await cloudLogin(this.hass, username, password);
      } catch (err: any) {
        const errCode = err && err.body && err.body.code;

        if (errCode === "usernotfound" && username !== username.toLowerCase()) {
          await doLogin(username.toLowerCase());
          return;
        }

        if (errCode === "PasswordChangeRequired") {
          showAlertDialog(this, {
            title: this.hass.localize(
              "ui.panel.config.cloud.login.alert_password_change_required"
            ),
          });
          navigate("/config/cloud/forgot-password");
          fireEvent(this, "closed");
          return;
        }

        this._requestInProgress = false;

        if (errCode === "UserNotConfirmed") {
          this._error = this.hass.localize(
            "ui.panel.config.cloud.login.alert_email_confirm_necessary"
          );
        } else {
          this._error =
            err && err.body && err.body.message
              ? err.body.message
              : "Unknown error";
        }

        emailField.focus();
      }
    };

    await doLogin(email);
  }

  static styles = [
    AssistantSetupStyles,
    css`
      :host {
        display: block;
      }
      ha-textfield,
      ha-password-field {
        display: block;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "cloud-step-signin": CloudStepSignin;
  }
}
