# Serves the game folder for working on it, and tells the browser not to keep any file, so a reload always reads the code and data/ as they are now.
# Without this the browser may take some modules from its cache and others fresh after a change, and a page made of two versions can stop with a blank screen.
# Usage: python tools/serve.py [port], from the game folder or anywhere; run_game.cmd calls it.
import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8778
    handler = functools.partial(NoStore, directory=ROOT)
    with http.server.ThreadingHTTPServer(('127.0.0.1', port), handler) as httpd:
        print(f'serving {ROOT} at http://127.0.0.1:{port}/index.html, nothing is cached')
        httpd.serve_forever()
