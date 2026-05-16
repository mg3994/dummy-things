/**
 * Google Apps Script for Antinna Hardware & Repair
 * Handles contact form submissions from the Blogger template.
 */

function doPost(e) {
  try {
    var params = e.parameter;

    // Extract form data
    var name = params.name || "Anonymous";
    var email = params.email || "No email provided";
    var phone = params.phone || "";
    var message = params.message || "No message provided";

    // Phone format validation (Simple regex for international format)
    if (phone && !isValidPhone(phone)) {
       return ContentService.createTextOutput(JSON.stringify({
        "status": "error",
        "message": "Invalid phone number format. Please include country code (e.g., +91...)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1. Send Email Notification
    var adminEmail = "contact@antinna.in";
    var subject = "New Inquiry: " + name;
    var body = "You have a new inquiry from your website:\n\n" +
               "Name: " + name + "\n" +
               "Email: " + email + "\n" +
               "Phone: " + phone + "\n\n" +
               "Message:\n" + message;

    GmailApp.sendEmail(adminEmail, subject, body, {
      replyTo: email
    });

    // 2. Log to Google Sheets (if a Spreadsheet ID is provided in script properties)
    var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (spreadsheetId) {
      var sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
      sheet.appendRow([new Date(), name, email, phone, message]);
    }

    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "message": "Message sent successfully!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Antinna API is active and ready to receive submissions.")
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Validates phone number format.
 * Note: For real-world OTP verification, you would integrate a service like Twilio.
 */
function isValidPhone(phone) {
  var phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}
