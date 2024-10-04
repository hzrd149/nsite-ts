import { html, css, LitElement } from "lit";
import { nip19 } from "nostr-tools";
import { pool, relays } from "../pool.js";

export class NsiteCard extends LitElement {
  static styles = css`
    :host {
      min-width: 3in;
      max-width: 4in;
      border: 1px solid lightslategray;
      display: flex;
      flex-direction: column;
      padding: 0.5em;
      gap: 0.3em;
      border-radius: 0.5em;
    }

    .title {
      display: flex;
      gap: 0.5em;
      align-items: center;
      color: initial;
      text-decoration: none;
    }
    .title h3 {
      margin: 0;
    }
    .avatar {
      width: 3rem;
      height: 3rem;
      border: none;
      outline: none;
      border-radius: 50%;
    }

    .thumb {
      display: flex;
      overflow: hidden;
    }

    .thumb > img {
      width: 100%;
      border-radius: 0.5em;
    }

    .about {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    time {
      margin-top: auto;
    }
  `;

  static properties = {
    nsite: { type: Object },
    profile: { state: true, type: Object },
  };

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();

    pool.get(relays, { kinds: [0], authors: [this.nsite.pubkey] }).then((event) => {
      if (event) this.profile = JSON.parse(event.content);
    });
  }

  render() {
    const npub = nip19.npubEncode(this.nsite.pubkey);
    const url = new URL("/", `${location.protocol}//${npub}.${location.host}`);

    return html`
      <a class="thumb" href="${url}" target="_blank">
        <img src="/screenshot/${this.nsite.pubkey}.png" />
      </a>
      <a class="title" href="${url}" target="_blank">
        ${this.profile && html`<img src="${this.profile.image || this.profile.picture}" class="avatar" />`}
        <div>
          ${this.profile
            ? html`
                <h3>${this.profile.display_name || this.profile.name}</h3>
                <small>${this.profile.nip05}</small>
              `
            : html`<h3>${npub.slice(0, 8)}</h3>`}
        </div>
      </a>
      ${this.profile && html`<p class="about">${this.profile.about}</p>`}
      <time>${new Date(this.nsite.created_at * 1000).toDateString()}</time>
    `;
  }
}

customElements.define("nsite-card", NsiteCard);
