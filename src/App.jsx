import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Upload, Trash2, Save, CheckSquare, Square, Edit3, X,
  CheckCircle2, Clock, Cloud, Database, AlertCircle, CheckCircle, LogOut,
  User, ExternalLink, Sparkles, Brain, Loader2, ChevronLeft, RefreshCw, 
  BookOpen, Play, Pause, Volume2, Menu, PenTool, ListTodo, Calendar, Check
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, updateDoc, getDoc
} from 'firebase/firestore';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from 'firebase/auth';

// --- CONFIGURAÇÃO DO TEU FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAvOICZLA1RFRDssU9XSRJhxVEDfp-TavA",
  authDomain: "produtividade-txt.firebaseapp.com",
  projectId: "produtividade-txt",
  storageBucket: "produtividade-txt.firebasestorage.app",
  messagingSenderId: "1008823595372",
  appId: "1:1008823595372:web:e2859447c5323c7062c349"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// CONFIGURAÇÃO DO PROVEDOR GOOGLE COM ESCOPO DE AGENDA
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');

const PROJECT_ID = 'my-txt-manager';

// ATENÇÃO: Para o Vercel, descomente a primeira linha e comente a segunda.
// const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; 
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

const GoogleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

// --- UTILITÁRIO DE ÁUDIO ---
const pcmToWav = (pcmData, sampleRate = 24000) => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const pcmBytes = new Uint8Array(pcmData);
  const wavBytes = new Uint8Array(buffer, 44);
  wavBytes.set(pcmBytes);

  return buffer;
};

// --- UTILITÁRIOS DE AGENDA (.ICS - CORRIGIDO PARA HORA LOCAL) ---
// Formata a data para ICS sem o 'Z' no final para usar "Floating Time" (horário local do dispositivo)
const formatICSDateLocal = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
};

const generateCalendarFile = (events) => {
  let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//TXT Manager//PT\n";
  events.forEach(evt => {
    icsContent += "BEGIN:VEVENT\n";
    icsContent += `SUMMARY:${evt.summary}\n`;
    // Usa formatação local para evitar problemas de fuso
    icsContent += `DTSTART:${formatICSDateLocal(evt.dtStart)}\n`;
    icsContent += `DTEND:${formatICSDateLocal(evt.dtEnd)}\n`;
    icsContent += `DESCRIPTION:Gerado por TXT Manager\n`;
    icsContent += "END:VEVENT\n";
  });
  icsContent += "END:VCALENDAR";
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'tarefas_local.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function App() {
  const [user, setUser] = useState(null);
  const [googleAccessToken, setGoogleAccessToken] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState('editor');
  
  const [currentView, setCurrentView] = useState('files');
  const [aiSummary, setAiSummary] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isExportingCalendar, setIsExportingCalendar] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const [localContent, setLocalContent] = useState('');
  const isTypingRef = useRef(false);

  // Injetor de Estilo
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setFiles([]);
      return;
    }
    const filesRef = collection(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files');
    const unsubscribe = onSnapshot(filesRef, (snapshot) => {
      const filesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = filesData.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setFiles(sorted);
      checkAndTriggerAutoSummary(sorted, true);
    }, (err) => console.error(err));
    return () => unsubscribe();
  }, [user]);

  const activeFile = files.find(f => f.id === activeFileId);

  useEffect(() => {
    if (activeFile && !isTypingRef.current) {
      setLocalContent(activeFile.content || '');
    }
  }, [activeFileId, activeFile?.content]);

  useEffect(() => {
    if (audioUrl && !audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
  }, [audioUrl]);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const checkAndTriggerAutoSummary = async (currentFiles, isInitialLoad = false) => {
    if (currentFiles.length === 0 || !apiKey) return;
    const today = new Date().toLocaleDateString();
    const summaryRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'ai-data', 'last-summary');
    try {
      const docSnap = await getDoc(summaryRef);
      const data = docSnap.exists() ? docSnap.data() : null;
      if (!data || data.date !== today) {
        if (isInitialLoad) generateAISummary(currentFiles, true);
      } else {
        setAiSummary(data.text);
      }
    } catch (e) { console.error("Erro recorrência:", e); }
  };

  const generateAudio = async (text) => {
    if (!text || !apiKey) return;
    setIsGeneratingAudio(true);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setAudioUrl(null);
    setIsPlaying(false);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const audioContent = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioContent) {
        const binaryString = window.atob(audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const wavBuffer = pcmToWav(bytes); 
        const url = URL.createObjectURL(new Blob([wavBuffer], { type: 'audio/wav' }));
        setAudioUrl(url);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setIsPlaying(false);
        audio.play().catch(e => console.error(e));
        setIsPlaying(true);
      }
    } catch (err) { setError(`Erro áudio: ${err.message}`); } 
    finally { setIsGeneratingAudio(false); }
  };

  const generateAISummary = async (filesToAnalyze = files, isAuto = false) => {
    if (filesToAnalyze.length === 0 || !apiKey) return;
    setIsGenerating(true);
    if (!isAuto) setCurrentView('ai-summary');
    setError(null);
    setAudioUrl(null);
    const allContent = filesToAnalyze.map(f => {
      const tasks = f.tasks?.map(t => `[${t.completed ? 'Feito' : 'Pendente'}] ${t.text}`).join(', ') || 'Nenhuma';
      return `Arquivo: ${f.name}\n${f.content}\nTarefas: ${tasks}`;
    }).join('\n---\n');
    const systemPrompt = "Você é um mentor de produtividade. Crie um 'Resumo da Manhã' conciso. Saudação, tópicos principais, pendências urgentes e dica do dia. Use Markdown.";
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `Dados:\n${allContent}\n\nFaça o resumo.` }] }], systemInstruction: { parts: [{ text: systemPrompt }] } })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
      setAiSummary(result);
      await setDoc(doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'ai-data', 'last-summary'), { text: result, date: new Date().toLocaleDateString(), timestamp: Date.now() });
    } catch (err) { if (!isAuto) setError(`Erro IA: ${err.message}`); } 
    finally { setIsGenerating(false); }
  };

  const handleSidebarSummaryClick = () => {
    if (aiSummary) setCurrentView('ai-summary');
    else generateAISummary(files, false);
    setIsSidebarOpen(false);
  };

  const handleExportToCalendar = async () => {
    if (!apiKey) { setError("Erro: Chave de API necessária."); return; }
    
    const tasksToProcess = [];
    files.forEach(f => f.tasks?.forEach(t => !t.completed && tasksToProcess.push(t.text)));
    if (tasksToProcess.length === 0) { setError("Nenhuma tarefa pendente para exportar."); return; }

    setIsExportingCalendar(true);
    setError(null);
    setSuccessMsg(null);

    // Prompt ajustado para corrigir fuso horário
    // Passamos a data completa do sistema local para a IA ter referência exata do fuso.
    const nowLocal = new Date().toString(); // Ex: "Sun Dec 21 2025 03:25:00 GMT-0300 (Brasilia Standard Time)"
    
    const systemPrompt = `Você é um assistente de agendamento.
    Data/Hora atual do usuário (com fuso): ${nowLocal}.
    
    Analise as tarefas. Identifique a intenção de data e hora.
    Regras de Fuso Horário (CRÍTICO):
    1. Retorne as datas no formato ISO 8601 COM O OFFSET DE FUSO CORRETO baseado na data atual fornecida acima (ex: -03:00 para Brasil).
    2. NÃO converta para UTC (Z). Mantenha o horário local da intenção do usuário.
    3. Exemplo: Se o usuário diz "às 15h" e o fuso é -03:00, retorne "...T15:00:00-03:00".

    Regras de Negócio:
    - Se tiver duração (ex: '2h'), calcule o fim.
    - Se não tiver duração, assuma 1h.
    - Se for prazo ('até 10h'), início é agora e fim é o prazo.
    
    Retorne JSON Array: { "summary": "Título", "dtStart": "ISO String com Offset", "dtEnd": "ISO String com Offset" }.
    Ignore tarefas sem tempo.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Tarefas:\n${tasksToProcess.join('\n')}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const events = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);

      if (!events || events.length === 0) {
        setError("Nenhuma tarefa com horário encontrada pela IA.");
      } else {
        if (googleAccessToken) {
          let addedCount = 0;
          for (const evt of events) {
             try {
               await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                 method: 'POST',
                 headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                   summary: evt.summary,
                   start: { dateTime: evt.dtStart }, // Envia com offset, Google entende
                   end: { dateTime: evt.dtEnd }
                 })
               });
               addedCount++;
             } catch (e) { console.error("Falha API Calendar:", e); }
          }
          setSuccessMsg(`${addedCount} eventos adicionados ao seu Google Calendar!`);
        } else {
          // Fallback ICS com correção local
          generateCalendarFile(events);
          setSuccessMsg("Arquivo de agenda gerado! Importe-o no Google Calendar.");
        }
      }
    } catch (err) { setError(`Erro exportação: ${err.message}`); } 
    finally { setIsExportingCalendar(false); setIsSidebarOpen(false); setTimeout(() => setSuccessMsg(null), 5000); }
  };

  const handleLogin = async () => {
    try { 
      setError(null); 
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential) setGoogleAccessToken(credential.accessToken);
    } 
    catch (err) { setError(err.message); }
  };

  const handleLogout = () => signOut(auth).then(() => { setActiveFileId(null); setCurrentView('files'); setAiSummary(null); setAudioUrl(null); setGoogleAccessToken(null); });

  const createNewFile = async (name) => {
    if (!user || !name) return;
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', id), {
      name: name.endsWith('.txt') ? name : `${name}.txt`, content: "", tasks: [], createdAt: Date.now(), updatedAt: Date.now()
    });
    setActiveFileId(id); setShowNewFileDialog(false); setNewFileName(''); setCurrentView('files'); setIsSidebarOpen(false);
  };
  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const r = new FileReader(); r.onload = (ev) => createNewFile(file.name, ev.target.result); r.readAsText(file); e.target.value = null;
  };
  const updateFileContent = async (c) => { 
    if (!user || !activeFileId) return; setLocalContent(c); 
    await updateDoc(doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId), { content: c, updatedAt: Date.now() }); 
  };
  const deleteFile = async (id) => { await deleteDoc(doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', id)); if(activeFileId === id) setActiveFileId(null); };
  const addTask = async () => { if(!newTaskText.trim()) return; await updateDoc(doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId), { tasks: [...(activeFile.tasks||[]), { id: crypto.randomUUID(), text: newTaskText, completed: false }] }); setNewTaskText(''); };
  const toggleTask = async (id) => { await updateDoc(doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId), { tasks: activeFile.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t) }); };
  const removeTask = async (id) => { await updateDoc(doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId), { tasks: activeFile.tasks.filter(t => t.id !== id) }); };
  const calculateProgress = (f) => (!f.tasks || f.tasks.length === 0) ? 0 : Math.round((f.tasks.filter(t => t.completed).length / f.tasks.length) * 100);

  if (isLoadingAuth) return <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', position: 'fixed', inset: 0 }}><Loader2 className="animate-spin text-indigo-600" /></div>;

  if (!user) return (
    <div className="bg-slate-50 font-sans" style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'fixed', inset: 0, backgroundColor: '#f8fafc' }}>
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-12 text-center border border-slate-100 animate-in fade-in zoom-in duration-500" style={{ borderRadius: '3rem', padding: '3rem', maxWidth: '28rem', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', backgroundColor: 'white' }}>
        <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3" style={{ width: '6rem', height: '6rem', backgroundColor: '#4f46e5', borderRadius: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto' }}><FileText size={48} color="white" /></div>
        <h1 className="text-4xl font-black text-slate-800 mb-4 tracking-tight" style={{ fontSize: '2.25rem', fontWeight: 900, marginBottom: '1rem', color: '#1e293b' }}>TXT Manager</h1>
        <p className="text-slate-500 mb-10 text-lg" style={{ color: '#64748b', marginBottom: '2.5rem', fontSize: '1.125rem', lineHeight: 1.625 }}>Organize suas notas e tarefas em qualquer lugar com segurança total.</p>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs mb-6 text-left border border-red-100 flex gap-2" style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '1rem', borderRadius: '1rem', marginBottom: '1.5rem', textAlign: 'left', border: '1px solid #fee2e2', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertCircle size={14} /><span>{error}</span>
          </div>
        )}

        <button onClick={handleLogin} className="w-full flex items-center justify-center gap-4 bg-white border-2 border-slate-200 py-4 px-6 rounded-2xl font-bold hover:border-indigo-600 transition-all shadow-md active:scale-95 group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', width: '100%', padding: '1rem 1.5rem', backgroundColor: 'white', border: '2px solid #e2e8f0', borderRadius: '1rem', cursor: 'pointer' }}>
          <GoogleIcon /> <span style={{ color: '#334155', fontWeight: 'bold', fontSize: '16px' }}>Entrar com conta Google</span>
        </button>

        <p className="mt-8 text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]" style={{ marginTop: '2rem', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 900, color: '#94a3b8' }}>Acesso Multi-usuário</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden fixed inset-0">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 flex flex-col shadow-2xl transition-transform duration-300 md:relative md:translate-x-0 md:shadow-sm md:w-80 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
          <img src={user.photoURL} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
          <div className="flex-1 overflow-hidden"><h1 className="text-sm font-bold truncate">{user.displayName}</h1><button onClick={handleLogout} className="text-[10px] text-red-500 font-bold uppercase tracking-widest hover:underline">Sair</button></div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-2 border-b border-slate-50">
          <button onClick={handleSidebarSummaryClick} disabled={files.length === 0 || isGenerating} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold transition-all shadow-lg active:scale-95 bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:scale-[1.02]">
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : (aiSummary ? <BookOpen size={18} /> : <Sparkles size={18} />)}
            {isGenerating ? "Gerando..." : (aiSummary ? "Ver Resumo do Dia" : "Resumo do Dia (IA)")}
          </button>
          <button onClick={handleExportToCalendar} disabled={isExportingCalendar} className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-all text-sm shadow-md active:scale-95">
            {isExportingCalendar ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />} {isExportingCalendar ? "Processando..." : "Carregar na Agenda"}
          </button>
          <button onClick={() => setShowNewFileDialog(true)} className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-100 transition-all text-sm"><Plus size={18} /> Novo Documento</button>
          <label className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-500 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs cursor-pointer"><Upload size={14} /> Importar .txt<input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" /></label>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 pt-0 space-y-1 custom-scrollbar">
          <div className="text-[10px] font-black text-slate-400 px-2 py-4 uppercase tracking-widest flex justify-between"><span>Meus Ficheiros</span><span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">{files.length}</span></div>
          {files.map(file => (
            <div key={file.id} onClick={() => { setActiveFileId(file.id); setCurrentView('files'); setIsSidebarOpen(false); }} className={`group flex flex-col p-3 rounded-xl cursor-pointer transition-all ${activeFileId === file.id && currentView === 'files' ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}>
              <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-3 overflow-hidden"><FileText size={18} /><span className="truncate font-medium text-sm">{file.name}</span></div><button onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }} className="opacity-0 group-hover:opacity-100 hover:text-red-500"><Trash2 size={14} /></button></div>
              {file.tasks?.length > 0 && <div className="flex items-center gap-2"><div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-indigo-400" style={{ width: `${calculateProgress(file)}%` }} /></div><span className="text-[8px] font-bold opacity-60">{calculateProgress(file)}%</span></div>}
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
        <div className="md:hidden absolute top-4 left-4 z-30"><button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white rounded-xl shadow-md border border-slate-100 text-slate-600"><Menu size={24} /></button></div>
        {successMsg && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl shadow-xl border border-emerald-100 flex items-center gap-3"><Check size={18} /><span className="text-sm font-bold">{successMsg}</span></div>}
        {error && <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-50 text-red-600 px-6 py-3 rounded-2xl shadow-xl border border-red-100 flex gap-3"><AlertCircle size={18} /><span className="text-xs md:text-sm font-bold">{error}</span><button onClick={() => setError(null)}><X size={14}/></button></div>}

        {currentView === 'ai-summary' ? (
          <div className="flex-1 overflow-hidden p-4 md:p-12 bg-indigo-50/10 flex justify-center h-full pt-16 md:pt-12">
            <div className="max-w-4xl w-full bg-white rounded-[2rem] md:rounded-[3rem] shadow-xl border border-indigo-50 flex flex-col h-full overflow-hidden">
              <div className="p-6 md:p-12 pb-6 border-b border-indigo-50 shrink-0">
                <button onClick={() => setCurrentView('files')} className="mb-6 flex items-center gap-2 text-indigo-600 font-bold hover:-translate-x-1 text-sm"><ChevronLeft size={18} /> Voltar para Arquivos</button>
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="flex items-center gap-4"><div className="w-12 h-12 md:w-20 md:h-20 bg-indigo-600 text-white rounded-2xl md:rounded-[2rem] flex items-center justify-center shadow-xl -rotate-3"><Brain size={24} className="md:w-10 md:h-10" /></div><div><h2 className="text-xl md:text-3xl font-black text-slate-800">Resumo do Dia</h2><p className="text-slate-400 font-medium italic mt-1 text-xs md:text-base">Análise inteligente automatizada</p></div></div>
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {audioUrl && <button onClick={toggleAudio} disabled={isGeneratingAudio} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${isPlaying ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>{isPlaying ? <><Pause size={14} /> Pausar</> : <><Volume2 size={14} /> Ouvir</>}</button>}
                    {!audioUrl && aiSummary && <button onClick={() => generateAudio(aiSummary)} disabled={isGeneratingAudio} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold">{isGeneratingAudio ? "Criando..." : "Criar Áudio"}</button>}
                    <button onClick={() => generateAISummary(files, true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold"><RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} /> Regenerar</button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-12 pt-6 custom-scrollbar">
                {isGenerating ? <div className="space-y-8 py-4"><div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse"></div><div className="h-64 bg-slate-50 rounded animate-pulse"></div></div> : aiSummary ? <div className="prose prose-indigo max-w-none text-slate-700 font-sans bg-indigo-50/20 p-6 md:p-10 rounded-[2rem] border border-indigo-100/50 whitespace-pre-wrap text-sm md:text-base">{aiSummary}</div> : <div className="text-center py-32"><p className="text-slate-400">Nada para mostrar.</p></div>}
              </div>
            </div>
          </div>
        ) : activeFile ? (
          <>
            <header className="h-20 border-b border-slate-100 px-4 md:px-8 flex items-center justify-between bg-white/80 backdrop-blur-md shadow-sm z-10 shrink-0 pl-16 md:pl-8">
              <div className="flex flex-col overflow-hidden mr-2">
                <div className="flex items-center gap-3"><h2 className="text-lg md:text-xl font-bold text-slate-800 truncate">{activeFile.name}</h2><span className="hidden md:flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded text-[10px] text-emerald-700 font-black uppercase tracking-tighter border border-emerald-100"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>Sincronizado</span></div>
                <div className="flex items-center gap-3 mt-1.5"><div className="w-16 md:w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-1000 ease-out" style={{ width: `${calculateProgress(activeFile)}%` }} /></div><span className="text-[8px] md:text-[10px] font-black text-indigo-600 uppercase tracking-widest">{calculateProgress(activeFile)}%</span></div>
              </div>
              <button onClick={() => setIsEditing(!isEditing)} className={`flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition-all shadow-md active:scale-95 ${isEditing ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{isEditing ? <><Save size={16}/> <span className="hidden md:inline">Salvar</span></> : <><Edit3 size={16}/> <span className="hidden md:inline">Editar</span></>}</button>
            </header>
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden h-full">
              <div className={`flex-1 p-4 md:p-8 overflow-hidden flex flex-col bg-white ${activeMobileTab === 'editor' ? 'flex' : 'hidden md:flex'}`}>
                {/* INDICADOR DE EDITANDO REINSERIDO AQUI */}
                <div className="mb-4 flex justify-between items-center shrink-0">
                  <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Editor</h3>
                  {isEditing && <span className="text-[10px] font-black text-amber-500 animate-pulse tracking-widest bg-amber-50 px-2 py-1 rounded">MODO DE EDIÇÃO</span>}
                </div>
                {isEditing ? <textarea className="flex-1 p-4 md:p-8 border border-slate-100 rounded-[2rem] bg-slate-50/50 font-mono text-sm leading-relaxed outline-none focus:ring-4 focus:ring-indigo-50 transition-all resize-none shadow-inner" value={localContent} onFocus={() => isTypingRef.current = true} onBlur={() => isTypingRef.current = false} onChange={(e) => updateFileContent(e.target.value)} /> : <div className="flex-1 p-6 md:p-10 bg-slate-50/30 rounded-[2rem] md:rounded-[3rem] overflow-y-auto border border-slate-100 whitespace-pre-wrap text-slate-700 font-mono text-sm leading-relaxed shadow-inner custom-scrollbar">{activeFile.content || <span className="text-slate-300 italic opacity-50">Documento vazio.</span>}</div>}
              </div>
              <div className={`w-full md:w-96 bg-slate-50/50 p-6 md:p-8 flex-col overflow-hidden border-t md:border-t-0 md:border-l border-slate-100 ${activeMobileTab === 'tasks' ? 'flex' : 'hidden md:flex'}`}>
                <div className="mb-4 md:mb-8 shrink-0"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Tarefas</h3><div className="flex gap-2"><input type="text" className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Nova tarefa..." value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} /><button onClick={addTask} className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-lg active:scale-95"><Plus size={20} /></button></div></div>
                <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">{activeFile.tasks?.map(task => (<div key={task.id} className={`group flex items-center gap-3 p-3 md:p-4 rounded-2xl border ${task.completed ? 'bg-emerald-50/40 border-emerald-100 text-slate-400' : 'bg-white border-slate-200'}`}><button onClick={() => toggleTask(task.id)} className="shrink-0">{task.completed ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Square size={20} className="text-slate-200 group-hover:text-indigo-400" />}</button><span className={`text-sm flex-1 ${task.completed ? 'line-through opacity-60' : ''}`}>{task.text}</span><button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100"><X size={14} /></button></div>))}</div>
              </div>
              <div className="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 bg-white shadow-2xl border border-slate-200 rounded-full p-1.5 flex items-center gap-1 z-50">
                <button onClick={() => setActiveMobileTab('editor')} className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold transition-all ${activeMobileTab === 'editor' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><PenTool size={16} /> Editor</button>
                <button onClick={() => setActiveMobileTab('tasks')} className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold transition-all ${activeMobileTab === 'tasks' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><ListTodo size={16} /> Tarefas {activeFile.tasks?.filter(t => !t.completed).length > 0 && <span className="bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full ml-1">{activeFile.tasks.filter(t => !t.completed).length}</span>}</button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 md:p-12 text-center bg-slate-50/20 h-full w-full overflow-hidden pt-16 md:pt-0">
            <div className="w-24 h-24 bg-white rounded-[3rem] flex items-center justify-center mb-6 shadow-xl shadow-slate-200/50 rotate-3 border border-slate-100"><Cloud size={48} className="text-indigo-500 group-hover:scale-110" /></div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Olá, {user.displayName?.split(' ')[0]}!</h2>
            <p className="max-w-xs text-slate-500 text-sm font-medium">Seus documentos estão seguros.</p>
          </div>
        )}
      </main>

      {showNewFileDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[3rem] p-8 md:p-12 w-full max-w-md shadow-2xl border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 mb-6 text-center">Criar Novo TXT</h3>
            <input autoFocus type="text" className="w-full px-6 py-4 md:py-5 bg-slate-50 border border-slate-200 rounded-3xl text-lg outline-none mb-8 focus:ring-4 focus:ring-indigo-100" placeholder="Nome..." value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createNewFile(newFileName)} />
            <div className="flex gap-4"><button onClick={() => setShowNewFileDialog(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl">Cancelar</button><button onClick={() => createNewFile(newFileName)} className="flex-1 py-4 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-2xl shadow-xl active:scale-95">Criar</button></div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `html, body, #root { height: 100vh !important; width: 100vw !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; position: fixed !important; top: 0; left: 0; } .custom-scrollbar::-webkit-scrollbar { width: 5px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; } .break-words { overflow-wrap: break-word; }`}} />
    </div>
  );
}
