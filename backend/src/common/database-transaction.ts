// Permission-checked writes hold row locks across several database round trips.
// Allow hosted database latency while keeping lock waits and execution bounded.
// Keep external network calls outside these transactions.
export const WRITE_TRANSACTION = { maxWait: 10_000, timeout: 30_000 };
