import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  Upload, 
  Trash2, 
  Save, 
  CheckSquare, 
  Square, 
  Edit3, 
  X,
  CheckCircle2,
  Clock,
  Cloud,
  Database,
  AlertCircle,
  CheckCircle,
  LogOut,
  LogIn,
  User
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  deleteDoc, 
  updateDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut
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

// Inicialização das instâncias
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const PROJECT_ID = 'my-txt-manager';

export default function App() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [showAdminView, setShowAdminView] = useState(false);
  const [error, setError] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // Estado local para evitar o pulo do cursor no textarea
  const [localContent, setLocalContent] = useState('');
  const isTypingRef = useRef(false);

  // INJETOR DE ESTILO (Para garantir o visual no Vercel/GitHub)
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  // 1. Monitoramento do Estado de Autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sincronização Firestore (Baseada no UID do Usuário Logado)
  useEffect(() => {
    if (!user) {
      setFiles([]);
      return;
    }

    const filesRef = collection(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files');
    
    const unsubscribe = onSnapshot(filesRef, (snapshot) => {
      const filesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFiles(filesData.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (err) => {
      console.error("Erro na sincronização Firestore:", err);
      if (err.code === 'permission-denied') {
        setError("Permissão negada no Firestore. Verifica se configuraste as regras do banco de dados.");
      }
    });

    return () => unsubscribe();
  }, [user]);

  const activeFile = files.find(f => f.id === activeFileId);

  // Sincroniza conteúdo local quando muda de arquivo ou quando não está digitando
  useEffect(() => {
    if (activeFile && !isTypingRef.current) {
      setLocalContent(activeFile.content || '');
    }
  }, [activeFileId, activeFile?.content]);

  // Ações de Autenticação
  const handleLogin = async () => {
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Erro no login:", err);
      setError("Falha ao entrar com Google. Verifique se os popups estão permitidos.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveFileId(null);
    } catch (err) {
      console.error("Erro no logout:", err);
    }
  };

  // Funções de Gerenciamento de Arquivos
  const createNewFile = async (name, content = "") => {
    if (!user || !name) return;
    const fileId = crypto.randomUUID();
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', fileId);
    
    try {
      await setDoc(fileRef, {
        name: name.endsWith('.txt') ? name : `${name}.txt`,
        content: content,
        tasks: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ownerEmail: user.email
      });
      setActiveFileId(fileId);
      setShowNewFileDialog(false);
      setNewFileName('');
    } catch (err) {
      console.error("Erro ao criar ficheiro:", err);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      createNewFile(file.name, e.target.result);
    };
    reader.readAsText(file);
  };

  const updateFileContent = async (content) => {
    if (!user || !activeFileId) return;
    setLocalContent(content);
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    try {
      await updateDoc(fileRef, { content, updatedAt: Date.now() });
    } catch (err) {
      console.error("Erro ao atualizar:", err);
    }
  };

  const deleteFile = async (id) => {
    if (!user) return;
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', id);
    try {
      await deleteDoc(fileRef);
      if (activeFileId === id) setActiveFileId(null);
    } catch (err) {
      console.error("Erro ao eliminar ficheiro:", err);
    }
  };

  const addTask = async () => {
    if (!newTaskText.trim() || !activeFile) return;
    const updatedTasks = [...activeFile.tasks, { id: crypto.randomUUID(), text: newTaskText, completed: false }];
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });
    setNewTaskText('');
  };

  const toggleTask = async (taskId) => {
    if (!activeFile) return;
    const updatedTasks = activeFile.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });
  };

  const removeTask = async (taskId) => {
    if (!activeFile) return;
    const updatedTasks = activeFile.tasks.filter(t => t.id !== taskId);
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });
  };

  const calculateProgress = (file) => {
    if (!file.tasks || file.tasks.length === 0) return 0;
    const completed = file.tasks.filter(t => t.completed).length;
    return Math.round((completed / file.tasks.length) * 100);
  };

  const completedLists = files.filter(f => f.tasks && f.tasks.length > 0 && f.tasks.every(t => t.completed));

  // Tela de Carregamento Inicial
  if (isLoadingAuth) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-sans">
        <div className="flex flex-col items-center gap-4 text-indigo-600">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="font-bold tracking-widest animate-pulse uppercase">Iniciando...</div>
        </div>
      </div>
    );
  }

  // Tela de Login (Landing Page)
  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-sans p-6">
        <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-12 text-center border border-slate-100">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3 transform hover:rotate-0 transition-all duration-500">
            <FileText size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">TXT Manager</h1>
          <p className="text-slate-500 mb-10 leading-relaxed">
            Organize suas notas e tarefas em qualquer lugar. Seus arquivos são salvos na nuvem com segurança.
          </p>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm mb-6 border border-red-100 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-indigo-600 text-slate-700 py-4 px-6 rounded-2xl font-bold transition-all shadow-sm hover:shadow-indigo-50 active:scale-95 group"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" alt="Google" className="w-6 h-6" />
            <span>Entrar com Google</span>
          </button>
          
          <p className="mt-8 text-[10px] text-slate-400 uppercase font-bold tracking-widest">Acesso Multi-usuário Seguro</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Barra Lateral */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm">
        {/* Perfil do Usuário */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
          <div className="relative group">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
            ) : (
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600"><User size={20} /></div>
            )}
            <button 
              onClick={handleLogout}
              className="absolute -top-1 -right-1 bg-white p-1 rounded-full shadow-md text-slate-400 hover:text-red-500 hover:scale-110 transition-all"
              title="Sair"
            >
              <LogOut size={12} />
            </button>
          </div>
          <div className="flex flex-col overflow-hidden">
            <h1 className="text-sm font-bold text-slate-800 truncate">{user.displayName || 'Usuário'}</h1>
            <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-2">
          <button onClick={() => { setShowNewFileDialog(true); setShowAdminView(false); }} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl transition-all shadow-md active:scale-95 font-bold"><Plus size={18} /> Novo Documento</button>
          <label className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-all text-sm font-medium"><Upload size={18} /> Importar .txt<input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" /></label>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 pt-0 space-y-1 custom-scrollbar">
          <div className="text-[10px] font-black text-slate-400 px-2 py-3 uppercase tracking-widest">Meus Ficheiros</div>
          {files.map(file => {
            const progress = calculateProgress(file);
            return (
              <div 
                key={file.id} 
                onClick={() => { setActiveFileId(file.id); setShowAdminView(false); }} 
                className={`group flex flex-col p-3 rounded-xl cursor-pointer transition-all ${activeFileId === file.id && !showAdminView ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText size={18} className={activeFileId === file.id ? 'text-indigo-500' : 'text-slate-400'} />
                    <span className="truncate font-medium text-sm">{file.name}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"><Trash2 size={14} /></button>
                </div>
                {file.tasks && file.tasks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-400'}`} 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                    <span className="text-[9px] font-bold opacity-60">{progress}%</span>
                  </div>
                )}
              </div>
            );
          })}
          {files.length === 0 && <p className="text-center text-xs text-slate-300 py-10 italic">Nenhum ficheiro encontrado.</p>}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/30">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-tighter"><CheckCircle2 size={14} /> Concluídos ({completedLists.length})</div>
          <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
            {completedLists.map(list => (<div key={list.id} className="text-xs flex items-center gap-2 text-emerald-600 font-medium bg-emerald-50 p-2 rounded-lg border border-emerald-100"><CheckCircle2 size={12} /> <span className="truncate">{list.name}</span></div>))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-white overflow-hidden">
        {activeFile ? (
          <>
            <header className="h-20 border-b border-slate-100 px-6 flex items-center justify-between shrink-0 bg-white shadow-sm z-10">
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-800">{activeFile.name}</h2>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded border border-emerald-100"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div><span className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest">Sincronizado</span></div>
                </div>
                {activeFile.tasks && activeFile.tasks.length > 0 && (
                  <div className="flex items-center gap-3 mt-1">
                    <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-700" 
                        style={{ width: `${calculateProgress(activeFile)}%` }} 
                      />
                    </div>
                    <span className="text-[11px] font-bold text-indigo-600">{calculateProgress(activeFile)}% concluído</span>
                  </div>
                )}
              </div>
              <button onClick={() => setIsEditing(!isEditing)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${isEditing ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{isEditing ? <><Save size={16} /> Gravar</> : <><Edit3 size={16} /> Editar Texto</>}</button>
            </header>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col p-6 overflow-hidden border-r border-slate-50">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Documento</h3>
                  {isEditing && <span className="text-[10px] text-amber-500 font-bold animate-pulse">MODO DE EDIÇÃO ATIVO</span>}
                </div>
                {isEditing ? (
                  <textarea 
                    className="flex-1 w-full p-6 border border-slate-200 rounded-3xl bg-slate-50/30 focus:ring-4 focus:ring-indigo-50 outline-none resize-none font-mono text-sm leading-relaxed transition-all" 
                    value={localContent} 
                    onFocus={() => { isTypingRef.current = true; }}
                    onBlur={() => { isTypingRef.current = false; }}
                    onChange={(e) => updateFileContent(e.target.value)} 
                  />
                ) : (
                  <div className="flex-1 w-full p-8 bg-white rounded-3xl overflow-y-auto border border-slate-100 whitespace-pre-wrap text-slate-700 font-mono text-sm leading-relaxed shadow-inner custom-scrollbar">{activeFile.content || <span className="text-slate-300 italic">Este ficheiro está vazio.</span>}</div>
                )}
              </div>
              <div className="w-96 bg-slate-50/50 p-6 flex flex-col overflow-hidden">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 font-sans flex items-center justify-between">
                  <span>Lista de Tarefas</span>
                  {calculateProgress(activeFile) === 100 && <CheckCircle size={14} className="text-emerald-500" />}
                </h3>
                <div className="flex gap-2 mb-6">
                  <input type="text" className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none shadow-sm focus:ring-2 focus:ring-indigo-100 font-sans" placeholder="Nova tarefa..." value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
                  <button onClick={addTask} className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-md transition-all active:scale-95"><Plus size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {activeFile.tasks.map(task => (
                    <div key={task.id} className={`group flex items-center gap-3 p-4 rounded-2xl border transition-all ${task.completed ? 'bg-emerald-50/30 border-emerald-100 text-slate-400' : 'bg-white border-slate-200 text-slate-700 shadow-sm'}`}>
                      <button onClick={() => toggleTask(task.id)} className={`shrink-0 ${task.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-400'}`}>{task.completed ? <CheckSquare size={22} /> : <Square size={22} />}</button>
                      <span className={`flex-1 text-sm ${task.completed ? 'line-through' : 'font-medium font-sans'}`}>{task.text}</span>
                      <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center bg-slate-50/20 font-sans">
            <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-slate-200/50"><Cloud size={48} className="text-indigo-100" /></div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Seus arquivos em {user.displayName}</h2>
            <p className="max-w-md text-sm text-slate-500 leading-relaxed">Selecione um ficheiro à esquerda ou crie um novo. Suas notas são exclusivas para sua conta do Google.</p>
          </div>
        )}
      </main>

      {showNewFileDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-black text-slate-800 mb-2 text-center">Novo TXT</h3>
            <p className="text-sm text-slate-500 mb-8 text-center leading-relaxed">Nome do documento para sincronizar.</p>
            <input autoFocus type="text" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-lg outline-none focus:ring-4 focus:ring-indigo-100 mb-8 transition-all" placeholder="Ex: Metas_2025.txt" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createNewFile(newFileName)} />
            <div className="flex gap-4">
              <button onClick={() => setShowNewFileDialog(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all">Cancelar</button>
              <button onClick={() => createNewFile(newFileName)} className="flex-1 py-4 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100 active:scale-95 transition-all">Criar Ficheiro</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        html, body, #root {
          height: 100% !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
}
