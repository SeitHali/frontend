import "@material/mwc-button";
import "@polymer/paper-input/paper-input";
import "@polymer/paper-spinner/paper-spinner";
import {
  css,
  CSSResult,
  customElement,
  html,
  LitElement,
  property,
  PropertyValues,
  TemplateResult,
} from "lit-element";
import "../../../components/ha-dialog";
import "../../../components/ha-switch";
import { createAuthForUser } from "../../../data/auth";
import {
  createUser,
  deleteUser,
  SYSTEM_GROUP_ID_ADMIN,
  SYSTEM_GROUP_ID_USER,
  User,
} from "../../../data/user";
import { PolymerChangedEvent } from "../../../polymer-types";
import { haStyleDialog } from "../../../resources/styles";
import { HomeAssistant } from "../../../types";
import { AddUserDialogParams } from "./show-dialog-add-user";

@customElement("dialog-add-user")
export class DialogAddUser extends LitElement {
  @property() public hass!: HomeAssistant;

  @property() private _loading = false;

  // Error message when can't talk to server etc
  @property() private _error?: string;

  @property() private _params?: AddUserDialogParams;

  @property() private _name?: string;

  @property() private _username?: string;

  @property() private _password?: string;

  @property() private _isAdmin?: boolean;

  public showDialog(params: AddUserDialogParams) {
    this._params = params;
    this._name = "";
    this._username = "";
    this._password = "";
    this._isAdmin = false;
    this._error = undefined;
    this._loading = false;
  }

  protected firstUpdated(changedProperties: PropertyValues) {
    super.firstUpdated(changedProperties);
    this.addEventListener("keypress", (ev) => {
      if (ev.keyCode === 13) {
        this._createUser(ev);
      }
    });
  }

  protected render(): TemplateResult {
    if (!this._params) {
      return html``;
    }
    return html`
      <ha-dialog
        open
        @closing=${this._close}
        scrimClickAction
        escapeKeyAction
        .heading=${this.hass.localize("ui.panel.config.users.add_user.caption")}
      >
        <div>
          ${this._error ? html` <div class="error">${this._error}</div> ` : ""}
          <paper-input
            class="name"
            .label=${this.hass.localize("ui.panel.config.users.add_user.name")}
            .value=${this._name}
            required
            auto-validate
            autocapitalize="on"
            error-message="Required"
            @value-changed=${this._nameChanged}
            @blur=${this._maybePopulateUsername}
          ></paper-input>
          <paper-input
            class="username"
            .label=${this.hass.localize(
              "ui.panel.config.users.add_user.username"
            )}
            .value=${this._username}
            required
            auto-validate
            autocapitalize="none"
            @value-changed=${this._usernameChanged}
            error-message="Required"
          ></paper-input>
          <paper-input
            .label=${this.hass.localize(
              "ui.panel.config.users.add_user.password"
            )}
            type="password"
            .value=${this._password}
            required
            auto-validate
            @value-changed=${this._passwordChanged}
            error-message="Required"
          ></paper-input>
          <ha-switch .checked=${this._isAdmin} @change=${this._adminChanged}>
            ${this.hass.localize("ui.panel.config.users.editor.admin")}
          </ha-switch>
          ${!this._isAdmin
            ? html`
                <br />
                The users group is a work in progress. The user will be unable
                to administer the instance via the UI. We're still auditing all
                management API endpoints to ensure that they correctly limit
                access to administrators.
              `
            : ""}
        </div>
        <mwc-button
          slot="secondaryAction"
          @click="${this._close}"
          .disabled=${this._loading}
        >
          ${this.hass!.localize("ui.common.cancel")}
        </mwc-button>
        ${this._loading
          ? html`
              <div slot="primaryAction" class="submit-spinner">
                <paper-spinner active></paper-spinner>
              </div>
            `
          : html`
              <mwc-button
                slot="primaryAction"
                .disabled=${!this._name || !this._username || !this._password}
                @click=${this._createUser}
              >
                ${this.hass.localize("ui.panel.config.users.add_user.create")}
              </mwc-button>
            `}
      </ha-dialog>
    `;
  }

  private _close() {
    this._params = undefined;
  }

  private _maybePopulateUsername() {
    if (this._username || !this._name) {
      return;
    }

    const parts = this._name.split(" ");

    if (parts.length) {
      this._username = parts[0].toLowerCase();
    }
  }

  private _nameChanged(ev: PolymerChangedEvent<string>) {
    this._error = undefined;
    this._name = ev.detail.value;
  }

  private _usernameChanged(ev: PolymerChangedEvent<string>) {
    this._error = undefined;
    this._username = ev.detail.value;
  }

  private _passwordChanged(ev: PolymerChangedEvent<string>) {
    this._error = undefined;
    this._password = ev.detail.value;
  }

  private async _adminChanged(ev): Promise<void> {
    this._isAdmin = ev.target.checked;
  }

  private async _createUser(ev) {
    ev.preventDefault();
    if (!this._name || !this._username || !this._password) {
      return;
    }

    this._loading = true;
    this._error = "";

    let user: User;
    try {
      const userResponse = await createUser(this.hass, this._name, [
        this._isAdmin ? SYSTEM_GROUP_ID_ADMIN : SYSTEM_GROUP_ID_USER,
      ]);
      user = userResponse.user;
    } catch (err) {
      this._loading = false;
      this._error = err.code;
      return;
    }

    try {
      await createAuthForUser(
        this.hass,
        user.id,
        this._username,
        this._password
      );
    } catch (err) {
      await deleteUser(this.hass, user.id);
      this._loading = false;
      this._error = err.code;
      return;
    }

    this._params!.userAddedCallback(user);
    this._close();
  }

  static get styles(): CSSResult[] {
    return [
      haStyleDialog,
      css`
        ha-dialog {
          --mdc-dialog-max-width: 500px;
        }
        ha-switch {
          margin-top: 8px;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "dialog-add-user": DialogAddUser;
  }
}
