import cron from "node-cron";
import Schedule from "./models/Schedule.js";
import { sendControlCommand } from "./mqttClient.js";

export function startScheduler() {
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const schedules = await Schedule.find({ active: true });

    for (const schedule of schedules) {
      const execTime = new Date(schedule.time);

      if (
        execTime.getHours() === now.getHours() &&
        execTime.getMinutes() === now.getMinutes()
      ) {
        console.log("⏰ Running schedule:", schedule);
        sendControlCommand(schedule.deviceId, schedule.action);

        if (schedule.repeat === "once") {
          schedule.active = false;
          await schedule.save();
        }
      }
    }
  });

  console.log("✅ Scheduler started");
}
