
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// আপনার প্রকাশিত ওয়েবসাইটের URL পরে এখানে বসাবেন
const APP_BASE_URL =
  process.env.BIRTHDAY_BLOOM_URL ||
  "https://birthday-wish-reminder.web.app";

const SIGNATURE = "Eng.Avijit Das Apon | Senior Software Engineer";

// Bangladesh date
function getBangladeshDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const result = {};

  for (const part of parts) {
    result[part.type] = part.value;
  }

  return {
    year: result.year,
    month: result.month,
    day: result.day,
    date: `${result.year}-${result.month}-${result.day}`
  };
}

// Daily automatic birthday notification
exports.sendBirthdayNotifications = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Asia/Dhaka",
    region: "asia-south1",
    timeoutSeconds: 300,
    memory: "256MiB"
  },
  async () => {
    const today = getBangladeshDate();

    console.log("Birthday check:", today.date);

    const birthdaySnapshot = await db
      .collection("birthdays")
      .get();

    let totalSent = 0;

    for (const birthdayDoc of birthdaySnapshot.docs) {
      const birthday = birthdayDoc.data();
      const birthdayId = birthdayDoc.id;

      if (!birthday.birthDate || !birthday.publicWishId) {
        continue;
      }

      const [, birthMonth, birthDay] =
        birthday.birthDate.split("-");

      if (
        birthMonth !== today.month ||
        birthDay !== today.day
      ) {
        continue;
      }

      const logId = `${birthdayId}_${today.date}`;
      const logRef = db.collection("notificationLogs").doc(logId);

      // Prevent duplicate notifications
      const alreadyProcessed = await db.runTransaction(async (tx) => {
        const existing = await tx.get(logRef);

        if (existing.exists) {
          return true;
        }

        tx.create(logRef, {
          birthdayId,
          date: today.date,
          status: "processing",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return false;
      });

      if (alreadyProcessed) {
        continue;
      }

      try {
        const subscriptions = await db
          .collection("pushSubscriptions")
          .where("birthdayId", "==", birthdayId)
          .where("active", "==", true)
          .get();

        if (subscriptions.empty) {
          await logRef.update({
            status: "no_subscribers"
          });
          continue;
        }

        const wishUrl =
          `${APP_BASE_URL}/?wish=${encodeURIComponent(birthday.publicWishId)}`;

        const title = `🎂 Happy Birthday ${birthday.name}!`;

        const body =
          `A special birthday wish from ${SIGNATURE} ❤️`;

        const docs = subscriptions.docs;

        let birthdaySent = 0;

        // Send in batches of 500
        for (let i = 0; i < docs.length; i += 500) {
          const batch = docs.slice(i, i + 500);
          const tokens = batch.map(item => item.data().token);

          const response = await messaging.sendEachForMulticast({
            tokens,
            data: {
              title,
              body,
              url: wishUrl
            },
            webpush: {
              headers: {
                Urgency: "high"
              }
            }
          });

          for (let j = 0; j < response.responses.length; j++) {
            const result = response.responses[j];

            if (result.success) {
              birthdaySent++;
            } else {
              const code = result.error?.code;

              console.error("Notification error:", code);

              if (
                code === "messaging/registration-token-not-registered" ||
                code === "messaging/invalid-registration-token"
              ) {
                await batch[j].ref.update({
                  active: false
                });
              }
            }
          }
        }

        totalSent += birthdaySent;

        await logRef.update({
          status: "completed",
          sentCount: birthdaySent,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

      } catch (error) {
        console.error("Birthday notification failed:", error);

        await logRef.update({
          status: "failed",
          error: String(error.message)
        });
      }
    }

    console.log("Total notifications sent:", totalSent);
  }
);
