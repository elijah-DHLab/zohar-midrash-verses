#!/usr/bin/env python3
"""Add compact citation-site metadata without changing text, annotation or verse IDs."""
import collections, gzip, hashlib, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def read(p):
    return json.loads(p.read_bytes() if p.exists() else gzip.decompress(Path(str(p)+'.gz').read_bytes()))

def write(p, obj):
    raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode()
    if p.suffix == '.gz': p.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    else: p.write_bytes(raw)

def enrich(root=ROOT):
    data = root/'data'; m = read(data/'manifest.json'); report = {'schema':'verse-evidence/sites-2','books':[]}
    for b in m['books']:
        ix = read(data/b['index']); shards = {}; affected = sites = annotations = overlaps = 0
        for u in ix['units']:
            if u['shard'] not in shards: shards[u['shard']] = read(data/u['shard'])
            r = shards[u['shard']][u['id']]; bins = collections.OrderedDict()
            for i,e in enumerate(r['events']): bins.setdefault(tuple(sorted(set(e['pos']))), []).append(i)
            merged = [v for v in bins.values() if len(v)>1]
            u['sites'] = merged
            u['tokenCount'] = len(r['text'].split())
            amb = [v for v in bins.values() if len({r['events'][i]['v'] for i in v})>1]
            u['ambiguousSites'] = len(amb); u['siteCount'] = len(bins)
            u['distinctCertain'] = len({r['events'][v[0]]['v'] for v in bins.values() if len({r['events'][i]['v'] for i in v})==1})
            positions=list(bins)
            overlap_sites=set(); partial=0
            for i,p in enumerate(positions):
                for j in range(i+1,len(positions)):
                    if set(p)&set(positions[j]):
                        partial+=1;overlap_sites.update([i,j])
            u['overlapSites']=sorted(overlap_sites)
            u['partialOverlaps'] = partial
            affected += bool(amb); sites += len(amb); annotations += sum(len(v) for v in amb); overlaps += partial
        write(data/(b['index']+'.gz'),ix)
        cat = read(data/b['catalog']); meta={u['id']:u for u in ix['units']}
        for u in cat['units']:
            for k in ['sites','overlapSites','tokenCount','ambiguousSites','siteCount','distinctCertain','partialOverlaps']: u[k]=meta[u['id']][k]
        write(data/(b['catalog']+'.gz'),cat)
        b['compressedIndexBytes']=(data/(b['index']+'.gz')).stat().st_size
        report['books'].append({'id':b['id'],'units':len(ix['units']),'unitsWithAmbiguity':affected,'ambiguousSites':sites,'alternativeAnnotations':annotations,'partialOverlapPairs':overlaps})
    m['evidenceSchema']='verse-evidence/sites-2'
    # Include derivation version in the cache key, while preserving all unit/verse IDs.
    m['version']=m['version'].split('-sites')[0]+'-sites2'
    m['evidenceAudit']='evidence-audit.json'
    if 'evidence-audit.json' not in m['plainFiles']: m['plainFiles'].append('evidence-audit.json')
    write(data/'manifest.json',m);write(data/'evidence-audit.json',report)
    return report

if __name__=='__main__': print(json.dumps(enrich(),ensure_ascii=False))
