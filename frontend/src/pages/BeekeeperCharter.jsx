import React from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';

// Gap 1: the Sustainable Beekeeper Charter page didn't exist at all.
// Content transcribed from the project's own Charter reference
// (Beekeper_charter.jpg) rather than invented -- the six pillars map to
// specific UN Sustainable Development Goals and are referenced directly
// by beekeepers.charter_signed, which already exists and is already
// populated with real data (4 signed / 3 not at time of writing).
//
// Deliberately NOT translated into the i18n files: this is a formal,
// legal-style document whose exact wording matters, not UI chrome.
// Translating it would need a real, reviewed French version of the actual
// charter from KKWA -- inventing one here would be worse than leaving it
// in its original form.

const PILLARS = [
  {
    number: 1,
    title: 'Promote economic empowerment',
    points: [
      'The prices of raw materials are fair and transparent as well as negotiation conditions for the farmers / collectors',
      'The respect of land tenure and community use rights',
      'The respect of access and benefit sharing regulations and principles',
      'The purchase agreements are transparent and formalized favouring mid-term commercial relationships',
      'The minimum wage is paid to employees and field workers',
      'The living wage is paid to employees and field workers',
      'The preference for long-term employment versus contract/temporary workers',
      "The producers' groups are effectively organized & governed",
    ],
  },
  {
    number: 2,
    title: 'Guarantee equality',
    points: [
      'The Equal opportunities are made available in the workplace',
      'The equal wage for all employees',
      'The price of raw materials is equal for all farmers or collectors',
      'The empowerment of under-privileged communities',
      'The promotion of women in the workplace',
    ],
  },
  {
    number: 3,
    title: 'Ensure decent and safe work',
    points: [
      'The child labor laws and international conventions are respected',
      'No evidence of forced labour',
      'The working contracts meet applicable employment standards and legislation',
      'The respect of working hours and days',
      'The freedom of association and / or access to the complaints mechanism',
      'The working conditions are safe and healthy',
      'The living conditions are safe (in cases where workers / employees are hosted by the employer)',
      'No evidence of harassment, abuse or threat in the workplace',
    ],
  },
  {
    number: 4,
    title: 'Preserve Biodiversity',
    points: [
      'Local and national environmental regulations are known and respected',
      'Natural forests are maintained and / or enhanced',
      'Respect for threatened or endangered species',
      'Restoring or strengthening connectivity with the surrounding natural ecosystems',
      'The adoption and promotion of positive agricultural practices that contribute to sustainability, productivity and self-sufficiency',
      'No use of illegal or prohibited chemicals',
      'The harvest rate of solid products should not exceed levels that can be permanently sustained',
      'The waste management systems put in place could contribute to the circular economy',
      'The management of the impact of agricultural practices on water',
    ],
  },
  {
    number: 5,
    title: 'Take action against climate changes',
    points: [
      'High carbon stock land is maintained or enhanced',
      'Favor low carbon activities',
      'Promote agricultural practices enhancing climate change adaptation',
    ],
  },
  {
    number: 6,
    title: 'Known origin',
    points: [
      'Documents evidence of the supply chain to the geographic origin are available',
      'Formalized traceability system implemented up to farmers/pickers tracks the raw material through the supply chain back to the producer',
    ],
  },
];

const ELIGIBILITY = [
  'Reside and practice in one of the countries covered by the « Bees of Africa » project',
  'Be a man or a woman, adult',
  'Be trained in sustainable beekeeping and / or be willing to be trained',
  'Have one or more agricultural operations (cashew, shea, mango, etc.) or have land suitable for a beekeeping operation (communal forest, shea park or reserves)',
];

function SectionHeading({ id, children }) {
  return (
    <h2 id={id} className="text-lg font-black text-[#ba550c] mt-8 mb-3 scroll-mt-20">
      {children}
    </h2>
  );
}

export default function BeekeeperCharter() {
  const { t } = useTranslation();

  return (
    <AppLayout hideDefaultHeader>
      <div className="max-w-4xl">
        <p className="text-sm font-bold text-[#ba550c] mb-1">Bees of Africa</p>
        <h1 className="text-2xl font-black text-[#ba550c] mb-6">Charter Sustainable beekeeping</h1>

        {/* Table of contents — mirrors the real charter's own sidebar */}
        <nav className="border border-[#cfd8e6] rounded-[5px] p-4 mb-8 bg-white" data-testid="charter-toc">
          <p className="text-sm font-bold text-[#032b71] mb-2">{t('charter.tableOfContents')}</p>
          <ul className="flex flex-col gap-1 text-sm">
            <li><a href="#preamble" className="text-[#0f48aa] hover:underline">Preamble</a></li>
            <li><a href="#commitments" className="text-[#0f48aa] hover:underline">Commitments of the structure</a></li>
            {PILLARS.map((p) => (
              <li key={p.number} className="pl-3">
                <a href={`#pillar-${p.number}`} className="text-[#0f48aa] hover:underline">
                  Pillar {p.number} – {p.title}
                </a>
              </li>
            ))}
            <li><a href="#eligibility" className="text-[#0f48aa] hover:underline">Appendix – Beekeepers eligibility criteria</a></li>
          </ul>
        </nav>

        <SectionHeading id="preamble">Preamble</SectionHeading>
        <div className="text-sm text-[#032b71] flex flex-col gap-3 leading-relaxed">
          <p>
            The objective of the « Bees Of Africa » program initiated by Koster Keunen West Africa is to promote
            beekeeping that meets the needs of the present without compromising the ability of future generations to
            meet theirs.
          </p>
          <p>
            Thus for viable beekeeping and sustainable rural development, collective beekeeping structures and
            beekeepers and beekeepers must be supported to improve their production and their beekeeping and / or
            agricultural operating systems in order to secure their activities and to therefore reconcile respect for
            good beekeeping practices, economic development of agriculture and sustainable development.
          </p>
          <p>
            The structures eligible for the model of sustainable beekeeping can be of any collective legal form,
            including beekeepers, members of the structure or beekeeper members of the network that the structure
            supports (men and women, adults), are in compliance with the eligibility criteria of beekeepers described
            in the appendix.
          </p>
          <p className="font-bold">Thus, the structures can be:</p>
          <ul className="list-disc pl-6 flex flex-col gap-1">
            <li>Beekeeping organizations such as group, association, cooperative</li>
            <li>Honey houses</li>
            <li>Wax / honey aggregators</li>
            <li>Agricultural / beekeeping organizations wishing to benefit from a pollination service</li>
            <li>Agricultural organizations carrying out an agricultural activity, agroforestry, collection of nontimber forest products (NTFPs)</li>
            <li>Organizations with a pest management model and which practice integrated sanitary control that is free from resistance to bee populations</li>
          </ul>
        </div>

        <SectionHeading id="commitments">Commitments of the structure</SectionHeading>
        <div className="text-sm text-[#032b71] flex flex-col gap-3 leading-relaxed">
          <p>The commitment criteria revolve around the following 6 pillars:</p>
          <ul className="list-disc pl-6 flex flex-col gap-1">
            {PILLARS.map((p) => (
              <li key={p.number}>Pillar {p.number} – {p.title}</li>
            ))}
          </ul>
          <p>
            These pillars fit into the United Nations Development Program (UNDP) Sustainable Development Goals.
          </p>
          <p className="font-bold">The structure eligible for the sustainable beekeeping model, commits to:</p>
        </div>

        {PILLARS.map((pillar) => (
          <div key={pillar.number}>
            <p className="text-xs font-bold text-[#7089b4] mt-7 mb-1">Pillar {pillar.number}</p>
            <h3 id={`pillar-${pillar.number}`} className="text-base font-black text-[#ba550c] mb-2 scroll-mt-20">
              {pillar.title}
            </h3>
            <p className="text-sm text-[#032b71] mb-2">That is to say:</p>
            <ul className="list-disc pl-6 flex flex-col gap-1 text-sm text-[#032b71]">
              {pillar.points.map((point, i) => <li key={i}>{point}</li>)}
            </ul>
          </div>
        ))}

        <div className="text-sm text-[#032b71] mt-8 flex flex-col gap-2 leading-relaxed">
          <p>The structure and the network support beekeeper members through:</p>
          <ol className="list-decimal pl-6 flex flex-col gap-1">
            <li>Have the sustainable beekeeper charter signed</li>
            <li>Organized trainings</li>
            <li>Ensure the monitoring</li>
          </ol>
          <p>In order to be able to ensure compliance with the commitments of this charter at all levels</p>
        </div>

        <SectionHeading id="eligibility">Appendix – Beekeepers eligibility criteria</SectionHeading>
        <h3 className="text-base font-bold text-[#ba550c] mb-2">The sustainable beekeeper profile</h3>
        <ul className="list-disc pl-6 flex flex-col gap-1 text-sm text-[#032b71] mb-8">
          {ELIGIBILITY.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
    </AppLayout>
  );
}
