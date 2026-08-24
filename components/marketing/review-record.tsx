import { Check, FileSearch, ShieldCheck } from "lucide-react";

export function ReviewRecord() {
  return (
    <aside className="review-record" aria-label="Illustrative review record">
      <div className="record-topline">
        <span>Illustrative review record</span>
        <span>R-021</span>
      </div>
      <div className="record-row">
        <FileSearch size={16} aria-hidden="true" />
        <div>
          <span>Source</span>
          <strong>Submission v2</strong>
        </div>
      </div>
      <div className="record-row">
        <ShieldCheck size={16} aria-hidden="true" />
        <div>
          <span>Review state</span>
          <strong>Changes requested</strong>
        </div>
      </div>
      <div className="record-row record-row-complete">
        <Check size={16} aria-hidden="true" />
        <div>
          <span>Next action</span>
          <strong>Revise and resubmit</strong>
        </div>
      </div>
    </aside>
  );
}
