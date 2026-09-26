/**
 * Fixture transcripts for the scorer-stability harness.
 *
 * These are SYNTHETIC — written to span the quality range the scorer has to
 * separate, not taken from any real candidate. They exist so the harness can
 * run on a fresh database; once you have real completed screens, the harness
 * prefers those, because fixture answers are cleaner than real speech.
 *
 * `expectedBand` is the author's intent, used only to spot gross miscalibration
 * (a "weak" set scoring 90). It is NOT ground truth and is never used to grade
 * the model — a fixture's label is one person's opinion.
 */
export interface FixtureTranscript {
  id: string;
  role: string;
  /** Author's intent for a sanity check, not ground truth. */
  expectedBand: 'strong' | 'mixed' | 'weak' | 'borderline';
  note: string;
  qa: { question: string; answer: string }[];
}

const QUESTIONS = [
  'Tell me about a time you had to make a technical decision with incomplete information. How did you approach it?',
  'Describe a project where you had to work closely with people outside engineering. What was hard about it?',
  'Walk me through how you would debug a service that is intermittently slow in production.',
];

export const FIXTURES: FixtureTranscript[] = [
  {
    id: 'strong-detailed',
    role: 'Senior Backend Engineer',
    expectedBand: 'strong',
    note: 'Specific, quantified, owns tradeoffs',
    qa: [
      {
        question: QUESTIONS[0],
        answer:
          'We had to pick a queue for an order pipeline with maybe six weeks of runway and no real load data. I wrote down what we actually knew: peak was around 400 orders a minute in the busiest hour, we needed at-least-once delivery, and the team had no Kafka experience. I built two throwaway prototypes over about four days, one on SQS and one on Kafka, and load tested both at three times projected peak. SQS held up and the operational burden was far lower, so we went with it. I documented the specific condition that would make us revisit — sustained throughput above about 2000 a minute, or a need for replay beyond fourteen days. We hit neither in two years. The thing I got wrong was underestimating the cost of FIFO queues at that volume, which added roughly 800 dollars a month we had not budgeted.',
      },
      {
        question: QUESTIONS[1],
        answer:
          'I spent two quarters embedded with the payments operations team. The hard part was that their definition of a failed payment and ours were different. Ours meant the gateway returned an error. Theirs included payments that succeeded but got reconciled to the wrong account, which our system considered a success. We were reporting a 0.3 percent failure rate while they were manually fixing about 2 percent. I sat with two of their analysts for a full day and watched them work, which is where that gap became obvious. We ended up adding a reconciliation status separate from gateway status. It cut their manual work substantially, though I would say the bigger win was that we stopped arguing about whose number was right.',
      },
      {
        question: QUESTIONS[2],
        answer:
          'First I would want to know whether slow means latency at the median or in the tail, because those point at completely different causes. I would pull p50, p95 and p99 over a window that covers a few of the incidents and look at whether the whole distribution shifted or just the tail got fatter. A fat tail with a stable median usually means contention, a slow dependency, or garbage collection. Then I would check whether the slowness correlates with anything: deploy times, traffic shape, a specific customer, a particular database shard. If tracing is in place I would look at span breakdowns for slow requests versus fast ones on the same endpoint. The mistake I have made before is jumping to profiling too early, which tells you where CPU goes but not much if you are actually blocked on IO.',
      },
    ],
  },
  {
    id: 'mixed-uneven',
    role: 'Senior Backend Engineer',
    expectedBand: 'mixed',
    note: 'One strong answer, two thin ones',
    qa: [
      {
        question: QUESTIONS[0],
        answer:
          'We needed to choose between rewriting our auth service or patching it. I looked at how many incidents it had caused in the last six months, which was about nine, and how much of the code we actually understood. We decided to patch the two worst paths and plan a rewrite for the following quarter. It was the right call because the rewrite would have taken longer than we had before an audit deadline.',
      },
      {
        question: QUESTIONS[1],
        answer:
          'I have worked with design and product a lot. Communication is really important. You have to make sure everyone is on the same page and understands the requirements before you start building, otherwise you waste time.',
      },
      {
        question: QUESTIONS[2],
        answer:
          'I would look at the logs and the metrics dashboard to see what is going on. Then I would probably check the database because that is usually where slowness comes from. If it is not that I would look at the code that handles the request.',
      },
    ],
  },
  {
    id: 'borderline-generic',
    role: 'Senior Backend Engineer',
    expectedBand: 'borderline',
    note: 'Reads competent, says almost nothing concrete — the hardest case to score consistently',
    qa: [
      {
        question: QUESTIONS[0],
        answer:
          'This comes up a lot in engineering. My approach is to gather as much information as I can in the time available, identify the key risks, and then make a decision I can defend. I try to make decisions reversible where possible, so if new information comes in we can change course without a lot of rework. I also make sure to document the reasoning so the team understands why we went a particular direction.',
      },
      {
        question: QUESTIONS[1],
        answer:
          'Working cross-functionally is something I enjoy. The main challenge is usually that different teams have different priorities and vocabulary. I focus on building relationships early, over-communicating status, and translating technical constraints into terms that make sense for the other side. That usually resolves most of the friction before it becomes a problem.',
      },
      {
        question: QUESTIONS[2],
        answer:
          'I would take a systematic approach. Start with monitoring and observability data to narrow down where the latency is coming from, form a hypothesis, and test it. Intermittent issues are harder because they are not always reproducible, so I would look for patterns in when it happens. Once I find the root cause I would fix it and add monitoring so we catch it earlier next time.',
      },
    ],
  },
  {
    id: 'weak-short',
    role: 'Senior Backend Engineer',
    expectedBand: 'weak',
    note: 'Minimal content',
    qa: [
      {
        question: QUESTIONS[0],
        answer: 'I usually just ask my manager or a senior engineer what they think and go with that.',
      },
      {
        question: QUESTIONS[1],
        answer: 'Yeah I have done that before. It went fine.',
      },
      {
        question: QUESTIONS[2],
        answer: 'I would restart the service and see if that fixes it. Usually it does.',
      },
    ],
  },
  {
    id: 'strong-spoken-disfluent',
    role: 'Senior Backend Engineer',
    expectedBand: 'strong',
    note: 'Same substance as strong-detailed, rendered as raw ASR: no punctuation, fillers, restarts. Should score close to it — a large gap means the scorer is grading transcription, not the candidate.',
    qa: [
      {
        question: QUESTIONS[0],
        answer:
          'um so we had to pick a queue for an order pipeline and we had maybe six weeks and no real load data so i i wrote down what we actually knew peak was around four hundred orders a minute in the busiest hour we needed at least once delivery and the team had no kafka experience so i built two throwaway prototypes over about four days one on sqs one on kafka and load tested both at like three times projected peak and sqs held up and the the operational burden was way lower so we went with it and i documented the specific condition that would make us revisit it so sustained throughput above about two thousand a minute or needing replay beyond fourteen days and we hit neither in two years the thing i got wrong was underestimating the cost of fifo queues at that volume which added like eight hundred dollars a month we hadnt budgeted',
      },
      {
        question: QUESTIONS[1],
        answer:
          'so i spent two quarters embedded with the the payments ops team and the hard part was that their definition of a failed payment and ours were different ours meant the gateway returned an error theirs included payments that succeeded but got reconciled to the wrong account which our system counted as a success so we were reporting like point three percent failure while they were manually fixing about two percent and i sat with two of their analysts for a full day and watched them work and thats where the gap became obvious we ended up adding a reconciliation status separate from gateway status which cut their manual work a lot but honestly the bigger win was we stopped arguing about whose number was right',
      },
      {
        question: QUESTIONS[2],
        answer:
          'ok so first i i would want to know whether slow means latency at the median or in the tail because those point at completely different causes so i would pull p fifty p ninety five p ninety nine over a window covering a few of the incidents and look at whether the whole distribution shifted or just the tail got fatter a fat tail with a stable median usually means contention or a slow dependency or gc and then i would check whether the slowness correlates with anything deploy times traffic shape a specific customer a particular database shard and if tracing is in place look at span breakdowns for slow requests versus fast ones on the same endpoint the mistake ive made before is jumping to profiling too early which tells you where cpu goes but not much if youre actually blocked on io',
      },
    ],
  },
];
