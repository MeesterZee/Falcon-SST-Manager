<script type="text/javascript">
  // Global variables  
  // let USER_SETTINGS; // Defined in HTML
  let APP_SETTINGS;
  let EMAIL_TEMPLATE_SETTINGS;
  let saveFlag = true;
  let busyFlag = false;

  // Initialize application
  window.onload = async function() {
    console.log("Initializing settings...");

    const toolbar = document.getElementById('toolbar');
    const page = document.getElementById('page');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    try {
      // Show loading indicator
      loadingIndicator.style.display = 'block';
      toolbar.style.display = 'none';
      page.style.display = 'none';

      // Fetch data in parallel (async not needed but allows for future data streams)
      const [appSettings] = await Promise.all([
        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getAppSettings();
        })
      ]);

      // Set global variables
      APP_SETTINGS = appSettings;

      // Populate elements with data
      await Promise.all([
        loadSettings()
      ]);

      setEventListeners(); // Set event listeners last to ensure tables are built before attaching
    
      console.log("Initialization complete!");
    
    } catch (error) {
        console.error("Error during initialization: ", error);
    
    } finally {
      // Hide loading indicator and show page
      loadingIndicator.style.display = 'none';
      toolbar.style.display = 'block';
      page.style.display = 'flex';
    }
  };

  function setEventListeners() {
    console.log("Setting event listeners...");

    const allTextInputs = document.querySelectorAll('input[type="text"], input[type="color"], .column-input');
    const allSelects = document.querySelectorAll('.table-select, #theme');
    const saveChangesButton = document.getElementById('saveChangesButton');
    const themeSelect = document.getElementById('theme');
    const alertSoundSelect = document.getElementById('alertSound');
    const emailSoundSelect = document.getElementById('emailSound');
    const successSoundSelect = document.getElementById('successSound');
    const removeSoundSelect = document.getElementById('removeSound');

    window.addEventListener('beforeunload', function (e) {
      if (!saveFlag) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    allTextInputs.forEach(input => {
      input.addEventListener('input', saveAlert);
    });

    allSelects.forEach(select => {
      select.addEventListener('change', saveAlert);
    });

    // Add paste event listeners to rich text inputs
    const richTextBoxes = document.querySelectorAll('.rich-text-box');
    richTextBoxes.forEach(input => {
      input.addEventListener("paste", function (event) {
        // Prevent the default paste behavior
        event.preventDefault();

        // Get the plain text from the clipboard
        const text = event.clipboardData.getData("text/plain");

        // Insert the plain text at the cursor position
        document.execCommand("insertText", false, text);
      });
    });

    themeSelect.addEventListener('change', function() {
      const theme = document.getElementById('theme').value;
      const customTheme = document.getElementById('customTheme');

      if (theme === "custom") {
        customTheme.style.display = 'block';
      } else {
        customTheme.style.display = 'none';
      }
    });

    alertSoundSelect.addEventListener('change', function() {
      USER_SETTINGS.alertSound = alertSoundSelect.value;
      playNotificationSound("alert");
    });

    emailSoundSelect.addEventListener('change', function() {
      USER_SETTINGS.emailSound = emailSoundSelect.value;
      playNotificationSound("email");
    });

    successSoundSelect.addEventListener('change', function() {
      USER_SETTINGS.successSound = successSoundSelect.value;
      playNotificationSound("success");
    });

    removeSoundSelect.addEventListener('change', function() {
      USER_SETTINGS.removeSound = removeSound.value;
      playNotificationSound("remove");
    });

    document.getElementById('silentModeSwitch').addEventListener('change', saveAlert);
    
    document.getElementById('templateSubject').addEventListener('input', saveAlert);
    document.getElementById('templateBody').addEventListener('input', saveAlert);

    saveChangesButton.addEventListener('click', saveSettings);

    console.log("Complete!");
  }

  ///////////////////
  // LOAD SETTINGS //
  ///////////////////

  function loadSettings() {
    console.log("Loading settings...");

    // Appearance
    setColorPicker();
    const themeSelect = document.getElementById('theme');
    const customTheme = document.getElementById('customTheme');
    themeSelect.value = USER_SETTINGS.theme;

    if (USER_SETTINGS.theme === "custom") {
      customTheme.style.display = 'block';
    } else {
      customTheme.style.display = 'none';
    }

    // Sound Effects
    const silentModeChecked = USER_SETTINGS.silentMode === 'true'; // Convert string to boolean
    document.getElementById('silentModeSwitch').checked = silentModeChecked;
    document.getElementById('alertSound').value = USER_SETTINGS.alertSound;
    document.getElementById('emailSound').value = USER_SETTINGS.emailSound;
    document.getElementById('removeSound').value = USER_SETTINGS.removeSound;
    document.getElementById('successSound').value = USER_SETTINGS.successSound;

    // School Information
    document.getElementById('schoolName').value = APP_SETTINGS.schoolSettings.schoolName || '';
    document.getElementById('schoolYear').value = APP_SETTINGS.schoolSettings.schoolYear || '';

    // Classroom Settings
    loadClassroomSettings(APP_SETTINGS.classroomSettings);

    // Email Templates
    loadEmailTemplateSettings(APP_SETTINGS.emailTemplateSettings);

    console.log("Complete!");
  }

  function setColorPicker() {
    const themeTypeSelect = document.getElementById('themeTypeSelect');
    const primaryColorPicker = document.getElementById('primaryColorPicker');
    const accentColorPicker = document.getElementById('accentColorPicker');

    themeTypeSelect.value = getComputedStyle(document.documentElement).getPropertyValue('color-scheme').trim();
    primaryColorPicker.value = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    accentColorPicker.value = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
  }

  function loadClassroomSettings(classroomSettings) {
    const tableRows = document.querySelectorAll('#classroomSettings tbody tr');

    // Iterate over each row and populate columns 2 and 3 with data from classroomSettings
    tableRows.forEach((row, index) => {
      const classroomData = classroomSettings[index] || {};

      // Column 2: Classroom
      const classroomInput = row.querySelector('td:nth-child(2) input');
      classroomInput.value = classroomData.classroom || '';

      // Column 3: Teacher
      const teacherInput = row.querySelector('td:nth-child(3) input');
      teacherInput.value = classroomData.teacher || '';
    });
  }

  function loadEmailTemplateSettings(emailTemplateSettings) {
    EMAIL_TEMPLATE_SETTINGS = {
      referral: {
        subject: emailTemplateSettings.referral.subject || '',
        body: emailTemplateSettings.referral.body || '',
        unsavedSubject: '',
        unsavedBody: ''
      },
      initial: {
        subject: emailTemplateSettings.initial.subject || '',
        body: emailTemplateSettings.initial.body || '',
        unsavedSubject: '',
        unsavedBody: ''
      },
      reminder: {
        subject: emailTemplateSettings.reminder.subject || '',
        body: emailTemplateSettings.reminder.body || '',
        unsavedSubject: '',
        unsavedBody: ''
      },
      summary: {
        subject: emailTemplateSettings.summary.subject || '',
        body: emailTemplateSettings.summary.body || '',
        unsavedSubject: '',
        unsavedBody: ''
      }
    };

    // Load initial email template settings into UI
    const templateTypeSelect = document.getElementById('templateType');
    const templateSubjectInput = document.getElementById('templateSubject');
    const templateBodyInput = document.getElementById('templateBody');

    // Set the default template type to "referral"
    const defaultTemplate = EMAIL_TEMPLATE_SETTINGS.referral;
    templateSubjectInput.value = defaultTemplate.subject;
    templateBodyInput.innerHTML = defaultTemplate.body;

    // Update unsaved subject on input
    templateSubjectInput.addEventListener('input', function() {
      const selectedTemplate = EMAIL_TEMPLATE_SETTINGS[templateTypeSelect.value];
      if (selectedTemplate) {
        selectedTemplate.unsavedSubject = templateSubjectInput.value;
      }
    });

    // Update unsaved body on input
    templateBodyInput.addEventListener('input', function() {
      const selectedTemplate = EMAIL_TEMPLATE_SETTINGS[templateTypeSelect.value];
      if (selectedTemplate) {
        selectedTemplate.unsavedBody = templateBodyInput.innerHTML;
      }
    });

    // Handle template type change
    templateTypeSelect.addEventListener('change', function() {
      const selectedTemplate = EMAIL_TEMPLATE_SETTINGS[templateTypeSelect.value];
      if (selectedTemplate) {
        templateSubjectInput.value = selectedTemplate.unsavedSubject || selectedTemplate.subject;
        templateBodyInput.innerHTML = selectedTemplate.unsavedBody || selectedTemplate.body;
      }
    });
  }

  ///////////////////
  // SAVE SETTINGS //
  ///////////////////

  function saveSettings() {
    if (busyFlag) {
      showError("operationInProgress");
      busyFlag = false;
      return;
    }

    busyFlag = true;
    saveChangesButton.classList.remove('tool-bar-button-unsaved');

    APP_SETTINGS = getAppSettings();
    
    saveFlag = true;
    saveTheme();
    setColorPicker();
    saveSound();
    
    document.getElementById('header-text').innerText = "Falcon SST Manager - " + APP_SETTINGS.schoolSettings.schoolYear;
    
    playNotificationSound("success");
    showToast("", "Settings saved!", 5000);

    google.script.run.writeSettings(USER_SETTINGS, APP_SETTINGS);
    busyFlag = false;
  }

  function getAppSettings() {
    // Get school settings    
    const schoolSettings = {
      schoolYear: document.getElementById('schoolYear').value,
      schoolName: document.getElementById('schoolName').value
    };

    // Get classroom settings
    const classroomSettings = [];
    const tableBody = document.querySelector('#classroomSettings tbody');
    tableBody.querySelectorAll('tr').forEach((row) => {
      classroomSettings.push({
        classroom: row.querySelector('td:nth-child(2) input').value || '',
        teacher: row.querySelector('td:nth-child(3) input').value || ''
      });
    });

    // Get email template settings
    Object.keys(EMAIL_TEMPLATE_SETTINGS).forEach((key) => {
      const template = EMAIL_TEMPLATE_SETTINGS[key];
      if (template.unsavedSubject !== "" || template.unsavedBody !== "") {
        template.subject = template.unsavedSubject || template.subject;
        template.body = template.unsavedBody || template.body;
      }
    });
    
    const emailTemplateSettings = {
      referral: {
        subject: EMAIL_TEMPLATE_SETTINGS.referral.subject,
        body: EMAIL_TEMPLATE_SETTINGS.referral.body
      },
      initial: {
        subject: EMAIL_TEMPLATE_SETTINGS.initial.subject,
        body: EMAIL_TEMPLATE_SETTINGS.initial.body
      },
      reminder: {
        subject: EMAIL_TEMPLATE_SETTINGS.reminder.subject,
        body: EMAIL_TEMPLATE_SETTINGS.reminder.body
      },
      summary: {
        subject: EMAIL_TEMPLATE_SETTINGS.summary.subject,
        body: EMAIL_TEMPLATE_SETTINGS.summary.body
      }
    };

    return {
      schoolSettings,
      classroomSettings,
      emailTemplateSettings
    };
  }

  ///////////////////////
  // UTILITY FUNCTIONS //
  ///////////////////////

  function showError(errorType, callback = "") {
    let icon = `<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color);"></i>`;
    let title;
    let message;
    let button1;
    let button2;

    switch (errorType) {
      case "operationInProgress":
        title = icon + "Error";
        message = "Operation currently in progress. Please wait until the operation completes and try again.";
        button1 = "Close";
        break;
    }

    playNotificationSound("alert");
    showModal(title, message, button1, button2);
  }
  
  function saveAlert() {
    saveFlag = false;
    saveChangesButton.classList.add('tool-bar-button-unsaved');
  }

</script>
