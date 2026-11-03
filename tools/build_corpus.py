#!/usr/bin/env python3
"""Build a static verse search corpus from raw JSON directories/ZIPs or saved research files. Python stdlib only."""
import argparse,collections,hashlib,json,re,shutil,sqlite3,unicodedata,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TITLES={'zohar':'זוהר','midrash-tanchuma':'תנחומא','midrash-tanchuma-buber':'תנחומא בובר','bereishit-rabbah':'בראשית רבה','shemot-rabbah':'שמות רבה','vayikra-rabbah':'ויקרא רבה','bamidbar-rabbah':'במדבר רבה','devarim-rabbah':'דברים רבה','ruth-rabbah':'רות רבה','eikhah-rabbah':'איכה רבה','esther-rabbah':'אסתר רבה','midrash-tehillim':'מדרש תהלים','midrash-mishlei':'מדרש משלי','midrash-shmuel':'מדרש שמואל','pirkei-derabbi-eliezer':'פרקי דרבי אליעזר','pesikta-rabbati':'פסיקתא רבתי','pesikta-d-rav-kahanna':'פסיקתא דרב כהנא','aggadat-bereshit':'אגדת בראשית','seder-olam-zutta':'סדר עולם זוטא','tanna-debei-eliyahu-rabbah':'תנא דבי אליהו רבה','mekhilta-drabbi-yishmael':'מכילתא דרבי ישמעאל','mekhilta-derabbi-shimon-ben-yochai':'מכילתא דרבי שמעון בן יוחאי','sifrei-bamidbar':'ספרי במדבר','sifrei-devarim':'ספרי דברים','mishnat-rabbi-eliezer':'משנת רבי אליעזר','yalkut-shimoni-on-torah':'ילקוט שמעוני על התורה','yalkut-shimoni-on-nach':'ילקוט שמעוני על נ״ך'}
SECTIONS={'Addenda':'תוספות','Idra Zuta':'אדרא זוטא',"Ha'Azinu":'האזינו','Ki Teitzei':'כי תצא','Vayeilech':'וילך','Devarim':'דברים','Eikev':'עקב','Ki Tavo':'כי תבוא','Masei':'מסעי','Nitzavim':'ניצבים',"Re'eh":'ראה','Shoftim':'שופטים',"V'Zot HaBerachah":'וזאת הברכה','Vaetchanan':'ואתחנן','Bereshit':'בראשית','Bereishit':'בראשית','Noach':'נח','Lech Lecha':'לך לך','Vayera':'וירא','Chayei Sara':'חיי שרה','Toldot':'תולדות','Vayetzei':'ויצא','Vayishlach':'וישלח','Vayeshev':'וישב','Miketz':'מקץ','Vayigash':'ויגש','Vayechi':'ויחי','Shemot':'שמות','Vaera':'וארא','Bo':'בא','Beshalach':'בשלח','Yitro':'יתרו','Mishpatim':'משפטים','Terumah':'תרומה','Tetzaveh':'תצוה','Ki Tisa':'כי תשא','Vayakhel':'ויקהל','Pekudei':'פקודי','Vayikra':'ויקרא','Tzav':'צו','Shmini':'שמיני','Tazria':'תזריע','Metzora':'מצורע','Achrei Mot':'אחרי מות','Kedoshim':'קדושים','Emor':'אמור','Behar':'בהר','Bechukotai':'בחוקותי','Bamidbar':'במדבר','Nasso':'נשא',"Beha'alotcha":'בהעלותך',"Sh'lach":'שלח','Korach':'קרח','Chukat':'חקת','Balak':'בלק','Pinchas':'פינחס','Matot':'מטות'}
def norm(s):
 s=unicodedata.normalize('NFD',str(s)).lower();s=re.sub(r'[\u0591-\u05c7]','',s)
 return re.sub(r'\s+',' ',re.sub(r'[^\w\u05d0-\u05ea]+',' ',s)).strip()
def ref(s):
 m=re.match(r'^Tanakh_(?:Torah|Prophets|Writings)_(.+)_(\d+)_(\d+)$',re.sub('_+','_',str(s)))
 return f'{m[1]}:{int(m[2])}:{int(m[3])}' if m else None

def canonical(x,book_override=None,title_override=None):
 loc=x.get('location');assert isinstance(loc,str) and loc,'Missing location'
 prefix,_,tail=loc.partition('__');name=re.sub(r'^(?:Midrash_Aggadic_Midrash_|Midrash_|Kabbalah_)','',prefix)
 # Preserve the conventional titles instead of collapsing all Midrash texts into one corpus.
 if prefix.startswith('Midrash_Aggadic_Midrash_'):name=prefix[len('Midrash_Aggadic_Midrash_'):]
 bid=book_override or re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-') or 'book-'+hashlib.sha256(prefix.encode()).hexdigest()[:10]
 title=title_override or TITLES.get(bid,name.replace('_',' '))
 raw=x.get('events');rawmode=not isinstance(raw,list)
 if rawmode:raw=x.get('nodes',[])
 assert isinstance(raw,list),'Invalid events'
 events=[]
 for n in raw:
  if n.get('valid') is False:continue
  reference=n.get('reference') if rawmode else n.get('ref');key=ref(reference)
  if not key:continue
  pos=n.get('pos',[])
  if not isinstance(pos,list) or not pos or not all(type(p)is int and p>=0 for p in pos):continue
  words=n.get('tokens',[]) if rawmode else n.get('words',[])
  if not isinstance(words,list):continue
  events.append({'ref':reference,'key':key,'pos':pos,'words':words,'class':n.get('calss' if rawmode else 'class',''),'kind':n.get('type' if rawmode else 'kind','')})
 events.sort(key=lambda e:e['pos'][0]);uid=hashlib.sha256(loc.encode()).hexdigest()[:20]
 m=re.match(r'^(.*?)_(\d+)_(\d+)_(\d+)$',tail)
 sec=m[1] if m else tail.rsplit('_',1)[0];label=SECTIONS.get(sec,sec.replace('_',' '))
 if m:label+=' · '+m[3]+('.'+m[4] if m[4]!='1' else '')
 text=x.get('gt_text',x.get('text','')) or x.get('gt_clean_text',x.get('clean','')) or ''
 assert isinstance(text,str),'Invalid text'
 source=x.get('source','');source=source if isinstance(source,str) and source.startswith(('https://drive.google.com/','https://docs.google.com/')) else ''
 return {'id':uid,'book':bid,'bookTitle':title,'location':loc,'label':label or loc,'section':SECTIONS.get(sec,sec),'text':text,'events':events,'source':source}

def inputs(paths):
 for path in paths:
  p=Path(path)
  if p.is_dir():
   for f in sorted(p.rglob('*.json')):yield str(f),lambda f=f:f.read_bytes()
  elif zipfile.is_zipfile(p):
   with zipfile.ZipFile(p) as z:
    for f in sorted(z.namelist()):
     if f.lower().endswith('.json') and not f.startswith('__MACOSX/'):yield str(p)+'!'+f,lambda f=f,z=z:z.read(f)
  else:yield str(p),lambda p=p:p.read_bytes()

def write_json(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')

def build(paths,output=ROOT/'data',cache=ROOT/'.build'/'corpus.sqlite',sample=False,replace=False,book=None,title=None):
 cache=Path(cache);cache.parent.mkdir(parents=True,exist_ok=True)
 db=sqlite3.connect(cache);db.execute('create table if not exists records (id text primary key, book text, location text unique, payload text, hash text)')
 if replace:db.execute('delete from records')
 stats={'input_files':0,'new_units':0,'updated_units':0,'duplicates':0,'invalid':0,'ignored':0,'errors':[]}
 # Rebuild the incremental cache from deployed shards when a fresh download has no cache.
 if not replace and not db.execute('select count(*) from records').fetchone()[0] and (Path(output)/'manifest.json').exists():
  existing=json.loads((Path(output)/'manifest.json').read_text(encoding='utf8'))
  for b in existing['books']:
   ix=json.loads((Path(output)/b['index']).read_text(encoding='utf8'))
   for shard in sorted({u['shard'] for u in ix['units']}):
    for r in json.loads((Path(output)/shard).read_text(encoding='utf8')).values():
     for e in r['events']:e.pop('v',None)
     payload=json.dumps(r,ensure_ascii=False,separators=(',',':'));digest=hashlib.sha256(payload.encode()).hexdigest()
     db.execute('insert or replace into records values(?,?,?,?,?)',(r['id'],r['book'],r['location'],payload,digest))
  stats['restored_units']=db.execute('select count(*) from records').fetchone()[0]
 for origin,read in inputs(paths):
  stats['input_files']+=1
  try:
   obj=json.loads(read().decode('utf-8-sig'));xs=obj.get('records') if isinstance(obj,dict) and str(obj.get('schema','')).startswith('verse-paths/') else [obj]
   for x in xs:
    if not isinstance(x,dict) or 'location' not in x:stats['ignored']+=1;continue
    r=canonical(x,book,title);r['origin']=origin.split('!')[-1] if '!' in origin else Path(origin).name;payload=json.dumps(r,ensure_ascii=False,separators=(',',':'));digest=hashlib.sha256(payload.encode()).hexdigest();old=db.execute('select hash from records where id=?',(r['id'],)).fetchone()
    if old and old[0]==digest:stats['duplicates']+=1;continue
    stats['updated_units' if old else 'new_units']+=1
    db.execute('insert or replace into records values(?,?,?,?,?)',(r['id'],r['book'],r['location'],payload,digest))
  except Exception as e:
   stats['invalid']+=1
   if len(stats['errors'])<100:stats['errors'].append({'file':origin,'error':str(e)})
 db.commit()
 if not db.execute('select count(*) from records').fetchone()[0]:raise ValueError('No valid units; no website generated.')
 out=Path(output);stage=out.with_name(out.name+'.building')
 if stage.exists():shutil.rmtree(stage)
 stage.mkdir(parents=True)
 verses=[];vid={};books=[];totalevents=0
 for (bid,) in db.execute('select distinct book from records order by book').fetchall():
  units=[];words=collections.defaultdict(list);post=collections.defaultdict(list);textshard={};shard_no=0;shard_bytes=0;network={};book_title='';maxseq=0
  def flush():
   nonlocal textshard,shard_no,shard_bytes
   if textshard:write_json(stage/'texts'/bid/(str(shard_no)+'.json'),textshard);textshard={};shard_no+=1;shard_bytes=0
  rows=db.execute('select payload from records where book=? order by location',(bid,))
  # Natural order preserves numeric unit order without trusting filesystem ordering.
  rs=[json.loads(row[0]) for row in rows];rs.sort(key=lambda r:[int(t) if t.isdigit() else t for t in re.split(r'(\d+)',r['location'])])
  for r in rs:
   book_title=r['bookTitle'];seq=[]
   for i,e in enumerate(r['events']):
    key=e['key']
    if key not in vid:vid[key]=len(verses);verses.append(key)
    seq.append([vid[key],i,len(e['words'])]);e['v']=vid[key]
   idx=len(units);count=collections.Counter(e[0] for e in seq)
   for v,n in count.items():post[str(v)].append([idx,n])
   for w in set(norm(r['text']).split()):words[w].append(idx)
   size=len(json.dumps(r,ensure_ascii=False).encode())
   if shard_bytes+size>180000:flush()
   units.append({'id':r['id'],'label':r['label'],'section':r['section'],'location':r['location'],'seq':seq,'shard':f'texts/{bid}/{shard_no}.json'})
   textshard[r['id']]=r;shard_bytes+=size;maxseq=max(maxseq,len(seq));totalevents+=len(seq)
   for a,b in zip(r['events'],r['events'][1:]):
    k=a['key'].split(':')[0]+'|'+b['key'].split(':')[0]
    if k not in network:network[k]={'count':0,'units':[]}
    network[k]['count']+=1
    if r['id'] not in network[k]['units'] and len(network[k]['units'])<5:network[k]['units'].append(r['id'])
  flush();write_json(stage/'catalogs'/(bid+'.json'),{'id':bid,'units':[{**{k:v for k,v in u.items() if k!='seq'},'sequenceLength':len(u['seq'])} for u in units]});index={'id':bid,'units':units,'postings':post};write_json(stage/'indexes'/(bid+'.json'),index);write_json(stage/'networks'/(bid+'.json'),network)
  buckets=collections.defaultdict(dict)
  for word,ids in words.items():buckets[sum(ord(c) for c in word)%64][word]=ids
  word_paths={}
  for bucket,entries in sorted(buckets.items()):
   path=f'words/{bid}/{bucket}.json';write_json(stage/path,entries);word_paths[str(bucket)]=path
  books.append({'id':bid,'title':book_title,'units':len(units),'events':sum(len(u['seq']) for u in units),'maxSequence':maxseq,'index':'indexes/'+bid+'.json','wordBuckets':word_paths,'network':'networks/'+bid+'.json','indexBytes':(stage/'indexes'/(bid+'.json')).stat().st_size,'catalog':'catalogs/'+bid+'.json'})
 stats['stored_units']=sum(b['units'] for b in books);stats['books']=len(books);stats['events']=totalevents
 version=hashlib.sha256(''.join(row[0] for row in db.execute('select hash from records order by id')).encode()).hexdigest()[:20]
 manifest={'version':version,'schema':'verse-search/3','coverage':'sample' if sample else 'imported-input','completeBibliographicCorpus':False,'books':books,'verses':'verses.json','units':stats['stored_units'],'events':totalevents,'buildReport':'build-report.json'}
 write_json(stage/'manifest.json',manifest);write_json(stage/'verses.json',verses);write_json(stage/'build-report.json',stats)
 if out.exists():shutil.rmtree(out)
 stage.rename(out);db.close();return stats
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',nargs='+',required=True);p.add_argument('--output',type=Path,default=ROOT/'data');p.add_argument('--cache',type=Path,default=ROOT/'.build'/'corpus.sqlite');p.add_argument('--replace',action='store_true',help='Replace the staging corpus instead of adding/updating books.');p.add_argument('--sample',action='store_true');p.add_argument('--book',help='Stable ID for an additional book, if automatic detection is unsuitable.');p.add_argument('--title',help='Display title of that additional book.')
 a=p.parse_args()
 if a.book and not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}',a.book):p.error('--book must contain lowercase ASCII letters, digits and hyphens')
 print(json.dumps(build(a.input,a.output,a.cache,a.sample,a.replace,a.book,a.title),ensure_ascii=False,indent=2))
