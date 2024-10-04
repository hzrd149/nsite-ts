import { LitElement, html, css } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "./components/nsite-card.js";
import { pool, relays } from "./pool.js";

export class NsiteApp extends LitElement {
  static properties = {
    selected: { state: true },
    status: { state: true, type: String },
    sites: { state: true, type: Array },
  };

  static styles = css`
    .sites {
      display: flex;
      gap: 0.5em;
      flex-wrap: wrap;
    }
  `;

  seen = new Set();
  constructor() {
    super();
    this.sites = [];
  }

  connectedCallback() {
    super.connectedCallback();

    pool.subscribeMany(relays, [{ kinds: [34128], "#d": ["/index.html"] }], {
      onevent: (event) => {
        if (this.seen.has(event.pubkey)) return;
        this.seen.add(event.pubkey);

        this.sites = [...this.sites, event].sort((a, b) => b.created_at - a.created_at);
      },
    });
  }

  render() {
    return html`<div class="container">
      <img src="/logo.jpg" style="max-height: 2in" />
      <h1>nsite</h1>
      <a class="navbar-item" href="https://github.com/hzrd149/nsite-ts" target="_blank">Source Code</a>

      <h2 class="subtitle is-2">Latest nsites:</h2>
      <div class="sites">
        ${repeat(
          this.sites,
          (nsite) => nsite.pubkey,
          (nsite) => html`<nsite-card .nsite="${nsite}"></nsite-card>`,
        )}
      </div>
    </div>`;
  }
}

customElements.define("nsite-app", NsiteApp);
