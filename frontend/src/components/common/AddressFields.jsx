import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import RequiredLabel from '@/components/common/RequiredLabel';
import SearchableSelect from '@/components/common/SearchableSelect';
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

export default function AddressFields({ value, onChange, testIdPrefix = 'address', required = true }) {
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
        <RequiredLabel required={required} spaced={false}>{t('forms.country')}</RequiredLabel>
        <SearchableSelect
          testId={`${testIdPrefix}-country`}
          value={country}
          onChange={(v) => { set({ country: v, state_region: '', lga_municipality: '' }); setLgaIsOther(false); }}
          placeholder={t('forms.selectCountry')}
          options={COUNTRIES.map((c) => ({ value: c, label: c }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <RequiredLabel required={required}>{t('forms.stateRegion')}</RequiredLabel>
        <SearchableSelect
          testId={`${testIdPrefix}-state`}
          value={state_region}
          onChange={(v) => { set({ state_region: v, lga_municipality: '' }); setLgaIsOther(false); }}
          disabled={!country}
          placeholder={country ? t('forms.selectState') : t('forms.selectCountryFirst')}
          options={states.map((s) => ({ value: s, label: s }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <RequiredLabel required={required}>{t('forms.lgaMunicipality')}</RequiredLabel>
        {lgas.length > 0 && !lgaIsOther ? (
          <SearchableSelect
            testId={`${testIdPrefix}-lga`}
            value={lgaSelectValue}
            onChange={handleLgaSelect}
            disabled={!state_region}
            placeholder={state_region ? t('forms.selectLga') : t('forms.selectStateFirst')}
            options={[...lgas.map((l) => ({ value: l, label: l })), { value: OTHER_LGA_VALUE, label: t('forms.otherNotListed') }]}
          />
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
        <RequiredLabel required={required}>{t('forms.village')}</RequiredLabel>
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
