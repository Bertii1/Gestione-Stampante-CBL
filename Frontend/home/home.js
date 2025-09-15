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
  const min = option.min ?? option.rangemin ?? 0;
  if (max != null) input.max = max;
  if (min != null) input.min = min;
  input.name = option.description + option.position;
  input.id = input.name; // id per collegare il label
  if (min != null) input.value = String(min);

  const label = creaLabel(input.id, option.description);
  return { label, input };
}

// Crea un select con mappa {key: label}
function creaCampoSelect(option) {
  const select = document.createElement("select");
  select.name = option.description + option.position;
  select.id = select.name;
  select.classList.add("form-select");

  for (const key in option.values) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = option.values[key];
    select.appendChild(opt);
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
  input.name = option.description + option.position;
  input.id = input.name;
  input.value = String(min ?? 0);

  const label = creaLabel(input.id, option.description);
  const output = document.createElement("output");
  output.classList.add("form-label");
  output.value = input.value;

  // Aggiorna l'output in tempo reale
  input.addEventListener("input", function () {
    output.value = this.value;
  });

  return { label, input, output };
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
      displayString();
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
    const el = document.getElementById(id);
    if (!el) return null;
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

    // Caso standard: il name è description+position
    const fieldId =
      (option.description ?? option.name ?? "") + (option.position ?? "");
    risultati.push(valorePerId(fieldId));
  });

  return risultati;
}

function buildCommandString() {
  if (!currentCmd) return "";
  const values = leggiValoriCampi();
  // Costruisco: COMMAND,<v1>,<v2>,...
  const parts = [currentCmd.command, ...values.map((v) => v ?? "")];
  return parts.join(",");
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
  const response = await fetch("/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd: buildCommandString(),
    }),
  });

  if (response.ok) {
    showNotification(true, "✅ Stampa avvenuta con successo");
  } else {
    showNotification(false, "❌ Errore nella Stampa");
  }
}
// Avvio dell'applicazione (al termine della definizione delle funzioni)
init();
