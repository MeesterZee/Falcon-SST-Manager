<script type="text/javascript">
  // Global constants
  const STUDENT_KEY_MAPPINGS = {
    'gender': 'Gender', 'dateOfBirth': 'Date Of Birth', 'grade': 'Grade', 'classroom': 'Classroom', 'allergies': 'Allergies', 'medications': 'Medications', 'dietaryRestrictions':'Dietary Restrictions', 'diagnosis': 'Diagnosis', 'servicesPrograms': 'Services/Programs', 'aide': 'Aide', 'specializedInstruction': 'Specialized Instruction', 'caseManager': 'Case Manager', 'roi1': 'ROI Organization 1', 'roi2': 'ROI Organization 2', 'roi3': 'ROI Organization 3', 'parentGuardianName1': 'Parent/Guardian Name 1', 'parentGuardianPhone1': 'Parent/Guardian Phone 1', 'parentGuardianEmail1': 'Parent/Guardian Email 1', 'parentGuardianName2': 'Parent/Guardian Name 2', 'parentGuardianPhone2': 'Parent/Guardian Phone 2', 'parentGuardianEmail2': 'Parent/Guardian Email 2', 'notes': 'Notes'
  };

  const MEETING_KEY_MAPPINGS = {
    'meetingDate': 'Date', 'meetingType': 'Type', 'attendees': 'Attendees', 'facilitator': 'Facilitator', 'scribe': 'Scribe', 'strengthsInput': 'Areas Of Strength', 'concernsInput': 'Areas Of Concern', 'actionPlanInput': 'Action Plan', 'nextDate': 'Next Date', 'nextTime': 'Next Time'
  };

  // Global variables
  let STUDENT_DATA;
  let MEETING_DATA;
  let APP_SETTINGS;
  
  // Global IDs
  let previousStudentID;
  let previousMeetingID;
  let cachedID = null;
  
  // Global flags
  let saveFlag = true; // True if all changes saved, false if unsaved changes
  let busyFlag = false; // True if backup in progress, false if backup not in progress

  // Initialize application
  window.onload = async function() {
    console.log("Initializing dashboard...");

    // Get main elements
    const toolbar = document.getElementById('toolbar');
    const page = document.getElementById('page');
    const loadingIndicator = document.getElementById('loading-indicator');

    try {
      // Show loading indicator and hide page elements
      loadingIndicator.style.display = 'block';
      toolbar.style.display = 'none';
      page.style.display = 'none';

      // Fetch data in parallel
      const [studentData, meetingData, appSettings] = await Promise.all([
        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getStudentData();
        }),
        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getMeetingData();
        }),
        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getAppSettings();
        })
      ]);

      // Assign data to global variables
      STUDENT_DATA = studentData;
      MEETING_DATA = meetingData;
      APP_SETTINGS = appSettings;

      // Initialize the dashboard
      setEventListeners();
      populateDashboard();

      console.log("Initialization complete!");

    } catch (error) {
      console.error("Error during initialization:", error);
    
    } finally {
      // Hide loading indicator and show page elements
      loadingIndicator.style.display = 'none';
      toolbar.style.display = 'block';
      page.style.display = 'flex';
    }
  };
    
  function setEventListeners() {
    console.log("Setting event listeners...");
    
    // Check for unsaved changes or busy state before closing the window
    window.addEventListener('beforeunload', function (e) {
      if (!saveFlag || busyFlag) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    
    // Add event listeners for tool bar buttons
    document.getElementById('toggleDataButton').addEventListener('click', toggleDataView);
    document.getElementById('saveChangesButton').addEventListener('click', saveProfile);
    document.getElementById('addStudentButton').addEventListener('click', addStudent);
    document.getElementById('removeStudentButton').addEventListener('click', removeStudent);
    document.getElementById('renameStudentButton').addEventListener('click', renameStudent);
    document.getElementById('activateStudentButton').addEventListener('click', activateStudent);
    document.getElementById('deleteStudentButton').addEventListener('click', deleteStudent);
    document.getElementById('addMeetingButton').addEventListener('click', addMeeting);
    document.getElementById('deleteMeetingButton').addEventListener('click', deleteMeeting);
    document.getElementById('composeEmailButton').addEventListener('click', composeEmail);
    document.getElementById('sendReferralButton').addEventListener('click', sendReferral);
    document.getElementById('exportMeetingButton').addEventListener('click', exportMeeting);
    document.getElementById('exportDataButton').addEventListener('click', exportData);
    
    // Dropdown event listeners
    document.querySelectorAll('.dropdown').forEach(dropdown => {
      const dropdownContent = dropdown.querySelector('.dropdown-content');

      dropdown.addEventListener('mouseenter', () => {
        dropdown.classList.add('active');
      });

      dropdown.addEventListener('mouseleave', () => {
        setTimeout(() => {
          if (!dropdown.matches(':hover')) {
            dropdown.classList.remove('active');
          }
        }); // Small delay to prevent flickering
      });
    });

    // Toggle data view button
    const options = [
      { text: "<i class='bi bi-eye'></i>Active", color: "var(--green)" },
      { text: "<i class='bi bi-eye'></i>Watch", color: "var(--orange)" },
      { text: "<i class='bi bi-eye'></i>Archive", color: "var(--gray)" }
    ];

    // Initialize the button state
    let currentIndex = 0;
    const button = document.getElementById('toggleDataButton');
    button.setAttribute('data-state', currentIndex);

    button.addEventListener('click', () => {
      if (busyFlag) {
        showError("Error: OPERATION_IN_PROGRESS");
        return;
      }

      if (!saveFlag) {
        showError("Error: UNSAVED_CHANGES");
        return;
      }

      // Update the index to the next option, cycling back to 0 if at the end
      currentIndex = (currentIndex + 1) % options.length;

      // Update the button text and background color
      button.innerHTML = options[currentIndex].text;
      button.style.backgroundColor = options[currentIndex].color;
      button.setAttribute('data-state', currentIndex);
      toggleDataView();
    });
    
    // Add event listener for student name select box
    const studentNameSelectBox = document.getElementById('studentName');
    studentNameSelectBox.addEventListener('change', function() {
      const currentStudent = studentNameSelectBox.value;
      if (!saveFlag) {
        showError("Error: UNSAVED_CHANGES");
        studentNameSelectBox.value = previousStudentID;
      }
      else {
        updateStudentData(currentStudent);
      }
    });

    // Add event listener for meeting name select box
    const meetingNameSelectBox = document.getElementById('meetingName');
    meetingNameSelectBox.addEventListener('change', function() {
      const currentMeeting = meetingNameSelectBox.value;
      if (!saveFlag) {
        showError("Error: UNSAVED_CHANGES");
        meetingNameSelectBox.value = previousMeetingID;
      }
      else {
        updateMeetingData(currentMeeting);
      }
    });

    // Add event listeners for color dashboard fields
    const selectColorElements = document.querySelectorAll('#gender, #dateOfBirth, #grade, #classroom, #aide, #specializedInstruction');
    const inputColorElements = document.querySelectorAll('#allergies, #medications, #dietaryRestrictions, #diagnosis, #servicesPrograms, #caseManager, #roi1, #roi2, #roi3, #parentGuardianName1, #parentGuardianPhone1, #parentGuardianEmail1, #parentGuardianName2, #parentGuardianPhone2, #parentGuardianEmail2');
    const noColorElements = document.querySelectorAll('#notes, #meetingDate, #meetingType, #attendees, #facilitator, #scribe, #strengthsInput, #concernsInput, #actionPlan, #nextDate, #nextTime');

    selectColorElements.forEach(element => {
      element.addEventListener('change', () => {
        saveAlert();
        element.style.backgroundColor = getColor(element);
      });
    });

    inputColorElements.forEach(element => {
      element.addEventListener('input', () => {
        saveAlert();
        element.style.backgroundColor = getColor(element);
        if (element.id === 'parentGuardianPhone1' || element.id === 'parentGuardianPhone2') {
          formatPhoneNumber(element);
        }
      });
    });

    noColorElements.forEach(element => {
      const eventType = element.tagName === 'SELECT' ? 'change' : 'input';
      element.addEventListener(eventType, () => {
        saveAlert();
      });
    });
    
    // Highlight save changes with exceptions
    document.querySelectorAll("select:not(#studentName, #meetingName, #templateSelect)").forEach(function(select) {
      select.addEventListener("keydown", function(event) {
        if (event.key === "Backspace" || event.key === "Delete") {
          // Check if the select is inside any of the specified modals
          const isInModal = !!select.closest("#addStudentModal") || !!select.closest("#addMeetingModal") || !!select.closest("#referStudentModal");
          if (!isInModal) {
            saveAlert();
          }
          select.value = '';
          select.style.backgroundColor = '';
        }
      });
    });

    // Add event listener for phone number inputs in Add Student modal
    const addPhoneInputIds = document.querySelectorAll('#addParentGuardianPhone1, #addParentGuardianPhone2')
    addPhoneInputIds.forEach(input => {
      input.addEventListener('input', function(event) {
        formatPhoneNumber(this);
      });
    });

    // Add event listener for email template selection on Email modal
    const templateSelect = document.getElementById('templateSelect');
    templateSelect.addEventListener('change', function() {
      getEmailTemplate();
    });

    // Profile search event listener
    const profileSearchInput = document.getElementById('profileSearch');

    profileSearchInput.addEventListener('keyup', () => {
      const filter = profileSearchInput.value.toLowerCase();
      const toggleDataButton = document.getElementById('toggleDataButton');
      const dataFilter = parseInt(toggleDataButton.getAttribute('data-state'), 10);

      // Clear the current options in the studentNameSelectBox
      while (studentNameSelectBox.firstChild) {
        studentNameSelectBox.removeChild(studentNameSelectBox.firstChild);
      }

      // Filter STUDENT_DATA based on the selected database
      let filteredStudentData = STUDENT_DATA;

      if (dataFilter === 0) {
        filteredStudentData = STUDENT_DATA.filter(item => item['Status'] === 'Active');
      } else if (dataFilter === 1) {
        filteredStudentData = STUDENT_DATA.filter(item => item['Status'] === 'Watch');
      } else if (dataFilter === 2) {
        filteredStudentData = STUDENT_DATA.filter(item => item['Status'] === 'Archive');
      }

      // Further filter the already filteredStudentData based on the search input
      const filteredStudents = filteredStudentData.filter(student => {
        return Object.keys(student).some(key => {
          if ([
            'Student Name',
            'Gender', 
            'Date Of Birth', 
            'Grade', 
            'Classroom',
            'Allergies', 
            'Medications', 
            'Dietary Restrictions',
            'Diagnosis',
            'Services/Programs',
            'Aide',
            'Specialized Instruction',
            'Case Manager', 
            'ROI Organization 1',
            'ROI Organization 2', 
            'ROI Organization 3', 
            'Parent/Guardian Name 1',
            'Parent/Guardian Phone 1', 
            'Parent/Guardian Email 1',
            'Parent/Guardian Name 2',
            'Parent/Guardian Phone 2', 
            'Parent/Guardian Email 2',
            'Notes'
          ].includes(key)) {
            const value = student[key] ? student[key].toString().toLowerCase() : '';
            return value.includes(filter);
          }
          return false;
        });
      });

    // Populate the studentNameSelectBox with the filtered results
    filteredStudents.forEach(student => {
      const option = document.createElement('option');
      option.value = student['Student ID'];
      option.textContent = student['Student Name'];
      studentNameSelectBox.appendChild(option);
    });

    if (filteredStudents.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '';
      studentNameSelectBox.appendChild(option);
      updateStudentData("");
    }
    else {
      updateStudentData(filteredStudents[0]['Student ID']);
    }
  });
    
    console.log("Complete!");
  }

  function populateDashboard() {
    console.log("Populating dashboard...");

    const classroomSelect = document.getElementById('classroom');
    const addClassroomSelect = document.getElementById('addClassroom');
    const referClassroomSelect = document.getElementById('referClassroom')
    classroomSelect.innerHTML = '';
    addClassroomSelect.innerHTML = '';
    referClassroomSelect.innerHTML = '';

    // Populate classroom selects
    APP_SETTINGS.classroomSettings.forEach(classroom => {
      const className = classroom.classroom;
      const teacherName = classroom.teacher;
      if (className) {
        const option1 = document.createElement('option');
        option1.value = `${className} - ${teacherName}`;
        option1.textContent = `${className} - ${teacherName}`;
        classroomSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = `${className} - ${teacherName}`;
        option2.textContent = `${className} - ${teacherName}`;
        addClassroomSelect.appendChild(option2);

        const option3 = document.createElement('option');
        option3.value = `${className} - ${teacherName}`;
        option3.textContent = `${className} - ${teacherName}`;
        referClassroomSelect.appendChild(option3);
      }
    });

    // Set initial values for Add Student modal select boxes
    addStudentModal.querySelectorAll('select').forEach(function(select) {
      select.value = '';
    });

    // Set initial values for Refer Student modal select boxes
    referStudentModal.querySelectorAll('select').forEach(function(select) {
      select.value = '';
    });

    // Set initial values for Add Meeting modal select boxes
    addMeetingModal.querySelectorAll('select').forEach(function(select) {
      select.value = '';
    });
    
    updateStudentNames();
    
    console.log("Complete!");
  }

  /////////////////////
  // MODAL FUNCTIONS //
  /////////////////////

  function resetModal() {
    const modalInputs = document.querySelectorAll('#addStudentModal input, #addStudentModal select, #renameStudentModal input, #referStudentModal input, #referStudentModal select, #addMeetingModal input, #addMeetingModal select, #emailModal input, #emailModal select, #referStudentModal input, #referStudentModal select, #referStudentModal textarea, #emailBody, #exportMeetingModal select, #exportDataModal input, #exportDataModal select');
    
    modalInputs.forEach(function(input) {
      if (input.type === 'checkbox' || input.type === 'radio') {
        // Uncheck checkboxes and radio buttons
        input.checked = false;
      } else if (input.id === 'emailBody') {
        input.innerHTML = '';
      } else if (input.id === 'templateSelect' || input.id === 'exportMeetingSelect' || input.id === 'dataTypeSelect' || input.id === 'fileTypeSelect') {
        input.selectedIndex = 0; // Reset to the first option
      } else {
        input.value = '';
      }
    });

    // Reset the scroll position of all modal bodies
    const modalBodies = document.querySelectorAll('.modal-htmlbody');
    modalBodies.forEach(modalBody => {
      modalBody.scrollTop = 0;
    });
  }

  //////////////////
  // SAVE PROFILE //
  //////////////////

  function saveProfile() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }

    const studentNameSelectBox = document.getElementById('studentName');
    const meetingNameSelectBox = document.getElementById('meetingName');

    if (studentNameSelectBox.options.length === 0) {
      showError("Error: MISSING_STUDENT_DATA");
      return;
    }

    const selectedStudentID = studentNameSelectBox.value;
    const selectedMeetingID = meetingNameSelectBox.value;

    // Create working copies
    const tempStudentData = [...STUDENT_DATA];
    const tempMeetingData = [...MEETING_DATA];
    
    const student = tempStudentData.find(item => item['Student ID'] === selectedStudentID);

    // Update student data
    Object.entries(STUDENT_KEY_MAPPINGS).forEach(([elementId, dataKey]) => {
        const element = document.getElementById(elementId);
        if (element) {
            student[dataKey] = element.value;
        }
    });

    const studentDataArray = [[
        student['Student ID'],
        student['Status'],
        student['Student Name'],
        ...Object.keys(STUDENT_KEY_MAPPINGS).map(key => student[STUDENT_KEY_MAPPINGS[key]])
    ]];

    // Update meeting data if exists
    let meetingDataArray = [];
    if (selectedMeetingID?.trim()) {
        const meeting = tempMeetingData.find(item => item['Meeting ID'] === selectedMeetingID);
        if (meeting) {
            Object.entries(MEETING_KEY_MAPPINGS).forEach(([elementId, dataKey]) => {
                const element = document.getElementById(elementId);
                if (element) {
                    meeting[dataKey] = element.value;
                }
            });

            meetingDataArray = [[
                meeting['Meeting ID'],
                student['Student ID'],
                student['Student Name'],
                ...Object.keys(MEETING_KEY_MAPPINGS).map(key => meeting[MEETING_KEY_MAPPINGS[key]])
            ]];
        }
    }
    
    busyFlag = true;
    showToast("", "Saving changes...", 5000);

    google.script.run
      .withSuccessHandler(() => {
        STUDENT_DATA = tempStudentData;
        MEETING_DATA = tempMeetingData;
        document.getElementById('saveChangesButton').classList.remove('tool-bar-button-unsaved');
               
        showToast("", `'${student['Student Name']}' saved successfully!`, 5000);
        playNotificationSound("success");

        saveFlag = true;
        busyFlag = false;
      })
      .withFailureHandler((error) => {
        const errorString = String(error);
        
        if (errorString.includes("401")) {
          sessionError();
        }
        else if (errorString.includes("permission")) {
            showError("Error: PERMISSION");
        }
        else {
          showError(error.message);
        }
        saveFlag = true;
        busyFlag = false;
      })
    .saveStudentData(studentDataArray, meetingDataArray);
  }

  /////////////////
  // ADD STUDENT //
  /////////////////
  
  async function addStudent() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }

    showHtmlModal("addStudentModal");

    const addStudentModalButton = document.getElementById("addStudentModalButton");

    addStudentModalButton.onclick = async function() {
      if (addStudentErrorCheck()) {
        return;
      }

      busyFlag = true;
      
      // Get the form data
      const toggleDataButton = document.getElementById('toggleDataButton');
      const dataFilter = parseInt(toggleDataButton.getAttribute('data-state'), 10);
      let status;

      if (dataFilter === 0) {
        status = 'Active';
      }
      else if (dataFilter === 1) {
        status = 'Watch';
      }
      else if (dataFilter === 2) {
        status = 'Archive';
      }
      
      const firstName = document.getElementById('addFirstName').value;
      const lastName = document.getElementById('addLastName').value;
      const studentName = lastName + ", " + firstName;

      // Create temporary student object
      const tempStudent = {
        'Status': status,
        'Student Name': studentName,
        'Gender': document.getElementById('addGender').value,
        'Date Of Birth': document.getElementById('addDateOfBirth').value,
        'Grade': document.getElementById('addGrade').value,
        'Classroom': document.getElementById('addClassroom').value,
        'Allergies': document.getElementById('addAllergies').value,
        'Medications': document.getElementById('addMedications').value,
        'Dietary Restrictions': document.getElementById('addDietaryRestrictions').value,
        'Diagnosis': document.getElementById('addDiagnosis').value,
        'Services/Programs': document.getElementById('addServicesPrograms').value,
        'Aide': document.getElementById('addAide').value,
        'Specialized Instruction': document.getElementById('addSpecializedInstruction').value,
        'Case Manager': document.getElementById('addCaseManager').value,
        'ROI Organization 1': document.getElementById('addROI1').value,
        'ROI Organization 2': document.getElementById('addROI2').value,
        'ROI Organization 3': document.getElementById('addROI3').value,
        'Parent/Guardian Name 1': document.getElementById('addParentGuardianName1').value,
        'Parent/Guardian Phone 1': document.getElementById('addParentGuardianPhone1').value,
        'Parent/Guardian Email 1': document.getElementById('addParentGuardianEmail1').value,
        'Parent/Guardian Name 2': document.getElementById('addParentGuardianName2').value,
        'Parent/Guardian Phone 2': document.getElementById('addParentGuardianPhone2').value,
        'Parent/Guardian Email 2': document.getElementById('addParentGuardianEmail2').value,
      };

      closeHtmlModal("addStudentModal");
      showToast("", "Adding student...", 5000);

      await getAvailableID();
      tempStudent['Student ID'] = cachedID;

      const newStudentArray = [[
        tempStudent['Student ID'],
        tempStudent['Status'],
        tempStudent['Student Name'],
        tempStudent['Gender'],
        tempStudent['Date Of Birth'],
        tempStudent['Grade'],
        tempStudent['Classroom'],
        tempStudent['Allergies'],
        tempStudent['Medications'],
        tempStudent['Dietary Restrictions'],
        tempStudent['Diagnosis'],
        tempStudent['Services/Programs'],
        tempStudent['Aide'],
        tempStudent['Specialized Instruction'],
        tempStudent['Case Manager'],
        tempStudent['ROI Organization 1'],
        tempStudent['ROI Organization 2'],
        tempStudent['ROI Organization 3'],
        tempStudent['Parent/Guardian Name 1'],
        tempStudent['Parent/Guardian Phone 1'],
        tempStudent['Parent/Guardian Email 1'],
        tempStudent['Parent/Guardian Name 2'],
        tempStudent['Parent/Guardian Phone 2'],
        tempStudent['Parent/Guardian Email 2'],
        '' // Notes
      ]];

      google.script.run
        .withSuccessHandler(() => {
          STUDENT_DATA.push(tempStudent);
          updateStudentNames();
                    
          const studentNameSelectBox = document.getElementById('studentName');
          studentNameSelectBox.value = tempStudent['Student ID'];
          studentNameSelectBox.dispatchEvent(new Event('change'));
                    
          showToast("", `${tempStudent['Student Name']} added successfully!`, 5000);
          playNotificationSound("success");
          busyFlag = false;
        })
        .withFailureHandler((error) => {
          const errorString = String(error);
          
          if (errorString.includes("401")) {
            sessionError();
          }
          else if (errorString.includes("permission")) {
            showError("Error: PERMISSION");
          }
          else {
            showError(error.message);
          }
          busyFlag = false;
        })
      .addStudentData(newStudentArray);
    }
  }

  function addStudentErrorCheck() {
    // Get the current database filter
    const toggleDataButton = document.getElementById('toggleDataButton');
    const dataFilter = parseInt(toggleDataButton.getAttribute('data-state'), 10);
    
    // Get the form values
    const firstName = document.getElementById('addFirstName').value;
    const lastName = document.getElementById('addLastName').value;
    const gender = document.getElementById('addGender').value;
    const dateOfBirth = document.getElementById('addDateOfBirth').value;
    const grade = document.getElementById('addGrade').value;
    const classroom = document.getElementById('addClassroom').value;
    const specializedInstruction = document.getElementById('addSpecializedInstruction').value;
    const caseManager = document.getElementById('addCaseManager').value;
    const parentGuardianName1 = document.getElementById('addParentGuardianName1').value;
    const parentGuardianPhone1 = document.getElementById('addParentGuardianPhone1').value;
    const parentGuardianEmail1 = document.getElementById('addParentGuardianEmail1').value;
    const parentGuardianName2 = document.getElementById('addParentGuardianName2').value;
    const parentGuardianPhone2 = document.getElementById('addParentGuardianPhone2').value;
    const parentGuardianEmail2 = document.getElementById('addParentGuardianEmail2').value;
    const parent1Valid = parentGuardianName1 && parentGuardianPhone1 && parentGuardianEmail1;
    const parent2Valid = parentGuardianName2 && parentGuardianPhone2 && parentGuardianEmail2;

    // Define regular expression patterns for error handling
    const phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9-]{2,})+$/;

    if (!firstName) {
      showError("Error: MISSING_FIRST_NAME");
      return true;
    }
    
    if (!lastName) {
      showError("Error: MISSING_LAST_NAME");
      return true;
    }

    if (!gender) {
      showError("Error: MISSING_GENDER");
      return true;
    }
    
    if (!dateOfBirth) {
      showError("Error: MISSING_DOB");
      return true;
    }

    if (!grade) {
      showError("Error: MISSING_GRADE");
      return true;
    }

    if (!classroom) {
      showError("Error: MISSING_CLASSROOM");
      return true;
    }

    if (dataFilter === 0) {
      if (!caseManager) {
      showError("Error: MISSING_CASE_MANAGER");
      return true;
      }

      // If neither Parent 1 nor Parent 2 is fully valid, show an error
      if (!parent1Valid && !parent2Valid) {
        showError("Error: MISSING_CONTACT");
        return true;
      }
      
      // Validate phone numbers
      if (parentGuardianPhone1 && !phonePattern.test(parentGuardianPhone1)) {
        showError("Error: INVALID_PHONE");
        return true;
      }
      if (parentGuardianPhone2 && !phonePattern.test(parentGuardianPhone2)) {
        showError("Error: INVALID_PHONE");
        return true;
      }

      // Validate emails
      if (parentGuardianEmail1 && !emailPattern.test(parentGuardianEmail1)) {
        showError("Error: INVALID_EMAIL");
        return true;
      }
      if (parentGuardianEmail2 && !emailPattern.test(parentGuardianEmail2)) {
        showError("Error: INVALID_EMAIL");
        return true;
      }
    }
    
    return false;
  }

  ////////////////////
  // ARCHIVE STUDENT //
  ////////////////////

  async function removeStudent() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }
    
    if (removeStudentErrorCheck()) {
        return;
    }

    // Get student data
    const studentNameSelectBox = document.getElementById('studentName');
    const selectedStudentID = studentNameSelectBox.value;
    const selectedStudent = STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID);

    if (!selectedStudent) {
      showError("Error: MISSING_STUDENT_ENTRY");
      return;
    }

    // Show confirmation modal
    const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
    const message = `Are you sure you want to archive the data for '${selectedStudent['Student Name']}'?`;
    const title = `${warningIcon}Archive Student`;
    const buttonText = await showModal(title, message, "Cancel", "Archive");

    if (buttonText === "Cancel") {
      return;
    }

    // Set busy flag and create a backup of the student data
    busyFlag = true;
    const selectedIndex = studentNameSelectBox.selectedIndex;

    // Show progress toast
    showToast("", "Archiving student...", 5000);

    // Server operation
    google.script.run
      .withSuccessHandler(() => {
        // Update the UI
        if (selectedIndex >= 0) {
          studentNameSelectBox.remove(selectedIndex);
          studentNameSelectBox.selectedIndex = -1;
        }
            
        // Update the student status in the local data - CHANGE THIS!
        STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID)['Status'] = 'Archive';
        updateStudentNames();
            
        const toastMessage = `'${selectedStudent['Student Name']}' archived successfully!`;
        showToast("", toastMessage, 5000);
        playNotificationSound("remove");
        busyFlag = false;
      })
      .withFailureHandler((error) => {
        const errorString = String(error);
        
        if (errorString.includes("401")) {
          sessionError();
        }
        else if (errorString.includes("permission")) {
            showError("Error: PERMISSION");
        }
        else {
          showError(error.message);
        }
        busyFlag = false;
      })
      .updateStudentStatus(selectedStudentID, 'Archive');
  }

  function removeStudentErrorCheck() {
    const studentNameSelectBox = document.getElementById('studentName');
    
    if (studentNameSelectBox.options.length === 0) {
      showError("Error: MISSING_STUDENT_DATA");
      return true;
    }

    return false;
  }

  ////////////////////
  // RENAME STUDENT //
  ////////////////////
  
  async function renameStudent() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }

    const studentNameSelectBox = document.getElementById('studentName');

    if (studentNameSelectBox.options.length === 0) {
      showError("Error: MISSING_STUDENT_DATA");
      return true;
    }

    // Get the selected student ID and data
    const selectedStudentID = studentNameSelectBox.value;
    const selectedStudent = STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID);

    if (!selectedStudent) {
        showError("Error: MISSING_STUDENT_ENTRY");
        return;
    }

    // Store the current name
    const oldStudentName = selectedStudent['Student Name'];

    // Update modal with current name
    document.getElementById('currentStudentName').innerHTML = oldStudentName;

    // Show the rename modal
    showHtmlModal("renameStudentModal");
    const renameStudentModalButton = document.getElementById("renameStudentModalButton");
    
    renameStudentModalButton.onclick = async function() {
        busyFlag = true;

        if (renameStudentErrorCheck()) {
            busyFlag = false;
            return;
        }

        // Get new name/status data
        const firstName = document.getElementById('renameFirst').value;
        const lastName = document.getElementById('renameLast').value;
        const newStudentName = lastName + ", " + firstName;
        const studentStatus = selectedStudent['Status'];

        // Close modal immediately
        closeHtmlModal("renameStudentModal");
        
        // Show initial toast
        showToast("", "Renaming student...", 5000);

        // Save to Google Sheets
        google.script.run
          .withSuccessHandler(() => {
            selectedStudent['Student Name'] = newStudentName;
            updateStudentNames();
            
            // Switch to renamed student
            studentNameSelectBox.value = selectedStudentID;
            studentNameSelectBox.dispatchEvent(new Event('change'));
            
            showToast("", `${oldStudentName} renamed to ${newStudentName} successfully!`, 5000);
            playNotificationSound("success");
            busyFlag = false;
          })
          .withFailureHandler((error) => {
            const errorString = String(error);
        
            if (errorString.includes("401")) {
              sessionError();
            }
            else if (errorString.includes("permission")) {
            showError("Error: PERMISSION");
            }
            else {
              showError(error.message);
            }
            busyFlag = false;
          })
        .renameStudent(selectedStudentID, studentStatus, newStudentName);
    };
  }

  function renameStudentErrorCheck() {
    const firstNameInput = document.getElementById('renameFirst').value;
    const lastNameInput = document.getElementById('renameLast').value;
    
    if (!firstNameInput) {
      showError("Error: MISSING_FIRST_NAME");
      return true;
    }

    if (!lastNameInput) {
      showError("Error: MISSING_LAST_NAME");
      return true;
    }
    
    return false;
  }

  //////////////////////
  // ACTIVATE STUDENT //
  //////////////////////

  async function activateStudent() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }

    if (activateStudentErrorCheck()) {
      busyFlag = false;
      return;
    }

    // Get student data
    const studentNameSelectBox = document.getElementById('studentName');
    const selectedIndex = studentNameSelectBox.selectedIndex;

    if (selectedIndex < 0) {
        return;
    }

    const selectedStudentID = studentNameSelectBox.value;
    const selectedStudentName = studentNameSelectBox.options[selectedIndex].text;

    // Show confirmation modal with warning icon
    const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
    const message = `Are you sure you want to activate the data for '${selectedStudentName}'?`;
    const title = `${warningIcon}Activate Student`;

    const buttonText = await showModal(title, message, "Cancel", "Activate");

    if (buttonText === "Cancel") {
      return;
    }

    // Set busy flag and store backup
    busyFlag = true;

    // Show progress toast
    showToast("", "Activating student...", 5000);

    // Server operation
    google.script.run
      .withSuccessHandler(() => {
        STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID)['Status'] = 'Active';
        updateStudentNames();

        showToast("", `'${selectedStudentName}' activated successfully!`, 5000);
        playNotificationSound("success");
        busyFlag = false;
      })
      .withFailureHandler((error) => {
        const errorString = String(error);
        
        if (errorString.includes("401")) {
          sessionError();
        }
        else if (errorString.includes("permission")) {
            showError("Error: PERMISSION");
        }
        else {
          showError(error.message);
        }
        busyFlag = false;
      })
    .updateStudentStatus(selectedStudentID, 'Active');
  }

  function activateStudentErrorCheck() {
    const studentNameSelectBox = document.getElementById('studentName');
    
    if (studentNameSelectBox.options.length === 0) {
      showError("Error: MISSING_STUDENT_DATA");
      return true;
    }

    return false;
  }

  ////////////////////
  // DELETE STUDENT //
  ////////////////////
  
  async function deleteStudent() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }

    if (deleteStudentErrorCheck()) {
      busyFlag = false;
      return;
    }

    // Get student data
    const studentNameSelectBox = document.getElementById('studentName');
    const selectedStudentID = studentNameSelectBox.value;
    const selectedStudent = STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID);
    const selectedStudentName = selectedStudent['Student Name'];
    const selectedStudentStatus = selectedStudent['Status'];

    // Show confirmation modal with warning icon
    const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
    const message = `Are you sure you want to delete the profile and meeting data for '${selectedStudentName}'? This action cannot be undone.`;
    const title = `${warningIcon}Delete Student`;

    const buttonText = await showModal(title, message, "Cancel", "Delete");

    if (buttonText === "Cancel") {
      return;
    }

    // Set busy flag and store backup
    busyFlag = true;
    const selectedIndex = studentNameSelectBox.selectedIndex;
    const associatedMeetings = MEETING_DATA.filter(meeting => meeting['Student ID'] === selectedStudentID);

    // Show progress toast
    showToast("", "Deleting student and meetings...", 5000);

    // Server operation
    google.script.run
      .withSuccessHandler(() => {
        if (selectedIndex >= 0) {
          studentNameSelectBox.remove(selectedIndex);
          studentNameSelectBox.selectedIndex = -1;
        }

        // Remove student with the selected ID from STUDENT_DATA
        STUDENT_DATA = STUDENT_DATA.filter(student => student['Student ID'] !== selectedStudentID);
                      
        // Remove associated meetings from MEETING_DATA
        MEETING_DATA = MEETING_DATA.filter(meeting => meeting['Student ID'] !== selectedStudentID);

        updateStudentNames();
                  
        const toastMessage = `'${selectedStudentName}' and associated meetings deleted successfully!`;
        playNotificationSound("remove");
        showToast("", toastMessage, 5000);
        busyFlag = false;
      })
      .withFailureHandler((error) => {
        const errorString = String(error);
        
        if (errorString.includes("401")) {
          sessionError();
        }
        else if (errorString.includes("permission")) {
            showError("Error: PERMISSION");
        }
        else {
          showError(error.message);
        }
        busyFlag = false;
      })
    .deleteStudentData(selectedStudentID, selectedStudentStatus);
  }

  function deleteStudentErrorCheck() {
    const studentNameSelectBox = document.getElementById('studentName');
    
    if (studentNameSelectBox.options.length === 0) {
      showError("Error: MISSING_STUDENT_DATA");
      return true;
    }

    return false;
  }

  /////////////////
  // ADD MEETING //
  /////////////////

  async function addMeeting() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }

    // Check if a student is selected
    const studentID = document.getElementById('studentName').value;
    if (!studentID) {
      showError("Error: MISSING_STUDENT_DATA");
      return;
    }

    // Show the Add Meeting modal
    showHtmlModal("addMeetingModal");

    const addMeetingModalButton = document.getElementById("addMeetingModalButton");

    addMeetingModalButton.onclick = async function() {
      busyFlag = true;

      if (addMeetingErrorCheck()) {
        busyFlag = false;
        return;
      }

      // Get student data
      const studentNameSelectBox = document.getElementById('studentName');
      const selectedStudentID = studentNameSelectBox.value;
      const student = STUDENT_DATA.find(student => student['Student ID'] === selectedStudentID);

      // Create the new meeting object
      const newMeeting = {
        'Student ID': student['Student ID'],
        'Student Name': student['Student Name'],
        'Date': document.getElementById('addMeetingDate').value,
        'Type': document.getElementById('addMeetingType').value,
        'Attendees': document.getElementById('addAttendees').value,
        'Facilitator': document.getElementById('addFacilitator').value,
        'Scribe': document.getElementById('addScribe').value,
        'Areas Of Strength': "",
        'Areas Of Concern': "",
        'Action Plan': "",
        'Next Date': "",
        'Next Time': ""
      };

      // Close the modal and show progress toast
      closeHtmlModal("addMeetingModal");
      showToast("", "Adding meeting...", 5000);

      // Get meeting ID
      await getAvailableID();
      const meetingID = cachedID;
      newMeeting['Meeting ID'] = meetingID;

      // Prepare data for Google Sheets
      const newMeetingArray = [[
        meetingID,
        newMeeting['Student ID'],
        newMeeting['Student Name'],
        newMeeting['Date'],
        newMeeting['Type'],
        newMeeting['Attendees'],
        newMeeting['Facilitator'],
        newMeeting['Scribe']
      ]];

      // Attempt to save to Google Sheets
      google.script.run
        .withSuccessHandler(() => {
          MEETING_DATA.push(newMeeting);
          studentNameSelectBox.value = selectedStudentID;
          studentNameSelectBox.dispatchEvent(new Event('change'));

          showToast("", "Meeting added successfully!", 5000);
          playNotificationSound("success");
          busyFlag = false;
        })
        .withFailureHandler((error) => {
          const errorString = String(error);
        
          if (errorString.includes("401")) {
            sessionError();
          }
          else if (errorString.includes("permission")) {
            showError("Error: PERMISSION");
          }
          else {
            showError(error.message);
          }
          busyFlag = false;
        })
      .addMeetingData(newMeetingArray);
    };
  }

  function addMeetingErrorCheck() {
    const meetingDate = document.getElementById('addMeetingDate').value;
    const meetingType = document.getElementById('addMeetingType').value;
    const meetingAttendees = document.getElementById('addAttendees').value;
    const meetingFacilitator = document.getElementById('addFacilitator').value;
    const meetingScribe = document.getElementById('addScribe').value;

    if (!meetingDate) {
      showError("Error: MISSING_DATE");
      return true;
    }
    if (!meetingType) {
      showError("Error: MISSING_MEETING_TYPE");
      return true;
    }
    if (!meetingAttendees) {
      showError("Error: MISSING_ATTENDEES");
      return true;
    }
    if (!meetingFacilitator) {
      showError("Error: MISSING_FACILITATOR");
      return true;
    }
    if (!meetingScribe) {
      showError("Error: MISSING_SCRIBE");
      return true;
    }

    return false;
  }

  ////////////////////
  // DELETE MEETING //
  ////////////////////

  async function deleteMeeting() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }
    
    if (deleteMeetingErrorCheck()) {
      busyFlag = false;
      return;
    }

    // Get meeting data
    const meetingNameSelectBox = document.getElementById('meetingName');
    const meetingID = meetingNameSelectBox.value;
    const selectedMeeting = MEETING_DATA.find(meeting => meeting['Meeting ID'] === meetingID);

    if (!selectedMeeting) {
      showError("Error: MISSING_MEETING_ENTRY");
      return;
    }

    // Format meeting information for confirmation modal
    const meetingDate = formatDate(selectedMeeting['Date']);
    const meetingName = `${meetingDate} - ${selectedMeeting['Type']}`;
    
    // Show confirmation modal
    const warningIcon = '<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>';
    const message = `Are you sure you want to delete the meeting '${meetingName}'? This action cannot be undone.`;
    const title = `${warningIcon}Delete Meeting`;
    const buttonText = await showModal(title, message, "Cancel", "Delete");
    
    if (buttonText === "Cancel") {
        return;
    }

    busyFlag = true;
    showToast("", "Deleting meeting...", 5000);

    google.script.run
      .withSuccessHandler(() => {
        meetingNameSelectBox.remove(meetingNameSelectBox.selectedIndex);
        meetingNameSelectBox.selectedIndex = -1;
        MEETING_DATA = MEETING_DATA.filter(meeting => meeting['Meeting ID'] !== meetingID);
                  
        // Refresh the meeting list for the selected student
        const studentID = document.getElementById('studentName').value;
        updateMeetingNames(studentID);
                
        const toastMessage = `'${meetingName}' deleted successfully!`;
        playNotificationSound("remove");
        showToast("", toastMessage, 5000);
        busyFlag = false;
      })
      .withFailureHandler((error) => {
        const errorString = String(error);
        
        if (errorString.includes("401")) {
          sessionError();
        }
        else if (errorString.includes("permission")) {
            showError("Error: PERMISSION");
        }
        else {
          showError(error.message);
        }
        busyFlag = false;
      })
    .deleteMeetingData(meetingID);
  }

  function deleteMeetingErrorCheck() {
    const meetingNameSelectBox = document.getElementById('meetingName');
    
    if (meetingNameSelectBox.options.length === 0) {
      showError("Error: MISSING_MEETING_DATA");
      return true;
    }

    return false;
  }

  ///////////////////
  // COMPOSE EMAIL //
  ///////////////////

  async function composeEmail() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }

    // Prevent add email modal from being shown if no student selected
    const studentID = document.getElementById('studentName').value;

    if (!studentID) {
      showError("Error: MISSING_STUDENT_DATA");
      return;
    }
    
    // Reset the warning before the modal is opened
    document.getElementById('templateWarning').style.display = 'none';
    showHtmlModal("emailModal");

    const sendEmailModalButton = document.getElementById('sendEmailModalButton');
    sendEmailModalButton.onclick = async function() {
      busyFlag = true;
        
      if (sendEmailErrorCheck()) {
        busyFlag = false;
        return;
      }

      const template = document.getElementById('templateSelect').value;
      const recipient = document.getElementById('emailRecipient').value;
      const subject = document.getElementById('emailSubject').value;
      const body = document.getElementById('emailBody').innerHTML;
      let attachmentType = '';
      let attachments = [];

      // Get the data from the Student Meetings column
      const meetingSummaryData = {
        'Student Name': document.getElementById('studentName').options[document.getElementById('studentName').selectedIndex].text,
        'Meeting Date': formatDate(document.getElementById('meetingDate').value),
        'Meeting Type': document.getElementById('meetingType').value,
        'Attendees': document.getElementById('attendees').value,
        'Facilitator': document.getElementById('facilitator').value,
        'Scribe': document.getElementById('scribe').value,
        'Strengths': document.getElementById('strengthsInput').value,
        'Concerns': document.getElementById('concernsInput').value,
        'Action Plan': document.getElementById('actionPlanInput').value,
        'Next Meeting Date': formatDate(document.getElementById('nextDate').value),
        'Next Meeting Time': formatTime(document.getElementById('nextTime').value),
      };

      // Replace any empty values with 'N/A'
      Object.keys(meetingSummaryData).forEach((key) => {
        if (!meetingSummaryData[key]) {
          meetingSummaryData[key] = 'N/A';
        }
      });

      closeHtmlModal("emailModal");

      try {
        const toastMessage = template === "summary" 
          ? "Attaching meeting summary and sending email..." 
          : "Sending email...";
        const toastDuration = template === "summary" ? 10000 : 5000;
        
        showToast("", toastMessage, toastDuration);

        if (template === "summary") {
          attachmentType = 'summary';
          attachments = await generateMeetingSummaryPDF(meetingSummaryData);
        }

        google.script.run
          .withSuccessHandler(() => {
            playNotificationSound("email");
            showToast("", "Email successfully sent to: " + recipient, 10000);
            busyFlag = false;
          })
          .withFailureHandler((error) => {
            const errorString = String(error);
        
            if (errorString.includes("401")) {
              sessionError();
            } else {
              showError(error.message);
            }

            busyFlag = false;
          })
        .createEmail(recipient, subject, body, attachmentType, attachments);
      } catch {
        showError("Error: EMAIL_FAILURE");
        busyFlag = false;
      }
    };
  }

  function getEmailTemplate() {
    // Get references to the selectbox and text areas
    const mergeData = getMergeData();
    const templateType = document.getElementById('templateSelect').value;
    const parentGuardianEmail1 = document.getElementById('parentGuardianEmail1').value;
    const parentGuardianEmail2 = document.getElementById('parentGuardianEmail2').value;
    const recipient = document.getElementById('emailRecipient');
    const subjectTemplate = document.getElementById('emailSubject');
    const bodyTemplate = document.getElementById('emailBody');
    
    // Reset template warning
    document.getElementById('templateWarning').style.display = 'none';

    // Extract email templates from APP_SETTINGS
    const emailTemplates = APP_SETTINGS.emailTemplateSettings;

    // Helper function to find a template by type (e.g., 'Initial', 'Reminder')
    const getTemplate = (type) => emailTemplates[type] || { subject: '', body: '' };

    // Determine the recipient email(s)
    if (parentGuardianEmail1 && parentGuardianEmail2) {
        recipient.value = `${parentGuardianEmail1}, ${parentGuardianEmail2}`;
    } else if (parentGuardianEmail1) {
        recipient.value = parentGuardianEmail1;
    } else if (parentGuardianEmail2) {
        recipient.value = parentGuardianEmail2;
    } else {
        recipient.value = ""; // In case both emails are empty
    }

    // Update the template content based on the selected option
    switch (templateType) {
      case 'referral':
        const referralTemplate = getTemplate('referral');
        subjectTemplate.value = referralTemplate.subject;
        bodyTemplate.innerHTML = getEmailBody(referralTemplate.body, mergeData);
        break;

      case 'initial':
        const initialTemplate = getTemplate('initial');
        subjectTemplate.value = initialTemplate.subject;
        bodyTemplate.innerHTML = getEmailBody(initialTemplate.body, mergeData);
        break;

      case 'reminder':
        const reminderTemplate = getTemplate('reminder');
        subjectTemplate.value = reminderTemplate.subject;
        bodyTemplate.innerHTML = getEmailBody(reminderTemplate.body, mergeData);
        break;

      case 'summary':
        const summaryTemplate = getTemplate('summary');
        subjectTemplate.value = summaryTemplate.subject;
        bodyTemplate.innerHTML = getEmailBody(summaryTemplate.body, mergeData);
        break;

      default:
        recipient.value = "";
        subjectTemplate.value = "";
        bodyTemplate.innerHTML = "";
        break;
    }
  }

  function getEmailBody(message, mergeData) {
    // Regular expression to match text within curly braces
    const regex = /{{([^}]+)}}/g;
    const warningIcon = `<i class="bi-exclamation-triangle-fill" style="color: var(--warning-color)"></i>`;

    // Use replace() to find and replace text within curly braces
    const bodyTemplate = message.replace(regex, (match, variableName) => {
      
      // Check if the variable exists in the provided mapping
      if (mergeData.hasOwnProperty(variableName)) {
        // Replace the variable with its corresponding value
        return mergeData[variableName];
      }
      else {
        // If the variable is not found, leave it unchanged
        return match;
      }
    });

    if (bodyTemplate.includes(warningIcon)) {
      document.getElementById('templateWarning').style.display = '';
    }

    return bodyTemplate;
  }

  function getMergeData() {
    // Split the student name into first and last
    const studentSelect = document.getElementById('studentName');
    const studentName = studentSelect.options[studentSelect.selectedIndex].text;
    let nameParts = studentName.match(/(.+),\s*(.+)/);
    let studentLastName = nameParts[1].trim();
    let studentFirstName = nameParts[2].trim();

    // Format meeting date
    const meetingDate = document.getElementById('meetingDate').value;
    const formattedMeetingDate = formatDate(meetingDate);

    // Format next meeting date
    const nextMeetingDate = document.getElementById('nextDate').value;
    const formattedNextMeetingDate = formatDate(nextMeetingDate);

    // Format screeningTime
    const nextMeetingTime = document.getElementById('nextTime').value;
    const formattedNextMeetingTime = formatTime(nextMeetingTime);

    // Create the mergeData object
    mergeData = {
      schoolYear: APP_SETTINGS.schoolSettings.schoolYear,
      studentLastName: studentLastName,
      studentFirstName: studentFirstName,
      caseManager: document.getElementById('caseManager').value,
      meetingDate: formattedMeetingDate,
      scheduledMeetingDate: formattedNextMeetingDate,
      scheduledMeetingTime: formattedNextMeetingTime
    };

    const warningIcon = `<i class="bi-exclamation-triangle-fill" style="color: var(--warning-color)"></i>`;

    // Add error icon to missing mergeData data
    Object.keys(mergeData).forEach(key => {
      if (mergeData[key] === "") {
        mergeData[key] = warningIcon;
      }
    });

    return mergeData;
  }

  function sendEmailErrorCheck() {
    const recipient = document.getElementById('emailRecipient').value;
    const body = document.getElementById('emailBody').innerHTML;
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9-]{2,})+$/;
    const warningIcon = '<i class="bi-exclamation-triangle-fill" style="color: var(--warning-color)"></i>';
    
    if (!recipient) {
      showError("Error: MISSING_RECIPIENT");
      return true;
    }

    const recipients = recipient.split(',');
    for (let i = 0; i < recipients.length; i++) {
      if (!emailPattern.test(recipients[i].trim())) {
        showError("Error: INVALID_EMAIL");
        return true;
      }
    }

    if (body.includes(warningIcon)) {
      showError("Error: MISSING_TEMPLATE_DATA");
      return true;
    }

    // Prevent email from being sent if no meetings can be attached
    const exportMeetingSelectBox = document.getElementById('exportMeetingSelect');
    const templateType = document.getElementById('templateSelect').value;
    
    if (exportMeetingSelectBox.options.length === 0 && templateType === 'summary') {
      showError("Error: MISSING_MEETING_DATA");
      return true;
    }

    return false;
  }

  ///////////////////
  // SEND REFERRAL //
  ///////////////////

  async function sendReferral() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }

    showHtmlModal("referStudentModal");

    const referStudentModalButton = document.getElementById('referStudentModalButton');
    referStudentModalButton.onclick = async function() {
      busyFlag = true;
        
      if (sendReferralErrorCheck()) {
        busyFlag = false;
        return;
      }

      // Build the referral object
      const lastName = document.getElementById('referLastName').value;
      const firstName = document.getElementById('referFirstName').value;

      const mapBoolean = (value) => value ? "Yes" : "No";
      
      const referralData = {
        information: {
          studentName: `${lastName}, ${firstName}`,
          gender: document.getElementById('referGender').value,
          grade: document.getElementById('referGrade').value,
          classroom: document.getElementById('referClassroom').value,
          date: formatDate(document.getElementById('referDate').value)
        },
        strengths: document.getElementById('referStrengths').value,
        concerns: document.getElementById('referConcerns').value,
        reading: {
          phonemicAwareness: mapBoolean(document.getElementById('phonemicAwareness').checked),
          decodingPhonics: mapBoolean(document.getElementById('decodingPhonics').checked),
          fluency: mapBoolean(document.getElementById('fluency').checked),
          vocabulary: mapBoolean(document.getElementById('vocabulary').checked),
          comprehension: mapBoolean(document.getElementById('comprehension').checked)
        },
        writing: {
          transcription: mapBoolean(document.getElementById('transcription').checked),
          spellingPhonics: mapBoolean(document.getElementById('spellingPhonics').checked),
          grammar: mapBoolean(document.getElementById('grammar').checked),
          sentenceConstruction: mapBoolean(document.getElementById('sentenceConstruction').checked),
          genreContentKnowledge: mapBoolean(document.getElementById('genreContentKnowledge').checked),
          writingProcess: mapBoolean(document.getElementById('writingProcess').checked)
        },
        mathematics: {
          computationalWeakness: mapBoolean(document.getElementById('computationalWeakness').checked),
          incompleteMasteryNumberFacts: mapBoolean(document.getElementById('incompleteMasteryNumberFacts').checked),
          mathLanguageDifficulty: mapBoolean(document.getElementById('mathLanguageDifficulty').checked),
          visualSpatialPerceptual: mapBoolean(document.getElementById('visualSpatialPerceptual').checked),
          difficultyTransferringKnowledge: mapBoolean(document.getElementById('difficultyTransferringKnowledge').checked),
          makingConnections: mapBoolean(document.getElementById('makingConnections').checked)
        },
        behavior: {
          unfocusedInClass: mapBoolean(document.getElementById('unfocusedInClass').checked),
          distractionToOthers: mapBoolean(document.getElementById('distractionToOthers').checked),
          executiveFunctioningIssues: mapBoolean(document.getElementById('executiveFunctioningIssues').checked),
          disruptiveTalking: mapBoolean(document.getElementById('disruptiveTalking').checked),
          difficultySelfRegulation: mapBoolean(document.getElementById('behaviorDifficultySelfRegulation').checked)
        },
        socialEmotional: {
          excessiveEmotionalBehavior: mapBoolean(document.getElementById('excessiveEmotionalBehavior').checked),
          limitedSocialSkills: mapBoolean(document.getElementById('limitedSocialSkills').checked),
          difficultySelfRegulation: mapBoolean(document.getElementById('socialDifficultySelfRegulation').checked),
          anxietyRelatedBehaviors: mapBoolean(document.getElementById('anxietyRelatedBehaviors').checked),
          moodSwings: mapBoolean(document.getElementById('moodSwings').checked),
          depressionWithdrawal: mapBoolean(document.getElementById('depressionWithdrawal').checked)
        },
        medical: {
          visualPerceptualConcerns: mapBoolean(document.getElementById('visualPerceptualConcerns').checked),
          poorFineMotorSkills: mapBoolean(document.getElementById('poorFineMotorSkills').checked),
          poorGrossMotorSkills: mapBoolean(document.getElementById('poorGrossMotorSkills').checked),
          chronicHealthIssues: mapBoolean(document.getElementById('chronicHealthIssues').checked),
          speechLanguageDifficulties: mapBoolean(document.getElementById('speechLanguageDifficulties').checked)
        },
        interventions: document.getElementById('referInterventions').value,
        support: {
          pushIn: mapBoolean(document.getElementById('supportPushIn').checked),
          pullOut: mapBoolean(document.getElementById('supportPullOut').checked),
          resources: mapBoolean(document.getElementById('supportResources').checked),
          other: mapBoolean(document.getElementById('supportOther').checked)
        }
      };

      closeHtmlModal("referStudentModal");
    
      try {
        const toastMessage = "Sending referral..."
        showToast("", toastMessage, 10000);

        // Get the referral email settings
        const recipient = APP_SETTINGS.referralSettings.recipient;
        const subject = "Student Referral";
        const body = "A new referral form has been submitted and is attached for your review. Please review the details provided to assess the student's needs and determine the appropriate next steps.<br><br>Falcon SST Manager";
        const attachmentType = 'referral';
        const attachments = await generateReferralPDF(referralData);

        google.script.run
          .withSuccessHandler(() => {
            playNotificationSound("email");
            showToast("", "Referral successfully sent to: " + recipient, 10000);
          })
          .withFailureHandler((error) => {
            const errorString = String(error);
        
            if (errorString.includes("401")) {
              sessionError();
            } else {
              showError(error.message);
            }
          })
        .createEmail(recipient, subject, body, attachmentType, attachments);
      } catch {
        showError("Error: EMAIL_FAILURE");
      } finally {
        busyFlag = false;
      }
    };
  }

  function sendReferralErrorCheck() {
    const date = document.getElementById('referDate').value;
    const firstName = document.getElementById('referFirstName').value;
    const lastName = document.getElementById('referLastName').value;
    const gender = document.getElementById('referGender').value;
    const grade = document.getElementById('referGrade').value;
    const classroom = document.getElementById('referClassroom').value;
    const strengths = document.getElementById('referStrengths').value;
    const concerns = document.getElementById('referConcerns').value;
    const interventions = document.getElementById('referInterventions').value;
    const pushIn = document.getElementById('supportPushIn').checked;
    const pullOut = document.getElementById('supportPullOut').checked;
    const resources = document.getElementById('supportResources').checked;
    const other = document.getElementById('supportOther').checked;

    if (!date) {
      showError("Error: MISSING_DATE");
      return true;
    }
    if (!firstName) {
      showError("Error: MISSING_FIRST_NAME");
      return true;
    }
    if (!lastName) {
      showError("Error: MISSING_LAST_NAME");
      return true;
    }
    if (!gender) {
      showError("Error: MISSING_GENDER");
      return true;
    }
    if (!grade) {
      showError("Error: MISSING_GRADE");
      return true;
    }
    if (!classroom) {
      showError("Error: MISSING_CLASSROOM");
      return true;
    }
    if (!strengths) {
      showError("Error: MISSING_STRENGTHS");
      return true;
    }
    if (!concerns) {
      showError("Error: MISSING_CONCERNS");
      return true;
    }
    if (!interventions) {
      showError("Error: MISSING_INTERVENTIONS");
      return true;
    }
    if (!pushIn && !pullOut && !resources && !other) {
      showError("Error: MISSING_SUPPORT");
      return true;
    }
    
    return false;
  }

  async function generateMeetingSummaryPDF(meetingSummaryData) {
    const docDefinition = createMeetingSummary(meetingSummaryData);
    const blob = await new Promise((resolve, reject) => {
      pdfMake.createPdf(docDefinition).getBlob(resolve);
    });
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return Array.from(uint8Array); // Convert to array for google.script.run
  }

  async function generateReferralPDF(referralData) {
    const docDefinition = createReferral(referralData);
    const blob = await new Promise((resolve, reject) => {
      pdfMake.createPdf(docDefinition).getBlob(resolve);
    });
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return Array.from(uint8Array); // Convert to array for google.script.run
  }

  ////////////////////
  // EXPORT MEETING //
  ////////////////////

  function exportMeeting() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }
    
    const exportMeetingSelectBox = document.getElementById('exportMeetingSelect');
    if (exportMeetingSelectBox.options.length === 0) {
      showError("Error: MISSING_MEETING_DATA");
      return;
    }
    
    showHtmlModal("exportMeetingModal");
    const exportFormsModalButton = document.getElementById('exportMeetingModalButton');
    
    exportFormsModalButton.onclick = function() {
      busyFlag = true;
      const formType = document.getElementById('exportMeetingSelect').value;

      const meetingSummaryData = {
        'Student Name': document.getElementById('studentName').options[document.getElementById('studentName').selectedIndex].text,
        'Meeting Date': formatDate(document.getElementById('meetingDate').value),
        'Meeting Type': document.getElementById('meetingType').value,
        'Attendees': document.getElementById('attendees').value,
        'Facilitator': document.getElementById('facilitator').value,
        'Scribe': document.getElementById('scribe').value,
        'Strengths': document.getElementById('strengthsInput').value,
        'Concerns': document.getElementById('concernsInput').value,
        'Action Plan': document.getElementById('actionPlanInput').value,
        'Next Meeting Date': formatDate(document.getElementById('nextDate').value),
        'Next Meeting Time': formatTime(document.getElementById('nextTime').value),
      };

      // Replace any empty values with 'N/A'
      Object.keys(meetingSummaryData).forEach((key) => {
        if (!meetingSummaryData[key]) {
          meetingSummaryData[key] = 'N/A';
        }
      });
      
      closeHtmlModal("exportMeetingModal");

      setTimeout(function() {
        pdfMake.createPdf(createMeetingSummary(meetingSummaryData)).download('First Lutheran School - SST Meeting Summary.pdf');
        
        busyFlag = false;
      }, 100); // Short delay to allow UI update to process before PDF generation
    };
  }

  /////////////////
  // EXPORT DATA //
  /////////////////

  function exportData() {
    if (busyFlag) {
      showError("Error: OPERATION_IN_PROGRESS");
      return;
    }
    
    if (!saveFlag) {
      showError("Error: UNSAVED_CHANGES");
      return;
    }
    
    showHtmlModal("exportDataModal");
    const exportDataModalButton = document.getElementById('exportDataModalButton');
    
    exportDataModalButton.onclick = function() {
      busyFlag = true;
    
      const dataType = document.getElementById('dataTypeSelect').value;
      const fileType = document.getElementById('fileTypeSelect').value;
      let fileName;

      if (dataType === 'studentData') {
        fileName = 'SST Profile Data - ' + APP_SETTINGS.schoolSettings.schoolYear;
      }
      else {
        fileName = 'SST Meeting Data - ' + APP_SETTINGS.schoolSettings.schoolYear;
      }

      switch (fileType) {
        case 'csv':
          google.script.run
            .withSuccessHandler(function(data) {
              let a = document.createElement('a');
              
              a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(data);
              a.download = fileName + '.csv';
              a.click();
              busyFlag = false;
            })
            .withFailureHandler((error) => {
              const errorString = String(error);
        
              if (errorString.includes("401")) {
                sessionError();
              } else {
                showError(error.message);
              }
              busyFlag = false;
            })
          .getCsv(dataType);
          break;
        case 'xlsx':
          google.script.run
            .withSuccessHandler(function(data) {
              // Convert the raw data into a Uint8Array
              const uint8Array = new Uint8Array(data);
                      
              // Create a Blob from the binary data
              const blob = new Blob([uint8Array], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
              
              const url = URL.createObjectURL(blob);
              let a = document.createElement('a');
              a.href = url;
              a.download = fileName + '.xlsx';
              a.click();
              URL.revokeObjectURL(url);
              busyFlag = false;
            })
            .withFailureHandler((error) => {
              const errorString = String(error);
        
              if (errorString.includes("401")) {
                sessionError();
              } else {
                showError(error.message);
              }
              busyFlag = false;
            })
          .getXlsx(dataType);
          break;
      }
      
      closeHtmlModal("exportDataModal");
    };
  }

  //////////////////////////////
  // ARCHIVE/ACTIVE DATA VIEW //
  //////////////////////////////

  function toggleDataView() {
    const toggleDataButton = document.getElementById('toggleDataButton');
    const stateIndex = parseInt(toggleDataButton.getAttribute('data-state'), 10);
    
    switch (stateIndex) {
      // Active data
      case 0:
        // Update the toolbar UI
        document.getElementById('addStudentButton').style.display = "block";
        document.getElementById('removeStudentButton').style.display = "block";
        document.getElementById('activateStudentButton').style.display = "none";
        document.getElementById('deleteStudentButton').style.display = "none";
        document.getElementById('meetingButton').style.display = "block";
        document.getElementById('emailButton').style.display = "block";
        document.getElementById('exportButton').style.display = "block";
        document.getElementById('exportDataButton').style.display = "block";
        break;

      // Watch data
      case 1:
        // Update the toolbar UI
        document.getElementById('addStudentButton').style.display = "block";
        document.getElementById('removeStudentButton').style.display = "block";
        document.getElementById('activateStudentButton').style.display = "block";
        document.getElementById('deleteStudentButton').style.display = "none";
        document.getElementById('meetingButton').style.display = "none";
        document.getElementById('emailButton').style.display = "none";
        document.getElementById('exportButton').style.display = "none";
        break;
      
      // Archive data
      case 2:
        // Update the toolbar UI
        document.getElementById('addStudentButton').style.display = "none";
        document.getElementById('removeStudentButton').style.display = "none";
        document.getElementById('activateStudentButton').style.display = "block";
        document.getElementById('deleteStudentButton').style.display = "block";
        document.getElementById('meetingButton').style.display = "none";
        document.getElementById('emailButton').style.display = "none";
        document.getElementById('exportButton').style.display = "block";
        document.getElementById('exportDataButton').style.display = "none";
        break;
    }

    updateStudentNames();
  }

  ///////////////////////
  // UTILITY FUNCTIONS //
  ///////////////////////

  // Build the 'studentName' select box with student names
  function updateStudentNames() {
    const toggleDataButton = document.getElementById('toggleDataButton');
    const dataFilter = parseInt(toggleDataButton.getAttribute('data-state'), 10);
    const studentNameSelectBox = document.getElementById('studentName');
    studentNameSelectBox.innerHTML = ''; // Reset selectbox options
    
    // Filter the student data by STUDENT_DATA['Status']
    let filteredStudentData = STUDENT_DATA;

    if (dataFilter === 0) {
      filteredStudentData = STUDENT_DATA.filter(item => item['Status'] === 'Active');
    } else if (dataFilter === 1) {
      filteredStudentData = STUDENT_DATA.filter(item => item['Status'] === 'Watch');
    } else if (dataFilter === 2) {
      filteredStudentData = STUDENT_DATA.filter(item => item['Status'] === 'Archive');
    }

    const sortedStudentData = filteredStudentData.sort(function(a, b) {
      return a['Student Name'].localeCompare(b['Student Name']);
    });
    
    sortedStudentData.forEach(function(item) {
      let option = document.createElement('option');
      option.text = item['Student Name'];
      option.value = item['Student ID'];
      studentNameSelectBox.add(option);
    });

    // Check if there are students to display
    if (sortedStudentData.length === 0) {
        console.log("WARNING: No student data found for the selected filter.");
        document.getElementById('profileDataTable').style.display = 'none';
        document.getElementById('profileWarning').style.display = '';
    } else {
        document.getElementById('profileDataTable').style.display = '';
        document.getElementById('profileWarning').style.display = 'none';

        // If there are students, set the first one as selected by default
        studentNameSelectBox.value = sortedStudentData[0]['Student ID']; // Default to first student
        studentNameSelectBox.dispatchEvent(new Event('change')); // Trigger 'change' event
    }

    // Clear student data if no options
    if (studentNameSelectBox.options.length === 0) {
        updateStudentData();
    }
  }
  
  // Update student profile fields
  function updateStudentData(selectedStudentID) {
    const clearAll = !selectedStudentID || selectedStudentID === "";
    
    let student = clearAll ? {} : STUDENT_DATA.find(function(item) {
      return item['Student ID'] === selectedStudentID;
    });

    Object.keys(STUDENT_KEY_MAPPINGS).forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.value = clearAll || !student || student[STUDENT_KEY_MAPPINGS[id]] === undefined ? "" : student[STUDENT_KEY_MAPPINGS[id]];
      }
    });

    // Update colors in student profile fields
    updateColors();

    // Update the meetings based on the selected student's student ID
    if (student && student['Student ID']) {
      updateMeetingNames(student['Student ID']);  // Pass the Student ID to update the meetings
    } else {
      updateMeetingNames();
    }
    
    const saveChangesButton = document.getElementById('saveChangesButton');
    saveChangesButton.classList.remove('tool-bar-button-unsaved');
    saveFlag = true;
    previousStudentID = selectedStudentID;
  }

  // Build the 'meetingName' select box with meeting names filtered by student
  function updateMeetingNames(selectedStudentID) {
    const meetingNameSelectBox = document.getElementById('meetingName');
    const exportMeetingSelectBox = document.getElementById('exportMeetingSelect');
    meetingNameSelectBox.innerHTML = '';
    exportMeetingSelectBox.innerHTML = '';

    if (Object.keys(MEETING_DATA).length === 0) {
      console.log("WARNING: No meeting data found.");
    }

    // Filter meetings by the selected student's Student ID
    const filteredMeetings = MEETING_DATA.filter(function(item) {
      return item['Student ID'] === selectedStudentID;
    }).sort(function(a, b) {
      return b['Date'].localeCompare(a['Date']);
    });

    // Show the warning and hide the meeting input if no meetings are found for the student
    if (filteredMeetings.length === 0) {
      console.log("WARNING: No meeting data found for this student.");
      document.getElementById('meetingDataTable').style.display = 'none';
      document.getElementById('meetingWarning').style.display = '';
    } 
    else {
      document.getElementById('meetingDataTable').style.display = '';
      document.getElementById('meetingWarning').style.display = 'none';
    }

    // Add the filtered meetings to the meeting select box
    filteredMeetings.forEach(function(item) {
      let option = document.createElement('option');
      option.text = formatDate(item['Date']) + " - " + item['Type'];
      option.value = item['Meeting ID'];
      meetingNameSelectBox.add(option);
    });

    // Add the filtered meetings to the export select box
    filteredMeetings.forEach(function(item) {
      let option = document.createElement('option');
      option.text = formatDate(item['Date']) + " - " + item['Type'];
      option.value = item['Meeting ID'];
      exportMeetingSelectBox.add(option);
    });

    // Update meeting information for the first filtered meeting
    if (meetingNameSelectBox.options.length > 0) {
      let selectedMeeting = meetingNameSelectBox.options[0].value;
      meetingNameSelectBox.dispatchEvent(new Event('change')); // Trigger 'change' event
    } else {
      updateMeetingData();
    }
  }

  // Update meeting fields
  function updateMeetingData(selectedMeeting) {
    const clearAll = !selectedMeeting || selectedMeeting === "";
    
    let meeting = clearAll ? {} : MEETING_DATA.find(function(item) {
      return item['Meeting ID'] === selectedMeeting;
    });

    Object.keys(MEETING_KEY_MAPPINGS).forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
          element.value = clearAll || !meeting || meeting[MEETING_KEY_MAPPINGS[id]] === undefined ? "" : meeting[MEETING_KEY_MAPPINGS[id]];
      }
    });

    const saveChangesButton = document.getElementById('saveChangesButton');
    saveChangesButton.classList.remove('tool-bar-button-unsaved');
    saveFlag = true;
    previousMeetingID = selectedMeeting;
  }

  function getIDCache() {
    return new Promise((resolve, reject) => {  // Add reject parameter
      google.script.run
        .withSuccessHandler((idCache) => {
          // Convert to Set for O(1) lookup and find first missing number
          const idSet = new Set(idCache.map(id => parseInt(id, 10)));
               
          // Start from 1 and find first missing number
          let i = 1;
          while (idSet.has(i)) i++;
                
          // Format and return the result
          resolve(i.toString().padStart(6, '0'));
        })
        .withFailureHandler((error) => {
          const errorString = String(error);
                
          if (errorString.includes("401")) {
            sessionError();
          } else {
            showError("Error: ID_FAILURE");
          }
          busyFlag = false;
          reject(error);  // Reject the promise so the error propagates
        })
      .getIDCache();
    });
  }

  async function getAvailableID() {
    cachedID = await getIDCache();
  }

  function saveAlert() {
    saveFlag = false;
    saveChangesButton.classList.add('tool-bar-button-unsaved');
  }

  ////////////////////
  // ERROR HANDLING //
  ////////////////////

  function showError(errorType, callback = "") {
    const warningIcon = `<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>`;
    const errorIcon = `<i class="bi bi-x-circle-fill" style="color: var(--error-color); margin-right: 10px;"></i>`;
    let title;
    let message;
    let button1;
    let button2;

    switch (errorType) {
      case "Error: OPERATION_IN_PROGRESS":
        title = warningIcon + "Operation In Progress";
        message = "Please wait until the operation completes and try again.";
        button1 = "Close";
        break;
      
      // Save errors
      case "Error: UNSAVED_CHANGES":
        title = warningIcon + "Unsaved Changes";
        message = "There are unsaved changes. Please save the changes and try again.";
        button1 = "Close";
        break;
      
      // Add student errors
      case "Error: MISSING_FIRST_NAME":
        title = warningIcon + "Missing First Name";
        message = "Please enter a first name and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_LAST_NAME":
        title = warningIcon + "Missing Last Name";
        message = "Please enter a last name and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_GENDER":
        title = warningIcon + "Missing Gender";
        message = "Please select a gender and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_DOB":
        title = warningIcon + "Missing Date Of Birth";
        message = "Please enter a date of birth and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_GRADE":
        title = warningIcon + "Missing Grade";
        message = "Please select a grade and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_CLASSROOM":
        title = warningIcon + "Missing Classroom";
        message = "Please select a classroom and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_CASE_MANAGER":
        title = warningIcon + "Missing Case Manager";
        message = "Please enter a case manager and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_CONTACT":
        title = warningIcon + "Missing Parent/Guardian Contact";
        message = "At least one parent/guardian name, phone, and email must be filled in. Please check the parent/guardian information and try again.";
        button1 = "Close";
        break;

      case "Error: INVALID_PHONE":
        title = warningIcon + "Invalid Phone Number";
        message = "Please check the parent/guardian phone number and try again.";
        button1 = "Close";
        break;

      // Add meeting errors
      case "Error: MISSING_DATE":
        title = warningIcon + "Missing Date";
        message = "Please enter a date and try again.";
        button1 = "Close";
        break;
      
      case "Error: MISSING_MEETING_TYPE":
        title = warningIcon + "Missing Meeting Type";
        message = "Please select a meeting type and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_ATTENDEES":
        title = warningIcon + "Missing Attendees";
        message = "Please enter the meeting attendees and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_FACILITATOR":
        title = warningIcon + "Missing Facilitator";
        message = "Please enter a meeting facilitator and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_SCRIBE":
        title = warningIcon + "Missing Scribe";
         message = "Please enter a meeting scribe and try again.";
        button1 = "Close";
        break;
      
      // Referral errors
      case "Error: MISSING_STRENGTHS":
        title = warningIcon + "Missing Strengths";
         message = "Please enter student strengths and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_CONCERNS":
        title = warningIcon + "Missing Concerns";
         message = "Please enter student concerns and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_INTERVENTIONS":
        title = warningIcon + "Missing Interventions";
         message = "Please enter interventions/modifications and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_SUPPORT":
        title = warningIcon + "Missing Support Type";
         message = "Please select one or more support types and try again.";
        button1 = "Close";
        break;

      // Database errors
      case "Error: MISSING_STUDENT_DATA":
        title = errorIcon + "Data Error";
        message = "No student data found. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: MISSING_MEETING_DATA":
        title = errorIcon + "Data Error";
        message = "No meeting data found. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: MISSING_STUDENT_ENTRY":
        title = errorIcon + "Data Error";
        message = "The student data could not be found in the database. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: MISSING_MEETING_ENTRY":
        title = errorIcon + "Data Error";
        message = "The meeting data could not be found in the database. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: DUPLICATE_ENTRY":
        title = errorIcon + "Data Error";
        message = "Duplicate data was found in the database. The operation could not be completed.";
        button1 = "Close";
        break;

      // Email errors
      case "Error: MISSING_RECIPIENT":
        title = warningIcon + "Missing Email Recipient";
        message = "Please enter an email address and try again.";
        button1 = "Close";
        break;
      
      case "Error: INVALID_EMAIL":
        title = warningIcon + "Invalid Email Address";
        message = "Please check the email address and try again.";
        button1 = "Close";
        break;

      case "Error: MISSING_TEMPLATE_DATA":
        title = errorIcon + "Email Error";
        message = "Missing email template data. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: QUOTA_LIMIT":
        title = errorIcon + "Email Error";
        message = "The daily email limit has been reached. Please wait 24 hours before sending your email and try again.";
        button1 = "Close";
        break;

      // Unknown errors
      case "Error: EMAIL_FAILURE":
        title = errorIcon + "Email Error";
        message = "An unknown email error occurred. The operation could not be completed.";
        button1 = "Close";
        break;
      
      case "Error: EXPORT_FAILURE":
        title = errorIcon + "Export Error";
        message = "An unknown error occurred while exporting data. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: ID_FAILURE":
        title = errorIcon + "ID Error";
        message = "An unknown error occurred while fetching ID's. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: DATABASE_FAILURE":
        title = errorIcon + "Database Error";
        message = "An unknown error occurred while connecting with the database. The operation could not be completed.";
        button1 = "Close";
        break;

      case "Error: PERMISSION":
        title = errorIcon + "Permission Error";
        message = "You do not have permission to modify the database. Please contact your administrator. The operation could not be completed.";
        button1 = "Close";
        break;

      default:
        title = errorIcon + "Error";
        message = errorType;
        button1 = "Close";
        break;
    }
    
    playNotificationSound("alert");
    showModal(title, message, button1, button2);
  }
  
  async function sessionError() {
    const errorIcon = `<i class="bi bi-x-circle-fill" style="color: var(--error-color); margin-right: 10px;"></i>`;
    const title = `${errorIcon}Session Expired`;
    const message = "The current session has expired. Please sign in with Google and try again.";
    
    playNotificationSound("alert");
    const buttonText = await showModal(title, message, "Cancel", "Sign in");
       
    if (buttonText === "Sign in") {
      const signInUrl = "https://accounts.google.com";
      const signInTab = window.open(signInUrl, "_blank");
    }
  }
  
  /////////////////////
  // DATA VALIDATION //
  /////////////////////

  // Function to format phone number inputs
  function formatPhoneNumber(input) {
    // Remove all non-digit characters from the input value
    let inputValue = input.value.replace(/\D/g, "");

    // Limit the input value to 10 digits
    inputValue = inputValue.slice(0, 10);

    // Format the input value as '(XXX) XXX-XXXX'
    let formattedValue = '';
    for (let i = 0; i < inputValue.length; i++) {
      if (i === 0) {
        formattedValue += '(';
      } else if (i === 3) {
        formattedValue += ') ';
      } else if (i === 6) {
        formattedValue += '-';
      }
      formattedValue += inputValue[i];
    }

    // Update the input value with the formatted value
    input.value = formattedValue;
  }

  // Function to format date
  function formatDate(dateString) {
    if (!dateString) {
      return '';
    } else {
      // Split the date string into components
      const [year, month, day] = dateString.split('-').map(Number);

      // Create a date object using the local time zone
      const date = new Date(year, month - 1, day);

      // Format the date as 'MM/DD/YYYY'
      const options = { month: 'numeric', day: 'numeric', year: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    }
  }

  // Function to format time
  function formatTime(timeString) {
    if (!timeString) {
      return '';
    } else {
      let hours = parseInt(timeString.split(':')[0]);
      let minutes = timeString.split(':')[1];
      let amPm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12; // Convert hours to 12-hour format
      return `${hours}:${minutes} ${amPm}`;
    }
  }

  function updateColors() {
    const selectColorElements = document.querySelectorAll('#gender, #dateOfBirth, #grade, #classroom, #diagnosis, #aide, #specializedInstruction');
    const inputColorElements = document.querySelectorAll('#allergies, #medications, #dietaryRestrictions, #servicesPrograms, #caseManager, #roi1, #roi2, #roi3, #parentGuardianName1, #parentGuardianPhone1, #parentGuardianEmail1, #parentGuardianName2, #parentGuardianPhone2, #parentGuardianEmail2');
    const noColorElements = document.querySelectorAll('#notes, #meetingName, #meetingDate, #meetingType, #attendees, #facilitator, #scribe, #strengthsInput, #concernsInput, #actionPlan, #nextDate, #nextTime');

    selectColorElements.forEach(element => {
      element.style.backgroundColor = getColor(element);
    });
    
    inputColorElements.forEach(element => {
      element.style.backgroundColor = getColor(element);
    });
  }

  // Get select box/input box color based on value
  function getColor(element) {
    const value = element.value.trim(); // Trim to remove extra spaces

    if (!value) { // Checks for "", null, undefined, 0, etc.
      return '';
    }

    // Define patterns for phone and email validation
    const phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9-]{2,})+$/;

    // Validation for phone numbers
    if (element.id === 'parentGuardianPhone1' || element.id === 'parentGuardianPhone2') {
      if (!phonePattern.test(value)) {
        return ''; // No color if phone format is invalid
      }
      return 'var(--green)'; // Valid phone numbers get green
    }

    // Validation for emails
    if (element.id === 'parentGuardianEmail1' || element.id === 'parentGuardianEmail2') {
      if (!emailPattern.test(value)) {
        return ''; // No color if email format is invalid
      }
      return 'var(--green)'; // Valid email addresses get green
    }

    // If the element is an input field but not a phone/email, restrict the color to green
    if (element.tagName === 'INPUT') {
      if (element.id === 'allergies' || element.id === 'medications' || element.id === 'dietaryRestrictions' || element.id === 'diagnosis' || element.id === 'servicesPrograms' || element.id === 'aide' || element.id === 'roi1' || element.id === 'roi2' || element.id === 'roi3') {
        return 'var(--orange)';
      }
      return 'var(--green)';
    }

    // Check for specific values
    switch (value) {
      case "Male":
        return 'var(--blue)';
      case "Female":
        return 'var(--pink)';
      case "Non-binary":
        return 'var(--gray)';
      case "504":
      case "IEP":
        return 'var(--orange)';
      default:
        // ID-based coloring rules
        if (value && (
          element.id === 'allergies' || 
         element.id === 'medications' || 
          element.id === 'dietaryRestrictions' ||  
          element.id === 'diagnosis' || 
          element.id === 'servicesPrograms' || 
          element.id === 'aide' ||
          element.id === 'roi1' || 
          element.id === 'roi2' || 
          element.id === 'roi3')
        ) {
          return 'var(--orange)';
        }
        // Default color for non-specified cases
        return 'var(--green)';
    }
  }

</script>
