/** Falcon SST Manager - Web App v3.5 **/
/** Falcon EDU © 2023-2025 All Rights Reserved **/
/** Created by: Nick Zagorin **/

//////////////////////
// GLOBAL CONSTANTS //
//////////////////////

const STUDENT_DATA_SHEET = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Student Data');
const MEETING_DATA_SHEET = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Meeting Data');

///////////////////////////
// PAGE RENDER FUNCTIONS //
///////////////////////////

/** Render the web app in the browser **/
function doGet(e) {
  const userSettings = getUserSettings();
  const page = e.parameter.page || "dashboard";
  const htmlTemplate = HtmlService.createTemplateFromFile(page);
  
  // Inject the user properties into the HTML
  htmlTemplate.userSettings = JSON.stringify(userSettings);

  return HtmlService.createHtmlOutput(htmlTemplate.evaluate().getContent())
    .setContent(htmlTemplate.evaluate().getContent().replace("{{NAVBAR}}", getNavbar(page)))
    .setFaviconUrl("https://meesterzee.github.io/FalconEDU/images/Falcon%20EDU%20Favicon%2032x32.png")
    .setTitle("Falcon SST Manager");
}

/** Create navigation/menu bar **/
function getNavbar(activePage) {
  const dashboardURL = getScriptURL();
  const dataURL = getScriptURL("page=data");
  const settingsURL = getScriptURL("page=settings");
  
  // Set the app header
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentYear = new Date().getFullYear();
  const schoolYear = scriptProperties.getProperty('schoolYear') || (currentYear + '-' + (currentYear + 1));
  const headerText = "Falcon SST Manager - " + schoolYear;

  let navbar = 
    `<div class="menu-bar">
      <button class="menu-button" onclick="showNav()">
        <div id="menu-icon">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>
      <h1 id="header-text">` + headerText + `</h1>
    </div>
    <div class="nav-bar" id="nav-bar-links">
      <a href="${dashboardURL}" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">
        <i class="bi bi-person-circle"></i>Dashboard
      </a>
      <a href="${dataURL}" class="nav-link ${activePage === 'data' ? 'active' : ''}">
        <i class="bi bi-bar-chart-line"></i>Data
      </a>
      <a href="${settingsURL}" class="nav-link ${activePage === 'settings' ? 'active' : ''}">
        <i class="bi bi-gear-wide-connected"></i>Settings
      </a>
      <button class="nav-button" onclick="showAbout()">
        <i class="bi bi-info-circle"></i>About
      </button>
    </div>
    <div class="javascript-code">
    <script>
      function showNav() {
        const icon = document.getElementById('menu-icon');
        const navbar = document.querySelector('.nav-bar');
        icon.classList.toggle('open');
        navbar.classList.toggle('show');
      }

      function showAbout() {
        const title = "<i class='bi bi-info-circle'></i>About Falcon SST Manager";
        const message = "Web App Version: 3.5<br>Build: 33.020325<br><br>Created by: Nick Zagorin<br>© 2024-2025 - All rights reserved";
        showModal(title, message, "Close");
      }
    </script>
    </div>`;

  return navbar;
}

/** Get URL of the Google Apps Script web app **/
function getScriptURL(qs = null) {
  let url = ScriptApp.getService().getUrl();
  if(qs){
    if (qs.indexOf("?") === -1) {
      qs = "?" + qs;
    }
    url = url + qs;
  }

  return url;
}

/** Include additional files in HTML **/
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/////////////////////////
// DASHBOARD FUNCTIONS //
/////////////////////////

/** Get student data **/
function getStudentData() {
  return getSheetData(STUDENT_DATA_SHEET);
}

/** Get meeting data **/
function getMeetingData() {
  return getSheetData(MEETING_DATA_SHEET);
}

/** Get sheet data **/
function getSheetData(sheet) {
  const lastRow = sheet.getLastRow();
  
  // Return empty array if there are no data rows
  if (lastRow <= 1) {
    return [];
  }

  // Get all headers and data in just two API calls
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues();
  
  // Map the data to objects using array methods
  return data.map(row => {
    return headers.reduce((obj, header, index) => {
      obj[header] = row[index];
      return obj;
    }, {});
  });
}

/** Get ID cache **/
function getIDCache() {
  const sheets = [
    STUDENT_DATA_SHEET,
    MEETING_DATA_SHEET
  ];
    
  const ids = sheets.reduce((acc, sheet) => {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const rangeValues = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
      acc.push(...rangeValues.flat());
    }
    return acc;
  }, []);

  return ids;
}

////////////////////
// DATA FUNCTIONS //
////////////////////

/** Save student data **/
function saveStudentData(studentData, meetingData) {
  const studentID = studentData[0][0]; // First column contains the student ID
  const studentStatus = studentData[0][1]; // Second column contains the student status
  const studentDataSheet = STUDENT_DATA_SHEET;
  const meetingDataSheet = MEETING_DATA_SHEET;
    
  // Get all student data at once
  const studentDataSheetLastRow = studentDataSheet.getLastRow();
  if (studentDataSheetLastRow <= 1) {
    throw new Error('MISSING_STUDENT_DATA');
  }
  
  const allStudentData = studentDataSheet.getRange(2, 1, studentDataSheetLastRow - 1, studentData[0].length).getDisplayValues();
   
  // Check for duplicate student ID's
  const duplicateCount = allStudentData.filter(row => row[0] === studentID).length;
  if (duplicateCount > 1) {
    throw new Error('DUPLICATE_ENTRY');
  }
    
  // Find student by ID
  const studentIndex = allStudentData.findIndex(row => row[0] === studentID);
  if (studentIndex === -1) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }

  // Validate student status
  const currentStatus = allStudentData[studentIndex][1];
  if (currentStatus !== studentStatus) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }
    
  // Update student data
  studentDataSheet.getRange(studentIndex + 2, 1, 1, studentData[0].length).setValues(studentData);
    
  // Process meeting data if provided
  if (meetingData?.length > 0) {
    const meetingID = meetingData[0][0];
    let meetingDataSheetLastRow = meetingDataSheet.getLastRow();
      
    if (meetingDataSheetLastRow > 1) {
      // Get all meeting data at once with formatted values
      const allMeetingData = meetingDataSheet.getRange(2, 1, meetingDataSheetLastRow - 1, meetingData[0].length).getDisplayValues();
        
      const meetingIndex = allMeetingData.findIndex(row => row[0] === meetingID);
      if (meetingIndex === -1) {
        throw new Error('MISSING_MEETING_ENTRY');
      }
        
      // Update meeting data
      meetingDataSheet.getRange(meetingIndex + 2, 1, 1, meetingData[0].length).setValues(meetingData);

      // Get the updated sheet rows/columns and sort by date
      meetingDataSheetLastRow = meetingDataSheet.getLastRow();
      let meetingDataSheetLastColumn = meetingDataSheet.getLastColumn();
      
      if (meetingDataSheetLastRow > 1) {
        meetingDataSheet.getRange(2, 1, meetingDataSheetLastRow - 1, meetingDataSheetLastColumn)
          .sort({ column: 4, ascending: true });
      }
    }
  }

  // Format the sheets
  studentDataSheet.getRange('A:A').setNumberFormat('000000'); // Set ID format
  studentDataSheet.getRange('U:U').setNumberFormat('HH:mm'); // Set time format
  meetingDataSheet.getRange('A:B').setNumberFormat('000000'); // Set ID format
  meetingDataSheet.getRange('M:M').setNumberFormat('HH:mm'); // Set time format

  return true;
}

/** Update student status:  active, watch, archive **/
function updateStudentStatus(studentID, studentStatus) {
  const studentDataSheet = STUDENT_DATA_SHEET;

  // Get all student data at once
  const studentDataSheetLastRow = studentDataSheet.getLastRow();
  if (studentDataSheetLastRow <= 1) {
    throw new Error('MISSING_STUDENT_DATA');
  }

  const allStudentData = studentDataSheet.getRange(2, 1, studentDataSheetLastRow - 1, studentDataSheet.getLastColumn()).getDisplayValues();

  // Check for duplicate student ID's
  const duplicateCount = allStudentData.filter(row => row[0] === studentID).length;
  if (duplicateCount > 1) {
    throw new Error('DUPLICATE_ENTRY');
  }

  // Find student by ID
  const studentIndex = allStudentData.findIndex(row => row[0] === studentID);
  if (studentIndex === -1) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }

  // Validate student status
  const currentStatus = allStudentData[studentIndex][1];
  if (currentStatus === studentStatus) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }

  // Update student status
  studentDataSheet.getRange(studentIndex + 2, 2).setValue(studentStatus);

  return true;
}

/** Add student data **/
function addStudentData(studentData) {
  const studentID = studentData[0][0]; // First column contains the student ID
  const studentDataSheet = STUDENT_DATA_SHEET;
    
  // Check for duplicates only if there's existing data
  let studentDataSheetLastRow = studentDataSheet.getLastRow();
  let studentDataSheetLastColumn = studentDataSheet.getLastColumn();

  if (studentDataSheetLastRow > 1) {
    const allStudentData = studentDataSheet.getRange(2, 1, studentDataSheetLastRow - 1, studentDataSheetLastColumn).getDisplayValues();
        
    // Check for duplicate student ID's
    const duplicateCount = allStudentData.filter(row => row[0] === studentID).length;
    if (duplicateCount > 1) {
      throw new Error('DUPLICATE_ENTRY');
    }
  }

  // Add student data to the sheet
  studentDataSheet.appendRow(studentData[0]);
    
  // Format the sheet
  studentDataSheet.getRange('A:A').setNumberFormat('000000'); // Set ID format
    
  // Get the updated sheet rows/columns and sort alphabetically by student name
  studentDataSheetLastRow = studentDataSheet.getLastRow();
  studentDataSheetLastColumn = studentDataSheet.getLastColumn();
  
  if (studentDataSheetLastRow > 1) {
    studentDataSheet.getRange(2, 1, studentDataSheetLastRow - 1, studentDataSheetLastColumn)
    .sort({ column: 3, ascending: true });
  }

  return true;
}

/** Add meeting data **/
function addMeetingData(meetingData) {
  const meetingID = meetingData[0][0];  // First column contains the meeting ID
  const studentID = meetingData[0][1];  // Second column contains the student ID
  const meetingDataSheet = MEETING_DATA_SHEET;
  const studentDataSheet = STUDENT_DATA_SHEET;

  // Get all student data at once
  let studentDataSheetLastRow = studentDataSheet.getLastRow();
  let studentDataSheetLastColumn = studentDataSheet.getLastColumn();
  if (studentDataSheetLastRow <= 1) {
    throw new Error('MISSING_STUDENT_DATA');
  }

  const allStudentData = studentDataSheet.getRange(2, 1, studentDataSheetLastRow - 1, studentDataSheetLastColumn).getDisplayValues();
        
  // Check for duplicate student ID's
  const duplicateCount = allStudentData.filter(row => row[0] === studentID).length;
  if (duplicateCount > 1) {
    throw new Error('DUPLICATE_ENTRY');
  }

  // Find student by ID
  const studentIndex = allStudentData.findIndex(row => row[0] === studentID);
  if (studentIndex === -1) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }

  // Check for meeting duplicates only if there's existing data
  let meetingDataSheetLastRow = meetingDataSheet.getLastRow();
  let meetingDataSheetLastColumn = meetingDataSheet.getLastColumn();

  if (meetingDataSheetLastRow > 1) {
    const allMeetingData = meetingDataSheet.getRange(2, 1, meetingDataSheetLastRow - 1, meetingDataSheetLastColumn).getDisplayValues();
    
    // Check for duplicate meeting IDs
    const meetingDuplicateCount = allMeetingData.filter(row => row[0] === meetingID).length;
    if (meetingDuplicateCount > 0) {
      throw new Error('DUPLICATE_ENTRY');
    }
  }

  // Add meeting data to the sheet
  meetingDataSheet.appendRow(meetingData[0]);  // Use first row of 2D array

  // Format the sheet
  meetingDataSheet.getRange('A:B').setNumberFormat('000000'); // Meeting ID/student ID format
  meetingDataSheet.getRange('D:D').setNumberFormat('yyyy-mm-dd'); // Date format

  // Get the updated sheet rows/columns and sort by date
  meetingDataSheetLastRow = meetingDataSheet.getLastRow();
  meetingDataSheetLastColumn = meetingDataSheet.getLastColumn();
  
  if (meetingDataSheetLastRow > 1) {
    meetingDataSheet.getRange(2, 1, meetingDataSheetLastRow - 1, meetingDataSheetLastColumn)
      .sort({ column: 4, ascending: true });
  }

  return true;
}

/** Rename student in data **/
function renameStudent(studentID, studentStatus, newStudentName) {
  const studentDataSheet = STUDENT_DATA_SHEET;
  const meetingDataSheet = MEETING_DATA_SHEET;
  
  // Get all student data at once
  const studentDataSheetLastRow = studentDataSheet.getLastRow();
  const studentDataSheetLastColumn = studentDataSheet.getLastColumn();
  if (studentDataSheetLastRow <= 1) {
    throw new Error('MISSING_STUDENT_DATA');
  }

  const allStudentData = studentDataSheet.getRange(2, 1, studentDataSheetLastRow - 1, studentDataSheetLastColumn).getDisplayValues();

  // Check for duplicate student ID's
  const duplicateCount = allStudentData.filter(row => row[0] === studentID).length;
  if (duplicateCount > 1) {
    throw new Error('DUPLICATE_ENTRY');
  }

  // Find student by ID
  const studentIndex = allStudentData.findIndex(row => row[0] === studentID);
  if (studentIndex === -1) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }

  // Validate student status
  const currentStatus = allStudentData[studentIndex][1];
  if (currentStatus !== studentStatus) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }

  // Update student name in student sheet
  studentDataSheet.getRange(studentIndex + 2, 3).setValue(newStudentName);
    
  // Sort alphabetically by student name
  if (studentDataSheetLastRow > 1) {
    studentDataSheet.getRange(2, 1, studentDataSheetLastRow - 1, studentDataSheet.getLastColumn())
    .sort({ column: 3, ascending: true });
  }

  // Update meeting data if it exists
  const meetingDataLastRow = meetingDataSheet.getLastRow();
  if (meetingDataLastRow > 1) {
    // Get student ID and name columns
    const meetingData = meetingDataSheet.getRange(2, 1, meetingDataLastRow - 1, 3).getDisplayValues();
    
    // Find all rows that need updating
    const rowsToUpdate = [];
    meetingData.forEach((row, index) => {
      if (row[1] === studentID) { // Check column B (index 1) for student ID
        rowsToUpdate.push(index + 2);
      }
    });

    // Update meeting sheet if matching rows found
    if (rowsToUpdate.length > 0) {
      // Create a range list of all cells to update
      const ranges = rowsToUpdate.map(row => 
        meetingDataSheet.getRange(row, 3).getA1Notation()
      );
      
      // Update all matching rows at once
      meetingDataSheet.getRangeList(ranges).setValue(newStudentName);
    }
  }
  
  return true;
}

/** Delete student and associated meetings from data **/
function deleteStudentData(studentID, studentStatus) {
  const studentDataSheet = STUDENT_DATA_SHEET;
  const meetingDataSheet = MEETING_DATA_SHEET;
  
  // Get all student data at once
  const studentDataSheetLastRow = studentDataSheet.getLastRow();
  const studentDataSheetLastColumn = studentDataSheet.getLastColumn();
  if (studentDataSheetLastRow <= 1) {
    throw new Error('MISSING_STUDENT_DATA');
  }
  
  const allStudentData = studentDataSheet.getRange(2, 1, studentDataSheetLastRow - 1, studentDataSheetLastColumn).getDisplayValues();

  // Check for duplicate student ID's
  const duplicateCount = allStudentData.filter(row => row[0] === studentID).length;
  if (duplicateCount > 1) {
    throw new Error('DUPLICATE_ENTRY');
  }

  // Find student by ID
  const studentIndex = allStudentData.findIndex(row => row[0] === studentID);
  if (studentIndex === -1) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }

  // Validate student status
  const currentStatus = allStudentData[studentIndex][1];
  if (currentStatus !== studentStatus) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }

  // Delete student from studentData (adding 2 to account for header row and 0-based index)
  studentDataSheet.deleteRow(studentIndex + 2);

  // Delete associated meetings if they exist
  const meetingDataLastRow = meetingDataSheet.getLastRow();
  if (meetingDataLastRow > 1) {
    // Get all meeting data
    const meetingData = meetingDataSheet.getRange(2, 1, meetingDataLastRow - 1, 3).getDisplayValues();
    
    // Find all rows that need to be deleted
    const rowsToDelete = [];
    meetingData.forEach((row, index) => {
      if (row[1] === studentID) {
        rowsToDelete.push(index + 2); // +2 for header row and 0-based index
      }
    });

    // Delete rows from bottom to top to avoid shifting issues
    if (rowsToDelete.length > 0) {
      rowsToDelete
        .sort((a, b) => b - a) // Sort in descending order
        .forEach(rowNum => {
          meetingDataSheet.deleteRow(rowNum);
        });
    }
  }

  return true;
}

//////////
//////////
//////////
//////////

/** Delete a single meeting from data **/
function deleteMeetingData(meetingID) {
  const meetingDataSheet = MEETING_DATA_SHEET;
  
  
  // Get all student data at once
  const meetingDataSheetLastRow = meetingDataSheet.getLastRow();
  const meetingDataSheetLastColumn = meetingDataSheet.getLastColumn();
  if (meetingDataSheetLastRow <= 1) {
    throw new Error('MISSING_MEETING_DATA');
  }
  
  const allMeetingData = meetingDataSheet.getRange(2, 1, meetingDataSheetLastRow - 1, meetingDataSheetLastColumn).getDisplayValues();

  // Check for duplicate meeting ID's
  const duplicateCount = allMeetingData.filter(row => row[0] === meetingID).length;
  if (duplicateCount > 1) {
    throw new Error('DUPLICATE_ENTRY');
  }

  // Find meeting in the sheet
  const meetingIndex = allMeetingData.findIndex(row => row[0] === meetingID);

  if (meetingIndex === -1) {
    throw new Error('MISSING_MEETING_ENTRY');
  }

  // Delete meeting (adding 2 to account for header row and 0-based index)
  meetingDataSheet.deleteRow(meetingIndex + 2);

  return true;
}

////////////////////////
// SETTINGS FUNCTIONS //
////////////////////////

/** Get user settings from user properties service **/
function getUserSettings() {
  const userProperties = PropertiesService.getUserProperties();

  return {
    theme: userProperties.getProperty('theme') || 'falconLight',
    customThemeType: userProperties.getProperty('customThemeType'),
    customThemePrimaryColor: userProperties.getProperty('customThemePrimaryColor'),
    customThemeAccentColor: userProperties.getProperty('customThemeAccentColor'),
    alertSound: userProperties.getProperty('alertSound') || 'alert01',
    emailSound: userProperties.getProperty('emailSound') || 'email01',
    removeSound: userProperties.getProperty('removeSound') || 'remove01',
    successSound: userProperties.getProperty('successSound') || 'success01',
    silentMode: userProperties.getProperty('silentMode') || 'false'
  };
}

/** Get app settings from script properties service */
function getAppSettings() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentYear = new Date().getFullYear();

  return {
    schoolSettings: {
      schoolName: scriptProperties.getProperty('schoolName') || "",
      schoolYear: scriptProperties.getProperty('schoolYear') || (currentYear + '-' + (currentYear + 1))
    },
    classroomSettings: scriptProperties.getProperty('classroomSettings') ? JSON.parse(scriptProperties.getProperty('classroomSettings')) : [],
    referralSettings: {
      recipient: scriptProperties.getProperty('referralRecipient') || "",
    },
    emailTemplateSettings: {
      referral: {
        subject: scriptProperties.getProperty('emailTemplateReferralSubject') || "",
        body: scriptProperties.getProperty('emailTemplateReferralBody') || ""
      },
      initial: {
        subject: scriptProperties.getProperty('emailTemplateInitialSubject') || "",
        body: scriptProperties.getProperty('emailTemplateInitialBody') || ""
      },
      reminder: {
        subject: scriptProperties.getProperty('emailTemplateReminderSubject') || "",
        body: scriptProperties.getProperty('emailTemplateReminderBody') || ""
      },
      summary: {
        subject: scriptProperties.getProperty('emailTemplateSummarySubject') || "",
        body: scriptProperties.getProperty('emailTemplateSummaryBody') || ""
      }
    }
  };
}

/** Write all settings to user and script properties stores **/
function writeSettings(userSettings, appSettings) {
  try {
    const userProperties = PropertiesService.getUserProperties();
    const scriptProperties = PropertiesService.getScriptProperties();

    // Store user-specific settings in User Properties and delete unused properties
    userProperties.setProperties({
      theme: userSettings.theme || 'falconLight',
      customThemeType: userSettings.customThemeType || '',
      customThemePrimaryColor: userSettings.customThemePrimaryColor || '',
      customThemeAccentColor: userSettings.customThemeAccentColor || '',
      alertSound: userSettings.alertSound || 'alert01',
      emailSound: userSettings.emailSound || 'email01',
      removeSound: userSettings.removeSound || 'remove01',
      successSound: userSettings.successSound || 'sucess01',
      silentMode: userSettings.silentMode || 'false'
    }, true);
    
    // Store app-wide settings in Script Properties and delete unused properties
    scriptProperties.setProperties({
      schoolName: appSettings.schoolSettings.schoolName,
      schoolYear: appSettings.schoolSettings.schoolYear,
      classroomSettings: JSON.stringify(appSettings.classroomSettings),
      referralRecipient: appSettings.referralSettings.recipient,
      emailTemplateReferralSubject: appSettings.emailTemplateSettings.referral.subject,
      emailTemplateReferralBody: appSettings.emailTemplateSettings.referral.body,
      emailTemplateInitialSubject: appSettings.emailTemplateSettings.initial.subject,
      emailTemplateInitialBody: appSettings.emailTemplateSettings.initial.body,
      emailTemplateReminderSubject: appSettings.emailTemplateSettings.reminder.subject,
      emailTemplateReminderBody: appSettings.emailTemplateSettings.reminder.body,
      emailTemplateSummarySubject: appSettings.emailTemplateSettings.summary.subject,
      emailTemplateSummaryBody: appSettings.emailTemplateSettings.summary.body
    }, true);
  } catch (e) {
    throw new Error(e);
  }
}

/////////////////////
// EMAIL FUNCTIONS //
/////////////////////

/** Create and send email */
function createEmail(recipient, subject, body, attachmentType, attachments) {
  const emailQuota = MailApp.getRemainingDailyQuota();

  // Check user's email quota and warn if it's too low to send emails
  if (emailQuota <= 10) {
    throw new Error('QUOTA_LIMIT');
  }

  // Get the current user's email
  const currentUserEmail = Session.getActiveUser().getEmail();
  const scriptProperties = PropertiesService.getScriptProperties();
  const schoolName = scriptProperties.getProperty('schoolName')
  
  // Set senderName based on schoolName
  const senderName = schoolName || ''; // Use schoolName if it exists, else default to an empty string
  
  // Create the email message object
  const emailMessage = {
    to: recipient,
    bcc: currentUserEmail,
    replyTo: currentUserEmail,
    subject: subject,
    htmlBody: body,
    name: senderName,
  };

  // Add attachments if provided
  if (attachments && attachmentType) {
    const uint8Array = new Uint8Array(attachments);
    let blob;

    if (attachmentType === 'summary') {
      blob = Utilities.newBlob(uint8Array, 'application/pdf', 'First Lutheran School - SST Meeting Summary.pdf');
    } 
    if (attachmentType === 'referral') {
      blob = Utilities.newBlob(uint8Array, 'application/pdf', 'First Lutheran School - SST Student Referral.pdf');
    }
    
    emailMessage.attachments = [blob];
  }

  // Send the email
  try {
    MailApp.sendEmail(emailMessage);
    return true;
  }
  catch(e) {
    throw new Error('EMAIL_FAILURE');
  }
}

////////////////////
// FILE FUNCTIONS //
////////////////////

/** Export data as a .csv file **/
function getCsv(dataType) {
  try {
    let data;
    
    if (dataType === 'studentData') {
      data = STUDENT_DATA_SHEET.getDataRange().getDisplayValues();
    } else {
      data = MEETING_DATA_SHEET.getDataRange().getDisplayValues();
    }

    return data.map(rowArray => {
      return rowArray.map(field => {
        // Convert to string and trim any whitespace
        let stringField = String(field).trim();
        
        // Determine if the field needs to be quoted
        let needsQuoting = false;
        
        // Quote if: contains commas, quotes, line breaks, or is a number with leading zeros
        if (
          stringField.includes(',') || 
          stringField.includes('"') || 
          stringField.includes('\n') || 
          stringField.includes('\r') ||
          (
            // Check for leading zeros in numeric fields
            /^0\d+$/.test(stringField) && 
            !isNaN(stringField)
          )
        ) {
          needsQuoting = true;
        }

        if (needsQuoting) {
          // Escape any existing quotes by doubling them
          stringField = stringField.replace(/"/g, '""');
          // Wrap the field in quotes
          return `"${stringField}"`;
        }
        
        return stringField;
      }).join(',');
    }).join('\r\n');
  } catch(e) {
      throw new Error('EXPORT_FAILURE');
  }
}

/** Export data as a .xlsx file **/
function getXlsx(dataType) {
  try {
    const spreadsheetId = SpreadsheetApp.getActive().getId();
    let sheetId;
    
    if (dataType === 'studentData') {
      sheetId = STUDENT_DATA_SHEET.getSheetId();
    } 
    else {
      sheetId = MEETING_DATA_SHEET.getSheetId();
    }

    // Construct the export URL
    const url = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/export?format=xlsx&gid=" + sheetId;
    
    // Fetch the xlsx file as a blob
    const blob = UrlFetchApp.fetch(url, {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}}).getBlob();
    
    // Return blob as binary
    return blob.getBytes();
  } catch(e) {
      throw new Error('EXPORT_FAILURE');
  }
}
