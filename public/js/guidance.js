/**
 * guidance.js — immigration guidance content and assessment engine.
 *
 * ALL substantive content in this file was audited against GOV.UK guidance in
 * July 2026. Every card and Q&A answer carries an inline source link. Figures
 * that changed since the original version of this tool (and were corrected):
 *
 *  - Skilled Worker general salary threshold: £41,700 (was £26,200/£38,700)
 *    — raised 22 July 2025. Shortage Occupation List abolished; replaced by
 *    the Immigration Salary List / Temporary Shortage List.
 *  - ILR application fee: £3,226 per person from 8 April 2026 (was £2,885).
 *  - Naturalisation: £1,709 + £130 ceremony = £1,839 from 8 April 2026.
 *  - Partner visa minimum income: £29,000 (unchanged since April 2024; MAC
 *    review 2025 recommended £23,000–£25,000 — no change implemented yet).
 *  - 10-year long residence now requires continuous LAWFUL residence
 *    (Appendix Long Residence, 11 April 2024) — overstaying breaks the clock.
 *    The old text saying overstaying could count was removed as inaccurate.
 *  - Long residence absences: max 180 days in any 12 months (was 548 total).
 *  - BRPs abolished 31 December 2024 — replaced by eVisas.
 *  - Graduate visa: cut to 18 months (36 for PhD) for applications from
 *    1 January 2027.
 *  - Refugee permission: 30 months (not 5 years) for asylum claims lodged on
 *    or after 2 March 2026.
 *  - Standard visitors CANNOT marry in the UK — a Marriage Visitor visa is
 *    required (old text wrongly said marriage was allowed on a visit visa).
 *  - DVILR renamed: Appendix Victim of Domestic Abuse (31 January 2024).
 *  - Child citizenship registration fee reduced to £1,000 (8 April 2026).
 *  - NEW: earned-settlement proposals (10-year standard qualifying period),
 *    ETA scheme, eVisa rollout, care-worker route closure — all covered.
 */

window.Guidance = (function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Source citation helper — every guidance card links to GOV.UK.
  // ---------------------------------------------------------------------
  const SRC = {
    skilledWorker: ['GOV.UK — Skilled Worker visa: your job', 'https://www.gov.uk/skilled-worker-visa/your-job'],
    fees: ['GOV.UK — Home Office immigration and nationality fees (8 April 2026)', 'https://www.gov.uk/government/publications/visa-regulations-revised-table'],
    ilrWork: ['GOV.UK — Settle in the UK (work visas)', 'https://www.gov.uk/settle-in-the-uk'],
    citizenship: ['GOV.UK — Apply for citizenship with indefinite leave to remain', 'https://www.gov.uk/apply-citizenship-indefinite-leave-to-remain'],
    citizenshipSpouse: ['GOV.UK — Apply for citizenship if your spouse is a British citizen', 'https://www.gov.uk/apply-citizenship-spouse'],
    familyVisa: ['GOV.UK — Family visas: partner or spouse', 'https://www.gov.uk/uk-family-visa/partner-spouse'],
    familyIncome: ['GOV.UK — Family visas: proof of income', 'https://www.gov.uk/uk-family-visa/proof-income'],
    longResidence: ['GOV.UK — Immigration Rules Appendix Long Residence', 'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-long-residence'],
    privateLife: ['GOV.UK — Immigration Rules Appendix Private Life', 'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-private-life'],
    evisa: ['GOV.UK — Online immigration status (eVisa)', 'https://www.gov.uk/evisa'],
    eta: ['GOV.UK — Electronic travel authorisation (ETA)', 'https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta'],
    graduate: ['GOV.UK — Graduate visa', 'https://www.gov.uk/graduate-visa'],
    student: ['GOV.UK — Student visa', 'https://www.gov.uk/student-visa'],
    visitor: ['GOV.UK — Visit the UK as a Standard Visitor', 'https://www.gov.uk/standard-visitor'],
    marriageVisitor: ['GOV.UK — Marriage Visitor visa', 'https://www.gov.uk/marriage-visa'],
    euss: ['GOV.UK — EU Settlement Scheme', 'https://www.gov.uk/settled-status-eu-citizens-families'],
    asylum: ['GOV.UK — Claim asylum in the UK', 'https://www.gov.uk/claim-asylum'],
    asylumSettlement: ['GOV.UK — Settlement: protection routes (policy guidance)', 'https://www.gov.uk/government/publications/settlement-refugee-or-humanitarian-protection'],
    appeals: ['GOV.UK — Appeal against a visa or immigration decision', 'https://www.gov.uk/immigration-asylum-tribunal'],
    adminReview: ['GOV.UK — Ask for a visa administrative review', 'https://www.gov.uk/ask-for-a-visa-administrative-review'],
    lifeInUK: ['GOV.UK — Life in the UK Test', 'https://www.gov.uk/life-in-the-uk-test'],
    english: ['GOV.UK — Prove your knowledge of English', 'https://www.gov.uk/english-language'],
    ihs: ['GOV.UK — Pay the immigration health surcharge', 'https://www.gov.uk/healthcare-immigration-application'],
    vda: ['GOV.UK — Settlement as a victim of domestic abuse', 'https://www.gov.uk/settlement-victim-domestic-abuse'],
    registerChild: ['GOV.UK — Register a child as a British citizen', 'https://www.gov.uk/register-british-citizen/child'],
    whitePaper: ['House of Commons Library — Changes to UK visa and settlement rules after the 2025 immigration white paper', 'https://commonslibrary.parliament.uk/research-briefings/cbp-10267/'],
    oisc: ['GOV.UK — Find an immigration adviser', 'https://www.gov.uk/find-an-immigration-adviser'],
    publicFunds: ['GOV.UK — Public funds guidance', 'https://www.gov.uk/government/publications/public-funds--2'],
    goodCharacter: ['GOV.UK — Nationality: good character requirement', 'https://www.gov.uk/government/publications/good-character-nationality-policy-guidance'],
    travelHistory: ['GOV.UK — Get a copy of your immigration or travel history', 'https://www.gov.uk/guidance/request-your-personal-information-from-uk-visas-and-immigration'],
  };

  function src(key, extra) {
    const [label, url] = SRC[key];
    const more = extra ? ` ${extra}` : '';
    return `<span class="source-note">Source: <a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a> (checked July 2026).${more}</span>`;
  }

  // Frequently reused fee facts (8 April 2026 fee schedule)
  const FEE_ILR = '£3,226';
  const FEE_NATURALISATION = '£1,839 in total (£1,709 application + £130 ceremony)';
  const SW_THRESHOLD = '£41,700';

  // ---------------------------------------------------------------------
  // Assessment engine
  //
  // `a` is the answers object assembled by app.js from the intake form.
  // Returns { title, sub, tone, cards[], steps[] }.
  // ---------------------------------------------------------------------
  function generateAssessment(a) {
    const cards = [];
    const steps = [];
    let title = 'General assessment';
    let sub = 'Based on your answers, here is a general overview of your position.';
    let tone = 'possible';

    const englishOK = ['fluent', 'test_passed', 'degree'].includes(a.english);
    const lifeUKOK = a.lifeuk === 'yes' || a.lifeuk === 'exempt';
    const goodCompliance = a.criminal === 'none' && a.deported === 'no' && a.deception === 'no';
    const yearsMap = { under_1: 0.5, '1_2': 1.5, '2_5': 3.5, '5_10': 7, over_10: 11 };
    const yearsLived = yearsMap[a.totalYears] || 0;

    // ================= SKILLED WORKER =================
    if (a.status === 'skilled') {
      const yearsOnVisa = a.skilled_entry
        ? Math.floor((Date.now() - new Date(a.skilled_entry).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : 0;
      title = 'Skilled Worker assessment';
      sub = `Based on your entry date, you have been on a Skilled Worker (formerly Tier 2) visa for approximately ${yearsOnVisa} year(s).`;

      if (yearsOnVisa >= 5 && goodCompliance && a.skilled_absences === 'under_180' && a.longAbsence === 'no') {
        tone = 'eligible';
        cards.push({
          type: 'eligible', tag: 'Likely eligible', title: 'Indefinite Leave to Remain (ILR)',
          detail: `You appear to meet the 5-year continuous residence requirement for settlement on the Skilled Worker route. You must still be needed by your sponsor, be paid at least ${SW_THRESHOLD} a year or the going rate for your occupation code (whichever is higher — lower thresholds apply to Immigration Salary List roles, new entrants and some Health and Care roles), pass the Life in the UK Test and meet the English language requirement. Apply online using form SET(O) — the fee is ${FEE_ILR} per person from 8 April 2026.` + src('ilrWork') + src('skilledWorker'),
        });
      } else if (yearsOnVisa >= 4 && yearsOnVisa < 5) {
        cards.push({
          type: 'possible', tag: 'Not yet eligible', title: 'ILR — approaching the 5-year mark',
          detail: `You are approaching the 5-year qualifying period for ILR on the Skilled Worker route (you can submit up to 28 days before completing 5 years). Start preparing now: Life in the UK Test, English evidence and a clean absence record (no more than 180 days outside the UK in any rolling 12-month period).` + src('ilrWork'),
        });
      } else if (yearsOnVisa >= 5) {
        cards.push({
          type: 'possible', tag: 'Requires review', title: 'ILR — possible continuous-residence concerns',
          detail: `You have been in the UK 5+ years but your absences may break continuous residence. The rule is no more than 180 days outside the UK in any rolling 12-month period. Request your travel history from UKVI if you are unsure, and take regulated advice before applying.` + src('ilrWork') + src('travelHistory'),
        });
      }

      if (yearsOnVisa >= 5 || yearsLived >= 5) {
        const ilrFirst = yearsOnVisa < 5;
        cards.push({
          type: ilrFirst ? 'possible' : 'info', tag: ilrFirst ? 'Requires ILR first' : 'Future step',
          title: 'British citizenship (naturalisation)',
          detail: `After ILR you can usually apply for naturalisation once you have held ILR for 12 months and lived in the UK for 5 years (no 12-month wait if you are married to a British citizen). You also need the Life in the UK Test, English at B1 or above, good character, and normally no more than 450 days of absence in the 5 years (90 in the final year). The fee is ${FEE_NATURALISATION} from 8 April 2026.` + src('citizenship') + src('fees'),
        });
      }

      if (a.sw_dependants && a.sw_dependants !== 'none') {
        cards.push({
          type: 'info', tag: 'Dependants', title: 'Dependent family members',
          detail: `Your partner and children under 18 can normally apply for ILR at the same time as you (each pays the full ${FEE_ILR} fee — there is no reduced child rate). A child born in the UK while you had limited leave is not automatically British, but once a parent is granted ILR the child can be registered as a British citizen — the registration fee was reduced to £1,000 from 8 April 2026.` + src('registerChild') + src('fees'),
        });
      }

      if (a.skilled_salary === 'under_25k' || a.skilled_salary === '25k_41699') {
        cards.push({
          type: 'possible', tag: 'Review required', title: 'Salary threshold',
          detail: `Since 22 July 2025 the standard Skilled Worker salary threshold is ${SW_THRESHOLD} a year (or the going rate for your occupation, whichever is higher). Lower thresholds apply if your role is on the Immigration Salary List (£33,400), you are a new entrant, you hold a relevant PhD, or you are in a Health and Care or transitional category. The old Shortage Occupation List no longer exists. If your salary is below the threshold that applies to you, an extension or ILR application could be refused — check your occupation code's current going rate before applying.` + src('skilledWorker'),
        });
      }

      steps.push('Confirm your exact entry date and calculate your 5-year qualifying date for ILR (you can apply up to 28 days early).');
      steps.push('Check your absences: no more than 180 days outside the UK in any rolling 12-month period. Request your travel history from UKVI if unsure.');
      steps.push('Book and pass the Life in the UK Test (£50) well before applying.');
      steps.push(`Gather evidence: payslips, P60s, employer letter confirming continued sponsorship, and access to your eVisa (UKVI account) — physical BRP cards expired on 31 December 2024.`);
      steps.push(`Apply for ILR on form SET(O) — fee ${FEE_ILR} per person (8 April 2026 rate).`);
      if (a.sw_dependants && a.sw_dependants !== 'none') steps.push('Include dependant applications at the same time as your own.');
      steps.push('After 12 months with ILR (immediately, if married to a British citizen), consider naturalisation.');
    }

    // ================= OVERSTAYER =================
    else if (a.status === 'overstayer') {
      title = 'Overstayer — options assessment';
      sub = 'Your situation is serious but not necessarily hopeless. The options below are general possibilities — take regulated legal advice before doing anything.';
      tone = 'warning';

      if (a.ov_removal === 'yes') {
        cards.push({
          type: 'not-eligible', tag: 'Urgent — act now', title: 'Active removal proceedings',
          detail: 'You may have very limited time to challenge removal. Contact a legal aid solicitor or an IAA-regulated adviser immediately (the immigration advice regulator OISC was renamed the Immigration Advice Authority in 2024). Organisations such as Bail for Immigration Detainees can also help.' + src('oisc'),
        });
      }

      // IMPORTANT CORRECTION: since 11 April 2024 the 10-year long residence
      // route requires continuous LAWFUL residence — overstaying breaks it.
      cards.push({
        type: 'info', tag: 'Rule change', title: '10-year long residence no longer covers overstaying',
        detail: 'Since 11 April 2024 (Appendix Long Residence), ILR after 10 years requires 10 years of continuous <strong>lawful</strong> residence. Time spent overstaying breaks continuity and does not count (except short periods disregarded under the overstaying exceptions). If most of your residence has been without leave, this route is unlikely to be open to you — but the private life route below may be.' + src('longResidence'),
      });

      if (a.ov_10yr === 'yes' || a.ov_10yr === 'unsure') {
        cards.push({
          type: 'possible', tag: 'Potentially available', title: 'Private life route (Appendix Private Life)',
          detail: 'Long residence without status can still lead to permission to stay on private life grounds: 20 years\' continuous residence (any status), or 7 years for a child where leaving the UK would be unreasonable, or more than half your life if you are aged 18–24. This normally leads to settlement after 10 years on the route (5 years in some cases). Strong documentary evidence of every year of residence is essential.' + src('privateLife'),
        });
      }

      if (a.ov_partner === 'yes') {
        cards.push({
          type: 'possible', tag: 'May be available', title: 'Partner of a British or settled person (Article 8 family life)',
          detail: `A genuine relationship with a British or settled partner can found an application under Appendix FM, including from inside the UK where there are insurmountable obstacles to family life continuing abroad (paragraph EX.1). The financial requirement for the standard route is £29,000 a year. Overstaying makes this complex — specialist advice is essential.` + src('familyVisa') + src('familyIncome'),
        });
      }

      if (a.ov_ukborn_child === 'yes_british') {
        cards.push({
          type: 'possible', tag: 'Potentially available', title: 'Parent of a British child',
          detail: 'Being the parent of a British citizen child who lives in the UK can support an application on the parent route or under paragraph EX.1, where it would not be reasonable to expect the child to leave the UK. You must play an active role in the child\'s upbringing. Seek advice urgently.' + src('familyVisa'),
        });
      }

      cards.push({
        type: 'info', tag: 'Consider carefully', title: 'Voluntary departure and re-entry bans',
        detail: 'Leaving voluntarily (rather than being removed) usually results in a shorter re-entry ban — typically 1 year if you leave voluntarily at your own expense, 2–5 years otherwise, and 10 years after deportation or removal. Overstayers who left within 30 days of their leave expiring generally avoid a ban. Take advice BEFORE leaving: departure can close in-country options.' + src('oisc'),
      });

      steps.push('Do NOT travel or leave the UK before taking legal advice — leaving can trigger a re-entry ban and close in-country routes.');
      steps.push('Consult an IAA-regulated adviser (level 2+) or an immigration solicitor immediately.');
      steps.push('Gather evidence of your continuous residence for every year (tenancy agreements, GP records, bank statements, letters).');
      if (a.ov_partner === 'yes') steps.push('Collect relationship evidence: cohabitation, joint finances, photographs, correspondence.');
      steps.push('If you receive any Home Office decision letter, note the date — appeal deadlines are usually 14 days.');
    }

    // ================= VISITOR =================
    else if (a.status === 'visitor') {
      title = 'Visitor — assessment';
      sub = 'As a visitor your options inside the UK are limited. Here is what you need to know.';
      tone = 'info';

      cards.push({
        type: 'not-eligible', tag: 'Important restriction', title: 'You cannot switch visas from inside the UK',
        detail: 'Visitors cannot switch into work, study or family routes from inside the UK — you must leave and apply from abroad. Very limited exceptions exist (for example, some fiancé(e)s applying under concessions). A standard visit is capped at 6 months and cannot normally be extended.' + src('visitor'),
      });

      if (a.v_partner === 'yes') {
        cards.push({
          type: 'possible', tag: 'Apply from abroad', title: 'Partner or spouse visa',
          detail: `If your partner is British or settled you may qualify for a partner visa, applied for from outside the UK. You must show a genuine relationship, adequate accommodation, English at A1, and meet the financial requirement — a minimum income of £29,000 a year (or savings of £88,500), unchanged since April 2024. The Migration Advisory Committee's 2025 review recommended a lower threshold (£23,000–£25,000) but no change has been made — check the current figure before applying.` + src('familyIncome'),
        });
      }

      if (a.visit_purpose === 'marriage') {
        // CORRECTION: the previous version wrongly said you can marry on a
        // standard visitor visa.
        cards.push({
          type: 'possible', tag: 'Corrected guidance', title: 'Getting married in the UK requires a Marriage Visitor visa',
          detail: 'You cannot get married or form a civil partnership on a standard visit (including ETA visa-free entry). You need a Marriage Visitor visa (£127), which does not lead to settlement — you must leave after the marriage. If you plan to live in the UK with a British or settled partner afterwards, the usual path is to marry and then apply for a partner visa from abroad, or apply for a fiancé(e) visa first.' + src('marriageVisitor'),
        });
      }

      cards.push({
        type: 'info', tag: 'Reminder', title: 'Leave before your permission expires',
        detail: 'Most visitors get 6 months. Overstaying — even briefly — is recorded and harms future applications. Note that visa-free nationals now need an Electronic Travel Authorisation (ETA, £16) before travelling to the UK.' + src('visitor') + src('eta'),
      });

      steps.push('Check the exact date your permission ends and do not overstay.');
      steps.push('If you want to live in the UK long-term, identify the right route (work, study, family) and apply from your home country.');
      if (a.v_partner === 'yes') steps.push('If you have a British or settled partner, gather relationship and income evidence for a partner visa application from abroad.');
    }

    // ================= FAMILY =================
    else if (a.status === 'family') {
      title = 'Family visa — pathway assessment';
      sub = 'Your route to settlement depends on your relationship type and time on the route.';
      tone = 'eligible';

      if (a.fam_duration === '5_plus' && a.fam_ongoing === 'yes') {
        cards.push({
          type: 'eligible', tag: 'Likely eligible', title: 'Indefinite Leave to Remain — SET(M)',
          detail: `After 5 years on the partner route you can apply for ILR using form SET(M) (fee ${FEE_ILR} from 8 April 2026). You must show the relationship is genuine and subsisting, meet the financial requirement, pass the Life in the UK Test and meet the English requirement at B1 level for settlement.` + src('familyVisa') + src('fees'),
        });
      } else if (a.fam_duration === '2_to_5') {
        cards.push({
          type: 'possible', tag: 'Extension needed first', title: 'ILR — not yet at the 5-year mark',
          detail: 'The standard partner route requires 5 years before ILR (10 years if you are on the extended route because you could not meet all requirements). Apply to extend your permission before it expires — a valid in-time application protects your status while it is decided.' + src('familyVisa'),
        });
      }

      if (a.fam_ongoing === 'no') {
        cards.push({
          type: 'info', tag: 'Protective route', title: 'Victims of domestic abuse — immediate settlement',
          detail: 'If your relationship broke down because of domestic abuse, you may apply for immediate settlement under Appendix Victim of Domestic Abuse (which replaced the "DVILR" rules on 31 January 2024) — no qualifying period applies, and a fee waiver is available if you cannot afford the fee. Support is available from the National Domestic Abuse Helpline (0808 2000 247).' + src('vda'),
        });
      }

      cards.push({
        type: 'info', tag: 'Future step', title: 'Citizenship after ILR',
        detail: `If you are married to a British citizen you can apply for naturalisation as soon as you have ILR and 3 years' residence — there is no 12-month wait after ILR for spouses. Otherwise the standard 5-year residence and 12-months-with-ILR rules apply. Fee: ${FEE_NATURALISATION}.` + src('citizenshipSpouse'),
      });

      steps.push('Diarise your visa expiry and apply to extend (or for ILR) before it expires.');
      steps.push('Keep ongoing relationship evidence: joint tenancy or mortgage, joint bills and accounts, correspondence to the same address.');
      steps.push('Pass the Life in the UK Test and secure B1-level English evidence before your ILR application.');
      if (a.fam_duration === '5_plus') steps.push(`Prepare the SET(M) application — fee ${FEE_ILR} per person.`);
    }

    // ================= ILR HOLDER =================
    else if (a.status === 'ilr') {
      title = 'ILR holder — citizenship pathway';
      sub = 'You are settled — here is your route to British citizenship.';
      tone = 'eligible';
      const spouseRoute = a.ilr_bc_spouse === 'yes';
      const totalYearsOK = a.ilr_total_time === '5_plus' || (spouseRoute && a.ilr_total_time === '3_to_5');

      if (totalYearsOK && (spouseRoute || a.ilr_duration !== 'under_1') && englishOK && goodCompliance) {
        cards.push({
          type: 'eligible', tag: 'Likely eligible', title: 'British citizenship (naturalisation)',
          detail: `You appear to meet the residence requirements. ${spouseRoute ? 'As the spouse or civil partner of a British citizen you need 3 years\' residence and ILR — with no 12-month wait after getting ILR.' : 'You need 5 years\' residence and to have held ILR for 12 months.'} You must also pass the Life in the UK Test, prove English at B1 or above, meet the good character requirement, and normally have no more than 450 days of absence in the qualifying period (90 in the final year). Fee: ${FEE_NATURALISATION} from 8 April 2026. Most applications are decided within 6 months. Apply online on Form AN.` + src(spouseRoute ? 'citizenshipSpouse' : 'citizenship') + src('fees'),
        });
      } else {
        cards.push({
          type: 'possible', tag: 'Not yet qualifying', title: 'Citizenship — approaching eligibility',
          detail: `The standard route requires ${spouseRoute ? '3 years\' residence (spouse of a British citizen) plus ILR' : '5 years\' residence plus ILR held for 12 months'}. Keep building your residence record and prepare the Life in the UK Test and English evidence now.` + src('citizenship'),
        });
      }

      if (!lifeUKOK) {
        cards.push({
          type: 'possible', tag: 'Required', title: 'Life in the UK Test',
          detail: 'You must pass the Life in the UK Test before applying for citizenship (unless you are under 18 or 65 or over). Book only through the official GOV.UK service — the fee is £50 — and prepare with the official handbook. You can retake it as many times as needed.' + src('lifeInUK'),
        });
      }
      if (!englishOK) {
        cards.push({
          type: 'possible', tag: 'Required', title: 'English language evidence',
          detail: 'Citizenship requires English at CEFR B1 or above: an approved Secure English Language Test (for example IELTS Life Skills B1 or Trinity GESE), a degree taught or researched in English, or nationality of a majority English-speaking country.' + src('english'),
        });
      }
      cards.push({
        type: 'info', tag: 'Be aware', title: 'Good character requirement — stricter since 2025',
        detail: 'Home Office guidance was tightened on 10 February 2025: applicants who entered the UK illegally, or arrived by dangerous journeys such as small boats, will normally be refused citizenship regardless of how long ago it happened. Criminality, recent bankruptcy and unpaid tax also count against good character. If anything in your history could be a concern, take advice before paying the fee — it is not refunded on refusal.' + src('goodCharacter'),
      });

      steps.push('Verify your residence and absence history against the 450/90-day limits (request your travel history from UKVI if unsure).');
      steps.push('Pass the Life in the UK Test if you have not already.');
      steps.push('Gather documents: passport, eVisa/UKVI account details, proof of residence, Life in the UK pass, English evidence, referees.');
      steps.push(`Apply online on Form AN — ${FEE_NATURALISATION}.`);
      steps.push('Attend your citizenship ceremony within 3 months of approval, then apply for a British passport.');
    }

    // ================= EUSS =================
    else if (a.status === 'euss') {
      title = 'EU Settlement Scheme assessment';
      sub = 'Your pathway to settled status and citizenship as an EU, EEA or Swiss national (or family member).';
      tone = a.euss_type === 'settled' ? 'eligible' : 'possible';

      if (a.euss_type === 'settled') {
        cards.push({
          type: 'eligible', tag: 'Already settled', title: 'Settled status = indefinite leave',
          detail: 'EUSS settled status is a form of indefinite leave. You can live, work and access public funds without time limit. Your status is digital only — keep your UKVI account (eVisa) up to date with your current passport, as physical documents are no longer issued.' + src('euss') + src('evisa'),
        });
        if ((a.euss_years === '5_6' || a.euss_years === 'over_6') && englishOK) {
          cards.push({
            type: 'eligible', tag: 'Likely eligible', title: 'British citizenship (naturalisation)',
            detail: `With 5+ years' continuous residence and settled status held for 12 months (no wait if married to a British citizen), you can apply for naturalisation: Life in the UK Test, English at B1+, good character, and the 450/90-day absence limits apply. Fee: ${FEE_NATURALISATION}.` + src('citizenship'),
          });
        }
      } else if (a.euss_type === 'pre_settled') {
        cards.push({
          type: 'possible', tag: 'Action ahead', title: 'Pre-settled status — upgrading to settled',
          detail: 'Pre-settled status no longer simply expires: the Home Office now extends it automatically (extensions of up to 5 years) and, since early 2025, converts eligible pre-settled holders to settled status automatically using government data. Do not rely on this happening — once you complete 5 years\' continuous residence, apply yourself to upgrade (it is free). Continuous residence generally means not being outside the UK more than 6 months in any 12-month period.' + src('euss'),
        });
        cards.push({
          type: 'info', tag: 'Keep evidence', title: 'Protect your continuous residence',
          detail: 'Keep evidence of living in the UK (P60s, council tax, tenancy, utility bills) for each year since you arrived, and keep your UKVI account details current so automatic checks can find your records.' + src('euss'),
        });
      }

      steps.push('Sign in to your UKVI account to confirm your current EUSS status and update passport details.');
      if (a.euss_type === 'pre_settled') steps.push('Calculate the date you complete 5 years\' continuous residence and apply for settled status then (free) — do not rely solely on automatic conversion.');
      steps.push('Keep documentary evidence of UK residence for every year.');
      if (a.euss_type === 'settled') steps.push('After 12 months with settled status (or immediately if married to a British citizen), consider naturalisation.');
    }

    // ================= STUDENT =================
    else if (a.status === 'student') {
      title = 'Student visa — next steps';
      sub = 'Your options after your course depend on your qualification and timing.';
      tone = 'info';

      if (a.st_post === 'graduate') {
        cards.push({
          type: 'eligible', tag: 'Time-sensitive', title: 'Graduate visa — length is being cut in 2027',
          detail: 'The Graduate route currently gives 2 years (3 for PhD graduates) of unsponsored work rights. <strong>For applications made on or after 1 January 2027 this drops to 18 months (36 months for PhDs).</strong> If you will be eligible before that date, applying in 2026 secures the longer period. You must apply from inside the UK before your Student visa expires, after your provider confirms you completed the course. Fee £880 plus the immigration health surcharge (£1,035 per year). The Graduate visa cannot be extended and does not itself lead to settlement, though the time counts towards the 10-year long residence route.' + src('graduate'),
        });
      }
      if (a.st_post === 'skilled') {
        cards.push({
          type: 'eligible', tag: 'Route to settlement', title: 'Skilled Worker visa',
          detail: `Switching to a Skilled Worker visa (you can switch from Student in-country once you have completed your course, or earlier for graduate-level jobs starting after completion) starts the 5-year clock to ILR. You need a Certificate of Sponsorship from a licensed sponsor, a job at RQF level 6 (degree level — raised from RQF 3 in July 2025), and salary of at least ${SW_THRESHOLD} or the going rate; new entrants (including recent graduates) benefit from a reduced threshold.` + src('skilledWorker'),
        });
      }
      cards.push({
        type: 'info', tag: 'Important', title: 'Timing your next application',
        detail: 'Apply for your next permission before your Student visa expires — there is no grace period after it ends. For the Graduate visa you must be in the UK, and your education provider must have reported successful completion to the Home Office. If your course was less than 12 months, work rules and dependant rules differ — check the specifics for your course.' + src('graduate') + src('student'),
      });

      steps.push('Note your Student visa expiry date and your course completion date.');
      steps.push('If choosing the Graduate route, apply before 31 December 2026 if possible to receive 2 years rather than 18 months.');
      steps.push('If you have a job offer, ask the employer to assign a Certificate of Sponsorship for a Skilled Worker switch.');
      steps.push('Do not exceed your permitted working hours during studies — breaches surface in later applications.');
    }

    // ================= ASYLUM =================
    else if (a.status === 'asylum') {
      title = 'Asylum — general information';
      sub = 'Asylum law is complex and changed substantially in March 2026. This is general information only — specialist advice is essential.';
      tone = 'warning';

      cards.push({
        type: 'info', tag: 'Major rule change', title: 'Refugee permission is now 30 months, not 5 years',
        detail: 'For asylum claims lodged on or after 2 March 2026, people recognised as refugees or granted humanitarian protection receive 30 months\' permission, subject to review, instead of the previous 5 years. Claims lodged before that date still lead to 5 years\' permission. The government has also proposed (not yet law) a much longer, 20-year path to settlement for those on the protection route — watch for the outcome of the earned settlement consultation.' + src('asylumSettlement') + src('whitePaper'),
      });

      if (a.asy_stage === 'granted') {
        cards.push({
          type: 'eligible', tag: 'Granted', title: 'Refugee status / humanitarian protection',
          detail: 'You have permission to live and work in the UK and can access public funds. If your claim was lodged before 2 March 2026 you will usually have 5 years\' leave and can apply for settlement at the end of it under the current rules; later grants are for 30 months subject to review. Keep evidence of residence and report changes of circumstances.' + src('asylumSettlement'),
        });
      } else if (a.asy_stage === 'pending') {
        cards.push({
          type: 'info', tag: 'Awaiting decision', title: 'While your claim is pending',
          detail: 'You may qualify for asylum support (accommodation and/or subsistence) if destitute — note that support eligibility rules were tightened in June 2026. You can apply for permission to work if your claim has been outstanding for more than 12 months through no fault of your own; work is restricted to jobs on the Immigration Salary List. Attend every interview and reporting appointment.' + src('asylum'),
        });
      } else if (a.asy_stage === 'refused') {
        cards.push({
          type: 'possible', tag: 'Time-sensitive', title: 'Refused — appeal deadlines are short',
          detail: 'You normally have 14 days from the date the decision was sent to appeal to the First-tier Tribunal (Immigration and Asylum Chamber). Legal aid remains available for asylum. Get legal help immediately — late appeals need special permission.' + src('appeals'),
        });
      }

      cards.push({
        type: 'info', tag: 'Get help', title: 'Free specialist support',
        detail: 'Free, regulated help is available from Refugee Council, Refugee Action, Migrant Help (0808 8010 503), the British Red Cross and local law centres. Only ever take immigration advice from an IAA-regulated adviser or a solicitor.' + src('oisc'),
      });

      steps.push('Attend all Home Office interviews and reporting events — missing them can lead to your claim being withdrawn.');
      steps.push('Contact a legal aid solicitor or specialist charity as early as possible.');
      steps.push('Keep every letter from the Home Office and the tribunal, and note the date on each one.');
      if (a.asy_stage === 'refused') steps.push('Act within 14 days of a refusal to lodge your appeal.');
    }

    // ================= DEFAULT / OTHER =================
    else {
      if (yearsLived >= 10 && goodCompliance) {
        cards.push({
          type: 'possible', tag: 'Potentially available', title: '10-year long residence (lawful residence only)',
          detail: 'With 10+ years of continuous <strong>lawful</strong> residence you may qualify for ILR under Appendix Long Residence. Since 11 April 2024: time overstaying breaks continuity, you must have had your current permission for 12 months (or been exempt from immigration control), and absences must not exceed 180 days in any 12-month period.' + src('longResidence'),
        });
      }
      cards.push({
        type: 'info', tag: 'Recommended', title: 'Take regulated advice',
        detail: 'Your situation does not fit a single standard route, so personalised advice matters. Use only advisers regulated by the Immigration Advice Authority (IAA, formerly OISC) or practising solicitors — unregulated immigration advice is a criminal offence.' + src('oisc'),
      });
      steps.push('Contact an IAA-regulated adviser (level 2 or 3) or an immigration solicitor.');
      steps.push('Gather your immigration documents: passports, decision letters, eVisa/UKVI account details, Home Office correspondence.');
      steps.push('Check whether you qualify for legal aid.');
    }

    // ================= CROSS-CUTTING FLAGS =================
    if (!lifeUKOK && (a.goal === 'ilr' || a.goal === 'citizenship') && a.status !== 'ilr') {
      cards.push({
        type: 'possible', tag: 'Plan ahead', title: 'Life in the UK Test required',
        detail: 'The Life in the UK Test is required for ILR and citizenship (ages 18–64). Book only via GOV.UK (£50) and allow time for a retake if needed.' + src('lifeInUK'),
      });
    }
    if (!englishOK && (a.goal === 'ilr' || a.goal === 'citizenship') && a.status !== 'ilr') {
      cards.push({
        type: 'possible', tag: 'Plan ahead', title: 'English language evidence needed',
        detail: 'ILR and citizenship require English at CEFR B1 or above via an approved Secure English Language Test, a degree taught in English (with Ecctis confirmation for overseas degrees), or nationality of a majority English-speaking country.' + src('english'),
      });
    }
    if (a.refusal && a.refusal !== 'no') {
      cards.push({
        type: 'possible', tag: 'Disclose', title: 'Previous refusal on record',
        detail: 'Every application asks about previous refusals; non-disclosure can itself be a ground for refusal on suitability grounds. A past refusal does not bar you, but address its reasons head-on with evidence in any new application.' + src('adminReview'),
      });
    }
    if (a.appeal_status && a.appeal_status !== 'none' && a.appeal_status !== '') {
      cards.push({
        type: 'info', tag: 'Deadlines', title: 'Appeals and administrative review — know your deadlines',
        detail: 'First-tier Tribunal appeals: 14 days from the decision being sent if you are in the UK, 28 days if outside. Administrative review (for eligible decisions, £80): 14 days in-country, 28 days out-of-country. Onward appeal to the Upper Tribunal requires permission and has its own short deadlines. Upload your decision letters in the Documents section so an adviser can check dates and grounds quickly.' + src('appeals') + src('adminReview'),
      });
    }
    if ((a.goal === 'ilr' || a.goal === 'citizenship') && a.status !== 'ilr' && a.status !== 'euss') {
      cards.push({
        type: 'info', tag: 'Proposed change', title: 'Settlement rules may change — the "earned settlement" proposals',
        detail: 'The government has proposed raising the standard qualifying period for settlement from 5 to 10 years, with shorter or longer periods depending on contribution and conduct. A consultation closed on 12 February 2026; the changes are <strong>not yet law</strong> and transitional arrangements are undecided. If you already qualify under current rules, applying sooner rather than later may be prudent.' + src('whitePaper'),
      });
    }
    if (a.pub_funds === 'yes') {
      cards.push({
        type: 'possible', tag: 'Check now', title: 'Public funds and NRPF conditions',
        detail: 'Most people with limited leave have a "no recourse to public funds" (NRPF) condition. Claiming listed public funds while subject to NRPF can lead to refusal of future applications and is a breach of conditions. Some benefits are not "public funds" and mixed households have special rules — check before you claim or stop claiming.' + src('publicFunds'),
      });
    }

    return { title, sub, tone, cards, steps };
  }

  // ---------------------------------------------------------------------
  // Q&A library — common questions, filtered by the user's circumstances.
  // `when(a)` marks a question as directly relevant to this user.
  // ---------------------------------------------------------------------
  const QA = [
    {
      id: 'evisa',
      q: 'What happened to my Biometric Residence Permit (BRP)?',
      when: (a) => a.status && a.status !== 'visitor',
      a: `<p>Physical BRP cards expired on 31 December 2024 and are no longer issued. Your immigration status is now an <strong>eVisa</strong> — a digital record you access through a UKVI account. You prove your status (to employers, landlords, airlines) with a share code. Keep your passport details up to date in your UKVI account, and keep your expired BRP if it is your only record of your visa history.</p>` + src('evisa'),
    },
    {
      id: 'sw-threshold',
      q: 'What salary do I need for a Skilled Worker visa in 2026?',
      when: (a) => a.status === 'skilled' || a.st_post === 'skilled' || a.goal === 'switch',
      a: `<p>Since 22 July 2025 the standard threshold is <strong>${SW_THRESHOLD} a year</strong> or the going rate for your occupation code, whichever is higher, and jobs must normally be at degree level (RQF 6). Lower thresholds apply for Immigration Salary List roles (£33,400), relevant PhD holders (£37,500), new entrants, and Health and Care Worker roles. The Shortage Occupation List no longer exists. The care worker route (SOC 6135/6136) closed to new applicants from overseas on 22 July 2025.</p>` + src('skilledWorker'),
    },
    {
      id: 'ilr-5yr',
      q: 'When can I apply for Indefinite Leave to Remain (ILR)?',
      when: (a) => a.goal === 'ilr' || ['skilled', 'family'].includes(a.status),
      a: `<p>Most work and family routes lead to ILR after <strong>5 years' continuous residence</strong> on the route. Continuous residence is broken by more than 180 days outside the UK in any rolling 12-month period (work routes). You also need the Life in the UK Test and English at B1. The fee is ${FEE_ILR} per person from 8 April 2026 — dependants each pay the full fee. You can apply up to 28 days before completing the qualifying period.</p>` + src('ilrWork') + src('fees'),
    },
    {
      id: 'earned-settlement',
      q: 'Is the ILR qualifying period really changing to 10 years?',
      when: (a) => a.goal === 'ilr' || a.goal === 'citizenship',
      a: `<p>It is proposed, not law. The May 2025 immigration white paper proposed a standard <strong>10-year</strong> qualifying period for settlement, reducible (or extendable) based on contribution, conduct and route — the "earned settlement" model. A consultation ran from 20 November 2025 to 12 February 2026. Until rules are actually changed, the current 5-year routes continue to apply, and how existing visa holders will be treated (transitional protection) is not yet settled. If you qualify under today's rules, consider applying without delay.</p>` + src('whitePaper'),
    },
    {
      id: 'citizenship',
      q: 'What are the requirements for British citizenship?',
      when: (a) => a.goal === 'citizenship' || a.status === 'ilr' || a.status === 'euss',
      a: `<p>For naturalisation you need: ILR or settled status (held 12 months, unless married to a British citizen), 5 years' residence (3 if married to a British citizen), presence in the UK on the date exactly 5 (or 3) years before the application, no more than 450 days' absence in the qualifying period (90 in the last year), English at B1+, the Life in the UK Test, and good character. Since February 2025, people who entered the UK illegally are normally refused on good character grounds. Fee: ${FEE_NATURALISATION}.</p>` + src('citizenship') + src('goodCharacter'),
    },
    {
      id: 'family-income',
      q: 'How much do I need to earn to sponsor my partner?',
      when: (a) => a.status === 'family' || a.goal === 'family_reunion' || a.v_partner === 'yes' || a.ov_partner === 'yes',
      a: `<p>The minimum income requirement for the partner route is <strong>£29,000 a year</strong> (or £88,500 in cash savings held 6 months), unchanged since 11 April 2024. Planned rises to £34,500 and £38,700 were shelved; the Migration Advisory Committee's June 2025 review recommended a range of about £23,000–£25,000, but as of July 2026 the government has not changed the threshold. There is no separate child element any more. Alternative sources (pension, self-employment, combining with savings) have detailed rules.</p>` + src('familyIncome'),
    },
    {
      id: 'long-residence',
      q: 'Does the 10-year long residence route still work if I overstayed?',
      when: (a) => a.status === 'overstayer' || a.totalYears === 'over_10',
      a: `<p>Generally no — this changed on 11 April 2024. Appendix Long Residence requires 10 years' continuous <strong>lawful</strong> residence; periods of overstaying break continuity (limited exceptions for short, disregarded periods of overstaying). You must also have held your current permission for 12 months and kept absences under 180 days in any 12 months. People with long residence <em>without</em> status should instead look at Appendix Private Life: 20 years' residence (any status), 7 years for children, or half-of-life for people aged 18–24.</p>` + src('longResidence') + src('privateLife'),
    },
    {
      id: 'appeal',
      q: 'How long do I have to appeal a Home Office refusal?',
      when: (a) => (a.appeal_status && a.appeal_status !== 'none') || (a.refusal && a.refusal !== 'no') || a.asy_stage === 'refused',
      a: `<p><strong>First-tier Tribunal appeal:</strong> 14 days from the date the decision was sent if you are in the UK; 28 days if you are outside. <strong>Administrative review</strong> (points-based and some other decisions, £80): 14 days in-country, 28 days out-of-country, 7 days if detained. Late appeals need the tribunal's permission with good reasons. Your refusal letter states which remedy applies — upload it in the Documents section and check the date immediately.</p>` + src('appeals') + src('adminReview'),
    },
    {
      id: 'graduate-visa',
      q: 'How long is the Graduate visa now?',
      when: (a) => a.status === 'student',
      a: `<p>2 years (3 years for PhD graduates) for applications made <strong>up to 31 December 2026</strong>. For applications on or after <strong>1 January 2027</strong> it is 18 months (36 months for PhDs). Apply from inside the UK before your Student visa expires, once your provider has reported successful completion. It cannot be extended, and time on it does not count towards the 5-year ILR routes (it does count for 10-year long residence).</p>` + src('graduate'),
    },
    {
      id: 'refugee-leave',
      q: 'How long is refugee leave, and when can refugees settle?',
      when: (a) => a.status === 'asylum',
      a: `<p>For asylum claims lodged <strong>on or after 2 March 2026</strong>, refugee status and humanitarian protection are granted for <strong>30 months</strong>, subject to review — a major reduction from the previous 5 years, which still applies to earlier claims. Settlement for those on the protection route is currently after 5 years of permission, but the government has proposed much longer qualifying periods (up to 20 years) in the earned settlement consultation; these proposals are not yet law.</p>` + src('asylumSettlement') + src('whitePaper'),
    },
    {
      id: 'euss-presettled',
      q: 'My pre-settled status is about to expire — what should I do?',
      when: (a) => a.status === 'euss',
      a: `<p>Pre-settled status is now extended automatically (the Home Office applies extensions of up to 5 years before expiry), and since early 2025 eligible people are being converted to settled status automatically using tax and benefits data. However, you should not rely on automation: once you complete 5 years' continuous residence, apply to upgrade — it is free. Keep your UKVI account and passport details current so your status can be verified.</p>` + src('euss'),
    },
    {
      id: 'eta',
      q: 'Do visitors to the UK need anything new before travelling?',
      when: (a) => a.status === 'visitor' || a.inUK === 'no',
      a: `<p>Yes — nationals who do not need a visa (including EU, US, Canadian and Australian citizens) must obtain an <strong>Electronic Travel Authorisation (ETA)</strong> before travelling. It costs £16, is applied for via the UK ETA app or GOV.UK, lasts 2 years (or until your passport expires) and allows visits of up to 6 months. Visa nationals still need a visit visa instead.</p>` + src('eta'),
    },
    {
      id: 'ihs',
      q: 'What is the immigration health surcharge and how much is it?',
      when: (a) => ['skilled', 'student', 'family'].includes(a.status) || a.goal === 'extend' || a.goal === 'switch',
      a: `<p>The immigration health surcharge (IHS) is paid with most visa applications and gives access to the NHS. It is <strong>£1,035 per year</strong> of the visa for adults, and £776 per year for students, their dependants, Youth Mobility applicants and under-18s. It is paid upfront for the whole visa length. ILR and citizenship applications do not pay the IHS.</p>` + src('ihs'),
    },
    {
      id: 'life-in-uk',
      q: 'What is the Life in the UK Test?',
      when: (a) => a.goal === 'ilr' || a.goal === 'citizenship',
      a: `<p>A 45-minute, 24-question computer test on British traditions, history and customs, required for ILR and citizenship (ages 18–64). It costs <strong>£50</strong>, is booked only via GOV.UK (beware copycat sites), and you need 75% to pass. You can retake it as many times as necessary; a pass never expires.</p>` + src('lifeInUK'),
    },
    {
      id: 'domestic-abuse',
      q: 'My relationship broke down because of domestic abuse — do I lose my visa?',
      when: (a) => a.status === 'family' || a.fam_ongoing === 'no',
      a: `<p>Not necessarily. If you are in the UK as the partner of a British citizen or settled person and the relationship broke down permanently because of domestic abuse, you can apply for <strong>immediate settlement</strong> under Appendix Victim of Domestic Abuse (which replaced the DVILR rules on 31 January 2024). There is no qualifying period, and a fee waiver is available if you cannot afford the ${FEE_ILR} fee. The Migrant Victims of Domestic Abuse Concession can give you 3 months' status-independent leave (with access to public funds) while you prepare the application.</p>` + src('vda'),
    },
    {
      id: 'child-citizenship',
      q: 'My child was born in the UK — are they British?',
      when: (a) => a.dependants_general === 'children' || a.dependants_general === 'both' || a.sw_dependants === 'children' || a.ov_ukborn_child === 'yes_not_british',
      a: `<p>A child born in the UK is automatically British only if, at the time of birth, at least one parent was British or "settled" (ILR, settled status, or Irish). Otherwise, the child can be <strong>registered</strong> as British (form MN1) once a parent becomes settled, or once the child has lived in the UK for their first 10 years. The registration fee was <strong>reduced to £1,000</strong> on 8 April 2026 (from £1,214) following litigation about child registration fees, and a fee waiver exists for children who cannot afford it.</p>` + src('registerChild') + src('fees'),
    },
    {
      id: 'nrpf',
      q: 'Can I claim benefits while on a visa?',
      when: (a) => a.pub_funds === 'yes' || a.pub_funds === 'entitled',
      a: `<p>Most limited-leave visas carry a <strong>No Recourse to Public Funds (NRPF)</strong> condition: claiming listed public funds (Universal Credit, Child Benefit, housing assistance and others) breaches your conditions and jeopardises future applications. People with ILR, refugee status or EUSS settled status are not subject to NRPF. Some payments are not "public funds" (contributory benefits, NHS care, statutory pay), and if your partner has recourse, household claims have special rules. If you are destitute you can apply for a "change of conditions" to lift NRPF.</p>` + src('publicFunds'),
    },
  ];

  function relevantQA(a) {
    const rel = [];
    const other = [];
    QA.forEach((item) => {
      try {
        (item.when(a || {}) ? rel : other).push(item);
      } catch {
        other.push(item);
      }
    });
    return { relevant: rel, other };
  }

  return { generateAssessment, relevantQA, QA };
})();
