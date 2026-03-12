/**
 * AI Learning Scheduler
 * 
 * Automatically learns from Chinese conversation data:
 * 1. Runs every 5 minutes to fetch unlearned Chinese conversation samples
 * 2. Analyzes them with AI to generate/update learning summary
 * 3. Marks the analyzed conversations as learned
 * 4. Also triggered when new messages arrive (debounced)
 */

import { getAiConfig, fetchUnlearnedChineseSamples, markMessagesAsLearned, updateLearningSummary } from "./db";
import { generateLearningSummaryFromSamples } from "./aiEngine";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

async function runLearningCycle(): Promise<void> {
  // Prevent concurrent runs
  if (isRunning) {
    console.log("[Learning Scheduler] Already running, skipping...");
    return;
  }
  isRunning = true;

  try {
    const config = await getAiConfig();
    if (!config || !config.isEnabled || !config.learningEnabled) {
      return; // Learning not enabled, skip
    }
    if (!config.apiUrl || !config.apiKey || !config.modelName) {
      return; // AI not configured, skip
    }

    // Fetch unlearned samples (up to 20 per cycle)
    const samples = await fetchUnlearnedChineseSamples(20);
    if (samples.length === 0) {
      return; // No new data to learn
    }

    console.log(`[Learning Scheduler] Found ${samples.length} unlearned conversation groups, analyzing...`);

    // Generate/update learning summary
    const newSummary = await generateLearningSummaryFromSamples(
      config.apiUrl, config.apiKey, config.modelName,
      samples, config.learningSummary,
    );
    await updateLearningSummary(newSummary);

    // Mark conversations as learned
    const phoneNumbers = samples.map(s => s.phoneNumber);
    const markedCount = await markMessagesAsLearned(phoneNumbers);

    console.log(`[Learning Scheduler] Learned ${samples.length} groups, marked ${markedCount} messages, summary updated`);
  } catch (error) {
    console.error("[Learning Scheduler] Error during learning cycle:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Trigger a learning cycle with debounce (e.g., when new messages arrive).
 * Waits 60 seconds after the last trigger to batch multiple messages.
 */
export function triggerLearning(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    runLearningCycle().catch(console.error);
  }, 60000); // Wait 60 seconds after last message before learning
}

export function startLearningScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  // Run every 5 minutes (300000ms) instead of every hour
  schedulerInterval = setInterval(runLearningCycle, 300000);

  // Also run once after 15 seconds of server start (give DB time to connect)
  setTimeout(runLearningCycle, 15000);

  console.log("[Learning Scheduler] Started - will run every 5 minutes");
}

export function stopLearningScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  console.log("[Learning Scheduler] Stopped");
}
