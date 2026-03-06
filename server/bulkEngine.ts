/**
 * Bulk SMS Task Execution Engine
 * 
 * Manages running bulk tasks with:
 * - Per-task interval timers
 * - Template variable replacement ({姓名} → contact name)
 * - Round-robin or random template selection
 * - Progress tracking and WebSocket broadcasting
 * - Pause/resume/cancel support via task status in DB
 */

import { getBulkTaskById, updateBulkTask, getTemplateById } from "./db";
import { sendSmsToDevice, broadcastToDashboard, isDeviceConnected } from "./mqttBroker";
import { createMessage, normalizePhone } from "./db";
import { getDeviceById } from "./db";

// Active task timers: taskId -> timer handle
const activeTimers = new Map<number, NodeJS.Timeout>();

/**
 * Replace {姓名} placeholder in template content with actual name
 */
function replaceVariables(template: string, contactName: string): string {
  return template.replace(/\{姓名\}/g, contactName);
}

/**
 * Select a template based on mode and current index
 */
function selectTemplateId(templateIds: number[], mode: "round_robin" | "random", currentIndex: number): number {
  if (mode === "round_robin") {
    return templateIds[currentIndex % templateIds.length];
  } else {
    return templateIds[Math.floor(Math.random() * templateIds.length)];
  }
}

/**
 * Start executing a bulk task
 */
export function startBulkTaskExecution(taskId: number) {
  // Clear any existing timer for this task
  stopBulkTaskExecution(taskId);

  // Begin the execution loop
  executeBulkStep(taskId);
}

/**
 * Stop a running bulk task execution
 */
export function stopBulkTaskExecution(taskId: number) {
  const timer = activeTimers.get(taskId);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(taskId);
  }
}

/**
 * Execute one step of the bulk task, then schedule the next
 */
async function executeBulkStep(taskId: number) {
  try {
    // Re-fetch task to get latest state
    const task = await getBulkTaskById(taskId);
    if (!task) {
      activeTimers.delete(taskId);
      return;
    }

    // Check if task should still be running
    if (task.status !== "running") {
      activeTimers.delete(taskId);
      return;
    }

    // Check if we've finished all contacts
    if (task.currentIndex >= task.totalCount) {
      await updateBulkTask(taskId, { status: "completed" });
      activeTimers.delete(taskId);
      broadcastToDashboard(task.userId, "bulk_progress", {
        taskId,
        status: "completed",
        currentIndex: task.currentIndex,
        totalCount: task.totalCount,
        successCount: task.successCount,
        failCount: task.failCount,
      });
      return;
    }

    // Parse contacts and template IDs
    const contacts: { name: string; phoneNumber: string }[] = JSON.parse(task.contacts);
    const templateIds: number[] = JSON.parse(task.templateIds);

    const contact = contacts[task.currentIndex];
    if (!contact) {
      await updateBulkTask(taskId, { status: "completed" });
      activeTimers.delete(taskId);
      return;
    }

    // Select template
    const selectedTemplateId = selectTemplateId(templateIds, task.mode, task.currentIndex);
    const template = await getTemplateById(selectedTemplateId);
    if (!template) {
      // Skip this one if template was deleted
      await updateBulkTask(taskId, {
        currentIndex: task.currentIndex + 1,
        failCount: task.failCount + 1,
      });
      scheduleNextStep(taskId, task.intervalSeconds);
      return;
    }

    // Replace variables
    const messageBody = replaceVariables(template.content, contact.name);

    // Get device info
    const device = await getDeviceById(task.deviceId);
    if (!device) {
      await updateBulkTask(taskId, { status: "cancelled" });
      activeTimers.delete(taskId);
      return;
    }

    // Check device is connected
    if (!isDeviceConnected(device.deviceId)) {
      // Device offline - mark as failed and continue
      await updateBulkTask(taskId, {
        currentIndex: task.currentIndex + 1,
        failCount: task.failCount + 1,
      });
      broadcastToDashboard(task.userId, "bulk_progress", {
        taskId,
        status: "running",
        currentIndex: task.currentIndex + 1,
        totalCount: task.totalCount,
        successCount: task.successCount,
        failCount: task.failCount + 1,
        lastContact: contact,
        lastResult: "failed",
        lastError: "设备离线",
      });
      scheduleNextStep(taskId, task.intervalSeconds);
      return;
    }

    // Send SMS via WebSocket
    const phone = normalizePhone(contact.phoneNumber);
    const result = await sendSmsToDevice(device.deviceId, phone, messageBody);

    // Save message to DB
    const msg = await createMessage({
      deviceId: task.deviceId,
      direction: "outgoing",
      phoneNumber: phone,
      contactName: contact.name,
      body: messageBody,
      status: result.success ? "sent" : "failed",
      smsTimestamp: Date.now(),
    });

    // Update task progress
    const newIndex = task.currentIndex + 1;
    const newSuccess = task.successCount + (result.success ? 1 : 0);
    const newFail = task.failCount + (result.success ? 0 : 1);
    const isCompleted = newIndex >= task.totalCount;

    await updateBulkTask(taskId, {
      currentIndex: newIndex,
      successCount: newSuccess,
      failCount: newFail,
      status: isCompleted ? "completed" : "running",
    });

    // Broadcast progress to dashboard
    broadcastToDashboard(task.userId, "bulk_progress", {
      taskId,
      status: isCompleted ? "completed" : "running",
      currentIndex: newIndex,
      totalCount: task.totalCount,
      successCount: newSuccess,
      failCount: newFail,
      lastContact: contact,
      lastResult: result.success ? "sent" : "failed",
      lastError: result.error,
      lastMessage: messageBody,
    });

    // Also broadcast the SMS status update for the chat view
    broadcastToDashboard(task.userId, "sms_status_update", {
      messageId: msg.id,
      deviceId: task.deviceId,
      status: result.success ? "sent" : "failed",
      error: result.error,
    });

    if (isCompleted) {
      activeTimers.delete(taskId);
      return;
    }

    // Schedule next step
    scheduleNextStep(taskId, task.intervalSeconds);
  } catch (err) {
    console.error(`[BulkEngine] Error executing step for task ${taskId}:`, err);
    // Try to continue after error
    try {
      const task = await getBulkTaskById(taskId);
      if (task && task.status === "running") {
        await updateBulkTask(taskId, {
          currentIndex: task.currentIndex + 1,
          failCount: task.failCount + 1,
        });
        scheduleNextStep(taskId, task.intervalSeconds);
      }
    } catch (e) {
      console.error(`[BulkEngine] Fatal error for task ${taskId}:`, e);
      activeTimers.delete(taskId);
    }
  }
}

/**
 * Schedule the next execution step after the configured interval
 */
function scheduleNextStep(taskId: number, intervalSeconds: number) {
  const timer = setTimeout(() => {
    executeBulkStep(taskId);
  }, intervalSeconds * 1000);
  activeTimers.set(taskId, timer);
}

/**
 * Get the status of all active bulk tasks (for debugging)
 */
export function getActiveBulkTaskIds(): number[] {
  return Array.from(activeTimers.keys());
}
