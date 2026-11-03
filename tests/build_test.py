import importlib.util,json,tempfile,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('builder',Path(__file__).resolve().parents[1]/'tools/build_corpus.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def unit(book,n=1):
 return {'location':book+'__Part_1_'+str(n)+'_1','gt_text':'בראשית ברא אלהים אשרי האיש','nodes':[{'reference':'Tanakh_Writings_Psalms_1_1','pos':[3,4],'tokens':['אשרי','האיש']},{'reference':'Tanakh_Torah_Genesis_1_1','pos':[0,1,2],'tokens':['בראשית','ברא','אלהים']}]}
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp);z=p/'first.zip';out=p/'data';cache=p/'cache.sqlite'
 with zipfile.ZipFile(z,'w') as f:
  f.writestr('a.json',json.dumps(unit('Kabbalah_Zohar')));f.writestr('broken.json','{')
 r=m.build([z],out,cache);assert r['stored_units']==1 and r['invalid']==1
 man=json.loads((out/'manifest.json').read_text());assert not man['completeBibliographicCorpus']
 ix=json.loads((out/man['books'][0]['index']).read_text());u=ix['units'][0];record=json.loads((out/u['shard']).read_text())[u['id']]
 assert record['events'][0]['key']=='Genesis:1:1' and record['origin']=='a.json'
 r=m.build([z],out,cache);assert r['duplicates']==1 and r['stored_units']==1
 cache.unlink();other=p/'other.json';other.write_text(json.dumps(unit('Other_Example')))
 r=m.build([other],out,cache,book='example',title='ספר נוסף');assert r['restored_units']==1 and r['stored_units']==2 and r['books']==2
 changed=unit('Other_Example');changed['gt_text']+=' נוסף';other.write_text(json.dumps(changed))
 r=m.build([other],out,cache,book='example',title='ספר נוסף');assert r['updated_units']==1 and r['stored_units']==2
 r=m.build([other],out,cache,replace=True,book='example',title='ספר נוסף');assert r['stored_units']==1
 print('PASS: ZIP ingestion, errors, event order, deduplication, cache restoration, incremental update, replacement')
