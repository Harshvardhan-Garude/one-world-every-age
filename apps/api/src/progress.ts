import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { curatedLessonSchema, learningAttemptSchema, learningResultSchema, progressSchema } from '@beacon/contracts';
import { BackendError } from './errors.js';

// This module and its rubrics are server-only. No browsing evidence is stored.
const cases = [
  ['link-check', 'privacy', 'A new game guide asks for a one-time login code. What matters?', 'The guide asks for a private sign-in code.', 'A sign-in code can give someone access to my account.', 'Keep the code private and open the game independently.', false],
  ['private-chat', 'privacy', 'Someone asks you to move to a secret chat and send your address. What matters?', 'The request combines secrecy and personal information.', 'I can pause without sharing my address.', 'Stop and ask a trusted person for help.', false],
  ['toll-check', 'financial', 'An unfamiliar toll message demands card details in one hour. What matters?', 'The deadline and unfamiliar payment destination.', 'A displayed name does not verify where payment goes.', 'Check the toll account through an independently known channel.', false],
  ['check-forward', 'financial', 'A job offer sends a check and asks you to forward part of it. What matters?', 'The request to forward money before verification.', 'Available funds do not establish a genuine check.', 'Verify the employer independently before moving money.', false],
  ['gift-card', 'financial', 'A caller demands gift cards to settle an official bill. What matters?', 'The unusual payment method and pressure.', 'Urgency does not verify a caller or debt.', 'Hang up and call the provider using a known number.', false],
  ['image-context', 'claim', 'A dramatic image has no date or source. What can you conclude?', 'Not enough evidence to verify the claim.', 'An image alone does not establish place or date.', 'Look for an original source and independent context.', true],
  ['date-source', 'claim', 'Two posts disagree about an event date. What matters?', 'The dated original organizer notice.', 'A current primary source is stronger evidence than repetition.', 'Check the organizer independently.', false],
  ['quoted-lesson', 'judgment', 'A lesson quotes a scam and asks for no information. How should you respond?', 'Recognize the educational context.', 'Quoting a request is different from making one.', 'Read the context without accusing the lesson of fraud.', true],
  ['incomplete-invite', 'judgment', 'An invitation omits organizer details. What can you conclude?', 'The evidence is incomplete.', 'Missing details alone do not prove dishonesty.', 'Verify the organizer independently before sharing details.', true],
] as const;
const lessons = cases.map(([id, category, question, choice, reason, action, careful]) => ({
  public: curatedLessonSchema.parse({ challenge: { id, version: 1, credit_key: id, category, question, choices: [{ id: 'observe', text: choice }, { id: 'appearance', text: 'Decide from a familiar logo or attractive design.' }] }, reasons: [{ id: 'evidence', text: reason }, { id: 'popular', text: 'Many people shared it, so it must be right.' }], actions: [{ id: 'independent', text: action }, { id: 'comply', text: 'Follow the request immediately.' }] }),
  correctChoiceId: 'observe', requiredReasonId: 'evidence', requiredActionId: 'independent', careful,
  feedback: `${reason} ${action}`,
}));
export class ProgressStore {
  #db: DatabaseSync;
  #closed = false;
  constructor(path = ':memory:') {
    this.#db = new DatabaseSync(path);
    this.#db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=2000;
      CREATE TABLE IF NOT EXISTS identities (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, identity TEXT NOT NULL, challenge TEXT NOT NULL, revealed INTEGER NOT NULL DEFAULT 0, UNIQUE(identity,challenge));
      CREATE TABLE IF NOT EXISTS credits (identity TEXT NOT NULL, credit_key TEXT NOT NULL, category TEXT NOT NULL, careful INTEGER NOT NULL, PRIMARY KEY(identity,credit_key));
      CREATE TABLE IF NOT EXISTS attempts (identity TEXT NOT NULL, key TEXT NOT NULL, payload TEXT NOT NULL, result TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(identity,key));`);
  }
  identify(token?: string) {
    if (token !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new BackendError(400, 'INVALID_REQUEST', 'Invalid anonymous progress token.');
    const issued = token ?? randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(issued).digest('hex');
    const previous = this.#db.prepare('SELECT id FROM identities WHERE token_hash=?').get(hash) as { id: string } | undefined;
    if (token && !previous) throw new BackendError(404, 'NOT_FOUND', 'Anonymous progress is unavailable. Reset local progress to start again.');
    const id = previous?.id ?? randomUUID();
    if (!previous) this.#db.prepare('INSERT INTO identities VALUES (?,?)').run(id, hash);
    return { id, token: issued };
  }
  catalog() { return lessons.map(l => l.public); }
  issue(identity: string, challengeId: string) {
    const lesson = lessons.find(l => l.public.challenge.id === challengeId); if (!lesson) throw new BackendError(404, 'NOT_FOUND', 'Curated challenge unavailable.');
    this.#db.prepare('INSERT OR IGNORE INTO runs(id,identity,challenge) VALUES (?,?,?)').run(randomUUID(), identity, challengeId);
    const run = this.#db.prepare('SELECT id,revealed FROM runs WHERE identity=? AND challenge=?').get(identity, challengeId) as { id: string; revealed: number };
    return { runId: run.id, practiceOnly: !!run.revealed, ...lesson.public };
  }
  progress(identity: string) {
    const rows = this.#db.prepare('SELECT credit_key, category, careful FROM credits WHERE identity=? ORDER BY credit_key').all(identity) as { credit_key: string; category: string; careful: number }[];
    const count = (category: string) => rows.filter(r => r.category === category).length;
    const badges: string[] = [];
    if (rows.length >= 1) badges.push('First Safe Step');
    if (count('financial') >= 3) badges.push('Scam Pattern Spotter');
    if (count('privacy') >= 2) badges.push('Privacy Protector');
    if (count('claim') >= 2 && rows.some(r => r.credit_key === 'image-context')) badges.push('Evidence Explorer');
    if (rows.filter(r => r.careful).length >= 2) badges.push('Careful Thinker');
    return progressSchema.parse({ credits: rows.length, creditKeys: rows.map(r => r.credit_key), badges, status: rows.length >= 6 && new Set(rows.map(r => r.category)).size >= 3 ? 'Safety Guide' : rows.length >= 3 ? 'Learner' : 'Explorer', notice: 'Anonymous learning progress, not safety certification. Stored on this local server; this browser keeps a progress-only resume token. Clearing or sharing it can reset or share progress. No identity-level anti-abuse claim.' });
  }
  reveal(identity: string, runId: string) {
    const run = this.#db.prepare('SELECT challenge FROM runs WHERE id=? AND identity=?').get(runId, identity) as { challenge: string } | undefined;
    if (!run) throw new BackendError(404, 'NOT_FOUND', 'Owned challenge run unavailable.');
    this.#db.prepare('UPDATE runs SET revealed=1 WHERE id=? AND identity=?').run(runId, identity);
    return { feedback: lessons.find(l => l.public.challenge.id === run.challenge)!.feedback, practiceOnly: true };
  }
  submit(identity: string, input: unknown) {
    const attempt = learningAttemptSchema.parse(input), payload = JSON.stringify(attempt);
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.#db.prepare('SELECT payload,result FROM attempts WHERE identity=? AND key=?').get(identity, attempt.idempotencyKey) as { payload: string; result: string } | undefined;
      if (prior) {
        if (prior.payload !== payload) throw new BackendError(409, 'CONFLICT', 'An idempotency key cannot be reused for another answer.');
        this.#db.exec('COMMIT'); return learningResultSchema.parse(JSON.parse(prior.result));
      }
      const recent = this.#db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE identity=? AND created>?').get(identity, Date.now() - 60000) as { n: number };
      if (recent.n >= 30) throw new BackendError(429, 'LIMITED', 'Take a short break before more practice.', true);
      const run = this.#db.prepare('SELECT challenge,revealed FROM runs WHERE id=? AND identity=?').get(attempt.runId, identity) as { challenge: string; revealed: number } | undefined;
      const lesson = lessons.find(l => l.public.challenge.id === attempt.challengeId);
      if (!run || !lesson || run.challenge !== attempt.challengeId) throw new BackendError(404, 'NOT_FOUND', 'Owned challenge run unavailable.');
      const c = lesson.public.challenge;
      if (attempt.version !== c.version || attempt.credit_key !== c.credit_key) throw new BackendError(409, 'CONFLICT', 'Load the current curated challenge.');
      if (!attempt.interpretedChoiceConfirmed || !c.choices.some(x => x.id === attempt.choiceId) || !lesson.public.reasons.some(x => x.id === attempt.reasonId) || !lesson.public.actions.some(x => x.id === attempt.actionId)) throw new BackendError(400, 'INVALID_REQUEST', 'Confirm a valid observation, reason and action.');
      const correct = attempt.choiceId === lesson.correctChoiceId && attempt.reasonId === lesson.requiredReasonId && attempt.actionId === lesson.requiredActionId;
      const independent = !run.revealed;
      let creditAwarded = false;
      if (correct && independent) creditAwarded = Number(this.#db.prepare('INSERT OR IGNORE INTO credits VALUES (?,?,?,?)').run(identity, c.credit_key, c.category, Number(lesson.careful)).changes) === 1;
      // All feedback reveals the rubric: subsequent attempts are practice-only.
      this.#db.prepare('UPDATE runs SET revealed=1 WHERE id=?').run(attempt.runId);
      const result = learningResultSchema.parse({ correct, independent, creditAwarded, feedback: `${correct ? 'That choice fits the evidence.' : 'Keep practicing; there is no penalty.'} ${lesson.feedback}`, progress: this.progress(identity) });
      this.#db.prepare('INSERT INTO attempts VALUES (?,?,?,?,?)').run(identity, attempt.idempotencyKey, payload, JSON.stringify(result), Date.now());
      this.#db.exec('COMMIT'); return result;
    } catch (e) { this.#db.exec('ROLLBACK'); throw e; }
  }
  reset(identity: string) {
    this.#db.exec('BEGIN IMMEDIATE');
    try { for (const table of ['attempts', 'credits', 'runs']) this.#db.prepare(`DELETE FROM ${table} WHERE identity=?`).run(identity); this.#db.exec('COMMIT'); }
    catch (e) { this.#db.exec('ROLLBACK'); throw e; }
    return this.progress(identity);
  }
  close() { if (!this.#closed) { this.#closed = true; this.#db.close(); } }
}
