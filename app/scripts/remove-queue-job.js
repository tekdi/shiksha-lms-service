/**
 * Remove a BullMQ job by id (e.g. stuck "active" recalculate-progress job).
 *
 * If remove() fails because the job is locked, deletes the Redis lock key and retries once
 * (safe when the worker died but Redis still holds the lock).
 *
 * Usage (from app/):
 *   node scripts/remove-queue-job.js '<jobId>'
 *   JOB_ID='...' node scripts/remove-queue-job.js
 *
 * Loads REDIS_* from .env in the current working directory (optional).
 */
require('dotenv').config();

const { Queue } = require('bullmq');
const Redis = require('ioredis');

const QUEUE_NAME = 'recalculate-progress';

async function removeWithLockFallback(queue, connection, job) {
  try {
    await job.remove();
    return true;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (!msg.includes('locked') && !msg.includes('could not be removed')) {
      throw err;
    }
    const lockKey = queue.toKey(job.id) + ':lock';
    const deleted = await connection.del(lockKey);
    console.warn(`Lock issue — deleted Redis key "${lockKey}" (${deleted} key(s)). Retrying remove...`);
    await job.remove();
    return true;
  }
}

async function main() {
  const jobId = process.argv[2] || process.env.JOB_ID;
  if (!jobId || jobId === '--help' || jobId === '-h') {
    console.error('Usage: node scripts/remove-queue-job.js <jobId>');
    console.error('   or: JOB_ID=<jobId> node scripts/remove-queue-job.js');
    process.exit(1);
  }

  const host = process.env.REDIS_HOST;
  if (!host) {
    console.error('REDIS_HOST is not set. Export it or add it to .env');
    process.exit(1);
  }

  const connection = new Redis({
    host,
    port: Number(process.env.REDIS_PORT || 6379),
    db: Number(process.env.REDIS_DB || 0),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  });

  const queue = new Queue(QUEUE_NAME, { connection });

  try {
    await queue.waitUntilReady();
    const job = await queue.getJob(jobId);
    if (!job) {
      console.error(`Job not found in queue "${QUEUE_NAME}": ${jobId}`);
      console.error('Check REDIS_HOST / REDIS_DB match the app, and quote the id if it contains special characters.');
      process.exit(1);
    }

    const state = await job.getState();
    console.log(`Job ${jobId} current state: ${state}`);

    await removeWithLockFallback(queue, connection, job);
    console.log(`Removed job ${jobId} OK`);
  } finally {
    await queue.close();
    connection.quit();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
