import {
  Check,
  ChevronRight,
  Eye,
  FileCode2,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

import { homepageCopy } from "@/components/marketing/marketing-content";

export function ProductPreview() {
  const { reviewContext } = homepageCopy;

  return (
    <section className="product-preview" aria-labelledby="preview-title">
      <div className="preview-topline">
        <span className="preview-live-dot" aria-hidden="true" />
        <span>Illustrative product preview</span>
        <span className="preview-context">No customer data</span>
      </div>
      <div className="preview-head">
        <div>
          <p className="preview-kicker">Evidence chain</p>
          <h2 id="preview-title">A proof begins with context.</h2>
        </div>
        <span className="preview-code">PRF-0024</span>
      </div>

      <div className="preview-evidence">
        <div className="preview-icon">
          <FileCode2 size={18} aria-hidden="true" />
        </div>
        <div>
          <p className="preview-label">Skill evidence</p>
          <p className="preview-value">{reviewContext.skill}</p>
        </div>
        <span className="preview-status">
          <Check size={14} aria-hidden="true" /> Submitted
        </span>
      </div>

      <div className="preview-path" aria-label="Proof progression">
        <span className="path-node path-node-complete">
          <Check size={12} aria-hidden="true" />
        </span>
        <span className="path-line" />
        <span className="path-node path-node-complete">
          <Check size={12} aria-hidden="true" />
        </span>
        <span className="path-line" />
        <span className="path-node path-node-active">
          <ShieldCheck size={13} aria-hidden="true" />
        </span>
        <span className="path-line path-line-muted" />
        <span className="path-node path-node-next">
          <Eye size={12} aria-hidden="true" />
        </span>
      </div>

      <div className="preview-project">
        <p className="preview-label">Submitted project</p>
        <p className="preview-value">{reviewContext.project}</p>
        <span className="preview-metadata">
          Versioned work · private source access
        </span>
      </div>

      <div className="preview-feedback">
        <MessageSquareText size={18} aria-hidden="true" />
        <div>
          <p className="preview-label">Reviewer feedback</p>
          <p>{reviewContext.feedback}</p>
        </div>
      </div>

      <div className="preview-publishable">
        <div>
          <p className="preview-label">Proof status</p>
          <p className="preview-value">Publishable after a finalized review</p>
        </div>
        <ChevronRight size={20} aria-hidden="true" />
      </div>
      <p className="preview-empty">
        Public proof never exposes private source files by default.
      </p>
    </section>
  );
}
