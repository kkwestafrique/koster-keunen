import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTour } from '@/contexts/TourContext';

// Real, deliberate choice: not a true spotlight-cutout mask (a
// transparent hole punched through the backdrop). That needs an SVG
// mask or a large box-shadow trick to get exactly right, and getting
// it subtly wrong (a misaligned cutout, a hole that doesn't match the
// target's real rounded corners) would look broken rather than
// polished. Instead: a semi-transparent backdrop over the whole page,
// with the real target element lifted to a high z-index and given a
// bright ring, so it visually reads as "the highlighted thing" without
// needing pixel-perfect cutout math.
export default function TourOverlay() {
  const { t } = useTranslation();
  const { isActive, stepIndex, steps, next, back, skip } = useTour();
  const [targetRect, setTargetRect] = useState(null);
  const [groupRects, setGroupRects] = useState([]);

  const step = steps[stepIndex];

  const measure = useCallback(() => {
    if (!step) return;
    if (step.groupTestIds) {
      const rects = step.groupTestIds
        .map((id) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect())
        .filter(Boolean);
      setGroupRects(rects);
      setTargetRect(rects[0] || null);
    } else if (step.targetTestId) {
      const el = document.querySelector(`[data-testid="${step.targetTestId}"]`);
      setTargetRect(el ? el.getBoundingClientRect() : null);
      setGroupRects([]);
    } else {
      setTargetRect(null);
      setGroupRects([]);
    }
  }, [step]);

  useEffect(() => {
    if (!isActive) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isActive, measure]);

  if (!isActive || !step) return null;

  const rectsToHighlight = groupRects.length > 0 ? groupRects : (targetRect ? [targetRect] : []);

  // Card position: below the (first) target if there's room, otherwise
  // centered on screen -- covers both a real targeted step and the
  // intro step, which has no target at all.
  const cardStyle = targetRect
    ? {
        position: 'fixed',
        top: Math.min(targetRect.bottom + 16, window.innerHeight - 220),
        left: Math.min(Math.max(targetRect.left, 16), window.innerWidth - 360),
        zIndex: 210,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 210,
      };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[200]" data-testid="tour-backdrop" onClick={skip} />
      {rectsToHighlight.map((rect, i) => (
        <div
          key={i}
          className="fixed rounded-[6px] ring-4 ring-[#0f48aa] pointer-events-none z-[205]"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      ))}
      <div
        className="bg-white rounded-[8px] shadow-xl p-5 w-[340px] flex flex-col gap-3"
        style={cardStyle}
        data-testid="tour-card"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-black text-[#032b71]">{t(step.titleKey)}</h3>
          <button type="button" onClick={skip} aria-label={t('tour.skip')} data-testid="tour-close" className="text-[#5a6f9a] hover:text-[#032b71] shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-[#5a6f9a]">{t(step.bodyKey)}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-[#5a6f9a]">{t('tour.stepCount', { current: stepIndex + 1, total: steps.length })}</span>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button type="button" variant="outline" size="sm" data-testid="tour-back" onClick={back} className="border-[#cfd8e6] text-[#032b71]">
                {t('tour.back')}
              </Button>
            )}
            <Button type="button" size="sm" data-testid="tour-next" onClick={next} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
              {stepIndex + 1 === steps.length ? t('tour.done') : t('tour.next')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
