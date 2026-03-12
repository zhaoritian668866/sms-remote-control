/**
 * AI Learning Scheduler
 * 
 * Runs every hour to:
 * 1. Fetch unlearned Chinese conversation samples
 * 2. Analyze them with AI to generate/update learning summary
 * 3. Mark the analyzed conversations as learned
 */

import { getAiConfig, fetchUnlearnedChineseSamples, markMessagesAsLearned, updateLearningSummary } from "./db";
import { generateLearningSummaryFromSamples } from "./aiEngine";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

async function runLearningCycle(): Promise<void> {
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
      console.log("[Learning Scheduler] No new unlearned conversations found");
      return;
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

    console.log(`[Learning Scheduler] Learned ${samples.length} groups, marked ${markedCount} messages`);
  } catch (error) {
    console.error("[Learning Scheduler] Error during learning cycle:", error);
  }
}

export function startLearningScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  // Run every hour (3600000ms)
  schedulerInterval = setInterval(runLearningCycle, 3600000);

  // Also run once after 30 seconds of server start (give DB time to connect)
  setTimeout(runLearningCycle, 30000);

  console.log("[Learning Scheduler] Started - will run every 1 hour");
}

export function stopLearningScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Learning Scheduler] Stopped");
  }
}
