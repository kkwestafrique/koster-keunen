import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES, getStatesForCountry, getLgasForState } from '@/data/regions';

// Cascading address block used by Add Actor / Add Beekeeper / Add Village:
// Country -> State/Region/Departement -> LGA/Municipality/Province -> Village.
// Note: the live site has the State and LGA labels swapped against their data
// (audit finding, July 2026). We implement the labels CORRECTLY here — states
// under State, LGAs under LGA — rather than replicating the bug.
// LGA falls back to free text when no list exists for the chosen state.
// Village is free text, matching the live site.
export default function AddressFields({ value, onChange, testIdPrefix = 'address' }) {
  const { t } = useTranslation();
  const { country = '', state_region = '', lga_municipality = '', village = '' } = value || {};

  const states = getStatesForCountry(country);
  const lgas = getLgasForState(country, state_region);

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label className="text-[#7089b4]">{t('forms.country')}</Label>
        <Select
          value={country}
          onValueChange={(v) => set({ country: v, state_region: '', lga_municipality: '' })}
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
          onValueChange={(v) => set({ state_region: v, lga_municipality: '' })}
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
        {lgas.length > 0 ? (
          <Select value={lga_municipality} onValueChange={(v) => set({ lga_municipality: v })} disabled={!state_region}>
            <SelectTrigger data-testid={`${testIdPrefix}-lga`}>
              <SelectValue placeholder={state_region ? t('forms.selectLga') : t('forms.selectStateFirst')} />
            </SelectTrigger>
            <SelectContent>
              {lgas.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
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
