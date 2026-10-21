import React from "react";

// One filter as a compact pill: its name inside, the choice beside it. A pill with a choice made is tinted, so what is narrowing the list is seen at a glance.
const FilterPick = ({ label, allLabel, value, options, onChange }) => (
  <label className={`cs-pick ${value ? "is-set" : ""}`}>
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      <option value="">{allLabel}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
);

export default FilterPick;
