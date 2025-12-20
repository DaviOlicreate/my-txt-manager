import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Upload, Trash2, Save, CheckSquare, Square, Edit3, X,
  CheckCircle2, Clock, Cloud, Database, AlertCircle, CheckCircle, LogOut,
  User, ExternalLink, Sparkles, Brain, Calendar, ChevronRight, Loader2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, updateDoc, getDoc
} from 'firebase/firestore';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from 'firebase/auth';

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAvOICZLA1RFRDssU9XSRJhxVEDfp-TavA",
  authDomain: "produtividade-txt.firebaseapp.com",
  projectId: "produtividade-txt",
  storageBucket: "produtividade-txt.firebasestorage.app",
  messagingSenderId: "1008823595372",
  appId: "1:1008823595372:web:e2859447c5323c7062c349"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const PROJECT_ID = 'my-txt-manager';
const apiKey = ""; // A chave será provida pelo ambiente de execução

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
  const [currentView, setCurrentView] = useState('files'); // 'files' ou 'ai-summary'
  
  // Estados da IA
  const [aiSummary, setAiSummary] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [localContent, setLocalContent] = useState('');
  const isTypingRef = useRef(false);

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
      setAiSummary(null);
      return;
    }

    const filesRef = collection(db, 'artifacts', PROJECT_ID, 'users', user.uid, 'files');
    const unsubscribe = onSnapshot(filesRef, (snapshot) => {
      const filesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFiles(filesData.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (err) => {
      console.error(err);
      setError("Erro ao carregar dados do Firestore.");
    });

    // Carregar último resumo salvo do dia
    const summaryRef = doc(db, 'artifacts', PROJECT_ID, 'users', user.uid, 'ai-data', 'daily-summary');
    getDoc(summaryRef).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const today = new Date().toLocaleDateString();
        if (data.date === today) {
          setAiSummary(data.text);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  const activeFile = files.find(f => f.id === activeFileId);

  useEffect(() => {
    if (activeFile && !isTypingRef.current) {
      setLocalContent(activeFile.content || '');
    }
  }, [activeFileId, activeFile?.content]);

  // Chamada à API do Gemini para gerar o resumo
  const generateAISummary = async () => {
    if (files.length === 0) return;
    setIsGenerating(true);
    setCurrentView('ai-summary');

    // Preparar o contexto para a IA
    const allNotesContext = files.map(f => {
      const tasksStr = f.tasks?.map(t => `[${t.completed ? 'X' : ' '}] ${t.text}`).join(', ') || 'Nenhuma tarefa';
      return `ARQUIVO: ${f.name}\nCONTEÚDO: ${f.content}\nTAREFAS: ${tasksStr}`;
    }).join('\n\n---\n\n');

    const systemPrompt = "Você é um Assistente de Produtividade Pessoal. Analise todas as notas e tarefas do usuário fornecidas e crie um resumo matinal executável. O resumo deve ter: 1. Uma saudação motivadora. 2. Os principais tópicos das notas. 3. O que falta concluir com urgência. 4. Uma dica de produtividade baseada no que ele escreveu. Use Markdown para formatar.";
    
    const userQuery = `Aqui estão meus arquivos e tarefas atuais:\n\n${allNotesContext}\n\nPor favor, gere meu resumo matinal.`;

    const fetchWithRetry = async (retries = 5, delay = 1000) => {
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
          if (!response.ok) throw new Error('Falha na API');
          const data = await response.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text;
        } catch (err) {
          if (i === retries - 1) throw err;
          await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
        }
      }
    };

    try {
      const text = await fetchWithRetry();
      if (text) {
        setAiSummary(text);
        // Salvar resumo no Firestore para o dia
        const summaryRef = doc(db, 'artifacts', PROJECT_ID, 'users', user.uid, 'ai-data', 'daily-summary');
        await setDoc(summaryRef, {
          text: text,
          date: new Date().toLocaleDateString(),
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error(err);
      setError("A IA não conseguiu processar suas notas agora. Tente novamente em instantes.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (err) { setError("Falha no login com Google."); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setActiveFileId(null);
  };

  const createNewFile = async (name) => {
    if (!user || !name) return;
    const fileId = crypto.randomUUID();
    const fileRef = doc(db, 'artifacts', PROJECT_ID, 'users', user.uid, 'files', fileId);
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
    setLocalContent(content);
    const fileRef = doc(db, 'artifacts', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { content, updatedAt: Date.now() });
  };

  const deleteFile = async (id) => {
    const fileRef = doc(db, 'artifacts', PROJECT_ID, 'users', user.uid, 'files', id);
    await deleteDoc(fileRef);
    if (activeFileId === id) setActiveFileId(null);
  };

  const addTask = async () => {
    if (!newTaskText.trim() || !activeFile) return;
    const updatedTasks = [...activeFile.tasks, { id: crypto.randomUUID(), text: newTaskText, completed: false }];
    const fileRef = doc(db, 'artifacts', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });
    setNewTaskText('');
  };

  const toggleTask = async (taskId) => {
    const updatedTasks = activeFile.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    const fileRef = doc(db, 'artifacts', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });
  };

  const removeTask = async (taskId) => {
    const updatedTasks = activeFile.tasks.filter(t => t.id !== taskId);
    const fileRef = doc(db, 'artifacts', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });
  };

  if (isLoadingAuth) return <div className="h-screen w-screen flex items-center justify-center bg-slate-50 font-sans fixed inset-0">Carregando...</div>;

  if (!user) return (
    <div className="h-screen w-screen bg-slate-50 font-sans flex items-center justify-center p-6 fixed inset-0">
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-12 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3"><FileText size={40} className="text-white" /></div>
        <h1 className="text-4xl font-black text-slate-800 mb-4">TXT Manager + AI</h1>
        <p className="text-slate-500 mb-10 text-lg">Suas notas organizadas e resumidas pela IA.</p>
        <button onClick={handleLogin} className="w-full flex items-center justify-center gap-4 bg-white border-2 border-slate-200 py-4 px-6 rounded-2xl font-bold hover:border-indigo-600 transition-all shadow-md active:scale-95">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-6 h-6" /> Entrar com Google
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden fixed inset-0">
      {/* SIDEBAR */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-20">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <img src={user.photoURL} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
          <div className="flex-1 overflow-hidden">
            <h1 className="text-sm font-bold truncate">{user.displayName}</h1>
            <button onClick={handleLogout} className="text-[10px] text-red-500 font-bold uppercase tracking-widest hover:underline">Sair</button>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {/* BOTÃO DA IA */}
          <button 
            onClick={generateAISummary}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 ${
              isGenerating ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed' : 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:shadow-indigo-200'
            }`}
          >
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            Resumo da Manhã (IA)
          </button>
          
          <button onClick={() => setShowNewFileDialog(true)} className="w-full flex items-center justify-center gap-2 bg-slate-100 border border-slate-200 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm">
            <Plus size={18} /> Novo Documento
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 pt-0 space-y-1 custom-scrollbar">
          <div className="text-[10px] font-black text-slate-400 px-2 py-3 uppercase tracking-widest flex justify-between">
            <span>Meus Ficheiros</span>
            <span className="text-indigo-400">{files.length}</span>
          </div>
          {files.map(file => (
            <div 
              key={file.id} 
              onClick={() => { setActiveFileId(file.id); setCurrentView('files'); }} 
              className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${activeFileId === file.id && currentView === 'files' ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText size={18} className={activeFileId === file.id ? 'text-indigo-500' : 'text-slate-400'} />
                <span className="truncate font-medium text-sm">{file.name}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg"><Trash2 size={14} /></button>
            </div>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
        {currentView === 'ai-summary' ? (
          /* TELA DO RESUMO IA */
          <div className="flex-1 overflow-y-auto p-12 bg-slate-50/50 flex justify-center">
            <div className="max-w-3xl w-full bg-white rounded-[3rem] shadow-xl p-10 border border-indigo-50">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Brain size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Seu Brainstorming Inteligente</h2>
                  <p className="text-sm text-slate-400 font-medium">Análise completa baseada em {files.length} arquivos</p>
                </div>
              </div>

              {isGenerating ? (
                <div className="space-y-6 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-100 rounded w-full"></div>
                  <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                  <div className="h-32 bg-slate-50 rounded-2xl"></div>
                </div>
              ) : aiSummary ? (
                <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap font-sans bg-indigo-50/20 p-8 rounded-[2rem] border border-indigo-50/50">
                  {aiSummary}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-400">
                  <Sparkles size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Nada resumido hoje. Clique em "Resumo da Manhã" para começar.</p>
                </div>
              )}
              
              <div className="mt-10 pt-10 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>INTELIGÊNCIA ARTIFICIAL ATIVA</span>
                <span>MODELO: GEMINI 2.5 FLASH</span>
              </div>
            </div>
          </div>
        ) : activeFile ? (
          /* TELA DE NOTAS NORMAL */
          <>
            <header className="h-20 border-b border-slate-100 px-6 flex items-center justify-between bg-white shadow-sm z-10">
              <h2 className="text-lg font-bold text-slate-800">{activeFile.name}</h2>
              <button onClick={() => setIsEditing(!isEditing)} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${isEditing ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{isEditing ? <Save size={16} /> : <Edit3 size={16} />}</button>
            </header>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 p-6 overflow-hidden flex flex-col">
                {isEditing ? (
                  <textarea className="flex-1 p-6 border border-slate-200 rounded-3xl bg-slate-50/30 font-mono text-sm leading-relaxed outline-none focus:ring-4 focus:ring-indigo-50" value={localContent} onFocus={() => { isTypingRef.current = true; }} onBlur={() => { isTypingRef.current = false; }} onChange={(e) => updateFileContent(e.target.value)} />
                ) : (
                  <div className="flex-1 p-8 bg-white rounded-3xl overflow-y-auto border border-slate-100 whitespace-pre-wrap text-slate-700 font-mono text-sm leading-relaxed shadow-inner">{activeFile.content || "Documento vazio."}</div>
                )}
              </div>
              <div className="w-96 bg-slate-50/30 p-6 flex flex-col overflow-hidden border-l border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Tarefas</h3>
                <div className="flex gap-2 mb-6">
                  <input type="text" className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none" placeholder="Nova tarefa..." value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
                  <button onClick={addTask} className="p-3 bg-indigo-600 text-white rounded-2xl"><Plus size={20} /></button>
                </div>
                <div className="space-y-2 overflow-y-auto custom-scrollbar">
                  {activeFile.tasks.map(task => (
                    <div key={task.id} className={`flex items-center gap-3 p-4 rounded-2xl border ${task.completed ? 'bg-emerald-50/30 border-emerald-100 text-slate-400' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <button onClick={() => toggleTask(task.id)}>{task.completed ? <CheckSquare size={22} className="text-emerald-500" /> : <Square size={22} className="text-slate-300" />}</button>
                      <span className={`text-sm ${task.completed ? 'line-through' : 'font-medium'}`}>{task.text}</span>
                      <button onClick={() => removeTask(task.id)} className="ml-auto opacity-0 group-hover:opacity-100"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/20">
            <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl shadow-slate-200/50 rotate-6"><Cloud size={64} className="text-indigo-200" /></div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">Bem-vindo, {user.displayName?.split(' ')[0]}</h2>
            <p className="max-w-md text-slate-500 text-center leading-relaxed">Selecione um arquivo ou gere seu resumo inteligente para começar o dia.</p>
          </div>
        )}
      </main>

      {/* MODAL NOVO ARQUIVO */}
      {showNewFileDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-black text-slate-800 mb-2 text-center">Novo Documento</h3>
            <input autoFocus type="text" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-lg outline-none mb-8 mt-6 focus:ring-4 focus:ring-indigo-50" placeholder="Nome do arquivo..." value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createNewFile(newFileName)} />
            <div className="flex gap-4">
              <button onClick={() => setShowNewFileDialog(false)} className="flex-1 py-4 text-slate-500 font-bold">Cancelar</button>
              <button onClick={() => createNewFile(newFileName)} className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100">Criar Agora</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        html, body, #root { height: 100vh !important; width: 100vw !important; margin: 0 !important; overflow: hidden !important; position: fixed !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
}
