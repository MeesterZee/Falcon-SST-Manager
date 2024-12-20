/** Falcon SST Manager - Web App v3.1 **/
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
        const message = "Web App Version: 3.1<br>Build: 29.122024<br><br>Created by: Nick Zagorin<br>© 2024-2025 - All rights reserved";
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

/** Get active data **/
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
  // Cache frequently used values and references
  const studentID = studentData[0][0];
  const studentDataSheet = STUDENT_DATA_SHEET;
    
  // Get last row in one call
  const studentDataSheetLastRow = studentDataSheet.getLastRow();
  if (studentDataSheetLastRow <= 1) {
    throw new Error('MISSING_STUDENT_DATA');
  }
    
  // Get all student data at once, including formatted values for dates, times, and IDs
  const allStudentData = studentDataSheet.getRange(2, 1, studentDataSheetLastRow - 1, studentData[0].length).getDisplayValues();
   
  // Find student index - now using formatted values throughout
  const studentIndex = allStudentData.findIndex(row => row[0] === studentID);
    
  // Check for duplicates using the complete formatted dataset
  const duplicateCount = allStudentData.filter(row => row[0] === studentID).length;
  if (duplicateCount > 1) {
    throw new Error('DUPLICATE_ENTRY');
  }
  if (studentIndex === -1) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }
    
  // Update student data in one operation
  studentDataSheet.getRange(studentIndex + 2, 1, 1, studentData[0].length).setValues(studentData);
    
  // Process meeting data if provided
  if (meetingData?.length > 0) {
    const meetingID = meetingData[0][0];
    const meetingDataSheetLastRow = MEETING_DATA_SHEET.getLastRow();
      
    if (meetingDataSheetLastRow > 1) {
      // Get all meeting data at once with formatted values
      const allMeetingData = MEETING_DATA_SHEET.getRange(2, 1, meetingDataSheetLastRow - 1, meetingData[0].length).getDisplayValues();
        
      const meetingIndex = allMeetingData.findIndex(row => row[0] === meetingID);
      if (meetingIndex === -1) {
        throw new Error('MISSING_MEETING_ENTRY');
      }
        
      // Update meeting data in one operation
      MEETING_DATA_SHEET.getRange(meetingIndex + 2, 1, 1, meetingData[0].length).setValues(meetingData);
    }
  }
  
  return true;
}

/** Add student data **/
function addStudentData(studentData) {
  // Cache sheet properties
  const sheet = STUDENT_DATA_SHEET;
  const studentID = studentData[0];
  const studentLastRow = sheet.getLastRow();
  const studentlastColumn = sheet.getLastColumn();
    
  // Check for duplicates only if there's existing data
  if (studentLastRow > 1) {
    // Batch read all Student IDs in one operation and convert to 1D array for faster searching
    const studentIDs = sheet.getRange(2, 1, studentLastRow - 1, 1).getDisplayValues().flat(); 
        
    // Use indexOf for efficient duplicate checking
    if (studentIDs.indexOf(studentID) !== -1) {
      throw new Error('DUPLICATE_ENTRY');
    }
  }

  // Add student data to the sheet
  sheet.appendRow(studentData);
    
  // Perform formatting
  sheet.getRange('A:A').setNumberFormat('000000');
    
  // Sort alphabetically by student name
  if (studentLastRow > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, studentlastColumn).sort({ column: 3, ascending: true });
  }

  return true;
}

/** Add meeting data **/
function addMeetingData(meetingData) {
  // Cache sheet properties
  const meetingDataSheet = MEETING_DATA_SHEET;
  const studentSheet = STUDENT_DATA_SHEET;  // Add reference to student sheet
  const meetingID = meetingData[0];
  const studentID = meetingData[1];  // Assuming student ID is second element
  const meetingLastRow = meetingDataSheet.getLastRow();

  // First, validate that the student exists
  const studentLastRow = studentSheet.getLastRow();
  
  if (studentLastRow > 1) {
    const studentIDs = studentSheet.getRange(2, 1, studentLastRow - 1, 1).getDisplayValues().flat();
    const duplicateCount = studentIDs.filter(id => id === studentID).length;
    
    if (duplicateCount > 1) {
      throw new Error('DUPLICATE_ENTRY'); // If more than one entry is found for the student ID
    }
    if (studentIDs.indexOf(studentID) === -1) {
      throw new Error('MISSING_STUDENT_ENTRY');
    }
  } else {
    throw new Error('MISSING_STUDENT_DATA'); // If no students exist in the sheet
  }
  
  // Check for duplicates only if there's existing data
  if (meetingDataLastRow > 1) {
    // Batch read all Meeting IDs in one operation and convert to 1D array for faster searching
    const meetingIDs = meetingDataSheet.getRange(2, 1, meetingDataLastRow - 1, 1).getDisplayValues().flat();
      
    // Use indexOf for efficient duplicate checking
    if (meetingIDs.indexOf(meetingID) !== -1) {
      throw new Error('DUPLICATE_ENTRY');
    }
  }

  // Batch all formatting operations into a single transaction
  const formatRanges = [
    { range: 'A:A', format: '000000' }, // Meeting ID
    { range: 'B:B', format: '000000' }, // Student ID
    { range: 'D:D', format: 'yyyy-mm-dd' } // Meeting Date
  ];

  // Add the meeting data to the sheet
  meetingDataSheet.appendRow(meetingData);
  
  // Create a single transaction for all formatting operations
  const formatTransaction = formatRanges.map(({ range, format }) => {
    return () => meetingDataSheet.getRange(range).setNumberFormat(format);
  });
  
  // Execute all formatting operations
  formatTransaction.forEach(operation => operation());

  // Sort only if there's more than one row of data
  if (meetingDataLastRow > 1) {
    const lastRow = meetingDataSheet.getLastRow();
    const lastCol = meetingDataSheet.getLastColumn();
    
    // Sort by date
    meetingDataSheet.getRange(2, 1, lastRow - 1, lastCol).sort({ column: 4, ascending: true });
  }

  return true;
}

function updateStudentStatus(studentID, status) {
  // Cache sheet references and properties
  const activeSheet = STUDENT_DATA_SHEET;
  const activeLastRow = activeSheet.getLastRow();

  // Early return if active data is empty
  if (activeLastRow <= 1) {
    throw new Error('MISSING_STUDENT_DATA');
  }

  // Get all active data in one batch operation
  const activeData = activeSheet.getRange(2, 1, activeLastRow - 1, activeSheet.getLastColumn()).getDisplayValues();

  // Check for duplicate in active data
  const duplicateCount = activeData.filter(row => row[0] === studentID).length;
  if (duplicateCount > 1) {
    throw new Error('DUPLICATE_ENTRY');
  }

  // Find student index using a more efficient find method
  const studentIndex = activeData.findIndex(row => row[0] === studentID);

  if (studentIndex === -1) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }

  // Update the status of the student (Status is always column 2)
  activeSheet.getRange(studentIndex + 2, 2).setValue(status);

  // Sort alphabetically by student name
  activeSheet.getRange(2, 1, activeLastRow - 1, activeSheet.getLastColumn()).sort({ column: 3, ascending: true });

  return true;
}

/** Rename student in data **/
function renameStudent(studentID, newStudentName) {
  const sheet = STUDENT_DATA_SHEET;
  const sheetLastRow = sheet.getLastRow();
  
  if (sheetLastRow <= 1) {
    throw new Error('MISSING_STUDENT_DATA');
  }

  // Load all student data at once
  const studentDataRange = sheet.getRange(2, 1, sheetLastRow - 1, 2);
  const studentData = studentDataRange.getDisplayValues();
  
  // Find student index - now using formatted values throughout
  const studentIndex = studentData.findIndex(row => row[0] === studentID);
    
  // Check for duplicates using the complete formatted dataset
  const duplicateCount = studentData.filter(row => row[0] === studentID).length;
  
  if (duplicateCount > 1) {
    throw new Error('DUPLICATE_ENTRY');
  }
  if (studentIndex === -1) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }

  // Batch our writes into a single operation
  const operations = [];
  
  // Update student name in student sheet
  operations.push(() => {
    sheet.getRange(studentIndex + 2, 3).setValue(newStudentName);
    
    // Sort alphabetically by student name
    sheet.getRange(2, 1, sheetLastRow - 1, sheet.getLastColumn()).sort({ column: 3, ascending: true });
  });

  // Update meeting data sheet
  const meetingDataSheet = MEETING_DATA_SHEET;
  const meetingDataLastRow = meetingDataSheet.getLastRow();

  if (meetingDataLastRow > 1) {
    // Load all meeting data at once
    const meetingRange = meetingDataSheet.getRange(2, 2, meetingDataLastRow - 1, 2);
    const meetingData = meetingRange.getValues();
    
    // Find all rows that need updating
    const rowsToUpdate = meetingData.reduce((acc, row, index) => {
      if (row[0] == studentID) acc.push(index + 2);
      return acc;
    }, []);

    // Batch update meeting sheet if needed
    if (rowsToUpdate.length > 0) {
      operations.push(() => {
        const ranges = rowsToUpdate.map(row => 
          meetingDataSheet.getRange(row, 3)
        );
        
        // Use batch setValue for all matching rows
        meetingDataSheet.getRangeList(ranges.map(r => r.getA1Notation())).setValue(newStudentName);
      });
    }
  }

  // Execute all operations
  operations.forEach(op => op());
  
  return true;
}

/** Delete student and associated meetings from data **/
function deleteStudentData(studentID) {
  // Cache sheet references and properties
  const studentDataSheet = STUDENT_DATA_SHEET;
  const meetingDataSheet = MEETING_DATA_SHEET;
  const studentDataLastRow = studentDataSheet.getLastRow();
  
  // Early return if studentData is empty
  if (studentDataLastRow <= 1) {
    throw new Error('MISSING_STUDENT_DATA');
  }
  
  // Get all studentData IDs in one batch operation
  const studentIds = studentDataSheet
    .getRange(2, 1, studentDataLastRow - 1, 1).getDisplayValues().flat();

  // Check for duplicate entries
  const duplicateCount = studentIds.filter(id => id === studentID).length;
  if (duplicateCount > 1) {
    throw new Error('DUPLICATE_ENTRY');
  }

  // Find student index
  const studentIndex = studentIds.indexOf(studentID);
  if (studentIndex === -1) {
    throw new Error('MISSING_STUDENT_ENTRY');
  }

  // Delete student from studentData (adding 2 to account for header row and 0-based index)
  const studentRowIndex = studentIndex + 2;
  studentDataSheet.deleteRow(studentRowIndex);

  // Handle associated meetings
  const meetingDataLastRow = meetingDataSheet.getLastRow();
  if (meetingDataLastRow > 1) {
    // Get all meeting data in one batch
    const meetingData = meetingDataSheet
      .getRange(2, 2, meetingDataLastRow - 1, 1)
      .getDisplayValues();

    // Find all rows to delete (in reverse order to maintain integrity)
    const rowsToDelete = meetingData
      .map((row, index) => row[0] === studentID ? index + 2 : null)
      .filter(row => row !== null)
      .reverse();

    // Delete meeting rows
    rowsToDelete.forEach(rowIndex => {
      meetingDataSheet.deleteRow(rowIndex);
    });
  }

  return true;
}

/** Delete a single meeting from data **/
function deleteMeetingData(meetingID) {
  // Cache sheet references and properties
  const meetingDataSheet = MEETING_DATA_SHEET;
  const lastRow = meetingDataSheet.getLastRow();
  const lastColumn = meetingDataSheet.getLastColumn();
  
  // Early return if meetings sheet is empty
  if (lastRow <= 1) {
    throw new Error('MISSING_MEETING_DATA');
  }
  
  // Get all meeting data in one batch operation
  const meetingData = meetingDataSheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();

  const duplicateCount = meetingData.filter(row => row[0] === meetingID).length;
  if (duplicateCount > 1) {
    throw new Error('DUPLICATE_ENTRY');
  }

  // Find meeting index using more efficient find method
  const meetingIndex = meetingData.findIndex(row => row[0] === meetingID);

  // Return early if meeting not found
  if (meetingIndex === -1) {
    throw new Error('MISSING_MEETING_ENTRY');
  }

  // Delete meeting (adding 2 to account for header row and 0-based index)
  const meetingRowIndex = meetingIndex + 2;
  meetingDataSheet.deleteRow(meetingRowIndex);

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

  console.log(emailMessage);

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
