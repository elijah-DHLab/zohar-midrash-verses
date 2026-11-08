#!/usr/bin/env python3
"""Serve this exact extracted project, choosing a free local port."""
import argparse,functools,http.server,webbrowser
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8000);p.add_argument('--no-browser',action='store_true');a=p.parse_args()
root=Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
 def end_headers(self):
  self.send_header('Cache-Control','no-store')
  super().end_headers()
handler=functools.partial(Handler,directory=str(root))
server=None
for port in range(a.port,min(65536,a.port+20)):
 try:server=http.server.ThreadingHTTPServer(('127.0.0.1',port),handler);break
 except OSError:
  continue
if server is None:raise SystemExit('No free local port. Close an older server or use --port.')
with server:
 url=f'http://127.0.0.1:{server.server_port}/?release=6.3'
 print('Verse Search 6.3 — '+str(root),flush=True);print(url,flush=True)
 if not a.no_browser:webbrowser.open(url,new=2)
 try:server.serve_forever()
 except KeyboardInterrupt:pass
