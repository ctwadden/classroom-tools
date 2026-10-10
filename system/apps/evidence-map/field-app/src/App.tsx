import React, {useEffect, useState, useRef} from 'react';
import {ClassroomFieldCapture} from './components/ClassroomFieldCapture';
import {EvidenceLogSync} from './components/EvidenceLogSync';
import {RubricExplorer} from './components/RubricExplorer';
import {evidenceBridge, BridgeStatus} from './utils/evidenceBridge';
import {getPendingEvents, setSetting} from './utils/indexedDb';
import {CourseId} from './types/evidenceContract';

const grantKey='em_field_session_until';
export default function App() {
  const authSequence=useRef(0);
  const [tab,setTab]=useState('capture');
  const [status,setStatus]=useState<BridgeStatus|null>(null);
  const [accessKey,setAccessKey]=useState('');
  const [message,setMessage]=useState('Checking your Evidence Map sign-in…');
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState(0);
  const [captureKey,setCaptureKey]=useState(0);
  const lock=()=>{++authSequence.current;sessionStorage.removeItem(grantKey);setStatus(null);setAccessKey('');setMessage('Sign in with your Evidence Map teacher access key.');};
  async function check() {
    if(sessionStorage.getItem('em_field_locked')){lock();return;}
    const sequence=++authSequence.current;
    const result=await evidenceBridge.checkStatus();
    if(sequence!==authSequence.current)return;
    if(result.authenticated && result.role==='teacher') {
      if(result.expiresAt) sessionStorage.setItem(grantKey,String(result.expiresAt));
      setStatus(result);setMessage('');
    } else if(!result.online && Number(sessionStorage.getItem(grantKey))>Date.now()) {
      setStatus({...result,authenticated:true,role:'teacher'});
      setMessage('Offline: using your downloaded class and rubric records. New captures stay on this device until the server acknowledges them.');
    } else {lock(); if(!result.online)setMessage('Reconnect to sign in. Unsent captures are retained on this device.');}
  }
  async function refreshPending(){setPending((await getPendingEvents()).length);}
  useEffect(()=>{
    check();
    const storage=(e:StorageEvent)=>{if(e.key==='em_teacher_signed_out'){sessionStorage.setItem('em_field_locked','1');lock();}};
    const online=async()=>{await check();await evidenceBridge.syncPendingQueue();await refreshPending();};
    const focus=()=>check();
    window.addEventListener('em-field-updated',refreshPending);window.addEventListener('em-auth-required',lock);window.addEventListener('storage',storage);
    window.addEventListener('online',online);window.addEventListener('offline',focus);window.addEventListener('focus',focus);
    const timer=setInterval(check,60000);
    return()=>{clearInterval(timer);window.removeEventListener('em-field-updated',refreshPending);window.removeEventListener('em-auth-required',lock);window.removeEventListener('storage',storage);window.removeEventListener('online',online);window.removeEventListener('offline',focus);window.removeEventListener('focus',focus);};
  },[]);
  useEffect(()=>{if(status?.authenticated)refreshPending();},[status?.authenticated]);
  async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);const r=await evidenceBridge.login(accessKey);setAccessKey('');if(r.ok){sessionStorage.removeItem('em_field_locked');await check();}else setMessage(r.error||'Sign-in failed.');setBusy(false);}
  async function signOut(){sessionStorage.setItem('em_field_locked','1');lock();localStorage.setItem('em_teacher_signed_out',String(Date.now()));try{await evidenceBridge.logout();}catch{setMessage('Device locked. Reconnect to finish signing out of the server.');}}
  async function useRubric(id:string,course:CourseId){await setSetting('active_course',course);await setSetting('active_rubric',id);setCaptureKey(k=>k+1);setTab('capture');}
  return <div className="min-h-screen bg-slate-100 text-slate-900">
    <header className="bg-[#0f1b33] text-white px-4 sm:px-7 py-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-teal-300 uppercase tracking-wider">Evidence Map companion</p><h1 className="text-xl font-bold">AssessTrack · Field capture</h1></div><a className="rounded-xl border border-slate-500 px-4 py-3 text-sm" href="/connected.html">Open main dashboard ↗</a></div>
      {status?.authenticated && <nav className="max-w-7xl mx-auto flex flex-wrap gap-2 mt-4" aria-label="Field views">
        {[['capture','Capture O / C / P'],['rubrics','Rubric library'],['sync',`Saved & pending (${pending})`]].map(([id,label])=><button className={`px-4 py-3 rounded-xl text-sm font-bold ${tab===id?'bg-white text-slate-900':'bg-slate-700'}`} key={id} onClick={()=>setTab(id)} aria-current={tab===id?'page':undefined}>{label}</button>)}
        <button onClick={signOut} className="px-4 py-3 text-sm ml-auto">Sign out</button>
      </nav>}
    </header>
    {!status?.authenticated ? <main className="max-w-xl mx-auto p-5"><form onSubmit={signIn} className="bg-white rounded-2xl p-6 space-y-4 border border-slate-200 mt-8"><h2 className="text-xl font-bold">Your real classes, in the field.</h2><p className="text-sm">This companion shares the dashboard’s teacher sign-in, Google roster and approved rubric versions.</p><p role="status" className="text-sm text-indigo-800">{message}</p><label className="block text-sm font-bold" htmlFor="field-key">Teacher access key</label><input id="field-key" type="password" autoComplete="current-password" required value={accessKey} onChange={e=>setAccessKey(e.target.value)} className="w-full border rounded-xl p-3"/><p className="text-xs text-slate-600">Use the private Evidence Map key supplied during setup. This is separate from your Google password and Gemini API key.</p><button disabled={busy} className="bg-indigo-600 text-white font-bold px-5 py-3 rounded-xl">{busy?'Signing in…':'Sign in'}</button></form></main> : <main>
      {message&&<p className="max-w-7xl mx-auto m-4 p-3 bg-amber-50 border border-amber-200 rounded-xl" role="status">{message}</p>}
      {tab==='capture'&&<ClassroomFieldCapture key={captureKey} onCaptureSaved={refreshPending} onNavigateToSync={()=>setTab('sync')}/>}
      {tab==='rubrics'&&<RubricExplorer onSelectRubricForCapture={useRubric}/>}
      {tab==='sync'&&<EvidenceLogSync onNavigateToCapture={()=>setTab('capture')}/>}
    </main>}
    <footer className="max-w-7xl mx-auto p-5 text-xs text-slate-600">On iPad, open this page in Safari, then Share → Add to Home Screen. Outcome judgments and reporting comments remain teacher-confirmed in the main dashboard.</footer>
  </div>;
}
