import { cn } from '@/lib/utils';

/**
 * "As-Is Contract" — adapted from the Exchange project-page design.
 * Makes expectations explicit at each maturity stage.
 */

interface ContractTerms {
  title: string;
  color: string;
  gets: string[];
  donts: string[];
}

const CONTRACTS: Record<string, ContractTerms> = {
  idea: {
    title: 'This is just an idea',
    color: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40',
    gets: [
      'Read the description and understand the concept.',
      'Vote to signal demand — helps prioritize builds.',
      'Comment with requirements or use cases.',
    ],
    donts: [
      'No code exists yet — nothing to run.',
      'No owner commitment to build.',
      'May be merged into a similar initiative.',
    ],
  },
  triaged: {
    title: 'Acknowledged need, not yet built',
    color: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40',
    gets: [
      'Someone has looked at this and agreed it\'s worth building.',
      'May have design notes or a linked PRD.',
    ],
    donts: [
      'No working code or artifact yet.',
      'No timeline or commitment.',
    ],
  },
  poc: {
    title: 'Use this at your own risk',
    color: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
    gets: [
      'Fork it, run it, try it out.',
      'Ask the author questions, when they have time.',
      'File bugs — they help the project graduate.',
    ],
    donts: [
      'No SLA, no on-call, no support channel.',
      'No promise it runs tomorrow, or at all.',
      'Output schema may change without notice.',
      'Nothing downstream may depend on it in production.',
    ],
  },
  validating: {
    title: 'Under active evaluation',
    color: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40',
    gets: [
      'Output shape is stabilizing — schema locked directionally.',
      'Being tested by at least one consuming team.',
      'Bug reports and feedback actively incorporated.',
    ],
    donts: [
      'Not yet certified — breaking changes still possible.',
      'Support is best-effort, not contractual.',
      'May not pass certification if eval fails.',
    ],
  },
  production_candidate: {
    title: 'Reviewed and pending certification',
    color: 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40',
    gets: [
      'Schema frozen — safe to build integrations against.',
      'Has passed all gate requirements except final sign-off.',
      'Support channel exists.',
    ],
    donts: [
      'Final certification pending — no official SLA yet.',
      'May be rolled back if blocking issues surface.',
    ],
  },
  production: {
    title: 'Certified, monitored, supported',
    color: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40',
    gets: [
      'Stable API/schema — safe to build on.',
      'Monitored with alerting and on-call rotation.',
      'Support channel and SLA documented.',
      'Breaking changes follow deprecation process.',
    ],
    donts: [
      'Changes require a review cycle — can\'t be patched ad hoc.',
      'Forking instead of contributing is discouraged.',
    ],
  },
};

export function MaturityContract({ maturity }: { maturity?: string }) {
  const stage = maturity && CONTRACTS[maturity] ? maturity : 'idea';
  const contract = CONTRACTS[stage];

  return (
    <div className={cn('rounded-xl border overflow-hidden', contract.color)}>
      <div className="px-4 py-3 border-b border-inherit flex items-center justify-between">
        <span className="font-semibold text-sm">{contract.title}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{stage} terms</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-inherit">
        <div className="p-4">
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">What you get</h4>
          <ul className="space-y-1.5">
            {contract.gets.map((item, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug">
                <span className="text-muted-foreground flex-none">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4">
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">What you don't</h4>
          <ul className="space-y-1.5">
            {contract.donts.map((item, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug">
                <span className="text-muted-foreground flex-none">×</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
