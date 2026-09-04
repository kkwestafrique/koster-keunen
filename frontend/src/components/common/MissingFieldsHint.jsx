import React from 'react';
import { useTranslation } from 'react-i18next';

// Real gap found via independent audit (C5): every form in the app
// simply disabled its submit button when something was missing, with
// zero indication of what. A user had no way to tell which field
// needed attention -- confirmed directly across 7 different forms,
// not an isolated case.
//
// Deliberately not full per-field inline validation (highlighting each
// individual input, tracking touched state) -- that's a much larger
// redesign. This directly answers the audit's actual stated problem
// ("users cannot determine which field is missing or invalid") with a
// clear, specific list next to the button itself.
export default function MissingFieldsHint({ missingFields, testId = 'missing-fields-hint' }) {
  const { t } = useTranslation();
  if (!missingFields || missingFields.length === 0) return null;
  return (
    <p className="text-xs text-[#ba550c] mt-1" data-testid={testId}>
      {t('forms.stillNeeded', { fields: missingFields.join(', ') })}
    </p>
  );
}
