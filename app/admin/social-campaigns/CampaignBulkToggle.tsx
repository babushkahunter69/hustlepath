'use client';

import { useId } from 'react';

export default function CampaignBulkToggle() {
  const toggleId = useId();

  function setChecked(checked: boolean) {
    const boxes = document.querySelectorAll<HTMLInputElement>('input[data-campaign-checkbox="true"]');
    boxes.forEach((box) => {
      box.checked = checked;
    });
  }

  return (
    <div className="campaign-select-tools">
      <label htmlFor={toggleId} className="campaign-select-toggle">
        <input
          id={toggleId}
          type="checkbox"
          onChange={(event) => setChecked(event.currentTarget.checked)}
        />
        <span>Select all visible</span>
      </label>
      <button type="button" className="secondary-link small" onClick={() => setChecked(false)}>Clear selection</button>
    </div>
  );
}
