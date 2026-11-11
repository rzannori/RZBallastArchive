"""Serve la cartella del repository sotto /RZBallastArchive/ (come GitHub Pages)."""
import functools, http.server, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREFIX = "/RZBallastArchive"


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if not path.startswith(PREFIX + "/"):
            return str(ROOT / "__non_esiste__")  # fuori dalla sottocartella: 404
        return super().translate_path(path[len(PREFIX):])

    def log_message(self, *args):
        pass


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8173
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=str(ROOT))).serve_forever()
