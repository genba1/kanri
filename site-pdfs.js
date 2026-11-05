// V79: 現場カードとアーカイブで共通のPDF一覧。
const SITE_PDFS={siteId:null,files:[],canManage:false,busy:false,sequence:0,viewSequence:0,url:null,returnFocus:null};
function sitePdfButton(siteId){
  return `<button type="button" class="btn btn-white btn-sm" style="border:1px solid #90CDF4;color:#1F4E79;" data-site-id="${htmlText(siteId)}" onclick="event.stopPropagation();openSitePdfs(this.dataset.siteId)">📄 PDF一覧</button>`;
}
function pdfElement(id){return document.getElementById(id);}
function pdfStatus(message,error=false){const el=pdfElement('site-pdf-status');el.textContent=message;el.style.color=error?'#C53030':'#4A5568';}
function releasePdfPreview(){
  SITE_PDFS.viewSequence++;
  pdfElement('site-pdf-preview').replaceChildren();
  if(SITE_PDFS.url)URL.revokeObjectURL(SITE_PDFS.url);
  SITE_PDFS.url=null;
}
function closeSitePdfs(){
  if(SITE_PDFS.busy)return;
  SITE_PDFS.sequence++;releasePdfPreview();SITE_PDFS.siteId=null;
  pdfElement('sitePdfModal').classList.remove('show');
  SITE_PDFS.returnFocus?.focus();
}
async function openSitePdfs(siteId){
  if(SITE_PDFS.busy)return;
  SITE_PDFS.returnFocus=document.activeElement;
  SITE_PDFS.sequence++;releasePdfPreview();
  SITE_PDFS.siteId=siteId;SITE_PDFS.files=[];SITE_PDFS.canManage=false;
  const site=[...SITES,...ARCHIVES].find(s=>s.id===siteId);
  pdfElement('site-pdf-title').textContent='📄 PDF一覧：'+(site?.name||siteId);
  pdfElement('site-pdf-input').value='';
  pdfElement('site-pdf-list').replaceChildren();
  pdfElement('site-pdf-upload').hidden=true;
  pdfElement('sitePdfModal').classList.add('show');
  pdfElement('site-pdf-close').focus();
  await loadSitePdfs();
}
async function loadSitePdfs(){
  const siteId=SITE_PDFS.siteId,seq=SITE_PDFS.sequence;
  pdfStatus('PDF一覧を読み込んでいます…');
  try{
    const result=await PILOT.request('/sites/'+encodeURIComponent(siteId)+'/pdfs');
    if(seq!==SITE_PDFS.sequence)return;
    if(!Array.isArray(result.files))throw new Error('PDF一覧の形式を確認できません。');
    SITE_PDFS.files=result.files;SITE_PDFS.canManage=result.canManage===true;
    renderSitePdfs();
    pdfStatus(result.files.length+'件'+(SITE_PDFS.canManage?'':' ／ 閲覧のみ。アーカイブの追加・削除は社長アカウントで操作できます。'));
  }catch(e){if(seq===SITE_PDFS.sequence){SITE_PDFS.canManage=false;pdfElement('site-pdf-upload').hidden=true;pdfStatus('一覧を取得できません。「再読込」で再試行してください：'+e.message,true);}}
}
function renderSitePdfs(){
  pdfElement('site-pdf-upload').hidden=!SITE_PDFS.canManage;
  const box=pdfElement('site-pdf-list');box.replaceChildren();
  if(!SITE_PDFS.files.length){box.textContent='この現場にはPDFがありません。';return;}
  SITE_PDFS.files.forEach(file=>{
    const row=document.createElement('div');row.className='site-pdf-row';
    const info=document.createElement('div');info.style.cssText='flex:1;min-width:0;overflow-wrap:anywhere;';
    const name=document.createElement('div');name.textContent=file.original_name||'図面.pdf';
    const meta=document.createElement('small');meta.textContent=bytesLabel(Number(file.bytes))+' ／ 登録日 '+String(file.created_at||'').slice(0,10);
    info.append(name,meta);row.append(info);
    const open=document.createElement('button');open.type='button';open.className='btn btn-white btn-sm';open.textContent='開く';open.disabled=SITE_PDFS.busy;open.onclick=()=>viewSitePdf(file);row.append(open);
    if(SITE_PDFS.canManage){
      const del=document.createElement('button');del.type='button';del.className='btn btn-white btn-sm';del.textContent='削除';del.style.color='#C53030';del.disabled=SITE_PDFS.busy;del.onclick=()=>deleteSitePdf(file);row.append(del);
    }
    box.append(row);
  });
}
function pdfBusy(busy){
  SITE_PDFS.busy=busy;
  ['site-pdf-input','site-pdf-close','site-pdf-refresh','site-pdf-add'].forEach(id=>pdfElement(id).disabled=busy);
  renderSitePdfs();
}
async function addSitePdfs(){
  if(SITE_PDFS.busy||!SITE_PDFS.canManage)return;
  const files=Array.from(pdfElement('site-pdf-input').files||[]);
  if(!files.length){pdfStatus('追加するPDFを選んでください。',true);return;}
  if(files.some(f=>!f.name.toLowerCase().endsWith('.pdf')||f.size<1||f.size>20*1024*1024)){pdfStatus('PDFは1ファイル20MB以下で、空ではないものを選んでください。',true);return;}
  pdfBusy(true);releasePdfPreview();
  let saved=0,error='';
  try{
    for(const file of files){
      pdfStatus('PDFを追加しています… '+(saved+1)+' / '+files.length);
      const form=new FormData();form.append('pdf',file);
      await PILOT.request('/sites/'+encodeURIComponent(SITE_PDFS.siteId)+'/pdfs',{method:'POST',body:form});
      saved++;
    }
  }catch(e){error=e.message;}
  finally{
    // 成功済みを選択から外し、部分失敗でも再送による重複を防ぐ。
    pdfElement('site-pdf-input').value='';
    await loadSitePdfs();pdfBusy(false);
    pdfStatus(error?saved+'件追加済み。残りは未完了です：'+error+'。一覧を確認して未追加分だけ選び直してください。':saved+'件のPDFを追加しました。',!!error);
    if(saved&&ARCHIVES.some(s=>s.id===SITE_PDFS.siteId))toggleArchiveDocuments(SITE_PDFS.siteId);
  }
}
async function deleteSitePdf(file){
  if(SITE_PDFS.busy||!SITE_PDFS.canManage)return;
  if(!confirm('このPDFを削除しますか？\n'+file.original_name+'\n現場カードとアーカイブの両方から削除されます。'))return;
  pdfBusy(true);releasePdfPreview();let error='';
  try{await PILOT.request('/sites/'+encodeURIComponent(SITE_PDFS.siteId)+'/pdfs/'+encodeURIComponent(file.id),{method:'DELETE'});}
  catch(e){error=e.message;}
  finally{
    await loadSitePdfs();pdfBusy(false);
    pdfStatus(error?'削除を確認できません：'+error+'。一覧を確認してください。':'PDFを削除しました。',!!error);
    if(!error&&ARCHIVES.some(s=>s.id===SITE_PDFS.siteId))toggleArchiveDocuments(SITE_PDFS.siteId);
  }
}
async function viewSitePdf(file){
  releasePdfPreview();const seq=SITE_PDFS.sequence,viewSeq=SITE_PDFS.viewSequence;
  const box=pdfElement('site-pdf-preview');box.textContent='PDFを読み込んでいます…';
  try{
    const blob=await PILOT.documentBlob(file.id);
    if(seq!==SITE_PDFS.sequence||viewSeq!==SITE_PDFS.viewSequence)return;
    const url=URL.createObjectURL(new Blob([blob],{type:'application/pdf'}));SITE_PDFS.url=url;
    const name=document.createElement('p');name.textContent=file.original_name;
    const download=document.createElement('a');download.href=url;download.download=file.original_name||'図面.pdf';download.textContent='PDFをダウンロード';download.className='btn btn-white btn-sm';
    const hint=document.createElement('p');hint.textContent='表示できない端末では、ダウンロードして開いてください。';hint.style.fontSize='12px';
    const frame=document.createElement('iframe');frame.title=file.original_name||'PDFプレビュー';frame.src=url;frame.style.cssText='width:100%;height:55vh;border:1px solid #CBD5E0;';
    box.replaceChildren(name,download,hint,frame);
  }catch(e){if(seq===SITE_PDFS.sequence&&viewSeq===SITE_PDFS.viewSequence)box.textContent='PDFを開けません：'+e.message;}
}
document.getElementById('sitePdfModal').addEventListener('click',e=>{if(e.target.id==='sitePdfModal')closeSitePdfs();});
document.addEventListener('keydown',e=>{
  const modal=pdfElement('sitePdfModal');if(!modal.classList.contains('show'))return;
  if(e.key==='Escape'){e.preventDefault();closeSitePdfs();}
  if(e.key==='Tab'){
    const items=Array.from(modal.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],iframe')).filter(el=>el.getClientRects().length);
    const first=items[0],last=items[items.length-1];
    if(first&&e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(last&&!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});
