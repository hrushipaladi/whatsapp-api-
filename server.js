import express from "express";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();

app.use(express.json());

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

const TOKEN = process.env.WHATSAPP_TOKEN;

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;



// Home Route
app.get("/", (req, res) => {
  res.send("Webhook server is running ");
});



// Webhook Verification Route
app.get("/webhook", (req, res) => {

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {

    console.log("Webhook verified ✅");

    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});



// Receive WhatsApp Messages
app.post("/webhook", async (req, res) => {

  try {

    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];



    // Only respond to real text messages
    if (message && message.type === "text") {

      const from = message.from;

      const text = message.text.body;

      console.log("User Message:", text);



      // Auto Reply Message
      const reply = `Hi 👋

Thank you for your message.

For further assistance, please connect with us at:
info@hiringhood.com

— Hiringhood`;



      // Send WhatsApp Reply
      await axios.post(
        `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: {
            body: reply
          }
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("Reply Sent ✅");

    }

    res.sendStatus(200);

  } catch (error) {

    console.log("ERROR:");
    console.log(error.response?.data || error.message);

    res.sendStatus(500);
  }
});



// Start Server
app.listen(3000, () => {
  console.log("Server running on port 3000 🚀");
});