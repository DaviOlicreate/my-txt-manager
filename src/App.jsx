import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Upload, Trash2, Save, CheckSquare, Square, Edit3, X,
  CheckCircle2, Clock, Cloud, Database, AlertCircle, CheckCircle, LogOut,
  User, ExternalLink, Sparkles, Brain, Loader2, ChevronLeft, RefreshCw, 
  BookOpen, Play, Pause, Volume2
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
const googleProvider = new GoogleAuthProvider();
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

export default function App() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [error, setError] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // Estados de IA e Áudio
  const [currentView, setCurrentView] = useState('files');
  const [aiSummary, setAiSummary] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
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
    }, (err) => {
      console.error(err);
    });

    return () => unsubscribe();
  }, [user]);

  const activeFile = files.find(f => f.id === activeFileId);

  useEffect(() => {
    if (activeFile && !isTypingRef.current) {
      setLocalContent(activeFile.content || '');
    }
  }, [activeFileId, activeFile?.content]);

  // Player de Áudio
  useEffect(() => {
    if (audioUrl && !audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
  }, [audioUrl]);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
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
        if (isInitialLoad) {
           generateAISummary(currentFiles, true);
        }
      } else {
        setAiSummary(data.text);
      }
    } catch (e) {
      console.error("Erro ao verificar recorrência:", e);
    }
  };

  const generateAudio = async (text) => {
    if (!text) return;
    if (!apiKey) {
      setError("Erro: Chave de API não configurada. Verifique o código.");
      return;
    }
    
    setIsGeneratingAudio(true);
    setError(null);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioUrl(null);
    setIsPlaying(false);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Kore"
                }
              }
            }
          }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const audioContent = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioContent) {
        const binaryString = window.atob(audioContent);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes.buffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        // Toca automaticamente quando pronto
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setIsPlaying(false);
        audio.play();
        setIsPlaying(true);
      } else {
        throw new Error("Áudio não gerado.");
      }

    } catch (err) {
      console.error(err);
      setError(`Erro ao gerar áudio: ${err.message}`);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const generateAISummary = async (filesToAnalyze = files, isAuto = false) => {
    if (filesToAnalyze.length === 0) return;
    setIsGenerating(true);
    if (!isAuto) setCurrentView('ai-summary');
    setError(null);
    setAudioUrl(null);

    const allContent = filesToAnalyze.map(f => {
      const tasks = f.tasks?.map(t => `[${t.completed ? 'Concluído' : 'Pendente'}] ${t.text}`).join(', ') || 'Sem tarefas';
      return `Arquivo: ${f.name}\nConteúdo: ${f.content}\nTarefas: ${tasks}`;
    }).join('\n\n---\n\n');

    const systemPrompt = "Você é um mentor de produtividade. Analise os arquivos e tarefas e crie um 'Resumo da Manhã'. 1. Comece com uma saudação. 2. Liste os tópicos principais. 3. Destaque pendências urgentes. 4. Dê uma dica para o dia. Use Markdown. Seja conciso para leitura em voz alta.";
    const userQuery = `Aqui estão meus dados:\n\n${allContent}\n\nFaça meu resumo matinal.`;

    try {
      if (!apiKey) throw new Error("API Key não encontrada.");
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
      setAiSummary(result);

      const summaryRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'ai-data', 'last-summary');
      await setDoc(summaryRef, {
        text: result,
        date: new Date().toLocaleDateString(),
        timestamp: Date.now()
      });

    } catch (err) {
      console.error(err);
      if (!isAuto) setError(`Erro na IA: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSidebarSummaryClick = () => {
    if (aiSummary) {
      setCurrentView('ai-summary');
    } else {
      generateAISummary(files, false);
    }
  };

  const handleLogin = async () => {
    try { setError(null); await signInWithPopup(auth, googleProvider); } 
    catch (err) { setError(err.message); }
  };

  const handleLogout = () => signOut(auth).then(() => { setActiveFileId(null); setCurrentView('files'); setAiSummary(null); setAudioUrl(null); });

  const createNewFile = async (name, content = "") => {
    if (!user || !name) return;
    const fileId = crypto.randomUUID();
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', fileId);
    await setDoc(fileRef, {
      name: name.endsWith('.txt') ? name : `${name}.txt`,
      content: content,
      tasks: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    setActiveFileId(fileId);
    setShowNewFileDialog(false);
    setNewFileName('');
    setCurrentView('files');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      createNewFile(file.name, e.target.result);
    };
    reader.readAsText(file);
    event.target.value = null; 
  };

  const updateFileContent = async (content) => {
    if (!user || !activeFileId) return;
    setLocalContent(content); 
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { content, updatedAt: Date.now() });
  };

  const deleteFile = async (id) => {
    await deleteDoc(doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', id));
    if (activeFileId === id) setActiveFileId(null);
  };

  const addTask = async () => {
    if (!newTaskText.trim() || !activeFile) return;
    const updatedTasks = [...(activeFile.tasks || []), { id: crypto.randomUUID(), text: newTaskText, completed: false }];
    await updateDoc(doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId), { tasks: updatedTasks });
    setNewTaskText('');
  };

  const toggleTask = async (taskId) => {
    const updatedTasks = activeFile.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    await updateDoc(doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId), { tasks: updatedTasks });
  };

  const removeTask = async (taskId) => {
    const updatedTasks = activeFile.tasks.filter(t => t.id !== taskId);
    await updateDoc(doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId), { tasks: updatedTasks });
  };

  const calculateProgress = (file) => {
    if (!file.tasks || file.tasks.length === 0) return 0;
    return Math.round((file.tasks.filter(t => t.completed).length / file.tasks.length) * 100);
  };

  if (isLoadingAuth) return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', position: 'fixed', top: 0, left: 0 }}>
      <Loader2 className="animate-spin text-indigo-600" />
    </div>
  );

  if (!user) return (
    <div 
      className="bg-slate-50 font-sans"
      style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '1.5rem', 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        backgroundColor: '#f8fafc'
      }}
    >
      <div 
        className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-12 text-center border border-slate-100 animate-in fade-in zoom-in duration-500"
        style={{
          backgroundColor: 'white',
          borderRadius: '3rem',
          padding: '3rem',
          maxWidth: '28rem',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3 transform hover:rotate-0 transition-all duration-500">
          <FileText size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-black text-slate-800 mb-4 tracking-tight" style={{ fontSize: '2.25rem', fontWeight: 900, marginBottom: '1rem', color: '#1e293b' }}>TXT Manager</h1>
        <p className="text-slate-500 mb-10 text-lg leading-relaxed" style={{ color: '#64748b', marginBottom: '2.5rem', fontSize: '1.125rem', lineHeight: 1.625 }}>Organize suas notas e tarefas em qualquer lugar com segurança total.</p>
        
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs mb-6 text-left border border-red-100 flex items-start gap-2"><AlertCircle size={14} className="shrink-0 mt-0.5" /><span>{error}</span></div>}

        <button 
          onClick={handleLogin} 
          className="w-full flex items-center justify-center gap-4 bg-white border-2 border-slate-200 py-4 px-6 rounded-2xl font-bold hover:border-indigo-600 transition-all shadow-md active:scale-95 group"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            width: '100%',
            padding: '1rem 1.5rem',
            backgroundColor: 'white',
            border: '2px solid #e2e8f0',
            borderRadius: '1rem',
            fontWeight: 'bold',
            color: '#334155',
            cursor: 'pointer'
          }}
        >
          <GoogleIcon /> <span>Entrar com conta Google</span>
        </button>

        <p className="mt-8 text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]" style={{ marginTop: '2rem', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 900, color: '#94a3b8' }}>Acesso Multi-usuário</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden fixed inset-0">
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-20">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
          <img src={user.photoURL} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
          <div className="flex-1 overflow-hidden">
            <h1 className="text-sm font-bold truncate">{user.displayName}</h1>
            <button onClick={handleLogout} className="text-[10px] text-red-500 font-bold uppercase tracking-widest hover:underline">Sair</button>
          </div>
        </div>

        <div className="p-4 space-y-2 border-b border-slate-50">
          <button 
            onClick={handleSidebarSummaryClick}
            disabled={files.length === 0 || isGenerating}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${
              isGenerating 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : aiSummary 
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:scale-[1.02]'
            }`}
          >
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : (aiSummary ? <BookOpen size={18} /> : <Sparkles size={18} />)}
            {isGenerating ? "Gerando..." : (aiSummary ? "Ver Resumo do Dia" : "Resumo do Dia (IA)")}
          </button>
          
          <button onClick={() => setShowNewFileDialog(true)} className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-100 transition-all text-sm">
            <Plus size={18} /> Novo Documento
          </button>

          <label className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-500 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs cursor-pointer">
            <Upload size={14} /> Importar .txt
            <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 pt-0 space-y-1 custom-scrollbar">
          <div className="text-[10px] font-black text-slate-400 px-2 py-4 uppercase tracking-widest flex justify-between items-center">
            <span>Meus Ficheiros</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">{files.length}</span>
          </div>
          {files.map(file => (
            <div 
              key={file.id} 
              onClick={() => { setActiveFileId(file.id); setCurrentView('files'); }} 
              className={`group flex flex-col p-3 rounded-xl cursor-pointer transition-all ${activeFileId === file.id && currentView === 'files' ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText size={18} className={activeFileId === file.id ? 'text-indigo-500' : 'text-slate-400'} />
                  <span className="truncate font-medium text-sm">{file.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
              </div>
              {file.tasks?.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 transition-all duration-500" style={{ width: `${calculateProgress(file)}%` }} />
                  </div>
                  <span className="text-[8px] font-bold opacity-60">{calculateProgress(file)}%</span>
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 text-red-600 px-6 py-3 rounded-2xl shadow-xl border border-red-100 flex items-center gap-3">
            <AlertCircle size={18} />
            <span className="text-sm font-bold">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-full"><X size={14}/></button>
          </div>
        )}

        {currentView === 'ai-summary' ? (
          <div className="flex-1 overflow-hidden p-6 md:p-12 bg-indigo-50/10 flex justify-center h-full">
            <div className="max-w-4xl w-full bg-white rounded-[3rem] shadow-xl border border-indigo-50 flex flex-col h-full overflow-hidden">
              <div className="p-8 md:p-12 pb-6 border-b border-indigo-50 shrink-0">
                <button onClick={() => setCurrentView('files')} className="mb-6 flex items-center gap-2 text-indigo-600 font-bold hover:-translate-x-1 transition-transform group text-sm">
                  <ChevronLeft size={18} className="group-hover:scale-110" /> Voltar para Arquivos
                </button>
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-100 transform -rotate-3 shrink-0"><Brain size={42} /></div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Resumo do Dia</h2>
                      <p className="text-slate-400 font-medium italic mt-1 text-sm md:text-base">Análise inteligente automatizada</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {/* BOTÃO OUVIR */}
                    {aiSummary && (
                      <button 
                        onClick={() => toggleAudio()}
                        disabled={isGeneratingAudio}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                          isPlaying 
                            ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {isGeneratingAudio ? <Loader2 size={14} className="animate-spin" /> : isPlaying ? <><Pause size={14} /> Pausar</> : <><Volume2 size={14} /> Ouvir</>}
                      </button>
                    )}
                    {/* BOTÃO GERAR ÁUDIO */}
                    {!audioUrl && aiSummary && (
                      <button 
                        onClick={() => generateAudio(aiSummary)}
                        disabled={isGeneratingAudio}
                        className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
                      >
                        {isGeneratingAudio ? "Criando..." : "Criar Áudio"}
                      </button>
                    )}
                    <button 
                      onClick={() => generateAISummary(files, true)}
                      className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                    >
                      <RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} />
                      Regenerar
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 md:p-12 pt-6 custom-scrollbar">
                {isGenerating ? (
                  <div className="space-y-8 py-4"><div className="h-4 bg-slate-100 rounded-full w-3/4 animate-pulse"></div><div className="h-4 bg-slate-100 rounded-full w-full animate-pulse"></div><div className="h-64 bg-slate-50 rounded-[2.5rem] animate-pulse"></div></div>
                ) : aiSummary ? (
                  <div className="prose prose-indigo max-w-none text-slate-700 leading-relaxed font-sans bg-indigo-50/20 p-8 md:p-10 rounded-[2.5rem] border border-indigo-100/50 whitespace-pre-wrap shadow-inner break-words">{aiSummary}</div>
                ) : (
                  <div className="text-center py-32"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200"><Sparkles size={40} /></div><p className="text-slate-400 font-medium">Nada para mostrar hoje ainda.</p></div>
                )}
                <div className="mt-12 pt-8 border-t border-slate-100 text-center pb-8"><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">IA Recorrente Ativa</p></div>
              </div>
            </div>
          </div>
        ) : activeFile ? (
          <>
            <header className="h-20 border-b border-slate-100 px-8 flex items-center justify-between bg-white/80 backdrop-blur-md shadow-sm z-10 shrink-0">
              <div className="flex flex-col">
                <div className="flex items-center gap-3"><h2 className="text-xl font-bold text-slate-800">{activeFile.name}</h2><span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded text-[10px] text-emerald-700 font-black uppercase tracking-tighter border border-emerald-100"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>Sincronizado</span></div>
                <div className="flex items-center gap-3 mt-1.5"><div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-1000 ease-out" style={{ width: `${calculateProgress(activeFile)}%` }} /></div><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{calculateProgress(activeFile)}% concluído</span></div>
              </div>
              <button onClick={() => setIsEditing(!isEditing)} className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-md active:scale-95 ${isEditing ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{isEditing ? <><Save size={18}/> Salvar</> : <><Edit3 size={18}/> Editar Conteúdo</>}</button>
            </header>
            <div className="flex-1 flex overflow-hidden h-full">
              <div className="flex-1 p-8 overflow-hidden flex flex-col bg-white">
                <div className="mb-4 flex justify-between items-center shrink-0"><h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Área de Escrita</h3>{isEditing && <span className="text-[10px] font-black text-amber-500 animate-pulse tracking-widest bg-amber-50 px-2 py-1 rounded">MODO DE EDIÇÃO</span>}</div>
                {isEditing ? (
                  <textarea className="flex-1 p-8 border border-slate-100 rounded-[2.5rem] bg-slate-50/50 font-mono text-sm leading-relaxed outline-none focus:ring-4 focus:ring-indigo-50 transition-all resize-none shadow-inner" value={localContent} onFocus={() => { isTypingRef.current = true; }} onBlur={() => { isTypingRef.current = false; }} onChange={(e) => updateFileContent(e.target.value)} placeholder="Comece a escrever..." />
                ) : (
                  <div className="flex-1 p-10 bg-slate-50/30 rounded-[3rem] overflow-y-auto border border-slate-100 whitespace-pre-wrap text-slate-700 font-mono text-sm leading-relaxed shadow-inner custom-scrollbar border-dashed">{activeFile.content || <span className="text-slate-300 italic opacity-50">Documento vazio.</span>}</div>
                )}
              </div>
              <div className="w-96 bg-slate-50/50 p-8 flex flex-col overflow-hidden border-l border-slate-100">
                <div className="mb-8 shrink-0"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Minhas Tarefas</h3><div className="flex gap-2"><input type="text" className="flex-1 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-300 transition-all shadow-sm" placeholder="Nova tarefa..." value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} /><button onClick={addTask} className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"><Plus size={24} /></button></div></div>
                <div className="space-y-2.5 overflow-y-auto custom-scrollbar flex-1 pr-2">
                  {activeFile.tasks?.map(task => (
                    <div key={task.id} className={`group flex items-center gap-3 p-4 rounded-2xl border transition-all ${task.completed ? 'bg-emerald-50/40 border-emerald-100 text-slate-400' : 'bg-white border-slate-200 text-slate-700 shadow-sm hover:border-indigo-200'}`}>
                      <button onClick={() => toggleTask(task.id)} className="shrink-0 transition-transform active:scale-75">{task.completed ? <CheckCircle2 size={24} className="text-emerald-500" /> : <Square size={24} className="text-slate-200 group-hover:text-indigo-400" />}</button>
                      <span className={`text-sm flex-1 leading-snug font-medium ${task.completed ? 'line-through opacity-60' : ''}`}>{task.text}</span>
                      <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"><X size={16} /></button>
                    </div>
                  ))}
                  {(!activeFile.tasks || activeFile.tasks.length === 0) && <div className="text-center py-10 text-slate-300 italic text-xs">Sem tarefas vinculadas.</div>}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center bg-slate-50/20 h-full w-full overflow-hidden">
            <div className="w-32 h-32 bg-white rounded-[3rem] flex items-center justify-center mb-10 shadow-xl shadow-slate-200/50 rotate-3 border border-slate-100 group hover:rotate-0 transition-all duration-500"><Cloud size={64} className="text-indigo-500 group-hover:scale-110 transition-transform" /></div>
            <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">Olá, {user.displayName?.split(' ')[0]}!</h2>
            <p className="max-w-md text-slate-500 leading-relaxed text-lg font-medium text-center">Seus documentos estão seguros. No seu primeiro acesso do dia, a IA gera automaticamente seu resumo matinal.</p>
          </div>
        )}
      </main>

      {showNewFileDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[3rem] p-12 w-full max-w-md shadow-2xl border border-slate-100">
            <h3 className="text-3xl font-black text-slate-800 mb-8 text-center tracking-tighter">Criar Novo TXT</h3>
            <input autoFocus type="text" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-lg outline-none mb-10 focus:ring-4 focus:ring-indigo-100 transition-all shadow-inner" placeholder="Ex: Projeto_Viagem.txt" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createNewFile(newFileName)} />
            <div className="flex gap-4"><button onClick={() => setShowNewFileDialog(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all">Cancelar</button><button onClick={() => createNewFile(newFileName)} className="flex-1 py-4 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95">Criar Arquivo</button></div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        html, body, #root { height: 100vh !important; width: 100vw !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; position: fixed !important; top: 0; left: 0; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        .break-words { overflow-wrap: break-word; }
      `}} />
    </div>
  );
}
