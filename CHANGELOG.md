# Storia delle modifiche

Le versioni corrispondono a `VERSION` in `sw.js`. La cronologia dettagliata dello sviluppo precedente a questo repository è conservata altrove; qui è riassunta.

## v22 — 2026-11-11 · Trasloco su GitHub Pages
- L'app si trova ora su **https://rzannori.github.io/RZBallastArchive/** (repository pubblico con solo l'app).
- **Content-Security-Policy** con hash degli script inline e strumento `tools/csp.py` per aggiornarla e controllarla.
- **Test automatici** (Playwright): CSP, blocco di codice iniettato, nomi con HTML che restano testo, backup (anche da quelli esportati dal vecchio indirizzo), tabelle Excel, funzionamento offline in una sottocartella.
- Registrazione esplicita del service worker (`./sw.js`, `scope: './'`); valori numerici della scheda modello protetti con `esc()`.
- Sul vecchio indirizzo l'ultima versione mostra un avviso con il nuovo indirizzo e invita a esportare il backup.

## v21 — 2026-11-09 · Sito non indicizzato
- `noindex, nofollow`: il sito non compare nei motori di ricerca; il link si condivide su richiesta.

## v20 — 2026-11-06 · Logo RZ nella schermata iniziale
- Il logo RZ con l'aliante sostituisce esagono e «RZ»; logo e «Archive» seguono il colore principale scelto in Setup, dimensionati per non coprire la foto.

## v19 — 2026-11-05 · Freccia indietro
- Freccia «‹» accanto al logo nella barra in alto per tornare alla schermata iniziale.

## v18 · Logo come pulsante Home
- Toccando logo e titolo si torna alla schermata iniziale; tolto il tasto ⌂.

## v17 · Cambio rapido del modello
- Nella pagina del vento, toccando «Modello in uso» si apre l'elenco dei modelli; in archivio basta toccare il nome.

## v16 · Navigazione semplificata
- Tolte le schede in alto: Setup e Archivio si aprono dalla schermata iniziale.
- Riquadro «Modello in uso» con il nome in grande nella pagina del vento.
- Scorrimento col dito: verso destra per tornare indietro, verso sinistra per il dettaglio pesi.

## v14–v15 · Tabelle Excel
- In Setup: esporta un file `.xlsx` con un foglio per modello (dati, pesi, formule spiegate e configurazioni con formule vive) e lo reimporta dopo averlo modificato in Excel o Numbers.

## v13 · Scheda modello spiegata
- Un «?» con spiegazione su ogni voce della scheda (distanza dal CdG, tolleranze, peso RTF…).
- Lunghezza e spessore dei pesi in una sezione a parte: servono solo al disegno.
- Corretto: la lunghezza scritta a mano non viene più ricalcolata cambiando il peso.
- Nuova sezione della guida sulle voci della scheda.

## v12 · «Ripristina tutto» al sicuro
- Spostato in fondo alla pagina Modelli, in un riquadro separato.

## v11 · Nuova foto
- Schermata iniziale con la foto dell'aliante ritagliata su uno sfondo nei colori dell'app.

## v10 · Pulsante «Avvio»
- Nella schermata iniziale un solo pulsante «Avvio» con tendina: ultimo modello, archivio, demo, guida, Setup.

## v9 · Doppia conferma
- «Ripristina tutto» chiede due conferme e propone prima di salvare un backup.

## v8 · Schermata iniziale e gesti
- Pulsanti iniziali più compatti, pulsante Setup, scorrimento col dito tra le pagine.

## v7 · Interfaccia
- Indietro sotto il tasto Home, testo del disegno a schermo intero che ruota con il disegno, Setup riordinato, in italiano «pesi» al posto di «slug».

## v6 · Colori
- Logo, titolo e pulsanti seguono il colore principale; tema scuro anche per i controlli del telefono.

## v5 · Avviso aggiornamenti
- Barra «Nuova versione disponibile → Aggiorna» quando arriva una nuova versione.

## v4 · Prima pubblicazione
- App installabile e utilizzabile offline da un indirizzo web.

## v2–v3 · Backup
- Esporta e importa tutti i modelli (con immagini) in un file, da salvare su telefono, iCloud, Google Drive o Dropbox.
- Dopo le modifiche l'app chiede di salvare un backup; avviso finché manca.
- Dati versionati (`schema: 1`) con migrazione automatica.

## v1 · Prima versione
- Scelta della configurazione di ballast in base al vento (0–10 m/s), ΔCdG come prima informazione, pianta animata dei pesi, archivio modelli con calibrazione dell'immagine, Setup, guida e aiuti; italiano, inglese e francese.
