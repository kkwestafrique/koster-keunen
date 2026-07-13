import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES } from '@/data/regions';
import { useStatesForCountry, useLgasForState } from '@/hooks/useRegions';

// Cascading address block used by Add Actor / Add Beekeeper / Add Village:
// Country -> State/Region/Departement -> LGA/Municipality/Province -> Village.
// States/LGAs are fetched from the `regions` table in Supabase (not
// hardcoded) so corrections/additions don't require a code deploy.
// Note: the live site has the State and LGA labels swapped against their data
// (audit finding, July 2026). We implement the labels CORRECTLY here — states
// under State, LGAs under LGA — rather than replicating the bug.
// LGA falls back to free text when no list exists for the chosen state, and
// always includes an "Other" option even when a list does exist — some
// region's district data (e.g. Ghana) was populated from best-available
// reference material rather than a verified government source, so a real
// district that's missing or misspelled in our data must never block someone
// from just typing what they actually have.
const OTHER_LGA_VALUE = '__other__';

export default function AddressFields({ value, onChange, testIdPrefix = 'address' }) {
  const { t } = useTranslation();
  const { country = '', state_region = '', lga_municipality = '', village = '' } = value || {};

  const { data: states = [] } = useStatesForCountry(country);
  const { data: lgas = [] } = useLgasForState(country, state_region);

  const [lgaIsOther, setLgaIsOther] = React.useState(false);

  const set = (patch) => onChange({ ...value, ...patch });

  const lgaSelectValue = lgaIsOther ? OTHER_LGA_VALUE : lga_municipality;

  const handleLgaSelect = (v) => {
    if (v === OTHER_LGA_VALUE) {
      setLgaIsOther(true);
      set({ lga_municipality: '' });
    } else {
      setLgaIsOther(false);
      set({ lga_municipality: v });
    }
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label className="text-[#7089b4]">{t('forms.country')}</Label>
        <Select
          value={country}
          onValueChange={(v) => { set({ country: v, state_region: '', lga_municipality: '' }); setLgaIsOther(false); }}
        >
          <SelectTrigger data-testid={`${testIdPrefix}-country`}>
            <SelectValue placeholder={t('forms.selectCountry')} />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[#7089b4]">{t('forms.stateRegion')}</Label>
        <Select
          value={state_region}
          onValueChange={(v) => { set({ state_region: v, lga_municipality: '' }); setLgaIsOther(false); }}
          disabled={!country}
        >
          <SelectTrigger data-testid={`${testIdPrefix}-state`}>
            <SelectValue placeholder={country ? t('forms.selectState') : t('forms.selectCountryFirst')} />
          </SelectTrigger>
          <SelectContent>
            {states.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[#7089b4]">{t('forms.lgaMunicipality')}</Label>
        {lgas.length > 0 && !lgaIsOther ? (
          <Select value={lgaSelectValue} onValueChange={handleLgaSelect} disabled={!state_region}>
            <SelectTrigger data-testid={`${testIdPrefix}-lga`}>
              <SelectValue placeholder={state_region ? t('forms.selectLga') : t('forms.selectStateFirst')} />
            </SelectTrigger>
            <SelectContent>
              {lgas.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
              <SelectItem value={OTHER_LGA_VALUE}>{t('forms.otherNotListed')}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            data-testid={`${testIdPrefix}-lga`}
            value={lga_municipality}
            disabled={!state_region}
            placeholder={state_region ? t('forms.enterLga') : t('forms.selectStateFirst')}
            onChange={(e) => set({ lga_municipality: e.target.value })}
          />
        )}
        {lgaIsOther && lgas.length > 0 && (
          <button
            type="button"
            data-testid={`${testIdPrefix}-lga-back-to-list`}
            onClick={() => setLgaIsOther(false)}
            className="text-xs text-[#0f48aa] hover:underline self-start"
          >
            {t('forms.chooseFromList')}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[#7089b4]">{t('forms.village')}</Label>
        <Input
          data-testid={`${testIdPrefix}-village`}
          value={village}
          placeholder={t('forms.enterVillage')}
          onChange={(e) => set({ village: e.target.value })}
        />
      </div>
    </>
  );
}
