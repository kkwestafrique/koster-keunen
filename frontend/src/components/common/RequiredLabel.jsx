import React from 'react';
import { Label } from '@/components/ui/label';

// Renders a field label matching the live site's required-field asterisk:
// color #EB5757, baseline-aligned (not superscript), 12px.
// The live site is inconsistent about whether there's a space before the
// asterisk per-field (e.g. "Actor name *" vs "Country*") — `spaced` lets
// each usage match its own audited reference exactly rather than forcing
// one convention across the app.
export default function RequiredLabel({ children, required, spaced = true, className = '', htmlFor, testId }) {
  return (
    <Label htmlFor={htmlFor} data-testid={testId} className={`text-[#7089b4] ${className}`}>
      {children}
      {required && <span className="text-[#EB5757] text-xs align-baseline">{spaced ? ' *' : '*'}</span>}
    </Label>
  );
}
