// Gestione UI per la composizione dei comandi della stampante
// Tutti i commenti sono in italiano per facilitare la manutenzione del codice.

// Stato corrente del comando selezionato (usato per leggere i valori)
let currentCmd = null;

// =====================
// Funzioni di utilità
// =====================

// Recupera la lista dei comandi dal backend (file statico)
async function getComandi() {
  const response = await fetch("/commands.json", { method: "GET" });
  return await response.json();
}

// Crea un <label> associato ad un controllo tramite l'attributo htmlFor
function creaLabel(forId, testo) {
  const label = document.createElement("label");
  label.classList.add("form-label");
  label.textContent = testo;
  label.htmlFor = forId; // deve puntare all'id del controllo
  return label;
}

// Svuota in modo sicuro tutti i contenuti di un nodo
function svuotaNodo(nodo) {
  if (!nodo) return;
  nodo.innerHTML = "";
}

// Restituisce (o crea se mancanti) i contenitori per le opzioni base e avanzate
function getOrCreateSezioniOpzioni(contenitore) {
  let defaultOptions = document.getElementById("default-options");
  let advancedOptions = document.getElementById("advanced-options");

  if (!defaultOptions && !advancedOptions) {
    defaultOptions = document.createElement("div");
    advancedOptions = document.createElement("div");

    defaultOptions.id = "default-options";
    advancedOptions.id = "advanced-options";

    contenitore.appendChild(defaultOptions);
    contenitore.appendChild(advancedOptions);
  }

  // Garantisce che i contenitori siano puliti prima di riempirli
  svuotaNodo(defaultOptions);
  svuotaNodo(advancedOptions);

  return { defaultOptions, advancedOptions };
}

// Inserisce coppia label+controllo in righe da 2 colonne (form-row > form-group)
function inserisciInSezione(
  { defaultOptions, advancedOptions },
  advanced,
  label,
  controllo,
  extraNodes = []
) {
  const target = advanced ? advancedOptions : defaultOptions;

  // Trova l'ultima riga o creane una nuova se piena/assente
  let lastRow = target.querySelector(":scope > .form-row:last-of-type");
  if (
    !lastRow ||
    lastRow.querySelectorAll(":scope > .form-group").length >= 2
  ) {
    lastRow = document.createElement("div");
    lastRow.classList.add("form-row");
    target.appendChild(lastRow);
  }

  // Crea il gruppo e inserisci label + controllo (+ eventuali extra)
  const group = document.createElement("div");
  group.classList.add("form-group");
  if (label) group.appendChild(label);
  group.appendChild(controllo);
  for (const n of extraNodes) group.appendChild(n);

  lastRow.appendChild(group);
}

// Slug semplice per name/id HTML
function slug(str) {
  return String(str)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// Crea un ID univoco e pulito per i controlli
function creaIdCampo(option) {
  const position = option.position || "";
  const description = option.description || option.name || "";

  // Usa una combinazione di position + slug della description
  return `${position}_${slug(description)}`;
}

// =====================
// Costruttori dei controlli
// =====================

// Crea un input numerico (type=number) con limiti opzionali
function creaCampoNumero(option) {
  const input = document.createElement("input");
  input.type = "number";
  input.classList.add("form-input");
  // Supporta sia min/max sia rangemin/rangemax
  const max = option.max ?? option.rangemax;
  const min = option.min ?? option.rangemin;
  if (max != null) input.max = max;
  if (min != null) input.min = min;

  const fieldId = creaIdCampo(option);
  input.name = fieldId;
  input.id = fieldId; // id per collegare il label

  // p1 e p2 (posizioni X e Y) sono sempre obbligatori
  // p3 è obbligatorio solo per alcuni comandi specifici (B1, B2)
  const position = option.position || "";
  const isP1P2Required = ["p1", "p2"].includes(position.toLowerCase());
  const isP3Required =
    position.toLowerCase() === "p3" &&
    currentCmd &&
    ["B1", "B2"].includes(currentCmd.command);
  const isRequired = isP1P2Required || isP3Required;

  if (isRequired) {
    // Per parametri obbligatori, imposta il valore minimo o 0
    input.value = String(min ?? 0);
    input.required = true;
  } else {
    // Per parametri opzionali, lascia completamente vuoto
    input.placeholder = `Opzionale - Min: ${min ?? 0}, Max: ${max ?? "N/A"}`;
    // NON impostare alcun valore - deve rimanere vuoto
  }

  const label = creaLabel(input.id, option.description);

  // Aggiungi indicatore visivo per parametri obbligatori
  if (isRequired) {
    label.innerHTML += ' <span style="color: red;">*</span>';
    label.title = "Parametro obbligatorio";
  }

  return { label, input };
}

// Crea un select con mappa {key: label}
function creaCampoSelect(option) {
  const select = document.createElement("select");
  const fieldId = creaIdCampo(option);
  select.name = fieldId;
  select.id = fieldId;
  select.classList.add("form-select");

  // Aggiungi opzione vuota per parametri opzionali
  const position = option.position || "";
  const isP1P2Required = ["p1", "p2"].includes(position.toLowerCase());
  const isP3Required =
    position.toLowerCase() === "p3" &&
    currentCmd &&
    ["B1", "B2"].includes(currentCmd.command);
  const isRequired = isP1P2Required || isP3Required;

  if (!isRequired) {
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "-- Non specificato --";
    select.appendChild(emptyOpt);
  }

  for (const key in option.values) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = option.values[key];
    select.appendChild(opt);
  }

  // Seleziona la prima opzione valida per i parametri richiesti
  if (isRequired && Object.keys(option.values).length > 0) {
    select.selectedIndex = 0;
  }

  const label = creaLabel(select.id, option.description);
  return { label, select };
}

// Crea un select da un array di oggetti {name|nome, value}
function creaCampoSelectArray(labelText, name, valuesArray) {
  const select = document.createElement("select");
  select.classList.add("form-select");
  select.name = name;
  select.id = name;

  valuesArray.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.value;
    opt.textContent = v.name ?? v.nome ?? String(v.value);
    select.appendChild(opt);
  });

  const label = creaLabel(select.id, labelText);
  return { label, select };
}

// Crea un range (slider) con output affiancato che mostra il valore corrente
function creaCampoRange(option) {
  const input = document.createElement("input");
  input.type = "range";
  input.classList.add("form-input");
  // Supporta sia min/max sia rangemin/rangemax
  const max = option.max ?? option.rangemax;
  const min = option.min ?? option.rangemin ?? 0;
  if (max != null) input.max = max;
  if (min != null) input.min = min;
  const fieldId = creaIdCampo(option);
  input.name = fieldId;
  input.id = fieldId;

  // Per i range, impostiamo un valore di default poiché un range deve sempre avere un valore
  // Ma aggiungiamo un attributo per sapere se è il valore di default
  const defaultValue = min ?? 0;
  input.value = String(defaultValue);
  input.dataset.isDefault = "true"; // Segniamo che questo è il valore di default

  const label = creaLabel(input.id, option.description);
  const output = document.createElement("output");
  output.classList.add("form-label");
  output.value = input.value;

  // Aggiorna l'output in tempo reale e rimuovi il flag di default quando viene modificato
  input.addEventListener("input", function () {
    output.value = this.value;
    this.dataset.isDefault = "false"; // L'utente ha modificato il valore
  });

  return { label, input, output };
}

// Crea un campo file upload per SVG
function creaCampoFileUpload(option) {
  const container = document.createElement("div");
  container.classList.add("file-upload-container");
  
  const input = document.createElement("input");
  input.type = "file";
  input.classList.add("file-input");
  input.accept = option.accept || ".svg";
  
  const fieldId = creaIdCampo(option);
  input.name = fieldId;
  input.id = fieldId;
  input.style.display = "none"; // Hide default file input
  
  // Create custom upload area
  const uploadArea = document.createElement("div");
  uploadArea.classList.add("file-upload-area");
  uploadArea.innerHTML = `
    <div class="file-upload-content">
      <i class="fa-solid fa-cloud-upload-alt file-upload-icon"></i>
      <p class="file-upload-text">${option.placeholder || "Trascina qui il file o clicca per selezionare"}</p>
      <span class="file-upload-filename"></span>
    </div>
  `;
  
  // Style the upload area
  uploadArea.style.cssText = `
    border: 2px dashed #ddd;
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background-color: #fafafa;
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Click handler for upload area
  uploadArea.addEventListener('click', () => {
    input.click();
  });
  
  // Drag and drop handlers
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#007bff';
    uploadArea.style.backgroundColor = '#f0f8ff';
  });
  
  uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ddd';
    uploadArea.style.backgroundColor = '#fafafa';
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ddd';
    uploadArea.style.backgroundColor = '#fafafa';
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        handleFileSelection(file, input, uploadArea);
      } else {
        showFileError(uploadArea, 'Solo file SVG sono supportati');
      }
    }
  });
  
  // File input change handler
  input.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0], input, uploadArea);
    }
  });
  
  container.appendChild(input);
  container.appendChild(uploadArea);
  
  const label = creaLabel(input.id, option.description);
  return { label, input: container };
}

// Helper function for file selection
function handleFileSelection(file, input, uploadArea) {
  const filenameSpan = uploadArea.querySelector('.file-upload-filename');
  const textP = uploadArea.querySelector('.file-upload-text');
  const icon = uploadArea.querySelector('.file-upload-icon');
  
  filenameSpan.textContent = file.name;
  textP.textContent = 'File selezionato:';
  icon.className = 'fa-solid fa-file-image file-upload-icon';
  uploadArea.style.borderColor = '#28a745';
  uploadArea.style.backgroundColor = '#f8fff9';
  
  // Store file data for later use
  const reader = new FileReader();
  reader.onload = (e) => {
    input.dataset.fileData = e.target.result;
    input.dataset.fileName = file.name;
  };
  reader.readAsDataURL(file);
}

// Helper function for file errors
function showFileError(uploadArea, message) {
  const textP = uploadArea.querySelector('.file-upload-text');
  const icon = uploadArea.querySelector('.file-upload-icon');
  
  textP.textContent = message;
  icon.className = 'fa-solid fa-exclamation-triangle file-upload-icon';
  uploadArea.style.borderColor = '#dc3545';
  uploadArea.style.backgroundColor = '#fff5f5';
  
  setTimeout(() => {
    textP.textContent = 'Trascina qui il file SVG o clicca per selezionare';
    icon.className = 'fa-solid fa-cloud-upload-alt file-upload-icon';
    uploadArea.style.borderColor = '#ddd';
    uploadArea.style.backgroundColor = '#fafafa';
  }, 3000);
}

// Crea un checkbox con label
function creaCampoCheckbox(option) {
  const container = document.createElement("div");
  container.classList.add("checkbox-container");
  
  const input = document.createElement("input");
  input.type = "checkbox";
  input.classList.add("form-checkbox");
  
  const fieldId = creaIdCampo(option);
  input.name = fieldId;
  input.id = fieldId;
  
  // Set default checked state
  if (option.checked) {
    input.checked = true;
  }
  
  const label = document.createElement("label");
  label.classList.add("checkbox-label");
  label.htmlFor = fieldId;
  label.innerHTML = `
    <span class="checkbox-custom"></span>
    <span class="checkbox-text">${option.description}</span>
  `;
  
  // Style the custom checkbox
  const style = document.createElement('style');
  style.textContent = `
    .checkbox-container {
      display: flex;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .form-checkbox {
      display: none;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      cursor: pointer;
      font-size: 14px;
    }
    .checkbox-custom {
      width: 20px;
      height: 20px;
      border: 2px solid #ddd;
      border-radius: 4px;
      margin-right: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .form-checkbox:checked + .checkbox-label .checkbox-custom {
      background-color: #007bff;
      border-color: #007bff;
    }
    .form-checkbox:checked + .checkbox-label .checkbox-custom::after {
      content: '✓';
      color: white;
      font-size: 14px;
      font-weight: bold;
    }
    .checkbox-label:hover .checkbox-custom {
      border-color: #007bff;
    }
  `;
  
  if (!document.querySelector('#checkbox-styles')) {
    style.id = 'checkbox-styles';
    document.head.appendChild(style);
  }
  
  container.appendChild(input);
  container.appendChild(label);
  
  return { label: null, input: container }; // Return container as input
}

// Crea un range a partire da limiti e testo etichetta
function creaCampoRangeCustom(labelText, name, min, max) {
  return creaCampoRange({
    description: labelText,
    position: "",
    min,
    max,
    rangemin: min,
    rangemax: max,
  });
}

// =====================
// Rendering della selezione
// =====================

// Costruisce il pannello opzioni per il comando selezionato
function LoadSelection(cmd) {
  // 1) Seleziono il contenitore principale e lo preparo
  const contenitore = document.getElementsByClassName("empty-div")[0];
  svuotaNodo(contenitore);

  // 2) Titolo della scheda
  const title = document.createElement("h3");
  title.classList.add("card-title");
  title.innerText = `componi ${cmd.type}`;
  contenitore.appendChild(title);

  // Memorizzo il comando selezionato per la lettura successiva dei valori
  currentCmd = cmd;

  // 3) Sezioni "base" e "avanzate"
  const sezioni = getOrCreateSezioniOpzioni(contenitore);

  // 4) Stato per opzioni esclusive dei codici 2D (PDF417/QR/DataMatrix)
  let select2DTipo = null; // <select> per il tipo 2D (P/Q/D)
  const aggiornatriciEsclusive = []; // lista di funzioni che ridisegnano i blocchi esclusivi

  // 5) Per ogni opzione costruisco il relativo controllo e lo inserisco
  cmd.options.forEach((option) => {
    const hasExclusive = Array.isArray(option.esclusive_options);

    // Se l'opzione ha un blocco di opzioni esclusive, creo subito il contenitore e registro l'updater
    let exclusiveUpdater = null;
    if (hasExclusive) {
      const container = document.createElement("div");
      container.classList.add("exclusive-container");
      // Traccio la posizione (p4, p5, ...) per poter leggere i valori successivamente
      container.dataset.pos = option.position;
      const groupLabel = document.createElement("div");
      groupLabel.classList.add("form-label");
      groupLabel.textContent = option.description;
      const target = option.advanced
        ? sezioni.advancedOptions
        : sezioni.defaultOptions;
      // Avvolgo in riga/gruppo per coerenza visuale
      let row = document.createElement("div");
      row.classList.add("form-row");
      let group = document.createElement("div");
      group.classList.add("form-group");
      group.appendChild(groupLabel);
      group.appendChild(container);
      row.appendChild(group);
      target.appendChild(row);

      exclusiveUpdater = (selectedName) => {
        svuotaNodo(container);
        if (!selectedName) return;
        const match = option.esclusive_options.find(
          (ex) =>
            String(ex.for).toLowerCase() === String(selectedName).toLowerCase()
        );
        if (!match) return;

        const baseName = slug(
          `${match.name || match.nome || option.description}_${option.position}`
        );

        if (match.type === "range") {
          const { label, input, output } = creaCampoRangeCustom(
            match.name || match.nome || option.description,
            baseName,
            match.rangemin ?? 0,
            match.rangemax ?? 0
          );
          container.appendChild(label);
          container.appendChild(input);
          container.appendChild(output);
        } else if (match.type === "select") {
          const { label, select } = creaCampoSelectArray(
            match.name || match.nome || option.description,
            baseName,
            Array.isArray(match.values) ? match.values : []
          );
          container.appendChild(label);
          container.appendChild(select);
        }
      };

      aggiornatriciEsclusive.push(exclusiveUpdater);
    }

    // Gestione dei campi standard in base al tipo
    switch (option.type) {
      case "value": {
        const { label, input } = creaCampoNumero(option);
        inserisciInSezione(sezioni, !!option.advanced, label, input);
        break;
      }
      case "select": {
        const { label, select } = creaCampoSelect(option);
        inserisciInSezione(sezioni, !!option.advanced, label, select);

        const is2DType =
          (option.description || "")
            .toLowerCase()
            .includes("2d barcode type") ||
          (option.position === "p3" &&
            typeof option.values === "object" &&
            ("P" in option.values ||
              "Q" in option.values ||
              "D" in option.values));
        if (is2DType) {
          select2DTipo = select;
        }
        break;
      }
      case "range": {
        const { label, input, output } = creaCampoRange(option);
        inserisciInSezione(sezioni, !!option.advanced, label, input, [output]);
        break;
      }
      case "file_upload": {
        const { label, input } = creaCampoFileUpload(option);
        inserisciInSezione(sezioni, !!option.advanced, label, input);
        break;
      }
      case "checkbox": {
        const { label, input } = creaCampoCheckbox(option);
        // Per i checkbox, non passiamo label separatamente perché è integrato
        inserisciInSezione(sezioni, !!option.advanced, null, input);
        break;
      }
      default:
        break;
    }
  });

  // 6) Wiring: quando cambia il tipo 2D, aggiorno tutti i blocchi esclusivi
  if (select2DTipo && aggiornatriciEsclusive.length > 0) {
    const getSelected2DName = () => {
      // Usa il testo visualizzato nel select per evitare dipendenze dalla mappa
      const opt = select2DTipo.options[select2DTipo.selectedIndex];
      return opt ? opt.textContent : "";
    };

    const refreshAll = () => {
      const selectedName = getSelected2DName();
      aggiornatriciEsclusive.forEach((fn) => fn(selectedName));
    };

    // Primo render in base al valore corrente del select
    refreshAll();

    // Aggiorno a ogni cambio del select 2D
    select2DTipo.addEventListener("change", refreshAll);
  }
}

// =====================
// Inizializzazione pagina
// =====================

// Popola il select dei tipi e collega l'handler per il cambio selezione
async function init() {
  const comandi = await getComandi();

  // Eventi opzionali (se presenti nell'HTML)
  const printButton = document.getElementById("printButton");
  if (printButton) {
    printButton.addEventListener("click", () => {
      displayString();
      print();
    });
  }

  // supporta anche il bottone secondario (nella card sotto)
  const printButtonSecondary = document.getElementById("printButtonSecondary");
  if (printButtonSecondary) {
    printButtonSecondary.addEventListener("click", () => {
      displayString()
      print();
    });
  }

  const syncButton = document.getElementById("syncButton");
  if (syncButton) {
    syncButton.addEventListener("click", () => {
      displayString();
    });
  }

  // Toggle mostra/nascondi opzioni avanzate (se presente)
  const toggle = document.getElementById("toggleAdvanced");
  if (toggle) {
    const advancedWrap = document.querySelector(".options-advanced");
    toggle.addEventListener("click", () => {
      if (!advancedWrap) return;
      advancedWrap.classList.toggle("hidden");
    });
  }

  // Select dei tipi (assumiamo il primo elemento con classe "type-select")
  const typeSelect = document.getElementById("type-select");

  // Popolo il select con i comandi disponibili
  comandi.forEach((comando) => {
    const opt = document.createElement("option");
    opt.value = comando.command;
    opt.text = comando.type;
    typeSelect.appendChild(opt);
  });

  // Mostro subito la prima selezione (se presente)
  if (comandi.length > 0) {
    typeSelect.value = comandi[0].command;
    LoadSelection(comandi[0]);
  }

  // Al cambio di selezione, carico il relativo pannello
  typeSelect.addEventListener("change", (e) => {
    const choice = e.target.value;
    const selezionato = comandi.find((c) => c.command === choice);
    if (selezionato) LoadSelection(selezionato);
  });
}

// =====================
// Lettura dei valori e costruzione array
// =====================

// Legge tutti i campi attualmente visibili e restituisce un array di valori
// in ordine di posizione (p1, p2, ...). Include anche le opzioni esclusive
// in base alla selezione corrente del tipo 2D.
function leggiValoriCampi() {
  const risultati = [];
  if (!currentCmd) return risultati;

  // Helper: trova il valore di un controllo per id (id === name)
  const valorePerId = (id) => {
    if (!id) return null;

    let el = document.getElementById(id);
    if (!el) return null;

    // Per i campi range, controlla se è ancora il valore di default
    if (el.type === "range" && el.dataset.isDefault === "true") {
      return null; // Considera il valore di default come "non impostato"
    }

    // Per i checkbox, ritorna il valore booleano
    if (el.type === "checkbox") {
      return el.checked;
    }

    // Per i file input, cerchiamo i dati del file
    if (el.type === "file") {
      return {
        fileName: el.dataset.fileName || null,
        fileData: el.dataset.fileData || null
      };
    }

    return el.value ?? null;
  };

  // Per ogni opzione del comando
  currentCmd.options.forEach((option) => {
    // Caso con esclusiva: cerca il container marcato con data-pos
    if (Array.isArray(option.esclusive_options)) {
      const container = document.querySelector(
        `.exclusive-container[data-pos="${option.position}"]`
      );
      const control = container
        ? container.querySelector("input, select")
        : null;
      risultati.push(control ? control.value : null);
      return;
    }

    // Caso standard: usa la stessa logica di creazione ID
    const fieldId = creaIdCampo(option);
    const value = valorePerId(fieldId);
    risultati.push(value);
  });

  return risultati;
}

function buildCommandString() {
  if (!currentCmd) return "";
  const values = leggiValoriCampi();

  // Helper per controllare se un valore è considerato "vuoto"
  const isEmptyValue = (value, index) => {
    // p1 e p2 sono sempre obbligatori, quindi solo null/undefined/empty sono vuoti
    if (index <= 1) {
      return value == null || value === "" || value === undefined;
    }

    // Per gli altri parametri, anche "0" può essere considerato "non specificato"
    // se è il valore di default
    return (
      value == null || value === "" || value === "none" || value === undefined
    );
  };

  // Verifica che p1 e p2 siano sempre presenti (obbligatori)
  if (
    values.length >= 2 &&
    (isEmptyValue(values[0], 0) || isEmptyValue(values[1], 1))
  ) {
    console.warn(
      "Attenzione: p1 e p2 sono parametri obbligatori ma risultano vuoti"
    );
    // In caso di emergenza, usa valori di default
    if (isEmptyValue(values[0], 0)) values[0] = "0";
    if (isEmptyValue(values[1], 1)) values[1] = "0";
  }

  // Prima trovo l'ultimo parametro non vuoto per determinare fino dove costruire la stringa
  let ultimaPosizioneConValore = -1;
  for (let i = 0; i < values.length; i++) {
    if (!isEmptyValue(values[i], i)) {
      ultimaPosizioneConValore = i;
    }
  }

  // Assicurati che almeno p1 e p2 siano inclusi se esistono
  if (ultimaPosizioneConValore < 1 && values.length >= 2) {
    ultimaPosizioneConValore = 1; // Includi almeno p1 e p2
  }

  // Se non ci sono parametri validi, ritorno solo il comando
  if (ultimaPosizioneConValore === -1) {
    return currentCmd.command;
  }

  // Costruisco la stringa includendo solo i parametri necessari
  const parts = [];

  for (let i = 0; i <= ultimaPosizioneConValore; i++) {
    const value = values[i];
    if (!isEmptyValue(value, i)) {
      // Parametro con valore - lo aggiungo
      parts.push(value);
    }
    // Nota: non aggiungo nulla per i parametri vuoti - questo li omette dalla stringa
    // Eccezione: p1 e p2 devono sempre essere presenti anche se vuoti (ma non dovrebbe mai accadere)
  }

  return currentCmd.command + parts.join(",");
}

function displayString() {
  const preview = document.getElementById("preview");
  const data = document.getElementById("data-input");

  if (preview) {
    if (
      preview.tagName === "TEXTAREA" ||
      (preview.tagName === "INPUT" && preview.type === "text")
    ) {
      preview.value = buildCommandString() + "," + "'" + data.value + "'";
    } else {
      preview.textContent = buildCommandString() + "," + "'" + data.value + "'";
    }
  }
}

function showNotification(state, message) {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  if (state) {
    notification.classList.remove("notification-bad");
    notification.classList.add("notification");
  } else {
    notification.classList.remove("notification");
    notification.classList.add("notification-bad");
  }
  notification.classList.add("show");
  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

async function print() {
  const authData = authManager.getAuthData();
  const headers = { "Content-Type": "application/json" };
  
  // Add authorization header if available
  if (authData.token) {
    headers['Authorization'] = `Bearer ${authData.token}`;
  }
  
  // Get current label data for history
  const labelData = document.getElementById("data-input").value || '';
  const typeSelect = document.getElementById("type-select");
  const quantity = document.getElementById("label-number").value;
  const labelType = typeSelect ? typeSelect.options[typeSelect.selectedIndex].text : 'Unknown';
  
  
  // Collect current form data as template
  const templateData = {
    type: labelType,
    data: labelData,
    formValues: getCurrentFormValues(),
  };
  
  const response = await fetch("/print", {
    method: "POST",
    headers,
    body: JSON.stringify({
      cmd: buildCommandString(),
      label_type: labelType,
      label_data: labelData,
      template_data: templateData,
      label_quantity : quantity
    }),
  });

  if (response.ok) {
    showNotification(true, "✅ Stampa avvenuta con successo");
  } else {
    showNotification(false, "❌ Errore nella Stampa");
  }
}

// Helper function to collect current form values
function getCurrentFormValues() {
  const formData = {};
  
  // Get all form inputs, selects, and textareas
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    if (input.id && input.value !== '') {
      formData[input.id] = {
        type: input.type || input.tagName.toLowerCase(),
        value: input.value,
        label: input.previousElementSibling?.textContent || input.id
      };
    }
  });
  
  return formData;
}
// Authentication and initialization
document.addEventListener('DOMContentLoaded', function() {
  // Check authentication
  if (!authManager.requireAuth()) {
    return;
  }
  
  initializeAuth();
  init();
});

function initializeAuth() {
  // Update user info in sidebar
  const userNameElement = document.querySelector('.user-name');
  if (userNameElement) {
    userNameElement.textContent = authManager.getCurrentUsername() || 'Operatore';
  }
  
  // Setup logout button
  const logoutButton = document.querySelector('.sidebar-footer .button-secondary');
  if (logoutButton) {
    logoutButton.addEventListener('click', function() {
      authManager.logout();
      window.location.href = '/App/login/login.html';
    });
  }
  
  // Show/hide admin elements based on role
  const isAdmin = authManager.isAdmin();
  
  const adminSection = document.querySelector('.nav-list-admin');
  if (adminSection) {
    adminSection.style.display = isAdmin ? 'block' : 'none';
  }
  
  // Show admin indicator for admins
  const adminIndicator = document.getElementById('admin-indicator');
  if (adminIndicator && isAdmin) {
    adminIndicator.style.display = 'block';
  }
  
  // Update admin link to proper path
  const adminLink = document.querySelector('a[href="admin.html"]');
  if (adminLink) {
    adminLink.href = '../admin/admin.html';
  }
}
