import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Upload, Trash2, Save, CheckSquare, Square, Edit3, X,
  CheckCircle2, Clock, Cloud, Database, AlertCircle, CheckCircle, LogOut,
  User, ExternalLink, Sparkles, Brain, Loader2, ChevronLeft
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
const apiKey = ""; // Chave provida pelo ambiente

// Ícone do Google SVG
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
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
  const [errorCode, setErrorCode] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // Estados de IA e Visualização
  const [currentView, setCurrentView] = useState('files'); // 'files' ou 'ai-summary'
  const [aiSummary, setAiSummary] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Estados para correção do Cursor
  const [localContent, setLocalContent] = useState('');
  const isTypingRef = useRef(false);

  // Injetar Tailwind para garantir o visual no Vercel
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Firestore Sync
  useEffect(() => {
    if (!user) {
      setFiles([]);
      return;
    }

    const filesRef = collection(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files');
    const unsubscribe = onSnapshot(filesRef, (snapshot) => {
      const filesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFiles(filesData.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (err) => {
      console.error(err);
      if (err.code === 'permission-denied') setError("Permissão negada no banco de dados.");
    });

    return () => unsubscribe();
  }, [user]);

  const activeFile = files.find(f => f.id === activeFileId);

  // Sincroniza conteúdo local apenas quando NÃO está digitando (Correção do Cursor)
  useEffect(() => {
    if (activeFile && !isTypingRef.current) {
      setLocalContent(activeFile.content || '');
    }
  }, [activeFileId, activeFile?.content]);

  // Função para chamar a IA Gemini
  const generateAISummary = async () => {
    if (files.length === 0) return;
    setIsGenerating(true);
    setCurrentView('ai-summary');

    const allContent = files.map(f => {
      const tasks = f.tasks?.map(t => `[${t.completed ? 'Feito' : 'Pendente'}] ${t.text}`).join(', ') || 'Sem tarefas';
      return `Arquivo: ${f.name}\nConteúdo: ${f.content}\nTarefas: ${tasks}`;
    }).join('\n\n---\n\n');

    const systemPrompt = "Você é um mentor de produtividade. Analise os arquivos e tarefas e crie um 'Resumo da Manhã'. 1. Comece com uma saudação motivadora. 2. Liste os 3 tópicos principais que o usuário está focando. 3. Destaque tarefas pendentes urgentes. 4. Dê um conselho prático para o dia. Use Markdown.";
    const userQuery = `Aqui estão meus dados:\n\n${allContent}\n\nFaça meu resumo matinal.`;

    const callGemini = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userQuery }] }],
              systemInstruction: { parts: [{ text: systemPrompt }] }
            })
          });
          const data = await response.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text;
        } catch (err) {
          if (i === retries - 1) throw err;
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
      }
    };

    try {
      const result = await callGemini();
      setAiSummary(result);
    } catch (err) {
      setError("Não foi possível gerar o resumo com a IA agora.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Funções de CRUD
  const handleLogin = async () => {
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setErrorCode(err.code);
      setError(err.code === 'auth/unauthorized-domain' ? "Domínio não autorizado no Firebase." : err.message);
    }
  };

  const handleLogout = () => signOut(auth).then(() => { setActiveFileId(null); setCurrentView('files'); });

  const createNewFile = async (name) => {
    if (!user || !name) return;
    const fileId = crypto.randomUUID();
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', fileId);
    await setDoc(fileRef, {
      name: name.endsWith('.txt') ? name : `${name}.txt`,
      content: "",
      tasks: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    setActiveFileId(fileId);
    setShowNewFileDialog(false);
    setNewFileName('');
    setCurrentView('files');
  };

  const updateFileContent = async (content) => {
    if (!user || !activeFileId) return;
    setLocalContent(content); // Update local instantâneo
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

  // UI Renders
  if (isLoadingAuth) return <div className="h-screen w-screen flex items-center justify-center bg-slate-50 font-sans fixed inset-0"><Loader2 className="animate-spin text-indigo-600" /></div>;

  if (!user) return (
    <div className="h-screen w-screen bg-slate-50 font-sans flex items-center justify-center p-6 fixed inset-0">
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-12 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3"><FileText size={40} className="text-white" /></div>
        <h1 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">TXT Manager</h1>
        <p className="text-slate-500 mb-10 text-lg">Organize suas notas com Inteligência Artificial.</p>
        
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs mb-6 text-left">{error}</div>}

        <button onClick={handleLogin} className="w-full flex items-center justify-center gap-4 bg-white border-2 border-slate-200 py-4 px-6 rounded-2xl font-bold hover:border-indigo-600 transition-all shadow-md active:scale-95">
          <GoogleIcon /> Entrar com Google
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden fixed inset-0">
      {/* SIDEBAR */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-20">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
          <img src={user.photoURL} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
          <div className="flex-1 overflow-hidden">
            <h1 className="text-sm font-bold truncate">{user.displayName}</h1>
            <button onClick={handleLogout} className="text-[10px] text-red-500 font-bold uppercase tracking-widest hover:underline">Sair da Conta</button>
          </div>
        </div>

        <div className="p-4 space-y-2">
          <button 
            onClick={generateAISummary}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${
              isGenerating ? 'bg-indigo-100 text-indigo-400' : 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:scale-[1.02]'
            }`}
          >
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            Resumo Inteligente (IA)
          </button>
          
          <button onClick={() => setShowNewFileDialog(true)} className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm">
            <Plus size={18} /> Novo Arquivo
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 pt-0 space-y-1 custom-scrollbar">
          <div className="text-[10px] font-black text-slate-400 px-2 py-3 uppercase tracking-widest">Meus Ficheiros</div>
          {files.map(file => (
            <div 
              key={file.id} 
              onClick={() => { setActiveFileId(file.id); setCurrentView('files'); }} 
              className={`group flex flex-col p-3 rounded-xl cursor-pointer transition-all ${activeFileId === file.id && currentView === 'files' ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText size={18} className={activeFileId === file.id ? 'text-indigo-500' : 'text-slate-400'} />
                  <span className="truncate font-medium text-sm">{file.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
              </div>
              {file.tasks?.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 transition-all" style={{ width: `${calculateProgress(file)}%` }} />
                  </div>
                  <span className="text-[8px] font-bold">{calculateProgress(file)}%</span>
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
        {currentView === 'ai-summary' ? (
          /* TELA IA */
          <div className="flex-1 overflow-y-auto p-12 bg-indigo-50/20 flex justify-center custom-scrollbar">
            <div className="max-w-3xl w-full bg-white rounded-[3rem] shadow-xl p-12 border border-indigo-100">
              <button onClick={() => setCurrentView('files')} className="mb-8 flex items-center gap-2 text-indigo-600 font-bold hover:-translate-x-1 transition-transform">
                <ChevronLeft size={20} /> Voltar para Arquivos
              </button>
              
              <div className="flex items-center gap-5 mb-10">
                <div className="w-16 h-16 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Brain size={36} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">Resumo Matinal</h2>
                  <p className="text-slate-400 font-medium italic">Análise inteligente das suas anotações</p>
                </div>
              </div>

              {isGenerating ? (
                <div className="space-y-6">
                  <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
                  <div className="h-32 bg-slate-50 rounded-[2rem] animate-pulse"></div>
                </div>
              ) : (
                <div className="prose prose-indigo max-w-none text-slate-700 leading-relaxed font-sans bg-slate-50/50 p-10 rounded-[2.5rem] border border-slate-100 whitespace-pre-wrap">
                  {aiSummary || "Clique em 'Resumo Inteligente' na barra lateral para gerar."}
                </div>
              )}
            </div>
          </div>
        ) : activeFile ? (
          /* TELA EDITOR */
          <>
            <header className="h-20 border-b border-slate-100 px-8 flex items-center justify-between bg-white shadow-sm z-10">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-slate-800">{activeFile.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                   <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${calculateProgress(activeFile)}%` }} />
                   </div>
                   <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{calculateProgress(activeFile)}% completo</span>
                </div>
              </div>
              <button onClick={() => setIsEditing(!isEditing)} className={`px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-md ${isEditing ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {isEditing ? <span className="flex items-center gap-2"><Save size={16}/> Finalizar Edição</span> : <span className="flex items-center gap-2"><Edit3 size={16}/> Editar Texto</span>}
              </button>
            </header>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 p-8 overflow-hidden flex flex-col bg-white">
                {isEditing ? (
                  <textarea 
                    className="flex-1 p-8 border border-slate-100 rounded-[2rem] bg-slate-50/50 font-mono text-sm leading-relaxed outline-none focus:ring-4 focus:ring-indigo-100 transition-all resize-none" 
                    value={localContent} 
                    onFocus={() => { isTypingRef.current = true; }} 
                    onBlur={() => { isTypingRef.current = false; }} 
                    onChange={(e) => updateFileContent(e.target.value)} 
                  />
                ) : (
                  <div className="flex-1 p-10 bg-slate-50/30 rounded-[2.5rem] overflow-y-auto border border-slate-100 whitespace-pre-wrap text-slate-700 font-mono text-sm leading-relaxed shadow-inner custom-scrollbar">
                    {activeFile.content || <span className="text-slate-300 italic">Vazio. Clique em Editar para escrever.</span>}
                  </div>
                )}
              </div>
              <div className="w-96 bg-slate-50/50 p-8 flex flex-col overflow-hidden border-l border-slate-100">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Minhas Tarefas</h3>
                <div className="flex gap-2 mb-6">
                  <input type="text" className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-200 transition-all" placeholder="Nova tarefa..." value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
                  <button onClick={addTask} className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-md transition-all active:scale-95"><Plus size={22} /></button>
                </div>
                <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
                  {activeFile.tasks?.map(task => (
                    <div key={task.id} className={`group flex items-center gap-3 p-4 rounded-2xl border transition-all ${task.completed ? 'bg-emerald-50/30 border-emerald-100 text-slate-400' : 'bg-white border-slate-200 text-slate-700 shadow-sm'}`}>
                      <button onClick={() => toggleTask(task.id)} className="shrink-0">{task.completed ? <CheckCircle2 size={22} className="text-emerald-500" /> : <Square size={22} className="text-slate-300 group-hover:text-indigo-400" />}</button>
                      <span className={`text-sm flex-1 leading-tight ${task.completed ? 'line-through' : 'font-medium'}`}>{task.text}</span>
                      <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center bg-slate-50/20 h-full w-full">
            <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl shadow-slate-200/50 rotate-6"><Cloud size={64} className="text-indigo-200" /></div>
            <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Bem-vindo, {user.displayName?.split(' ')[0]}</h2>
            <p className="max-w-md text-slate-500 leading-relaxed text-lg">Suas notas estão sincronizadas com sua conta Google. Selecione um arquivo ou gere seu resumo inteligente.</p>
          </div>
        )}
      </main>

      {/* MODAL */}
      {showNewFileDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-12 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-slate-800 mb-6 text-center">Novo Documento</h3>
            <input autoFocus type="text" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-lg outline-none mb-8 focus:ring-4 focus:ring-indigo-100 transition-all" placeholder="Nome do arquivo..." value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createNewFile(newFileName)} />
            <div className="flex gap-4">
              <button onClick={() => setShowNewFileDialog(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all">Cancelar</button>
              <button onClick={() => createNewFile(newFileName)} className="flex-1 py-4 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100 transition-all">Criar Agora</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        html, body, #root { height: 100vh !important; width: 100vw !important; margin: 0 !important; overflow: hidden !important; position: fixed !important; top: 0; left: 0; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}} />
    </div>
  );
}
