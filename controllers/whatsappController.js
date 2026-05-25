import axios from "axios";
import { ObjectId } from "mongodb";
import { getClient } from "../config/db.js";

function toObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : id;
}

function getJobseekerName(jobseeker) {
  const {
    firstName,
    middleName,
    lastName
  } = jobseeker.personal_info || {};

  return [firstName, middleName, lastName]
    .filter(Boolean)
    .join(" ");
}

function getCleanPhone(phoneNumber, testPhoneNumber) {
  const phone =
    testPhoneNumber || phoneNumber;

  return String(phone || "")
    .replace(/\D/g, "")
    .slice(-10);
}

function getLocationText(locations) {
  if (!Array.isArray(locations) || locations.length === 0) {
    return "Not specified";
  }

  return locations
    .map((location) =>
      location.label ||
      location.fullData?.["Name of City"] ||
      location.name ||
      location.value
    )
    .filter(Boolean)
    .join(", ");
}

function getWorkModeText(modeOfWork, onSiteFeasibility) {
  const mode = String(modeOfWork || "").trim().toUpperCase();

  if (mode === "WFO") {
    return "On-site";
  }

  if (mode === "ON SITE" || mode === "ONSITE" || mode === "ON-SITE") {
    return "On-site";
  }

  if (mode === "WFH") {
    return "Remote";
  }

  if (mode === "HYBRID") {
    return "Hybrid";
  }

  return modeOfWork || onSiteFeasibility || "Not specified";
}

function getPercentNumber(value) {
  return String(value || "NA").replace(/%/g, "").trim();
}

function isUsableTemplateValue(value) {
  const normalized = String(value || "").trim().toLowerCase();

  return Boolean(normalized) &&
    !["na", "n/a", "other", "not specified", "hiringhood partner"].includes(normalized);
}

function getPossibleScore(scoreDoc) {
  return (
    scoreDoc?.scores?.resumeMatch?.OverallScore ||
    scoreDoc?.snsScoreResult?.resumeMatch?.OverallScore ||
    scoreDoc?.resumeMatch?.OverallScore ||
    scoreDoc?.OverallScore ||
    scoreDoc?.overallScore ||
    scoreDoc?.matchScore ||
    scoreDoc?.profileScore
  );
}

function getButtonUrlSuffix(applyLink, buttonUrlSuffix, contestId) {
  if (buttonUrlSuffix) {
    return String(buttonUrlSuffix).replace(/^\/+/, "");
  }

  const defaultSuffix =
    String(contestId);

  if (!applyLink) {
    return defaultSuffix;
  }

  try {
    const url = new URL(applyLink);

    if (
      url.hostname === "marketplace.dev.hiringhood.ai" &&
      url.pathname === "/jobseeker/jobs/uploadCv" &&
      url.searchParams.get("contestId")
    ) {
      return url.searchParams.get("contestId");
    }

    if (url.hostname === "hiringhood.ai") {
      return `${url.pathname}${url.search}`
        .replace(/^\/+/, "") || defaultSuffix;
    }
  } catch {
    return String(applyLink).replace(/^\/+/, "");
  }

  return String(applyLink).replace(/^https?:\/\/[^/]+\//, "");
}

async function findMatchScore(db, contestId, jsId) {
  const atomicScores =
    db.collection("atomicScores");

  const contestObjectId = toObjectId(contestId);
  const jobSeekerObjectId = toObjectId(jsId);
  const contestStringId = String(contestId);
  const jobSeekerStringId = String(jsId);

  let scoreDoc = await atomicScores.findOne({
    $or: [
      {
        contestId: contestObjectId,
        jobSeekerId: jobSeekerObjectId
      },
      {
        contestId: contestStringId,
        jobSeekerId: jobSeekerStringId
      },
      {
        contest_id: contestObjectId,
        jobSeeker_id: jobSeekerObjectId
      },
      {
        contest_id: contestStringId,
        jobSeeker_id: jobSeekerStringId
      },
      {
        contestId: contestObjectId,
        jsId: jobSeekerObjectId
      },
      {
        contestId: contestStringId,
        jsId: jobSeekerStringId
      }
    ]
  });

  if (scoreDoc?.scores?.resumeMatch?.OverallScore) {
    return scoreDoc.scores.resumeMatch.OverallScore;
  }

  const scoreCollections = [
    "matchscore-marketPlace",
    "jobSeekerContests",
    "wp_v1_jobSeekerContests"
  ];

  for (const collectionName of scoreCollections) {
    scoreDoc = await db.collection(collectionName).findOne({
      $or: [
        {
          contestId: contestObjectId,
          jobSeekerId: jobSeekerObjectId
        },
        {
          contestId: contestStringId,
          jobSeekerId: jobSeekerStringId
        },
        {
          contestId: contestObjectId,
          jobSeeker_id: jobSeekerObjectId
        },
        {
          contestId: contestStringId,
          jobSeeker_id: jobSeekerStringId
        }
      ]
    });

    const possibleScore =
      getPossibleScore(scoreDoc);

    if (possibleScore) {
      return possibleScore;
    }
  }

  const recruiterProfile =
    await db.collection("recruiterAddProfiles").findOne({
      $or: [
        {
          contestId: contestObjectId,
          "jobseekerDetails.jsId": jobSeekerObjectId
        },
        {
          contestId: contestObjectId,
          "jobseekerDetails.jsId": jobSeekerStringId
        },
        {
          contestId: contestObjectId,
          "jobseekerDetails._id": jobSeekerObjectId
        },
        {
          contestId: contestObjectId,
          "jobseekerDetails._id": jobSeekerStringId
        },
        {
          contestId: contestStringId,
          "jobseekerDetails.jsId": jobSeekerObjectId
        },
        {
          contestId: contestStringId,
          "jobseekerDetails.jsId": jobSeekerStringId
        },
        {
          contestId: contestStringId,
          "jobseekerDetails._id": jobSeekerObjectId
        },
        {
          contestId: contestStringId,
          "jobseekerDetails._id": jobSeekerStringId
        }
      ]
    });

  const recruiterJobseeker =
    recruiterProfile?.jobseekerDetails?.find((jobseeker) =>
      String(jobseeker.jsId) === jobSeekerStringId ||
      String(jobseeker._id) === jobSeekerStringId
    );

  const recruiterScore =
    getPossibleScore(recruiterJobseeker);

  if (recruiterScore) {
    return recruiterScore;
  }

  return "NA";
}

async function findEmployerProfile(usersProfile, userId) {
  if (!userId) {
    return null;
  }

  const userObjectId = toObjectId(userId);
  const userStringId = String(userId);

  return usersProfile.findOne({
    $or: [
      {
        _id: userObjectId
      },
      {
        _id: userStringId
      },
      {
        userId: userObjectId
      },
      {
        userId: userStringId
      }
    ]
  });
}

async function findContest(contests, contestId) {
  const contestObjectId = toObjectId(contestId);
  const contestStringId = String(contestId);

  return contests.findOne({
    $or: [
      {
        _id: contestObjectId
      },
      {
        _id: contestStringId
      },
      {
        contestId: contestObjectId
      },
      {
        contestId: contestStringId
      }
    ]
  });
}

export async function sendWhatsappMessage(req, res) {

  try {

    const { contestId, jsId, testPhoneNumber } = req.body;



    // Validation
    if (!contestId || !jsId) {
      return res.status(400).json({
        error: "Both 'contestId' and 'jsId' are required"
      });
    }



    // MongoDB Connection
    const client = await getClient();

    const db = client.db("Marketplace");

    const contests = db.collection("contests");

    const jobseeker_collection =
      db.collection("jobSeekerProfile");

    const users_profile =
      db.collection("userProfile");



    // Fetch Jobseeker
    const jobseeker =
      await jobseeker_collection.findOne({
        _id: new ObjectId(jsId)
      });

    if (!jobseeker) {
      return res.status(404).json({
        error: "Jobseeker not found"
      });
    }



    // Jobseeker Details
    const {
      firstName,
      middleName,
      lastName,
      phoneNumber
    } = jobseeker.personal_info;

    const jobseekerName =
      [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ");



    // Phone Cleanup
    const rawPhone = phoneNumber;

    const cleanPhone =
      rawPhone.replace(/\D/g, "").slice(-10);

    const jobseekerPhone =
      testPhoneNumber
        ? testPhoneNumber.replace(/\D/g, "").slice(-10)
        : cleanPhone;



    console.log("jobseekerName:", jobseekerName);
    console.log("jobseekerPhone:", `91${jobseekerPhone}`);



    // Fetch Contest Details
    const contestDetails =
      await findContest(contests, contestId);

    if (!contestDetails) {
      return res.status(404).json({
        error: "Contest not found"
      });
    }



    // Job Title
    const jobTitle =
      contestDetails.details.jobDetails.jobTitle;

    console.log("jobTitle:", jobTitle);



    // Fetch Employer Profile
    const userid = contestDetails.userId;

    const userProfile =
      await users_profile.findOne({
        _id: new ObjectId(userid)
      });

    if (!userProfile) {
      return res.status(404).json({
        error: "Employer profile not found"
      });
    }



    // Company Name
    const companyName =
      userProfile.emp_profile
      .legalNameOfTheOrganisation;

    console.log("companyName:", companyName || "NA");



    // Values required by the existing shortlist template.
    const profileScore = "85";

    const taraLink =
      "https://hiringhood.ai/tara";



    // Env Validation
    if (
      !process.env.WHATSAPP_API_URL ||
      !process.env.WHATSAPP_TOKEN ||
      !process.env.WHATSAPP_TEMPLATE_NAME
    ) {

      return res.status(500).json({
        error: "WhatsApp API configuration missing"
      });

    }



    // WhatsApp Template Payload
    const whatsappPayload = {

      messaging_product: "whatsapp",

      to: `91${jobseekerPhone}`,

      type: "template",

      template: {

        name:
          process.env.WHATSAPP_TEMPLATE_NAME,

        language: {
          code: "en"
        },

        components: [

          // Header Image
          {
            type: "header",

            parameters: [
              {
                type: "image",

                image: {
                  link:
                    "https://ecs-express-app.s3.amazonaws.com/images/uploaded-1777294691723.png"
                }
              }
            ]
          },



          // Body Variables
          {
            type: "body",

            parameters: [

              {
                type: "text",
                text: jobseekerName
              },

              {
                type: "text",
                text: jobTitle
              },

              {
                type: "text",
                text: companyName
              },

              {
                type: "text",
                text: contestId
              },

              {
                type: "text",
                text: profileScore
              },

              {
                type: "text",
                text: taraLink
              }

            ]
          }

        ]
      }
    };



    console.log(
      "Sending WhatsApp Template..."
    );



    // Send WhatsApp Message
    const response = await axios.post(

      process.env.WHATSAPP_API_URL,

      whatsappPayload,

      {
        headers: {

          Authorization:
            `Bearer ${process.env.WHATSAPP_TOKEN}`,

          "Content-Type":
            "application/json"
        }
      }
    );



    console.log(
      "WhatsApp Message Sent Successfully ✅"
    );



    // Success Response
    return res.status(200).json({

      success: true,

      message:
        "WhatsApp message sent successfully",

      data: response.data

    });

  } catch (error) {

    console.error(
      "Error in sendWhatsappMessage:"
    );

    console.error(
      error.response?.data || error.message
    );

    return res.status(500).json({

      success: false,

      message:
        "Internal server error",

      error:
        error.response?.data || error.message

    });
  }
}

export async function sendJdApprovedNotification(req, res) {

  try {

    const {
      contestId,
      jsId,
      testPhoneNumber,
      matchScore,
      thresholdScore = "80",
      interviewDays = "7",
      applyLink,
      buttonUrlSuffix
    } = req.body;



    // Validation
    if (!contestId || !jsId) {
      return res.status(400).json({
        error: "Both 'contestId' and 'jsId' are required"
      });
    }



    // MongoDB Connection
    const client = await getClient();

    const db = client.db("Marketplace");

    const contests = db.collection("contests");

    const jobseekerCollection =
      db.collection("jobSeekerProfile");

    const usersProfile =
      db.collection("userProfile");

    // Fetch Jobseeker
    const jobseeker =
      await jobseekerCollection.findOne({
        _id: toObjectId(jsId)
      });

    if (!jobseeker) {
      return res.status(404).json({
        error: "Jobseeker not found"
      });
    }

    const jobseekerName =
      getJobseekerName(jobseeker);

    const jobseekerPhone =
      getCleanPhone(
        jobseeker.personal_info?.phoneNumber,
        testPhoneNumber
      );

    if (!jobseekerPhone) {
      return res.status(400).json({
        error: "Jobseeker phone number is missing"
      });
    }



    // Fetch Contest Details
    const contestDetails =
      await findContest(contests, contestId);

    if (!contestDetails) {
      return res.status(404).json({
        error: "Contest not found"
      });
    }

    const jobDetails =
      contestDetails.details?.jobDetails || {};

    const jobTitle =
      jobDetails.jobTitle || "Not specified";

    const location =
      getLocationText(jobDetails.locations);

    const workMode =
      getWorkModeText(
        jobDetails.modeOfWork,
        jobDetails.onSiteFeasibility
      );



    // Fetch Employer Profile
    const userProfile =
      await findEmployerProfile(
        usersProfile,
        contestDetails.userId
      );

    const companyName =
      userProfile?.emp_profile
        ?.legalNameOfTheOrganisation ||
      jobDetails.otherCompanyName ||
      jobDetails.hiringFor ||
      "Hiringhood Partner";

    const savedMatchScore =
      matchScore ||
      await findMatchScore(
        db,
        contestId,
        jsId
      );

    const matchScoreNumber =
      getPercentNumber(savedMatchScore);

    const thresholdScoreNumber =
      getPercentNumber(thresholdScore);

    if (!isUsableTemplateValue(companyName)) {
      return res.status(422).json({
        error: "Company name is missing or not valid for WhatsApp notification"
      });
    }

    if (!isUsableTemplateValue(matchScoreNumber)) {
      return res.status(422).json({
        error: "Match score is missing for this contest and jobseeker"
      });
    }

    const dynamicButtonSuffix =
      getButtonUrlSuffix(
        applyLink,
        buttonUrlSuffix,
        contestId
      );

    // Env Validation
    if (
      !process.env.WHATSAPP_API_URL ||
      !process.env.WHATSAPP_TOKEN
    ) {

      return res.status(500).json({
        error: "WhatsApp API configuration missing"
      });

    }

    const templateName =
      process.env.JD_APPROVED_TEMPLATE_NAME ||
      process.env.WHATSAPP_TEMPLATE_NAME;

    if (!templateName) {
      return res.status(500).json({
        error: "JD_APPROVED_TEMPLATE_NAME or WHATSAPP_TEMPLATE_NAME is required"
      });
    }



    // WhatsApp Template Payload
    const whatsappPayload = {

      messaging_product: "whatsapp",

      to: `91${jobseekerPhone}`,

      type: "template",

      template: {

        name: templateName,

        language: {
          code: "en"
        },

        components: [
          {
            type: "body",

            parameters: [
              {
                type: "text",
                text: jobseekerName
              },
              {
                type: "text",
                text: jobTitle
              },
              {
                type: "text",
                text: companyName
              },
              {
                type: "text",
                text: location
              },
              {
                type: "text",
                text: workMode
              },
              {
                type: "text",
                text: matchScoreNumber
              },
              {
                type: "text",
                text: thresholdScoreNumber
              },
              {
                type: "text",
                text: interviewDays
              }
            ]
          }
        ]
      }
    };

    whatsappPayload.template.components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        {
          type: "text",
          text: dynamicButtonSuffix
        }
      ]
    });



    console.log("Sending JD Approved WhatsApp Template...");

    const response = await axios.post(

      process.env.WHATSAPP_API_URL,

      whatsappPayload,

      {
        headers: {

          Authorization:
            `Bearer ${process.env.WHATSAPP_TOKEN}`,

          "Content-Type":
            "application/json"
        }
      }
    );

    console.log("JD Approved WhatsApp Message Sent Successfully");

    return res.status(200).json({

      success: true,

      message:
        "JD approved WhatsApp message sent successfully",

      data: response.data

    });

  } catch (error) {

    console.error("Error in sendJdApprovedNotification:");

    console.error(
      error.response?.data || error.message
    );

    return res.status(500).json({

      success: false,

      message:
        "Internal server error",

      error:
        error.response?.data || error.message

    });
  }
}
