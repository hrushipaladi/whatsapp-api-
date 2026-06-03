import express from "express";
import {
  sendReferralNotification,
  sendJdApprovedNotification,
  sendWhatsappMessage,
  sendPreferencesReminderNotification,
  sendProfileUpdatedNotification,
  sendJobApplicationUpdateNotification,
  sendInterviewRejectedNotification
} from "../controllers/whatsappController.js";

const router = express.Router();

router.post("/send-whatsapp", sendWhatsappMessage);
router.post("/send-jd-approved", sendJdApprovedNotification);
router.post("/send-referral", sendReferralNotification);
router.post("/send-preferences-reminder", sendPreferencesReminderNotification);
router.post("/send-profile-updated", sendProfileUpdatedNotification);
router.post("/send-job-application-update", sendJobApplicationUpdateNotification);
router.post("/send-interview-rejected", sendInterviewRejectedNotification);

export default router;
