import { looksLikeEduEmail, determineVerificationPath, domainMatchesInstitution } from '@/lib/utils/verification';
import { emailDomainMatches } from '@/lib/utils/institution-domain';

describe('Hungarian student emails', () => {
  it('recognises Hungarian university domains (so they reach ID upload, not "not eligible")', () => {
    for (const e of ['a@student.elte.hu', 'b@stud.uni-corvinus.hu', 'c@stud.u-szeged.hu', 'd@edu.bme.hu', 'e@semmelweis.hu']) {
      expect(looksLikeEduEmail(e)).toBe(true);
    }
  });

  it('does not treat look-alike or personal domains as universities', () => {
    for (const e of ['a@gmail.com', 'b@elte.hu.evil.com', 'c@notelte.hu', 'd@freemail.hu']) {
      expect(looksLikeEduEmail(e)).toBe(false);
    }
  });

  it('auto-verifies only when the domain is listed for an institution', () => {
    expect(determineVerificationPath('a@student.elte.hu', { name: 'Eötvös Loránd University' }).path).toBe('edu_email');
    expect(determineVerificationPath('c@stud.u-szeged.hu', null).path).toBe('id_upload');
    expect(determineVerificationPath('x@gmail.com', null).path).toBe('not_eligible');
  });

  it('matches exact domains and true sub-domains only', () => {
    expect(emailDomainMatches('student.elte.hu', 'student.elte.hu')).toBe(true);
    expect(emailDomainMatches('x.student.elte.hu', 'student.elte.hu')).toBe(true);
    expect(emailDomainMatches('elte.hu', 'student.elte.hu')).toBe(false);          // staff domain ≠ student domain
    expect(emailDomainMatches('evilstudent.elte.hu', 'student.elte.hu')).toBe(false);
    expect(domainMatchesInstitution('stud.uni-corvinus.hu', ['stud.uni-corvinus.hu'])).toBe(true);
  });
});
