#!/usr/bin/env python3
"""Aggiorna (o controlla) la Content-Security-Policy di index.html.

La CSP è un <meta http-equiv="Content-Security-Policy"> in index.html: GitHub Pages
non permette di impostare intestazioni HTTP. Gli script inline sono ammessi solo
tramite il loro hash SHA-256, quindi OGNI modifica a uno <script> inline cambia
l'hash: dopo aver modificato index.html eseguire

    python3 tools/csp.py          # ricalcola gli hash e aggiorna il <meta>
    python3 tools/csp.py --check  # solo verifica (esce con 1 se non aggiornata)
"""
import base64
import hashlib
import re
import sys
from pathlib import Path

INDEX = Path(__file__).resolve().parent.parent / "index.html"

# Politica completa; {scripts} viene sostituito con gli hash degli script inline.
POLICY = (
    "default-src 'self'; "
    "script-src {scripts}; "
    "style-src 'self' 'unsafe-inline'; "  # stili inline usati dall'interfaccia (non eseguono codice)
    "img-src 'self' data: blob:; "         # immagini incorporate (data:) e foto caricate
    "font-src 'self'; "
    "connect-src 'self'; "
    "manifest-src 'self'; "
    "worker-src 'self'; "
    "object-src 'none'; "
    "base-uri 'none'; "
    "form-action 'none'"
)
META_RE = re.compile(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">')
SCRIPT_RE = re.compile(r"<script>(.*?)</script>", re.S)  # solo script inline senza attributi


def expected(html: str) -> str:
    hashes = []
    for body in SCRIPT_RE.findall(html):
        digest = hashlib.sha256(body.encode("utf-8")).digest()
        hashes.append("'sha256-" + base64.b64encode(digest).decode() + "'")
    if not hashes:
        sys.exit("Nessuno script inline trovato in index.html")
    return '<meta http-equiv="Content-Security-Policy" content="' + POLICY.format(scripts=" ".join(hashes)) + '">'


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    found = META_RE.findall(html)
    if len(found) != 1:
        print(f"index.html deve contenere esattamente un <meta> CSP (trovati: {len(found)})", file=sys.stderr)
        return 1
    want = expected(html)
    if "--check" in sys.argv[1:]:
        if found[0] != want:
            print("CSP NON aggiornata: esegui  python3 tools/csp.py", file=sys.stderr)
            return 1
        print("CSP aggiornata: hash degli script inline corretti.")
        return 0
    if found[0] == want:
        print("CSP già aggiornata.")
        return 0
    INDEX.write_text(html.replace(found[0], want), encoding="utf-8")
    print("CSP aggiornata in index.html.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
