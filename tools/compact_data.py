#!/usr/bin/env python3
"""Lossless static data compression. Run after build_corpus.py; idempotent."""
import gzip,json,hashlib,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def compact(root=ROOT/'data'):
 root=Path(root);m=json.loads((root/'manifest.json').read_text());plain=['manifest.json','build-report.json','size-report.json','evidence-audit.json']
 before=sum(p.stat().st_size for p in root.rglob('*') if p.is_file())
 for p in list(root.rglob('*.json')):
  name=p.relative_to(root).as_posix()
  if name in plain:continue
  data=p.read_bytes();target=p.with_suffix(p.suffix+'.gz');target.write_bytes(gzip.compress(data,compresslevel=9,mtime=0));assert gzip.decompress(target.read_bytes())==data;p.unlink()
 shutil.rmtree(root/'networks',ignore_errors=True)
 for b in m['books']:b.pop('network',None)
 for b in m['books']:b['compressedIndexBytes']=(root/(b['index']+'.gz')).stat().st_size
 m.pop('evidenceBaseline',None);m['compression']='gzip';m['plainFiles']=plain;m['coverage']='supplied-archives';m['coverageNotice']=f"{m['units']:,} יחידות מקור · זוהר ו־{len(m['books'])-1} מדרשים · כל הקבצים שסופקו נקלטו; שלמות מהדורה לא אומתה"
 (root/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,separators=(',',':')))
 after=sum(p.stat().st_size for p in root.rglob('*') if p.is_file())
 report={'beforeBytes':before,'afterBytes':after,'losslessGzip':True,'requires':'DecompressionStream(gzip) in a modern browser','rawArchivesIncluded':False}
 (root/'size-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));return report
if __name__=='__main__':
 report=compact()
 from enrich_evidence import enrich
 enrich()
 (ROOT/'data'/'evidence-baseline.json.gz').unlink(missing_ok=True)
 print(json.dumps(report,indent=2))
