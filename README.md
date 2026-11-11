# RZ Ballast Archive

> ⚠️ **Dopo ogni modifica a `index.html` esegui `python3 tools/csp.py`.**
> La Content-Security-Policy ammette gli script inline solo tramite il loro hash SHA-256: se cambi uno `<script>` e non aggiorni l'hash, il browser **blocca l'app**. L'hash **non** viene aggiornato automaticamente durante la pubblicazione: lo strumento va lanciato a mano (i test con `npm test` lo verificano e falliscono se te ne dimentichi).

App web installabile (PWA) per scegliere la configurazione di ballast degli alianti RC in funzione del vento: pesi da montare, peso totale, carico alare e variazione del baricentro (ΔCdG). Funziona offline; i dati restano sul telefono (backup ed esportazione Excel inclusi). Lingue: IT / EN / FR.

Progetto hobbistico, condiviso così com'è: **nessuna garanzia di supporto o manutenzione**. Verificare sempre i risultati con una bilancia e un volo di prova.

## File

| File | Cosa contiene |
|---|---|
| `index.html` | L'app intera (HTML, CSS, JavaScript, immagini incorporate) |
| `manifest.webmanifest` | Nome, colori e icone per l'installazione |
| `sw.js` | Service worker: uso offline e aggiornamenti (incrementare `VERSION` a ogni rilascio) |
| `icons/` | Icone dell'app |
| `tools/csp.py` | Aggiorna/controlla gli hash della Content-Security-Policy |
| `tests/` | Test automatici (Playwright) e file di esempio di un backup |

Tutti i percorsi sono relativi (`./`): l'app funziona anche in una sottocartella, come su GitHub Pages: **https://rzannori.github.io/RZBallastArchive/**

## Sicurezza

- **Content-Security-Policy** in un `<meta>` di `index.html` (GitHub Pages non permette intestazioni HTTP): script solo con hash, nessun `eval`, nessuna risorsa esterna, `object-src 'none'`, `base-uri 'none'`. Gli stili inline sono ammessi (`'unsafe-inline'` solo per `style-src`).
- I testi scritti dall'utente (nomi di modelli e pesi) passano da `esc()` prima di finire in `innerHTML`; i file importati (backup, Excel) vengono ripuliti da `cleanModel()`.
- `noindex, nofollow`: il sito non viene indicizzato dai motori di ricerca.

## Provare in locale

```bash
python3 -m http.server 8000
```

Poi apri http://localhost:8000

## Test

Servono Node 18+ e Python 3.

```bash
npm install
npx playwright install chromium
npm test
```

`npm test` esegue `python3 tools/csp.py --check` e poi i test Playwright: CSP presente e senza violazioni, blocco di codice iniettato, nomi con HTML che restano testo, import di un backup della versione precedente, backup andata e ritorno, Excel, ΔCdG come prima informazione, manifest e service worker in una sottocartella e funzionamento offline.

## Rilascio

1. Modifica `index.html` (o gli altri file).
2. `python3 tools/csp.py`
3. Incrementa `VERSION` in `sw.js`.
4. `npm test`
5. Commit e push su `main`: GitHub Pages pubblica da solo; sui telefoni compare «Nuova versione disponibile → Aggiorna».
