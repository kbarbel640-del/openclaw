import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { icons } from "../icons.ts";
import { toSanitizedMarkdownHtml } from "../markdown.ts";

export type SidebarImage = {
  url: string;
  alt?: string;
};

export type MarkdownSidebarProps = {
  content: string | null;
  images?: SidebarImage[];
  error: string | null;
  onClose: () => void;
  onViewRawText: () => void;
};

function renderSidebarImages(images: SidebarImage[]) {
  if (images.length === 0) {
    return nothing;
  }
  return html`
    <div class="sidebar-images">
      ${images.map(
        (img) => html`
          <img
            src=${img.url}
            alt=${img.alt ?? "Tool output image"}
            class="sidebar-image"
            @click=${() => window.open(img.url, "_blank")}
          />
        `,
      )}
    </div>
  `;
}

export function renderMarkdownSidebar(props: MarkdownSidebarProps) {
  const hasImages = Boolean(props.images?.length);
  const hasContent = Boolean(props.content?.trim());
  const hasAnything = hasImages || hasContent;

  return html`
    <div class="sidebar-panel">
      <div class="sidebar-header">
        <div class="sidebar-title">Tool Output</div>
        <button @click=${props.onClose} class="btn" title="Close sidebar">
          ${icons.x}
        </button>
      </div>
      <div class="sidebar-content">
        ${
          props.error
            ? html`
              <div class="callout danger">${props.error}</div>
              <button @click=${props.onViewRawText} class="btn" style="margin-top: 12px;">
                View Raw Text
              </button>
            `
            : hasAnything
              ? html`
                  ${hasImages ? renderSidebarImages(props.images!) : nothing}
                  ${hasContent ? html`<div class="sidebar-markdown">${unsafeHTML(toSanitizedMarkdownHtml(props.content!))}</div>` : nothing}
                `
              : html`
                  <div class="muted">No content available</div>
                `
        }
      </div>
    </div>
  `;
}
