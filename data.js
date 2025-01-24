<script type="text/javascript">
  // Global variables  
  // let USER_SETTINGS; // Defined in HTML
  let STUDENT_DATA;
  let APP_SETTINGS;
  
  // Initialize application
  window.onload = async function() {
    console.log("Initializing data...");

    const toolbar = document.getElementById('toolbar');
    const page = document.getElementById('page');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    try {
      // Show loading indicator
      loadingIndicator.style.display = 'block';
      toolbar.style.display = 'none';
      page.style.display = 'none';

      // Fetch data and initialize charts in parallel
      const [studentData, appSettings] = await Promise.all([
        
        // Fetch student data
        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getStudentData();
        }),

        new Promise((resolve, reject) => {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getAppSettings();
        }),
        
        // Initialize Google Charts
        new Promise((resolve) => {
          console.log('Initializing Google Charts...')
          google.charts.load('current', { packages: ['coreChart'] });
          google.charts.setOnLoadCallback(() => {
            console.log('Complete!');
            resolve(); // Resolve the Promise once charts are ready
          });
        })
      ]);

      // Filter student data to only active cases
      const activeStudents = studentData.filter(student => student.Status === 'Active');

      STUDENT_DATA = activeStudents;
      APP_SETTINGS = appSettings;

      // Set event listeners
      setEventListeners();

      // Populate intitial chart with data
      window.requestAnimationFrame(loadChart);
    
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
    
    // Draw the selected chart    
    const chartSelectBox = document.getElementById('chartSelect');
    chartSelectBox.addEventListener('change', function() {
      loadChart();
    });
    
    // Redraw selected chart on window resize
    window.addEventListener('resize', () => {
      loadChart();
    });

    console.log("Complete!");
  }

  function loadChart() {
    // Set the chart options
    const chartTheme = getChartTheme();
    const chartOptions = {
      backgroundColor: chartTheme.background,
      colors: chartTheme.bars,
      legend: {
        position: 'top',
        textStyle: {
          fontName: 'Roboto',
          color: chartTheme.text
        }
      },
      tooltip: { 
        isHtml: true
      },
      hAxis: { 
        titleTextStyle: {
          fontName: 'Roboto',
          fontSize: 18,
          color: chartTheme.text,
          bold: true
        },
        textStyle: {
          fontName: 'Roboto',
          fontSize: 16,
          color: chartTheme.text
        }
      },
      vAxis: {
        titleTextStyle: {
          fontName: 'Roboto',
          fontSize: 18,
          color: chartTheme.text,
          bold: true
        },
        textStyle: {
          fontName: 'Roboto',
          fontSize: 16,
          color: chartTheme.text
        },
        gridlines: { color: chartTheme.gridLines },
        minorGridlines: { count: 0 },
        format: '0'
      },
      width: '100%',
      height: '100%',
      chartArea: {
        left: 50,   // Distance from the left edge of the chart to the chart area (default is 50)
        top: 50,    // Distance from the top edge of the chart to the chart area (default is 50)
        right: 20,  // Distance from the right edge of the chart to the chart area (default is 20)
        bottom: 50  // Distance from the bottom edge of the chart to the chart area (default is 50)
      },
      animation: {
        startup: true,
        duration: 1000,  // Duration of the animation in milliseconds (1000 ms = 1 second)
        easing: 'out'   // Easing function for the animation, 'out' is smooth and decelerates
      }
    };
    
    // Get the chart type and draw the chart
    const chartType = document.getElementById('chartSelect').value;
    
    switch (chartType) {
      case 'caseGrade':
        drawCasesByGradeChart(chartOptions);
        break;
      case 'caseClassroom':
        drawCasesByClassroomChart(chartOptions);
        break;
      case 'caseGender':
        drawCasesByGenderChart(chartOptions);
        break;
      case 'caseCaseManager':
        drawCasesByCaseManagerChart(chartOptions);
        break;
      case 'diagnosisGrade':
        drawDiagnosisByGradeChart(chartOptions);
        break;
      case 'diagnosisClassroom':
        drawDiagnosisByClassroomChart(chartOptions);
        break;
      case 'diagnosisGender':
        drawDiagnosisByGenderChart(chartOptions);
        break;
      case 'diagnosisCaseManager':
        drawDiagnosisByCaseManagerChart(chartOptions);
        break;
      case 'aideGrade':
        drawAideByGradeChart(chartOptions);
        break;
      case 'aideClassroom':
        drawAideByClassroomChart(chartOptions);
        break;
      case 'aideGender':
        drawAideByGenderChart(chartOptions);
        break;
    }
  }

  /////////////////////
  // CHART FUNCTIONS //
  /////////////////////

  // Draw case types by grade  
  function drawCasesByGradeChart(options) {
    // Predefined grade order
    const gradeOrder = ['TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8'];

    // Initialize grade level counts with zeros
    const gradeLevelCounts = {};
    gradeOrder.forEach(grade => {
        gradeLevelCounts[grade] = { 'none': 0, 'iep': 0, '504': 0 };
    });

    // Aggregate data
    STUDENT_DATA.forEach(student => {
        const grade = student.Grade;
        const specializedInstruction = (student['Specialized Instruction'] || 'None').toLowerCase();

        // Only increment if the grade exists in our predefined list
        if (gradeLevelCounts[grade] !== undefined) {
            gradeLevelCounts[grade][specializedInstruction]++;
        }
    });

    // Prepare Google Chart Data
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Grade');
    data.addColumn('number', 'SST');
    data.addColumn('number', 'IEP');
    data.addColumn('number', '504');
    
    // Use predefined order
    gradeOrder.forEach(grade => {
      const counts = gradeLevelCounts[grade];
      
      data.addRow([
        grade, 
        counts['none'] || 0,   // SST
        counts['iep'] || 0,    // IEP
        counts['504'] || 0     // 504
      ]);
    });

    // Draw the chart with stacked bars
    const chartDiv = document.getElementById('chart-div');
    const chart = new google.visualization.ColumnChart(chartDiv);

    const chartOptions = {
      ...options,
      isStacked: true, // Stack the columns
    };

    chart.draw(data, chartOptions);
  }

  // Draw case types by classroom
  function drawCasesByClassroomChart(options) {
    // Aggregate Data by Grade and Specialized Instruction
    const classroomCounts = {};

    // Initialize counts for ALL classrooms from APP_SETTINGS
    const classroomOrder = APP_SETTINGS.classroomSettings.map(setting => setting.classroom);
    classroomOrder.forEach(classroom => {
        classroomCounts[classroom] = { 'none': 0, 'iep': 0, '504': 0 };
    });

    STUDENT_DATA.forEach(student => {
        // Extract just the classroom code (before the hyphen)
        const fullClassroom = student['Classroom'];
        const classroom = fullClassroom.split(' - ')[0];
        const specializedInstruction = (student['Specialized Instruction'] || 'None').toLowerCase();

        // Increment only if the classroom exists in our predefined list
        if (classroomCounts[classroom] !== undefined) {
            classroomCounts[classroom][specializedInstruction]++;
        }
    });

    // Convert to array and sort based on APP_SETTINGS order
    let aggregatedData = classroomOrder.map(classroom => [classroom, classroomCounts[classroom]]);

    // Prepare Google Chart Data
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Classroom');
    data.addColumn('number', 'SST');
    data.addColumn('number', 'IEP');
    data.addColumn('number', '504');
    
    aggregatedData.forEach(([classroom, counts]) => {
      // Find the full classroom name with teacher for display
      const fullClassroomName = APP_SETTINGS.classroomSettings
        .find(setting => setting.classroom === classroom)
        ? `${classroom} - ${APP_SETTINGS.classroomSettings.find(setting => setting.classroom === classroom).teacher}`
        : classroom;

      // Ensure the order matches the column definitions
      data.addRow([
        fullClassroomName, 
        counts['none'] || 0,   // SST
        counts['iep'] || 0,    // IEP
        counts['504'] || 0     // 504
      ]);
    });

    // Draw the chart with stacked bars
    const chartDiv = document.getElementById('chart-div');
    const chart = new google.visualization.ColumnChart(chartDiv);

    const chartOptions = {
      ...options,
      isStacked: true, // Stack the columns
    };

    chart.draw(data, chartOptions);
  }

  // Draw case types by gender
  function drawCasesByGenderChart(options) {
    // Predefined gender order
    const genderOrder = ['Male', 'Female', 'Non-binary'];

    // Initialize gender counts with zeros
    const genderCounts = {};
    genderOrder.forEach(gender => {
        genderCounts[gender] = { 'none': 0, 'iep': 0, '504': 0 };
    });

    // Aggregate data
    STUDENT_DATA.forEach(student => {
        const gender = student.Gender;
        const specializedInstruction = (student['Specialized Instruction'] || 'None').toLowerCase();

        // Only increment if the gender exists in our predefined list
        if (genderCounts[gender] !== undefined) {
            genderCounts[gender][specializedInstruction]++;
        }
    });

    // Prepare Google Chart Data
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Gender');
    data.addColumn('number', 'SST');
    data.addColumn('number', 'IEP');
    data.addColumn('number', '504');
    
    // Use predefined order
    genderOrder.forEach(gender => {
      const counts = genderCounts[gender];
      
      data.addRow([
        gender, 
        counts['none'] || 0,   // SST
        counts['iep'] || 0,    // IEP
        counts['504'] || 0     // 504
      ]);
    });

    // Draw the chart with stacked bars
    const chartDiv = document.getElementById('chart-div');
    const chart = new google.visualization.ColumnChart(chartDiv);

    const chartOptions = {
      ...options,
      isStacked: true, // Stack the columns
    };

    chart.draw(data, chartOptions);
  }

  // Draw case types by case manager
  function drawCasesByCaseManagerChart(options) {
    // Get unique case managers
    const caseManagers = [...new Set(STUDENT_DATA.map(student => student['Case Manager']))].sort();

    // Initialize case manager counts with zeros
    const caseManagerCounts = {};
    caseManagers.forEach(manager => {
        caseManagerCounts[manager] = { 'none': 0, 'iep': 0, '504': 0 };
    });

    // Aggregate data
    STUDENT_DATA.forEach(student => {
        const caseManager = student['Case Manager'];
        const specializedInstruction = (student['Specialized Instruction'] || 'None').toLowerCase();

        // Only increment if the case manager exists in our list
        if (caseManagerCounts[caseManager] !== undefined) {
            caseManagerCounts[caseManager][specializedInstruction]++;
        }
    });

    // Prepare Google Chart Data
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Case Manager');
    data.addColumn('number', 'SST');
    data.addColumn('number', 'IEP');
    data.addColumn('number', '504');
    
    // Use alphabetical order of case managers
    caseManagers.forEach(manager => {
      const counts = caseManagerCounts[manager];
      
      data.addRow([
        manager, 
        counts['none'] || 0,   // SST
        counts['iep'] || 0,    // IEP
        counts['504'] || 0     // 504
      ]);
    });

    // Draw the chart with stacked bars
    const chartDiv = document.getElementById('chart-div');
    const chart = new google.visualization.ColumnChart(chartDiv);

    const chartOptions = {
      ...options,
      isStacked: true, // Stack the columns
    };

    chart.draw(data, chartOptions);
  }

  // Draw dianosis by grade
  function drawDiagnosisByGradeChart(options) {
    // Mapping of full diagnosis names to short codes
    const diagnosisMapping = {
        'ADHD (Attention Deficit Hyperactivity Disorder)': 'adhd',
        'APD (Auditory Processing Disorder)': 'apd',
        'ASD (Autism Spectrum Disorder)': 'asd',
        'DD (Developmental Delay)': 'dd',
        'DS (Down Syndrome)': 'ds',
        'EBD (Emotional and Behavioral Disorders)': 'ebd',
        'ED (Emotional Disturbance)': 'ed',
        'HI (Hearing Impairment)': 'hi',
        'ID (Intellectual Disability)': 'id',
        'LD (Language Disorder)': 'ld',
        'MD (Multiple Disabilities)': 'md',
        'OHI (Other Health Impairment)': 'ohi',
        'OI (Orthopedic Impairment)': 'oi',
        'SLD (Specific Learning Disorder)': 'sld',
        'TBI (Traumatic Brain Injury)': 'tbi',
        'VI (Visual Impairment)': 'vi'
    };

    // Get unique diagnoses and add 'none'
    const diagnoses = ['none', ...Object.values(diagnosisMapping)];
    
    // Predefined grade order
    const gradeOrder = ['TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8'];

    // Aggregate data
    const gradeLevelCounts = gradeOrder.reduce((acc, grade) => {
        acc[grade] = STUDENT_DATA
            .filter(student => student.Grade === grade)
            .reduce((counts, student) => {
                const diagnosis = student['Diagnosis'] || '';
                const diagnosisKey = diagnosis === '' 
                    ? 'none' 
                    : (diagnosisMapping[diagnosis] || 'none');
                
                counts[diagnosisKey] = (counts[diagnosisKey] || 0) + 1;
                return counts;
            }, Object.fromEntries(diagnoses.map(d => [d, 0])));
        
        return acc;
    }, {});

    // Prepare Google Chart Data
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Grade');
    
    // Dynamically add columns based on diagnoses
    diagnoses.forEach(diagnosis => {
        const columnName = diagnosis === 'none' 
            ? 'None' 
            : diagnosis.toUpperCase();
        data.addColumn('number', columnName);
    });

    // Add rows for each grade
    gradeOrder.forEach(grade => {
        const counts = gradeLevelCounts[grade];
        
        data.addRow([
            grade,
            ...diagnoses.map(diagnosis => counts[diagnosis] || 0)
        ]);
    });

    // Draw the chart with stacked bars
    const chartDiv = document.getElementById('chart-div');
    const chart = new google.visualization.ColumnChart(chartDiv);

    const chartOptions = {
        ...options,
        isStacked: true, // Stack the columns
    };

    chart.draw(data, chartOptions);
  }

  // Draw dianosis by classroom
  function drawDiagnosisByClassroomChart(options) {
    // Mapping of full diagnosis names to short codes
    const diagnosisMapping = {
        'ADHD (Attention Deficit Hyperactivity Disorder)': 'ADHD',
        'APD (Auditory Processing Disorder)': 'APD',
        'ASD (Autism Spectrum Disorder)': 'ASD',
        'DD (Developmental Delay)': 'DD',
        'DS (Down Syndrome)': 'DS',
        'EBD (Emotional and Behavioral Disorders)': 'EBD',
        'ED (Emotional Disturbance)': 'ED',
        'HI (Hearing Impairment)': 'HI',
        'ID (Intellectual Disability)': 'ID',
        'LD (Language Disorder)': 'LD',
        'MD (Multiple Disabilities)': 'MD',
        'OHI (Other Health Impairment)': 'OHI',
        'OI (Orthopedic Impairment)': 'OI',
        'SLD (Specific Learning Disorder)': 'SLD',
        'TBI (Traumatic Brain Injury)': 'TBI',
        'VI (Visual Impairment)': 'VI'
    };

    // Get classroom order from APP_SETTINGS
    const classroomOrder = APP_SETTINGS.classroomSettings.map(setting => setting.classroom);

    // Add 'none' to the list of diagnoses
    const diagnoses = ['none', ...Object.values(diagnosisMapping)];

    // Aggregate Data
    const classroomCounts = classroomOrder.reduce((acc, classroom) => {
        acc[classroom] = STUDENT_DATA
            .filter(student => {
                const fullClassroom = student['Classroom'];
                return fullClassroom.split(' - ')[0] === classroom;
            })
            .reduce((counts, student) => {
                const diagnosis = student['Diagnosis'] || '';
                const diagnosisKey = diagnosis === '' 
                    ? 'none' 
                    : (diagnosisMapping[diagnosis] || 'none');
                
                counts[diagnosisKey] = (counts[diagnosisKey] || 0) + 1;
                return counts;
            }, Object.fromEntries(diagnoses.map(d => [d, 0])));
        
        return acc;
    }, {});

    // Prepare Google Chart Data
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Classroom');
    
    // Dynamically add columns based on diagnoses
    diagnoses.forEach(diagnosis => {
        const columnName = diagnosis === 'none' 
            ? 'None' 
            : diagnosis;
        data.addColumn('number', columnName);
    });
    
    // Add rows for each classroom
    const chartRows = classroomOrder.map(classroom => {
        // Find the full classroom name with teacher
        const fullClassroomName = APP_SETTINGS.classroomSettings
            .find(setting => setting.classroom === classroom)
            ? `${classroom} - ${APP_SETTINGS.classroomSettings.find(setting => setting.classroom === classroom).teacher}`
            : classroom;

        return [
            fullClassroomName,
            ...diagnoses.map(diagnosis => 
                classroomCounts[classroom][diagnosis] || 0
            )
        ];
    });

    // Add rows to the data table
    chartRows.forEach(row => data.addRow(row));

    // Draw the chart with stacked bars
    const chartDiv = document.getElementById('chart-div');
    const chart = new google.visualization.ColumnChart(chartDiv);

    const chartOptions = {
        ...options,
        isStacked: true // Stack the columns
    };

    chart.draw(data, chartOptions);
  }

  function drawDiagnosisByGenderChart(options) {
    // Mapping of full diagnosis names to short codes
    const diagnosisMapping = {
        'ADHD (Attention Deficit Hyperactivity Disorder)': 'adhd',
        'APD (Auditory Processing Disorder)': 'apd',
        'ASD (Autism Spectrum Disorder)': 'asd',
        'DD (Developmental Delay)': 'dd',
        'DS (Down Syndrome)': 'ds',
        'EBD (Emotional and Behavioral Disorders)': 'ebd',
        'ED (Emotional Disturbance)': 'ed',
        'HI (Hearing Impairment)': 'hi',
        'ID (Intellectual Disability)': 'id',
        'LD (Language Disorder)': 'ld',
        'MD (Multiple Disabilities)': 'md',
        'OHI (Other Health Impairment)': 'ohi',
        'OI (Orthopedic Impairment)': 'oi',
        'SLD (Specific Learning Disorder)': 'sld',
        'TBI (Traumatic Brain Injury)': 'tbi',
        'VI (Visual Impairment)': 'vi'
    };

    // Predefined gender order
    const genderOrder = ['Male', 'Female', 'Non-binary'];

    // Get unique diagnoses and add 'none'
    const diagnoses = ['none', ...Object.values(diagnosisMapping)];

    // Aggregate data
    const genderLevelCounts = genderOrder.reduce((acc, gender) => {
        acc[gender] = STUDENT_DATA
            .filter(student => student.Gender === gender)
            .reduce((counts, student) => {
                const diagnosis = student['Diagnosis'] || '';
                const diagnosisKey = diagnosis === '' 
                    ? 'none' 
                    : (diagnosisMapping[diagnosis] || 'none');
                
                counts[diagnosisKey] = (counts[diagnosisKey] || 0) + 1;
                return counts;
            }, Object.fromEntries(diagnoses.map(d => [d, 0])));
        
        return acc;
    }, {});

    // Prepare Google Chart Data
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Gender');
    
    // Dynamically add columns based on diagnoses
    diagnoses.forEach(diagnosis => {
        const columnName = diagnosis === 'none' 
            ? 'None' 
            : diagnosis.toUpperCase();
        data.addColumn('number', columnName);
    });

    // Add rows for each gender
    genderOrder.forEach(gender => {
        const counts = genderLevelCounts[gender];
        
        data.addRow([
            gender,
            ...diagnoses.map(diagnosis => counts[diagnosis] || 0)
        ]);
    });

    // Draw the chart with stacked bars
    const chartDiv = document.getElementById('chart-div');
    const chart = new google.visualization.ColumnChart(chartDiv);

    const chartOptions = {
        ...options,
        isStacked: true, // Stack the columns
    };

    chart.draw(data, chartOptions);
  }

  // Draw diagnosis by case manager
  function drawDiagnosisByCaseManagerChart(options) {
    // Mapping of full diagnosis names to short codes
    const diagnosisMapping = {
        'ADHD (Attention Deficit Hyperactivity Disorder)': 'ADHD',
        'APD (Auditory Processing Disorder)': 'APD',
        'ASD (Autism Spectrum Disorder)': 'ASD',
        'DD (Developmental Delay)': 'DD',
        'DS (Down Syndrome)': 'DS',
        'EBD (Emotional and Behavioral Disorders)': 'EBD',
        'ED (Emotional Disturbance)': 'ED',
        'HI (Hearing Impairment)': 'HI',
        'ID (Intellectual Disability)': 'ID',
        'LD (Language Disorder)': 'LD',
        'MD (Multiple Disabilities)': 'MD',
        'OHI (Other Health Impairment)': 'OHI',
        'OI (Orthopedic Impairment)': 'OI',
        'SLD (Specific Learning Disorder)': 'SLD',
        'TBI (Traumatic Brain Injury)': 'TBI',
        'VI (Visual Impairment)': 'VI'
    };

    // Get unique case managers in order
    const caseManagerOrder = [...new Set(STUDENT_DATA.map(student => student['Case Manager']))].sort();

    // Add 'none' to the list of diagnoses
    const diagnoses = ['none', ...Object.values(diagnosisMapping)];

    // Aggregate Data
    const caseManagerCounts = caseManagerOrder.reduce((acc, caseManager) => {
        acc[caseManager] = STUDENT_DATA
            .filter(student => student['Case Manager'] === caseManager)
            .reduce((counts, student) => {
                const diagnosis = student['Diagnosis'] || '';
                const diagnosisKey = diagnosis === '' 
                    ? 'none' 
                    : (diagnosisMapping[diagnosis] || 'none');
                
                counts[diagnosisKey] = (counts[diagnosisKey] || 0) + 1;
                return counts;
            }, Object.fromEntries(diagnoses.map(d => [d, 0])));
        
        return acc;
    }, {});

    // Prepare Google Chart Data
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Case Manager');
    
    // Dynamically add columns based on diagnoses
    diagnoses.forEach(diagnosis => {
        const columnName = diagnosis === 'none' 
            ? 'None' 
            : diagnosis;
        data.addColumn('number', columnName);
    });
    
    // Add rows for each case manager
    const chartRows = caseManagerOrder.map(caseManager => [
        caseManager,
        ...diagnoses.map(diagnosis => 
            caseManagerCounts[caseManager][diagnosis] || 0
        )
    ]);

    // Add rows to the data table
    chartRows.forEach(row => data.addRow(row));

    // Draw the chart with stacked bars
    const chartDiv = document.getElementById('chart-div');
    const chart = new google.visualization.ColumnChart(chartDiv);

    const chartOptions = {
        ...options,
        isStacked: true // Stack the columns
    };

    chart.draw(data, chartOptions);
  }

  function drawAideByGradeChart(options) {
    // Predefined grade order
    const gradeOrder = ['TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8'];

    // Initialize grade level counts with zeros
    const gradeLevelCounts = {};
    gradeOrder.forEach(grade => {
        gradeLevelCounts[grade] = { 
            'No Aide': 0,
            'Full-time': 0,
            'Part-time (AM)': 0,
            'Part-time (PM)': 0
        };
    });

    // Aggregate data
    STUDENT_DATA.forEach(student => {
        const grade = student.Grade;
        const aide = student.Aide || 'No Aide';

        // Only increment if the grade exists in our predefined list
        if (gradeLevelCounts[grade] !== undefined) {
            gradeLevelCounts[grade][aide]++;
        }
    });

    // Prepare Google Chart Data
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Grade');
    data.addColumn('number', 'No Aide');
    data.addColumn('number', 'Full-time');
    data.addColumn('number', 'Part-time (AM)');
    data.addColumn('number', 'Part-time (PM)');
    
    // Use predefined order
    gradeOrder.forEach(grade => {
      const counts = gradeLevelCounts[grade];
      
      data.addRow([
        grade, 
        counts['No Aide'] || 0,
        counts['Full-time'] || 0,
        counts['Part-time (AM)'] || 0,
        counts['Part-time (PM)'] || 0
      ]);
    });

    // Draw the chart with stacked bars
    const chartDiv = document.getElementById('chart-div');
    const chart = new google.visualization.ColumnChart(chartDiv);

    const chartOptions = {
      ...options,
      isStacked: true, // Stack the columns
    };

    chart.draw(data, chartOptions);
  }

  function drawAideByClassroomChart(options) {
    // Aggregate Data by Classroom and Aide Types
    const classroomCounts = {};

    // Initialize counts for ALL classrooms from APP_SETTINGS
    const classroomOrder = APP_SETTINGS.classroomSettings.map(setting => setting.classroom);
    classroomOrder.forEach(classroom => {
        classroomCounts[classroom] = { 
            'No Aide': 0, 
            'Full-time': 0, 
            'Part-time (AM)': 0, 
            'Part-time (PM)': 0 
        };
    });

    STUDENT_DATA.forEach(student => {
        // Extract just the classroom code (before the hyphen)
        const fullClassroom = student['Classroom'];
        const classroom = fullClassroom.split(' - ')[0];
        const aide = student.Aide || 'No Aide';

        // Increment only if the classroom exists in our predefined list
        if (classroomCounts[classroom] !== undefined) {
            classroomCounts[classroom][aide]++;
        }
    });

    // Convert to array and sort based on APP_SETTINGS order
    let aggregatedData = classroomOrder.map(classroom => [classroom, classroomCounts[classroom]]);

    // Prepare Google Chart Data
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Classroom');
    data.addColumn('number', 'No Aide');
    data.addColumn('number', 'Full-time');
    data.addColumn('number', 'Part-time (AM)');
    data.addColumn('number', 'Part-time (PM)');
    
    aggregatedData.forEach(([classroom, counts]) => {
      // Find the full classroom name with teacher for display
      const fullClassroomName = APP_SETTINGS.classroomSettings
        .find(setting => setting.classroom === classroom)
        ? `${classroom} - ${APP_SETTINGS.classroomSettings.find(setting => setting.classroom === classroom).teacher}`
        : classroom;

      // Ensure the order matches the column definitions
      data.addRow([
        fullClassroomName, 
        counts['No Aide'] || 0,
        counts['Full-time'] || 0,
        counts['Part-time (AM)'] || 0,
        counts['Part-time (PM)'] || 0
      ]);
    });

    // Draw the chart with stacked bars
    const chartDiv = document.getElementById('chart-div');
    const chart = new google.visualization.ColumnChart(chartDiv);

    const chartOptions = {
      ...options,
      isStacked: true, // Stack the columns
    };

    chart.draw(data, chartOptions);
  }

  function drawAideByGenderChart(options) {
    // Predefined gender order
    const genderOrder = ['Male', 'Female', 'Non-binary'];

    // Initialize gender counts with zeros
    const genderCounts = {};
    genderOrder.forEach(gender => {
        genderCounts[gender] = { 
            'No Aide': 0, 
            'Full-time': 0, 
            'Part-time (AM)': 0, 
            'Part-time (PM)': 0 
        };
    });

    // Aggregate data
    STUDENT_DATA.forEach(student => {
        const gender = student.Gender;
        const aide = student.Aide || 'No Aide';

        // Only increment if the gender exists in our predefined list
        if (genderCounts[gender] !== undefined) {
            genderCounts[gender][aide]++;
        }
    });

    // Prepare Google Chart Data
    const data = new google.visualization.DataTable();
    data.addColumn('string', 'Gender');
    data.addColumn('number', 'No Aide');
    data.addColumn('number', 'Full-time');
    data.addColumn('number', 'Part-time (AM)');
    data.addColumn('number', 'Part-time (PM)');
    
    // Use predefined order
    genderOrder.forEach(gender => {
      const counts = genderCounts[gender];
      
      data.addRow([
        gender, 
        counts['No Aide'] || 0,
        counts['Full-time'] || 0,
        counts['Part-time (AM)'] || 0,
        counts['Part-time (PM)'] || 0
      ]);
    });

    // Draw the chart with stacked bars
    const chartDiv = document.getElementById('chart-div');
    const chart = new google.visualization.ColumnChart(chartDiv);

    const chartOptions = {
      ...options,
      isStacked: true, // Stack the columns
    };

    chart.draw(data, chartOptions);
  }

  ///////////////////////
  // UTILITY FUNCTIONS //
  ///////////////////////

  function showError(errorType, callback = "") {
    let icon = `<i class="bi bi-exclamation-triangle-fill" style="color: var(--warning-color); margin-right: 10px;"></i>`;
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
  
</script>
